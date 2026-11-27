import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_REFERRAL_CODE,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PLAN_ID,
  SUBSCRIPTION_PRICE_INR,
  TRIAL_DURATION_DAYS,
  addDays,
  addYears,
  buildActivatedSubscription,
  createInitialTrialSubscription,
  evaluateReferralCode,
  formatInrAmount,
  getSubscriptionState,
} from './subscription';

test('new student receives a 1-month (30-day) free trial with ₹200 / 7-year plan constants', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const sub = createInitialTrialSubscription(start);

  assert.equal(sub.planId, SUBSCRIPTION_PLAN_ID);
  assert.equal(sub.planId, 'scholar_7yr_200inr');
  assert.equal(sub.status, 'trial');
  assert.equal(sub.amountInr, SUBSCRIPTION_PRICE_INR);
  assert.equal(sub.amountInr, 200);
  assert.equal(sub.currency, SUBSCRIPTION_CURRENCY);
  assert.equal(sub.currency, 'INR');
  assert.equal(sub.durationYears, SUBSCRIPTION_DURATION_YEARS);
  assert.equal(sub.durationYears, 7);

  const expectedEnd = addDays(start, TRIAL_DURATION_DAYS);
  assert.equal(sub.trialEndsAt, expectedEnd.toISOString());

  const midTrialState = getSubscriptionState(sub, start.toISOString(), new Date('2026-01-16T00:00:00.000Z'));
  assert.equal(midTrialState.effectiveStatus, 'trial');
  assert.equal(midTrialState.isTrialActive, true);
  assert.equal(midTrialState.isExpired, false);
  assert.equal(midTrialState.daysRemaining, 15);
});

test('after 1 month (30 days), unpaid trial transitions cleanly to expired state', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const sub = createInitialTrialSubscription(start);

  const afterOneMonth = new Date('2026-02-02T00:00:00.000Z');
  const state = getSubscriptionState(sub, start.toISOString(), afterOneMonth);

  assert.equal(state.effectiveStatus, 'expired');
  assert.equal(state.isTrialActive, false);
  assert.equal(state.isActivePass, false);
  assert.equal(state.isExpired, true);
  assert.equal(state.daysRemaining, 0);
});

test('activating the ₹200 7-year pass unlocks full access for 7 full years', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const trial = createInitialTrialSubscription(start);
  const activatedAt = new Date('2026-02-02T10:00:00.000Z');
  const expiresAt = addYears(activatedAt, 7);

  const activeSub = buildActivatedSubscription(trial, {
    subscribedAt: activatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    paymentMethod: 'Razorpay (UPI)',
    receiptId: 'PW-7YR-123456',
    amountInr: 200,
  });

  assert.equal(activeSub.amountInr, 200);

  // Check 3 years later -> still active!
  const threeYearsLater = new Date('2029-02-02T10:00:00.000Z');
  const state = getSubscriptionState(activeSub, start.toISOString(), threeYearsLater);
  assert.equal(state.effectiveStatus, 'active');
  assert.equal(state.isActivePass, true);
  assert.equal(state.isExpired, false);
  assert.ok(state.daysRemaining >= 1450);

  // Check after 7 years -> expired
  const afterSevenYears = new Date('2033-02-03T10:00:00.000Z');
  const expiredState = getSubscriptionState(activeSub, start.toISOString(), afterSevenYears);
  assert.equal(expiredState.effectiveStatus, 'expired');
  assert.equal(expiredState.isExpired, true);
});

test('referral / discount code PRINCE reduces amount from ₹200 to ₹0.00 (case-insensitive & trimmed)', () => {
  const exact = evaluateReferralCode('PRINCE');
  assert.equal(exact.valid, true);
  assert.equal(exact.isFree, true);
  assert.equal(exact.normalizedCode, FREE_REFERRAL_CODE);
  assert.equal(exact.originalAmountInr, 200);
  assert.equal(exact.discountAmountInr, 200);
  assert.equal(exact.finalAmountInr, 0);
  assert.equal(formatInrAmount(exact.finalAmountInr), '₹0.00');

  const mixed = evaluateReferralCode('  prince  ');
  assert.equal(mixed.valid, true);
  assert.equal(mixed.isFree, true);
  assert.equal(mixed.finalAmountInr, 0);

  const invalid = evaluateReferralCode('WRONG123');
  assert.equal(invalid.valid, false);
  assert.equal(invalid.isFree, false);
  assert.equal(invalid.finalAmountInr, 200);
  assert.equal(formatInrAmount(invalid.finalAmountInr), '₹200');
});

test('activating with referral code PRINCE preserves ₹0.00 amount and referralCode across state checks', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const trial = createInitialTrialSubscription(start);
  const activatedAt = new Date('2026-02-02T10:00:00.000Z');
  const expiresAt = addYears(activatedAt, 7);

  const freePass = buildActivatedSubscription(trial, {
    subscribedAt: activatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    paymentMethod: 'Referral Code (PRINCE)',
    receiptId: 'PW-7YR-PRINCE-AB12',
    amountInr: 0,
    referralCode: 'prince',
  });

  assert.equal(freePass.amountInr, 0);
  assert.equal(freePass.referralCode, 'PRINCE');

  const state = getSubscriptionState(freePass, start.toISOString(), new Date('2027-01-01T00:00:00.000Z'));
  assert.equal(state.isActivePass, true);
  assert.equal(state.subscription.amountInr, 0);
  assert.equal(state.subscription.referralCode, 'PRINCE');
  assert.equal(formatInrAmount(state.subscription.amountInr), '₹0.00');
});

test('premium gating restricts ONLY Combine Study (combine) and Buddy AI (tutor) after trial ends', async () => {
  const { PREMIUM_ONLY_VIEWS, isPremiumView, canAccessWorkspaceView } = await import('./subscription');

  assert.deepEqual([...PREMIUM_ONLY_VIEWS], ['combine', 'tutor']);

  const freeViews = ['paths', 'study', 'revision', 'youtube', 'practice', 'planner'] as const;
  const premiumViews = ['combine', 'tutor'] as const;

  for (const view of freeViews) {
    assert.equal(isPremiumView(view), false, `${view} should remain free`);
  }
  for (const view of premiumViews) {
    assert.equal(isPremiumView(view), true, `${view} should be premium`);
  }

  const start = new Date('2026-01-01T00:00:00.000Z');
  const trial = createInitialTrialSubscription(start);
  const expiredState = getSubscriptionState(trial, start.toISOString(), new Date('2026-03-01T00:00:00.000Z'));
  assert.equal(expiredState.isExpired, true);

  for (const view of freeViews) {
    assert.equal(
      canAccessWorkspaceView(view, expiredState),
      true,
      `${view} must stay accessible even after trial expires`
    );
  }
  for (const view of premiumViews) {
    assert.equal(
      canAccessWorkspaceView(view, expiredState),
      false,
      `${view} must be locked after trial expires`
    );
  }

  const activeTrialState = getSubscriptionState(trial, start.toISOString(), new Date('2026-01-10T00:00:00.000Z'));
  for (const view of [...freeViews, ...premiumViews]) {
    assert.equal(canAccessWorkspaceView(view, activeTrialState), true);
  }

  const activePass = buildActivatedSubscription(trial, {
    subscribedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: '2033-03-01T00:00:00.000Z',
    paymentMethod: 'Referral Code (PRINCE)',
    receiptId: 'PW-7YR-PRINCE-TEST',
    amountInr: 0,
    referralCode: 'PRINCE',
  });
  const activePassState = getSubscriptionState(activePass, start.toISOString(), new Date('2026-03-02T00:00:00.000Z'));
  for (const view of [...freeViews, ...premiumViews]) {
    assert.equal(canAccessWorkspaceView(view, activePassState), true);
  }
});
