import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Info,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { StudentProfile, StudentSubscription } from '../types/study';
import {
  createSubscriptionOrderApi,
  fetchSubscriptionConfigApi,
  redeemSubscriptionCodeApi,
  verifySubscriptionPaymentApi,
  type SubscriptionConfigResponse,
} from '../utils/api';
import {
  RazorpayCheckoutError,
  loadRazorpayCheckoutScript,
  openRazorpayCheckout,
} from '../utils/razorpay';
import {
  FREE_REFERRAL_CODE,
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PLAN_ID,
  SUBSCRIPTION_PRICE_INR,
  TRIAL_DURATION_DAYS,
  buildActivatedSubscription,
  evaluateReferralCode,
  formatInrAmount,
  getSubscriptionState,
  type ReferralCodeEvaluation,
} from '../utils/subscription';

interface SubscriptionModalProps {
  profile: StudentProfile;
  locked?: boolean;
  onClose?: () => void;
  onSignOut?: () => void;
  onActivated: (subscription: StudentSubscription) => void;
}

const INCLUDED_FEATURES = [
  'Unlimited Buddy AI Tutor — ask syllabus-aligned doubts by text, voice, or photo',
  'Live Combine Study rooms — study with friends using shared timers & room chat',
  'Buddy AI responses in 47+ languages including Malayalam (മലയാളം), Hindi & Tamil',
  'Learning Paths, Study Kit, Exam Revision, YouTube Class, Practice & Planner stay free',
];

type CheckoutPhase = 'idle' | 'creating_order' | 'awaiting_payment' | 'verifying' | 'redeeming';

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  profile,
  locked = false,
  onClose,
  onSignOut,
  onActivated,
}) => {
  const subState = getSubscriptionState(profile.subscription, profile.createdAt);

  const [gatewayConfig, setGatewayConfig] = useState<SubscriptionConfigResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(!subState.isActivePass);
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [justActivatedReceipt, setJustActivatedReceipt] = useState<string | null>(null);
  const [justActivatedViaCode, setJustActivatedViaCode] = useState<string | null>(null);

  // Referral / Discount code state
  const [codeInput, setCodeInput] = useState('');
  const [appliedReferral, setAppliedReferral] = useState<ReferralCodeEvaluation | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (subState.isActivePass) {
      setIsLoadingConfig(false);
      return;
    }

    let cancelled = false;
    setIsLoadingConfig(true);

    fetchSubscriptionConfigApi()
      .then((cfg) => {
        if (cancelled) return;
        setGatewayConfig(cfg);
        if (cfg.configured) {
          loadRazorpayCheckoutScript().catch(() => {
            // Will retry with explicit error message if user initiates checkout
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setGatewayConfig({
          provider: 'razorpay',
          configured: false,
          planId: SUBSCRIPTION_PLAN_ID,
          amountInr: SUBSCRIPTION_PRICE_INR,
          amountPaise: SUBSCRIPTION_PRICE_INR * 100,
          currency: 'INR',
          durationYears: 7,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [subState.isActivePass]);

  const isBusy = phase !== 'idle';
  const isFreeWithCode = Boolean(appliedReferral?.valid && appliedReferral.isFree);
  const payableAmountInr = isFreeWithCode ? 0 : SUBSCRIPTION_PRICE_INR;
  const approxPerYearInr = Math.round(SUBSCRIPTION_PRICE_INR / SUBSCRIPTION_DURATION_YEARS);

  const handleApplyReferralCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setAppliedReferral(null);
      setCodeError('Enter a referral or discount code to apply.');
      return;
    }

    const evaluation = evaluateReferralCode(trimmed);
    if (evaluation.valid && evaluation.isFree) {
      setAppliedReferral(evaluation);
      setCodeInput(evaluation.normalizedCode);
      setCodeError(null);
    } else {
      setAppliedReferral(null);
      setCodeError(evaluation.message);
    }
  };

  const handleRemoveReferralCode = () => {
    setAppliedReferral(null);
    setCodeInput('');
    setCodeError(null);
    setError(null);
  };

  const handleRedeemFreeCode = async () => {
    if (!appliedReferral?.valid || !appliedReferral.isFree) return;
    setError(null);
    setNotice(null);
    setPhase('redeeming');

    try {
      const receipt = await redeemSubscriptionCodeApi({
        studentId: profile.id,
        studentName: profile.name,
        code: appliedReferral.normalizedCode,
      });

      const activated = buildActivatedSubscription(
        profile.subscription,
        {
          subscribedAt: receipt.subscribedAt,
          expiresAt: receipt.expiresAt,
          paymentMethod: receipt.paymentMethod,
          receiptId: receipt.receiptId,
          amountInr: receipt.amountInr,
          referralCode: receipt.referralCode || FREE_REFERRAL_CODE,
        },
        profile.createdAt
      );

      setJustActivatedReceipt(receipt.receiptId);
      setJustActivatedViaCode(receipt.referralCode || FREE_REFERRAL_CODE);
      onActivated(activated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to apply referral code right now. Please try again.'
      );
    } finally {
      setPhase('idle');
    }
  };

  const handleRazorpayCheckout = async () => {
    if (isFreeWithCode) {
      await handleRedeemFreeCode();
      return;
    }

    setError(null);
    setNotice(null);
    setPhase('creating_order');

    try {
      const [order] = await Promise.all([
        createSubscriptionOrderApi({
          studentId: profile.id,
          studentName: profile.name,
        }),
        loadRazorpayCheckoutScript(),
      ]);

      setPhase('awaiting_payment');

      const rpResponse = await openRazorpayCheckout({
        key: order.razorpayKeyId,
        amount: order.amountPaise,
        currency: 'INR',
        name: 'Pathwise',
        description: `7-Year Scholar Pass (₹${SUBSCRIPTION_PRICE_INR} one-time)`,
        order_id: order.orderId,
        prefill: {
          name: profile.name,
          email: profile.email || undefined,
        },
        notes: {
          planId: order.planId,
          durationYears: String(order.durationYears),
        },
        theme: {
          color: '#0284C7',
        },
      });

      setPhase('verifying');

      const receipt = await verifySubscriptionPaymentApi({
        orderId: rpResponse.razorpay_order_id || order.orderId,
        orderToken: order.orderToken,
        studentId: profile.id,
        razorpayPaymentId: rpResponse.razorpay_payment_id,
        razorpaySignature: rpResponse.razorpay_signature,
      });

      const activated = buildActivatedSubscription(
        profile.subscription,
        {
          subscribedAt: receipt.subscribedAt,
          expiresAt: receipt.expiresAt,
          paymentMethod: receipt.paymentMethod,
          receiptId: receipt.receiptId,
          amountInr: receipt.amountInr,
        },
        profile.createdAt
      );

      setJustActivatedReceipt(receipt.receiptId);
      setJustActivatedViaCode(null);
      onActivated(activated);
    } catch (err) {
      if (err instanceof RazorpayCheckoutError && err.code === 'CANCELLED') {
        setNotice('Razorpay checkout was closed. No amount was charged.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to complete Razorpay checkout right now. Please try again.'
        );
      }
    } finally {
      setPhase('idle');
    }
  };

  const buttonLabel =
    phase === 'redeeming'
      ? 'Activating Free Pass...'
      : phase === 'creating_order'
        ? 'Opening Razorpay...'
        : phase === 'awaiting_payment'
          ? 'Complete Payment in Razorpay...'
          : phase === 'verifying'
            ? 'Verifying Payment...'
            : isFreeWithCode
              ? `Activate Free ${SUBSCRIPTION_DURATION_YEARS}-Year Pass (₹0.00)`
              : `Pay ₹${SUBSCRIPTION_PRICE_INR} with Razorpay`;

  const isRazorpayReady = Boolean(gatewayConfig?.configured);
  const canProceed = isFreeWithCode || (!isLoadingConfig && isRazorpayReady);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden my-auto">
        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-5 bg-[#F8FAFC] dark:bg-slate-950/60">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0284C7] dark:text-sky-400">
              Pathwise Student Membership
            </p>
            <h2
              id="subscription-modal-title"
              className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100"
            >
              {subState.isActivePass
                ? '7-Year Scholar Pass Active'
                : locked
                  ? 'Your 1-Month Free Trial Has Ended'
                  : `7-Year Scholar Pass — ₹${SUBSCRIPTION_PRICE_INR} One-Time`}
            </h2>
          </div>

          {!locked && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close subscription dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Active Pass Receipt View */}
          {subState.isActivePass ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 p-5 flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-emerald-950 dark:text-emerald-200">
                    {justActivatedReceipt
                      ? justActivatedViaCode
                        ? `Code ${justActivatedViaCode} Applied — 7-Year Scholar Pass Unlocked!`
                        : 'Razorpay Payment Verified — 7-Year Scholar Pass Unlocked!'
                      : 'Your 7-Year Scholar Pass is Active'}
                  </h3>
                  <p className="text-sm text-emerald-900 dark:text-emerald-300">
                    Unlimited access to <strong>Combine Study</strong> and <strong>Buddy AI</strong>{' '}
                    (plus all free Pathwise study tools) until{' '}
                    <strong>{subState.passExpiryDateLabel}</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Amount Paid</p>
                  <p
                    data-testid="subscription-receipt-amount"
                    className="mt-1 font-mono text-lg font-semibold text-[#0F172A] dark:text-slate-100"
                  >
                    {formatInrAmount(subState.subscription.amountInr)} · {SUBSCRIPTION_DURATION_YEARS} Years
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Valid Until</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                    {subState.passExpiryDateLabel || '7 Years'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Receipt ID</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-[#0F172A] dark:text-slate-100 truncate">
                    {subState.subscription.receiptId || justActivatedReceipt || 'Verified'}
                  </p>
                  {subState.subscription.paymentMethod && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {subState.subscription.paymentMethod}
                    </p>
                  )}
                </div>
              </div>

              {onClose && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    Continue Studying
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Checkout / Referral Code View */
            <div className="space-y-5">
              {/* Expired Trial Notice (only shown after trial ends) */}
              {subState.isExpired && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 px-4 py-3.5 flex items-start gap-3">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <div className="text-sm leading-relaxed">
                    Your <strong>{TRIAL_DURATION_DAYS}-day free trial</strong> for{' '}
                    <strong>Combine Study</strong> &amp; <strong>Buddy AI</strong> ended on{' '}
                    <strong>{subState.trialEndDateLabel}</strong>. Activate the{' '}
                    <strong>
                      ₹{SUBSCRIPTION_PRICE_INR} / {SUBSCRIPTION_DURATION_YEARS}-Year Scholar Pass
                    </strong>{' '}
                    or apply a referral / discount code below to unlock them — all other study tools
                    remain free.
                  </div>
                </div>
              )}

              {/* Pricing Card + Included Features */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-5 rounded-xl border border-slate-900 dark:border-slate-700 bg-[#0F172A] dark:bg-slate-950 text-white p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      7-Year Scholar Pass
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        data-testid="subscription-payable-amount"
                        className={`font-mono text-4xl font-bold tracking-tight ${
                          isFreeWithCode ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {formatInrAmount(payableAmountInr)}
                      </span>
                      {isFreeWithCode && (
                        <span className="font-mono text-base text-slate-400 line-through">
                          ₹{SUBSCRIPTION_PRICE_INR}
                        </span>
                      )}
                      <span className="text-sm text-slate-300">
                        / {SUBSCRIPTION_DURATION_YEARS} years
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {isFreeWithCode
                        ? `100% discount applied with code ${appliedReferral?.normalizedCode}. No payment required.`
                        : `One-time payment of ₹${SUBSCRIPTION_PRICE_INR}. Works out to just ~₹${approxPerYearInr} per year — no monthly renewals.`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-700/80 flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>All saved study paths, notes & streak stay synced</span>
                  </div>
                </div>

                <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Premium Unlocks Combine Study &amp; Buddy AI ({SUBSCRIPTION_DURATION_YEARS} Years)
                  </p>
                  <ul className="space-y-2.5">
                    {INCLUDED_FEATURES.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Referral / Discount Code Section */}
              <form
                onSubmit={handleApplyReferralCode}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 p-4 space-y-2.5"
              >
                <label
                  htmlFor="subscription-referral-code"
                  className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100"
                >
                  <Tag className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                  Referral / Discount Code
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="subscription-referral-code"
                    data-testid="subscription-referral-input"
                    type="text"
                    maxLength={32}
                    value={codeInput}
                    disabled={isBusy}
                    onChange={(e) => {
                      setCodeInput(e.target.value);
                      if (codeError) setCodeError(null);
                      if (appliedReferral && e.target.value.trim().toUpperCase() !== appliedReferral.normalizedCode) {
                        setAppliedReferral(null);
                      }
                    }}
                    placeholder="Enter referral or discount code"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono uppercase tracking-wide text-[#0F172A] dark:text-slate-100 placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400 focus:outline-none"
                  />

                  {isFreeWithCode ? (
                    <button
                      type="button"
                      onClick={handleRemoveReferralCode}
                      disabled={isBusy}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Remove Code
                    </button>
                  ) : (
                    <button
                      type="submit"
                      data-testid="subscription-referral-apply-btn"
                      disabled={isBusy || !codeInput.trim()}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] dark:bg-sky-500 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Apply Code
                    </button>
                  )}
                </div>

                {isFreeWithCode && appliedReferral && (
                  <p
                    data-testid="subscription-referral-success"
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{appliedReferral.message}</span>
                  </p>
                )}

                {codeError && (
                  <p
                    role="alert"
                    data-testid="subscription-referral-error"
                    className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{codeError}</span>
                  </p>
                )}
              </form>

              {/* Checkout / Activation Section */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                      {isFreeWithCode
                        ? `Referral Discount Applied (${formatInrAmount(0)} Payable)`
                        : `Secured by Razorpay Checkout (₹${SUBSCRIPTION_PRICE_INR} INR)`}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isFreeWithCode
                      ? 'Instant free activation — no card or UPI needed'
                      : 'UPI (GPay, PhonePe, Paytm) · Cards · Net Banking'}
                  </span>
                </div>

                {!isFreeWithCode && !isLoadingConfig && !isRazorpayReady && (
                  <div
                    role="status"
                    className="rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-3 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5 leading-relaxed"
                  >
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-amber-950 dark:text-amber-200">
                        Razorpay credentials required to accept online payments
                      </p>
                      <p className="mt-0.5 text-amber-900 dark:text-amber-300">
                        Add <code className="font-mono font-semibold">RAZORPAY_KEY_ID</code> and{' '}
                        <code className="font-mono font-semibold">RAZORPAY_KEY_SECRET</code> in{' '}
                        <strong>Settings → Secrets</strong> (Test or Live mode) to enable instant
                        ₹{SUBSCRIPTION_PRICE_INR} Razorpay checkout, or apply a valid referral /
                        discount code above.
                      </p>
                    </div>
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2"
                  >
                    <Info className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" aria-hidden="true" />
                    <span>{notice}</span>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-800 dark:text-red-300 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {locked && onSignOut ? (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      Sign Out
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isFreeWithCode
                        ? `Instant ${SUBSCRIPTION_DURATION_YEARS}-year activation with code ${appliedReferral?.normalizedCode}`
                        : `Instant ${SUBSCRIPTION_DURATION_YEARS}-year activation after Razorpay verification`}
                    </span>
                  )}

                  <button
                    type="button"
                    data-testid="subscription-activate-btn"
                    onClick={handleRazorpayCheckout}
                    disabled={isBusy || !canProceed}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-55 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      isFreeWithCode
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-[#0284C7] hover:bg-[#0369A1]'
                    }`}
                  >
                    {isBusy || (!isFreeWithCode && isLoadingConfig) ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        {!isFreeWithCode && isLoadingConfig ? 'Checking Razorpay...' : buttonLabel}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        {buttonLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
