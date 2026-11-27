import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Compass,
  Crown,
  Flame,
  Lock,
  Sparkles,
  Target,
} from 'lucide-react';
import type { StudentProfile } from '../types/study';
import {
  computeDetailedStreak,
  evaluateStudentAchievements,
  type BadgeCategory,
  type BadgeIconKey,
  type BadgeTier,
  type CelebrationPayload,
  type EvaluatedAchievementBadge,
} from '../utils/achievements';

interface DashboardStreakAchievementsProps {
  profile: StudentProfile;
  onLogDailyStudyGoal: () => void;
  onTriggerCelebration: (payload: CelebrationPayload) => void;
}

type CategoryFilter = 'all' | BadgeCategory;

function BadgeMedallion({
  iconKey,
  tier,
  unlocked,
}: {
  iconKey: BadgeIconKey;
  tier: BadgeTier;
  unlocked: boolean;
}) {
  const IconComponent =
    iconKey === 'spark'
      ? Sparkles
      : iconKey === 'flame'
        ? Flame
        : iconKey === 'calendar'
          ? CalendarCheck2
          : iconKey === 'crown'
            ? Crown
            : iconKey === 'book'
              ? BookOpen
              : iconKey === 'compass'
                ? Compass
                : iconKey === 'target'
                  ? Target
                  : Award;

  if (!unlocked) {
    return (
      <div
        className="relative w-11 h-11 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0"
        aria-hidden="true"
      >
        <IconComponent className="w-4 h-4 opacity-55" />
        <Lock className="w-3 h-3 absolute -bottom-1 -right-1 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-full p-0.5 border border-slate-200 dark:border-slate-700" />
      </div>
    );
  }

  const palette =
    tier === 'gold'
      ? {
          outer: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400',
          ring: '#F59E0B',
        }
      : tier === 'silver'
        ? {
            outer: 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800/80 text-[#0284C7] dark:text-sky-400',
            ring: '#0284C7',
          }
        : {
            outer: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-[#059669] dark:text-emerald-400',
            ring: '#059669',
          };

  return (
    <div
      className={`relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${palette.outer}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 44 44"
        className="absolute inset-0 w-full h-full pointer-events-none"
        fill="none"
      >
        <rect
          x="3"
          y="3"
          width="38"
          height="38"
          rx="9"
          stroke={palette.ring}
          strokeOpacity="0.22"
          strokeWidth="1"
        />
      </svg>
      <IconComponent className="w-5 h-5 relative z-10" />
    </div>
  );
}

export const DashboardStreakAchievements: React.FC<DashboardStreakAchievementsProps> = ({
  profile,
  onLogDailyStudyGoal,
  onTriggerCelebration,
}) => {
  const [windowMode, setWindowMode] = useState<'7d' | '14d'>('7d');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const streak = useMemo(
    () => computeDetailedStreak(profile.completedDates),
    [profile.completedDates]
  );

  const badges = useMemo(() => evaluateStudentAchievements(profile), [profile]);

  const unlockedCount = useMemo(
    () => badges.filter((b) => b.unlocked).length,
    [badges]
  );

  const filteredBadges = useMemo(
    () =>
      categoryFilter === 'all'
        ? badges
        : badges.filter((b) => b.category === categoryFilter),
    [badges, categoryFilter]
  );

  const visibleDays = windowMode === '7d' ? streak.last7Days : streak.last14Days;

  const handleCelebrateBadge = (badge: EvaluatedAchievementBadge) => {
    if (!badge.unlocked) return;
    onTriggerCelebration({
      id: `replay-${badge.id}-${Date.now()}`,
      title: `${badge.title} — Unlocked`,
      subtitle: badge.description,
      kind: 'badge_unlocked',
      tier: badge.tier,
    });
  };

  const handleReplayStreakCelebration = () => {
    const tier: BadgeTier =
      streak.currentStreak >= 14
        ? 'gold'
        : streak.currentStreak >= 7
          ? 'silver'
          : 'bronze';
    onTriggerCelebration({
      id: `replay-streak-${streak.currentStreak}-${Date.now()}`,
      title: `${streak.currentStreak}-Day Study Streak Active`,
      subtitle: streak.nextMilestone
        ? `${streak.daysToNextMilestone} more day${streak.daysToNextMilestone === 1 ? '' : 's'} to reach ${streak.nextMilestone.title}.`
        : 'You have mastered every streak milestone. Keep the rhythm going!',
      kind: 'streak_milestone',
      tier,
    });
  };

  const tierLabel = (tier: BadgeTier) =>
    tier === 'gold' ? 'Gold' : tier === 'silver' ? 'Silver' : 'Bronze';

  return (
    <section
      id="streak-achievements"
      aria-label="Study streak counter and achievement badges"
      data-testid="dashboard-streak-achievements"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
    >
      {/* Left Zone: Visual Streak Counter & Daily Goal Tracker */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-6">
        <div className="space-y-5">
          {/* Header & Window Toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Daily Study Streak <span aria-hidden="true">·</span> {profile.dailyMinutes} min goal
              </p>
              <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                Consistency Tracker
              </h2>
            </div>

            <div
              role="group"
              aria-label="Streak calendar range"
              className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0"
            >
              <button
                type="button"
                onClick={() => setWindowMode('7d')}
                aria-pressed={windowMode === '7d'}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  windowMode === '7d'
                    ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('14d')}
                aria-pressed={windowMode === '14d'}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  windowMode === '14d'
                    ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                14 Days
              </button>
            </div>
          </div>

          {/* Focal Streak Counter Display */}
          <div className="flex items-center gap-5 py-1">
            <div
              className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center shrink-0 transition-colors ${
                streak.completedToday
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400'
                  : streak.currentStreak > 0
                    ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}
              aria-hidden="true"
            >
              <Flame
                className={`w-7 h-7 ${
                  streak.completedToday ? 'fill-amber-400/50 text-amber-600 dark:text-amber-400' : ''
                }`}
              />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline gap-2">
                <span
                  data-testid="dashboard-streak-days"
                  className="font-mono text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100 tabular-nums"
                >
                  {streak.currentStreak}
                </span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  consecutive {streak.currentStreak === 1 ? 'day' : 'days'}
                </span>
              </div>

              {streak.completedToday ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Today’s {profile.dailyMinutes}-minute goal completed
                </p>
              ) : streak.currentStreak > 0 ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Complete today’s goal to extend to {streak.currentStreak + 1} days
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hit your study goal today to start Day 1 of your streak
                </p>
              )}
            </div>
          </div>

          {/* Visual 7-Day or 14-Day Activity Calendar Strip */}
          <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Last {windowMode === '7d' ? '7' : '14'} days</span>
              <span className="font-mono tabular-nums">
                Best {streak.longestStreak}d <span aria-hidden="true">·</span> {streak.totalActiveDays} total
              </span>
            </div>

            <div
              data-testid="streak-calendar-grid"
              className={`grid gap-1.5 ${
                windowMode === '7d' ? 'grid-cols-7' : 'grid-cols-7'
              }`}
            >
              {visibleDays.map((day) => {
                const cellLabel = `${day.shortWeekday} ${day.dayNumber}: ${
                  day.completed
                    ? 'Study goal completed'
                    : day.isToday
                      ? 'Today — study goal pending'
                      : 'No study logged'
                }`;
                return (
                  <div
                    key={day.dateKey}
                    title={cellLabel}
                    aria-label={cellLabel}
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className={`text-[11px] font-medium ${
                        day.isToday ? 'text-[#0284C7] dark:text-sky-400 font-semibold' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {day.shortWeekday.slice(0, 2)}
                    </span>
                    <div
                      className={`w-full aspect-square max-w-[40px] rounded-lg border flex flex-col items-center justify-center transition-colors ${
                        day.completed && day.inActiveStreak
                          ? 'bg-[#059669] border-[#059669] text-white'
                          : day.completed
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                            : day.isToday
                              ? 'bg-sky-50/70 dark:bg-sky-950/40 border-dashed border-[#0284C7] dark:border-sky-400 text-[#0284C7] dark:text-sky-400'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {day.completed ? (
                        <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                      ) : (
                        <span className="font-mono text-xs tabular-nums">{day.dayNumber}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Milestone Progress */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {streak.nextMilestone
                  ? `Next milestone: ${streak.nextMilestone.title}`
                  : 'All streak milestones achieved'}
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                {streak.nextMilestone
                  ? `${streak.currentStreak} / ${streak.nextMilestone.days}d`
                  : `${streak.currentStreak}d`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0284C7] dark:bg-sky-400 transition-transform duration-200 origin-left"
                style={{
                  transform: `scaleX(${Math.max(0.03, streak.progressToNextPercent / 100)})`,
                }}
              />
            </div>
            {streak.nextMilestone && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {streak.daysToNextMilestone}{' '}
                {streak.daysToNextMilestone === 1 ? 'day' : 'days'} away from unlocking{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">{streak.nextMilestone.title}</span>.
              </p>
            )}
          </div>
        </div>

        {/* Primary Streak Action */}
        <div className="pt-2">
          {!streak.completedToday ? (
            <button
              type="button"
              data-testid="log-daily-goal-btn"
              onClick={onLogDailyStudyGoal}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              Log Today’s Study Goal ({profile.dailyMinutes} min)
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span
                data-testid="daily-goal-completed-label"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                Goal logged for today
              </span>
              <button
                type="button"
                data-testid="celebrate-milestone-btn"
                onClick={handleReplayStreakCelebration}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                Celebrate Streak
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Zone: Achievement Badges Gallery */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-5">
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Milestones & Honors <span aria-hidden="true">·</span>{' '}
                <span className="font-mono tabular-nums text-[#0F172A] dark:text-slate-100 font-semibold">
                  {unlockedCount} / {badges.length}
                </span>{' '}
                unlocked
              </p>
              <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                Achievement Badges
              </h2>
            </div>

            <div
              role="group"
              aria-label="Filter achievement badges"
              className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'consistency', label: 'Streaks' },
                  { id: 'mastery', label: 'Mastery' },
                  { id: 'excellence', label: 'Excellence' },
                ] as { id: CategoryFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  aria-pressed={categoryFilter === tab.id}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            data-testid="achievement-badges-grid"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {filteredBadges.map((badge) => (
              <button
                key={badge.id}
                type="button"
                data-testid={`badge-card-${badge.id}`}
                data-unlocked={badge.unlocked ? 'true' : 'false'}
                onClick={() => handleCelebrateBadge(badge)}
                disabled={!badge.unlocked}
                title={
                  badge.unlocked
                    ? `${badge.title} unlocked — click to celebrate`
                    : `${badge.title} — ${badge.progressLabel}`
                }
                className={`text-left rounded-xl border p-3.5 transition-colors flex items-start gap-3.5 ${
                  badge.unlocked
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-[#0284C7] dark:hover:border-sky-400 cursor-pointer'
                    : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 cursor-default'
                }`}
              >
                <BadgeMedallion
                  iconKey={badge.iconKey}
                  tier={badge.tier}
                  unlocked={badge.unlocked}
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm font-semibold leading-snug truncate ${
                        badge.unlocked ? 'text-[#0F172A] dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {badge.title}
                    </h3>
                    {badge.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] dark:text-emerald-400 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Unlocked
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                        {badge.progressLabel}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {badge.description}
                  </p>

                  {badge.unlocked ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      {tierLabel(badge.tier)} tier <span aria-hidden="true">·</span> Click to celebrate
                    </p>
                  ) : (
                    <div className="pt-1.5">
                      <div className="h-1.5 w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-500 dark:bg-slate-400 transition-transform duration-200 origin-left"
                          style={{
                            transform: `scaleX(${Math.max(0.03, badge.progressPercent / 100)})`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
          Earn badges automatically by hitting consecutive daily study goals, mastering syllabus
          modules, and scoring 90%+ on checkpoints.
        </p>
      </div>
    </section>
  );
};
