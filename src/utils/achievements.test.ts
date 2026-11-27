import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeDetailedStreak,
  detectMilestoneCelebration,
  evaluateStudentAchievements,
} from './achievements.ts';
import { createSampleStudentProfile, shiftDateKey } from './learningPath.ts';

test('computeDetailedStreak builds 7-day and 14-day history and next milestone accurately', () => {
  const refDate = new Date(2026, 10, 26, 10, 0, 0); // 2026-11-26
  const dates = ['2026-11-24', '2026-11-25'];
  const summary = computeDetailedStreak(dates, refDate);

  assert.equal(summary.currentStreak, 2);
  assert.equal(summary.longestStreak, 2);
  assert.equal(summary.completedToday, false);
  assert.equal(summary.totalActiveDays, 2);
  assert.equal(summary.last7Days.length, 7);
  assert.equal(summary.last14Days.length, 14);
  assert.equal(summary.last7Days[6].isToday, true);
  assert.equal(summary.last7Days[6].completed, false);
  assert.equal(summary.last7Days[5].completed, true);
  assert.equal(summary.last7Days[5].inActiveStreak, true);
  assert.equal(summary.nextMilestone?.days, 3);
  assert.equal(summary.daysToNextMilestone, 1);
});

test('computeDetailedStreak recognizes 3-day milestone when today is logged', () => {
  const refDate = new Date(2026, 10, 26, 10, 0, 0); // 2026-11-26
  const dates = ['2026-11-24', '2026-11-25', '2026-11-26'];
  const summary = computeDetailedStreak(dates, refDate);

  assert.equal(summary.currentStreak, 3);
  assert.equal(summary.completedToday, true);
  assert.equal(summary.reachedMilestone?.days, 3);
  assert.equal(summary.nextMilestone?.days, 7);
  assert.equal(summary.daysToNextMilestone, 4);
});

test('evaluateStudentAchievements unlocks badges accurately from real profile progress', () => {
  const sample = createSampleStudentProfile();
  const refDate = new Date();
  const todayKey = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(
    refDate.getDate()
  ).padStart(2, '0')}`;

  // Initial sample has 2 consecutive days, 3 mastered modules across 3 subjects, 100% quiz score
  const initialBadges = evaluateStudentAchievements(sample, refDate);
  const byId = Object.fromEntries(initialBadges.map((b) => [b.id, b]));

  assert.equal(byId['badge-first-spark'].unlocked, true);
  assert.equal(byId['badge-3-day-momentum'].unlocked, false);
  assert.equal(byId['badge-topic-master'].unlocked, true);
  assert.equal(byId['badge-quiz-ace'].unlocked, true);
  assert.equal(byId['badge-polymath'].unlocked, false);
  assert.ok(byId['badge-polymath'].currentValue < 3);

  // Adding today's completion unlocks 3-Day Momentum
  const updatedProfile = {
    ...sample,
    completedDates: [shiftDateKey(todayKey, -2), shiftDateKey(todayKey, -1), todayKey],
  };
  const updatedBadges = evaluateStudentAchievements(updatedProfile, refDate);
  const updatedById = Object.fromEntries(updatedBadges.map((b) => [b.id, b]));
  assert.equal(updatedById['badge-3-day-momentum'].unlocked, true);
});

test('detectMilestoneCelebration fires confetti payload when crossing 3-day milestone or unlocking a badge', () => {
  const sample = createSampleStudentProfile();
  const refDate = new Date();
  const todayKey = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(
    refDate.getDate()
  ).padStart(2, '0')}`;

  const prevBadges = evaluateStudentAchievements(sample, refDate);
  const nextProfile = {
    ...sample,
    completedDates: [shiftDateKey(todayKey, -2), shiftDateKey(todayKey, -1), todayKey],
  };
  const nextBadges = evaluateStudentAchievements(nextProfile, refDate);

  const celebration = detectMilestoneCelebration({
    previousStreak: 2,
    nextStreak: 3,
    previousCompletedToday: false,
    nextCompletedToday: true,
    previousUnlockedBadgeIds: prevBadges.filter((b) => b.unlocked).map((b) => b.id),
    nextBadges,
  });

  assert.ok(celebration);
  assert.equal(celebration.kind, 'streak_milestone');
  assert.match(celebration.title, /3-Day Streak Milestone/);
  assert.match(celebration.subtitle, /3-Day Momentum/);
});
