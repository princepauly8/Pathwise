import type { StudentProfile } from '../types/study';
import {
  calculateOverallProgress,
  calculateStudyStreak,
  formatLocalDateKey,
  shiftDateKey,
} from './learningPath';

export type BadgeCategory = 'consistency' | 'mastery' | 'excellence';
export type BadgeTier = 'bronze' | 'silver' | 'gold';
export type BadgeIconKey =
  | 'spark'
  | 'flame'
  | 'calendar'
  | 'crown'
  | 'compass'
  | 'book'
  | 'target'
  | 'award';

export interface StreakMilestoneDefinition {
  days: number;
  title: string;
  subtitle: string;
}

export const STREAK_MILESTONES: StreakMilestoneDefinition[] = [
  {
    days: 1,
    title: 'First Spark',
    subtitle: 'You hit your daily study goal and started your streak.',
  },
  {
    days: 3,
    title: '3-Day Momentum',
    subtitle: 'Three consecutive days of hitting your daily study goal.',
  },
  {
    days: 7,
    title: '7-Day Scholar',
    subtitle: 'A full uninterrupted week of consistent daily studying.',
  },
  {
    days: 14,
    title: '14-Day Fortnight',
    subtitle: 'Two consecutive weeks of disciplined daily study.',
  },
  {
    days: 21,
    title: '21-Day Habit Builder',
    subtitle: 'Three weeks straight—daily study is now a rock-solid habit.',
  },
  {
    days: 30,
    title: '30-Day Mastery Streak',
    subtitle: 'An entire month of hitting your study goal every single day.',
  },
];

export interface StreakDayCell {
  dateKey: string;
  shortWeekday: string;
  dayNumber: number;
  isToday: boolean;
  completed: boolean;
  inActiveStreak: boolean;
}

export interface DetailedStreakSummary {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  totalActiveDays: number;
  last7Days: StreakDayCell[];
  last14Days: StreakDayCell[];
  nextMilestone: StreakMilestoneDefinition | null;
  daysToNextMilestone: number;
  progressToNextPercent: number;
  reachedMilestone: StreakMilestoneDefinition | null;
}

export interface EvaluatedAchievementBadge {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  iconKey: BadgeIconKey;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  progressLabel: string;
}

export interface CelebrationPayload {
  id: string;
  title: string;
  subtitle: string;
  kind: 'streak_milestone' | 'badge_unlocked' | 'daily_goal';
  tier: BadgeTier;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function buildRecentDayCells(
  dateSet: Set<string>,
  activeStreakDates: Set<string>,
  todayKey: string,
  count: number
): StreakDayCell[] {
  const cells: StreakDayCell[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const dateKey = shiftDateKey(todayKey, -offset);
    const [y, m, d] = dateKey.split('-').map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    cells.push({
      dateKey,
      shortWeekday: WEEKDAY_SHORT[utcDate.getUTCDay()],
      dayNumber: d,
      isToday: offset === 0,
      completed: dateSet.has(dateKey),
      inActiveStreak: activeStreakDates.has(dateKey),
    });
  }
  return cells;
}

export function computeDetailedStreak(
  completedDates: string[] | undefined,
  referenceDate: Date = new Date()
): DetailedStreakSummary {
  const validUnique = Array.from(
    new Set((completedDates ?? []).filter((d) => DATE_KEY_PATTERN.test(d)))
  ).sort();
  const dateSet = new Set(validUnique);
  const todayKey = formatLocalDateKey(referenceDate);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const base = calculateStudyStreak(validUnique, referenceDate);

  // Determine exact calendar dates belonging to the current active streak
  const activeStreakDates = new Set<string>();
  let cursor: string | null = base.completedToday
    ? todayKey
    : dateSet.has(yesterdayKey)
      ? yesterdayKey
      : null;
  while (cursor && dateSet.has(cursor)) {
    activeStreakDates.add(cursor);
    cursor = shiftDateKey(cursor, -1);
  }

  const nextMilestone =
    STREAK_MILESTONES.find((m) => m.days > base.currentStreak) ?? null;

  const prevMilestoneDays =
    [...STREAK_MILESTONES]
      .reverse()
      .find((m) => m.days <= base.currentStreak)?.days ?? 0;

  const daysToNextMilestone = nextMilestone
    ? Math.max(0, nextMilestone.days - base.currentStreak)
    : 0;

  const progressToNextPercent = nextMilestone
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((base.currentStreak - prevMilestoneDays) /
              Math.max(1, nextMilestone.days - prevMilestoneDays)) *
              100
          )
        )
      )
    : 100;

  const reachedMilestone =
    STREAK_MILESTONES.find((m) => m.days === base.currentStreak) ?? null;

  const last14Days = buildRecentDayCells(dateSet, activeStreakDates, todayKey, 14);
  const last7Days = last14Days.slice(-7);

  return {
    currentStreak: base.currentStreak,
    longestStreak: base.longestStreak,
    completedToday: base.completedToday,
    totalActiveDays: validUnique.length,
    last7Days,
    last14Days,
    nextMilestone,
    daysToNextMilestone,
    progressToNextPercent,
    reachedMilestone,
  };
}

export function evaluateStudentAchievements(
  profile: StudentProfile,
  referenceDate: Date = new Date()
): EvaluatedAchievementBadge[] {
  const streak = computeDetailedStreak(profile.completedDates, referenceDate);
  const overall = calculateOverallProgress(profile.subjects, profile.paths);

  let maxQuizScore = 0;
  let subjectsWithMastery = 0;

  for (const subject of profile.subjects) {
    const path = profile.paths[subject];
    if (!path) continue;
    let hasMasteredInSubject = false;
    for (const mod of path.modules) {
      if (mod.status === 'mastered') hasMasteredInSubject = true;
      if (typeof mod.bestQuizScore === 'number' && mod.bestQuizScore > maxQuizScore) {
        maxQuizScore = mod.bestQuizScore;
      }
    }
    if (hasMasteredInSubject) subjectsWithMastery += 1;
  }

  for (const yt of profile.youtubeClasses ?? []) {
    if (typeof yt.bestQuizScore === 'number' && yt.bestQuizScore > maxQuizScore) {
      maxQuizScore = yt.bestQuizScore;
    }
  }

  const bestStreak = Math.max(streak.currentStreak, streak.longestStreak);

  const makeBadge = (spec: {
    id: string;
    title: string;
    description: string;
    category: BadgeCategory;
    tier: BadgeTier;
    iconKey: BadgeIconKey;
    currentValue: number;
    targetValue: number;
    unit: string;
  }): EvaluatedAchievementBadge => {
    const clamped = Math.min(spec.currentValue, spec.targetValue);
    const unlocked = spec.currentValue >= spec.targetValue;
    const progressPercent = Math.min(
      100,
      Math.round((clamped / Math.max(1, spec.targetValue)) * 100)
    );
    const progressLabel =
      spec.unit === '%'
        ? `${Math.min(100, spec.currentValue)}% / ${spec.targetValue}%`
        : `${clamped} / ${spec.targetValue} ${spec.unit}`;

    return {
      id: spec.id,
      title: spec.title,
      description: spec.description,
      category: spec.category,
      tier: spec.tier,
      iconKey: spec.iconKey,
      unlocked,
      currentValue: spec.currentValue,
      targetValue: spec.targetValue,
      progressPercent,
      progressLabel,
    };
  };

  return [
    makeBadge({
      id: 'badge-first-spark',
      title: 'First Spark',
      description: 'Hit your daily study goal at least once.',
      category: 'consistency',
      tier: 'bronze',
      iconKey: 'spark',
      currentValue: streak.totalActiveDays,
      targetValue: 1,
      unit: 'day',
    }),
    makeBadge({
      id: 'badge-3-day-momentum',
      title: '3-Day Momentum',
      description: 'Maintain a 3-day consecutive study streak.',
      category: 'consistency',
      tier: 'bronze',
      iconKey: 'flame',
      currentValue: bestStreak,
      targetValue: 3,
      unit: 'days',
    }),
    makeBadge({
      id: 'badge-7-day-scholar',
      title: '7-Day Scholar',
      description: 'Hit your daily study goal 7 days in a row.',
      category: 'consistency',
      tier: 'silver',
      iconKey: 'calendar',
      currentValue: bestStreak,
      targetValue: 7,
      unit: 'days',
    }),
    makeBadge({
      id: 'badge-14-day-fortnight',
      title: 'Fortnight Finisher',
      description: 'Sustain a 14-day uninterrupted study streak.',
      category: 'consistency',
      tier: 'gold',
      iconKey: 'crown',
      currentValue: bestStreak,
      targetValue: 14,
      unit: 'days',
    }),
    makeBadge({
      id: 'badge-topic-master',
      title: 'Topic Master',
      description: 'Master your first syllabus module.',
      category: 'mastery',
      tier: 'bronze',
      iconKey: 'book',
      currentValue: overall.masteredModules,
      targetValue: 1,
      unit: 'module',
    }),
    makeBadge({
      id: 'badge-curriculum-climber',
      title: 'Curriculum Climber',
      description: 'Master 5 modules across your learning paths.',
      category: 'mastery',
      tier: 'silver',
      iconKey: 'compass',
      currentValue: overall.masteredModules,
      targetValue: 5,
      unit: 'modules',
    }),
    makeBadge({
      id: 'badge-quiz-ace',
      title: 'Quiz Ace',
      description: 'Score 90% or higher on a module or class quiz.',
      category: 'excellence',
      tier: 'silver',
      iconKey: 'target',
      currentValue: maxQuizScore,
      targetValue: 90,
      unit: '%',
    }),
    makeBadge({
      id: 'badge-polymath',
      title: 'Multi-Subject Scholar',
      description: 'Master at least 1 module in 3 different subjects.',
      category: 'excellence',
      tier: 'gold',
      iconKey: 'award',
      currentValue: subjectsWithMastery,
      targetValue: 3,
      unit: 'subjects',
    }),
  ];
}

export function detectMilestoneCelebration(params: {
  previousStreak: number;
  nextStreak: number;
  previousCompletedToday: boolean;
  nextCompletedToday: boolean;
  previousUnlockedBadgeIds: string[];
  nextBadges: EvaluatedAchievementBadge[];
}): CelebrationPayload | null {
  const prevSet = new Set(params.previousUnlockedBadgeIds);
  const newlyUnlockedBadges = params.nextBadges.filter(
    (b) => b.unlocked && !prevSet.has(b.id)
  );

  // 1. Check if a streak milestone (1, 3, 7, 14, 21, 30) was newly crossed
  const crossedStreakMilestone = [...STREAK_MILESTONES]
    .reverse()
    .find(
      (m) => params.nextStreak >= m.days && params.previousStreak < m.days
    );

  if (crossedStreakMilestone) {
    const extraBadgeNote =
      newlyUnlockedBadges.length > 0
        ? ` Unlocked "${newlyUnlockedBadges[0].title}" badge!`
        : '';
    return {
      id: `streak-${crossedStreakMilestone.days}-${Date.now()}`,
      title: `${crossedStreakMilestone.days}-Day Streak Milestone!`,
      subtitle: `${crossedStreakMilestone.subtitle}${extraBadgeNote}`,
      kind: 'streak_milestone',
      tier:
        crossedStreakMilestone.days >= 14
          ? 'gold'
          : crossedStreakMilestone.days >= 7
            ? 'silver'
            : 'bronze',
    };
  }

  // 2. Check if any achievement badge was newly unlocked
  if (newlyUnlockedBadges.length > 0) {
    const top = newlyUnlockedBadges[0];
    const extraCount = newlyUnlockedBadges.length - 1;
    return {
      id: `badge-${top.id}-${Date.now()}`,
      title: `Achievement Unlocked: ${top.title}`,
      subtitle:
        extraCount > 0
          ? `${top.description} (+${extraCount} more badge${extraCount === 1 ? '' : 's'} earned)`
          : top.description,
      kind: 'badge_unlocked',
      tier: top.tier,
    };
  }

  // 3. Otherwise, if the student just completed today's study goal to extend an active streak
  if (!params.previousCompletedToday && params.nextCompletedToday && params.nextStreak > 0) {
    return {
      id: `daily-goal-${params.nextStreak}-${Date.now()}`,
      title: `Daily Goal Hit · ${params.nextStreak}-Day Streak!`,
      subtitle: 'Consistency compounds. Come back tomorrow to keep your streak alive.',
      kind: 'daily_goal',
      tier: params.nextStreak >= 14 ? 'gold' : params.nextStreak >= 7 ? 'silver' : 'bronze',
    };
  }

  return null;
}
