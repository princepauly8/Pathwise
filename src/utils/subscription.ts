import type { StudentSubscription, WorkspaceView } from '../types/study';

export const SUBSCRIPTION_PLAN_ID = 'scholar_7yr_200inr' as const;
export const LEGACY_SUBSCRIPTION_PLAN_ID = 'scholar_7yr_100inr' as const;
export const TRIAL_DURATION_DAYS = 30;
export const SUBSCRIPTION_PRICE_INR = 200;
export const SUBSCRIPTION_CURRENCY = 'INR' as const;
export const SUBSCRIPTION_DURATION_YEARS = 7;
export const FREE_REFERRAL_CODE = 'PRINCE' as const;
export const PREMIUM_ONLY_VIEWS = ['combine', 'tutor'] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isPremiumView(view: WorkspaceView): boolean {
  return view === 'combine' || view === 'tutor';
}

export function canAccessWorkspaceView(
  view: WorkspaceView,
  subState: Pick<ComputedSubscriptionState, 'isExpired'>
): boolean {
  return !isPremiumView(view) || !subState.isExpired;
}

export interface ReferralCodeEvaluation {
  normalizedCode: string;
  valid: boolean;
  isFree: boolean;
  originalAmountInr: number;
  discountAmountInr: number;
  finalAmountInr: number;
  message: string;
}

export function formatInrAmount(amountInr: number): string {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return '₹0.00';
  }
  return Number.isInteger(amountInr) ? `₹${amountInr}` : `₹${amountInr.toFixed(2)}`;
}

export function evaluateReferralCode(rawCode: string): ReferralCodeEvaluation {
  const normalizedCode = rawCode.trim().toUpperCase();
  if (!normalizedCode) {
    return {
      normalizedCode: '',
      valid: false,
      isFree: false,
      originalAmountInr: SUBSCRIPTION_PRICE_INR,
      discountAmountInr: 0,
      finalAmountInr: SUBSCRIPTION_PRICE_INR,
      message: '',
    };
  }

  if (normalizedCode === FREE_REFERRAL_CODE) {
    return {
      normalizedCode,
      valid: true,
      isFree: true,
      originalAmountInr: SUBSCRIPTION_PRICE_INR,
      discountAmountInr: SUBSCRIPTION_PRICE_INR,
      finalAmountInr: 0,
      message: `Code ${FREE_REFERRAL_CODE} applied — 100% off! Payable amount is ₹0.00.`,
    };
  }

  return {
    normalizedCode,
    valid: false,
    isFree: false,
    originalAmountInr: SUBSCRIPTION_PRICE_INR,
    discountAmountInr: 0,
    finalAmountInr: SUBSCRIPTION_PRICE_INR,
    message: 'Invalid referral or discount code. Please check and try again.',
  };
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

export function addYears(base: Date, years: number): Date {
  const next = new Date(base.getTime());
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function createInitialTrialSubscription(startedAt?: string | Date): StudentSubscription {
  const parsedStart =
    startedAt instanceof Date
      ? startedAt
      : typeof startedAt === 'string' && !Number.isNaN(Date.parse(startedAt))
        ? new Date(startedAt)
        : new Date();

  const trialEndsAt = addDays(parsedStart, TRIAL_DURATION_DAYS);

  return {
    planId: SUBSCRIPTION_PLAN_ID,
    status: 'trial',
    trialStartedAt: parsedStart.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    amountInr: SUBSCRIPTION_PRICE_INR,
    currency: SUBSCRIPTION_CURRENCY,
    durationYears: SUBSCRIPTION_DURATION_YEARS,
  };
}

export function ensureStudentSubscription(
  existing: StudentSubscription | undefined,
  accountCreatedAt?: string
): StudentSubscription {
  const hasKnownPlan =
    existing &&
    (existing.planId === SUBSCRIPTION_PLAN_ID || existing.planId === LEGACY_SUBSCRIPTION_PLAN_ID);

  if (
    hasKnownPlan &&
    typeof existing.trialStartedAt === 'string' &&
    typeof existing.trialEndsAt === 'string'
  ) {
    const isActive = existing.status === 'active';
    const preservedAmount =
      isActive &&
      (existing.amountInr === 0 || existing.amountInr === 100 || existing.amountInr === SUBSCRIPTION_PRICE_INR)
        ? existing.amountInr
        : SUBSCRIPTION_PRICE_INR;

    return {
      ...existing,
      planId: isActive ? existing.planId : SUBSCRIPTION_PLAN_ID,
      amountInr: preservedAmount,
      currency: SUBSCRIPTION_CURRENCY,
      durationYears: SUBSCRIPTION_DURATION_YEARS,
    };
  }
  return createInitialTrialSubscription(accountCreatedAt);
}

export interface ComputedSubscriptionState {
  subscription: StudentSubscription;
  effectiveStatus: 'trial' | 'active' | 'expired';
  isActivePass: boolean;
  isTrialActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEndDateLabel: string;
  passExpiryDateLabel: string | null;
}

function formatReadableDate(isoString: string | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getSubscriptionState(
  rawSub: StudentSubscription | undefined,
  accountCreatedAt?: string,
  now: Date = new Date()
): ComputedSubscriptionState {
  const subscription = ensureStudentSubscription(rawSub, accountCreatedAt);
  const nowMs = now.getTime();

  // Check active 7-year paid/redeemed pass first
  if (subscription.status === 'active' && subscription.expiresAt) {
    const expiresMs = Date.parse(subscription.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs > nowMs) {
      const daysRemaining = Math.max(1, Math.ceil((expiresMs - nowMs) / MS_PER_DAY));
      return {
        subscription,
        effectiveStatus: 'active',
        isActivePass: true,
        isTrialActive: false,
        isExpired: false,
        daysRemaining,
        trialEndDateLabel: formatReadableDate(subscription.trialEndsAt),
        passExpiryDateLabel: formatReadableDate(subscription.expiresAt),
      };
    }
  }

  // Check 1-month (30-day) free trial window
  const trialEndMs = Date.parse(subscription.trialEndsAt);
  if (!Number.isNaN(trialEndMs) && trialEndMs > nowMs) {
    const daysRemaining = Math.max(1, Math.ceil((trialEndMs - nowMs) / MS_PER_DAY));
    return {
      subscription,
      effectiveStatus: 'trial',
      isActivePass: false,
      isTrialActive: true,
      isExpired: false,
      daysRemaining,
      trialEndDateLabel: formatReadableDate(subscription.trialEndsAt),
      passExpiryDateLabel: null,
    };
  }

  // 1-month free trial has ended and no active 7-year pass
  return {
    subscription: { ...subscription, status: 'expired' },
    effectiveStatus: 'expired',
    isActivePass: false,
    isTrialActive: false,
    isExpired: true,
    daysRemaining: 0,
    trialEndDateLabel: formatReadableDate(subscription.trialEndsAt),
    passExpiryDateLabel: subscription.expiresAt
      ? formatReadableDate(subscription.expiresAt)
      : null,
  };
}

export function buildActivatedSubscription(
  existing: StudentSubscription | undefined,
  receipt: {
    subscribedAt: string;
    expiresAt: string;
    paymentMethod: string;
    receiptId: string;
    amountInr?: number;
    referralCode?: string;
  },
  accountCreatedAt?: string
): StudentSubscription {
  const base = ensureStudentSubscription(existing, accountCreatedAt);
  const finalAmount =
    receipt.amountInr === 0 || receipt.amountInr === SUBSCRIPTION_PRICE_INR
      ? receipt.amountInr
      : SUBSCRIPTION_PRICE_INR;
  const cleanReferral = receipt.referralCode?.trim().toUpperCase();

  return {
    planId: SUBSCRIPTION_PLAN_ID,
    status: 'active',
    trialStartedAt: base.trialStartedAt,
    trialEndsAt: base.trialEndsAt,
    subscribedAt: receipt.subscribedAt,
    expiresAt: receipt.expiresAt,
    amountInr: finalAmount,
    currency: SUBSCRIPTION_CURRENCY,
    durationYears: SUBSCRIPTION_DURATION_YEARS,
    paymentMethod: receipt.paymentMethod,
    receiptId: receipt.receiptId,
    ...(cleanReferral ? { referralCode: cleanReferral } : {}),
  };
}
