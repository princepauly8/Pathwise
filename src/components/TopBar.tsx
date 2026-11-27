import React from 'react';
import { Bell, BellRing, CheckCircle2, Flame, Lock, Moon, Sparkles, Sun } from 'lucide-react';
import type { StudentProfile, WorkspaceView } from '../types/study';
import { DEFAULT_LANGUAGE } from '../utils/languages';
import { calculateStudyStreak } from '../utils/learningPath';
import {
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PRICE_INR,
  getSubscriptionState,
  isPremiumView,
} from '../utils/subscription';
import type { ResolvedTheme } from '../utils/theme';
import { LanguageSelect } from './LanguageSelect';

interface TopBarProps {
  activeProfile: StudentProfile | null;
  activeView: WorkspaceView;
  isAuthenticated: boolean;
  isAuthScreen?: boolean;
  alertCount?: number;
  urgentAlertCount?: number;
  resolvedTheme: ResolvedTheme;
  onToggleTheme: () => void;
  onSelectView: (view: WorkspaceView) => void;
  onChangeLanguage: (language: string) => void;
  onOpenAlerts: () => void;
  onOpenSubscription: () => void;
  onOpenProfileModal: () => void;
  onLoadSample: () => void;
  onOpenAuth: () => void;
}

const NAV_ITEMS: { id: WorkspaceView; label: string }[] = [
  { id: 'paths', label: 'Learning Paths' },
  { id: 'study', label: 'Study Kit' },
  { id: 'revision', label: 'Exam Revision' },
  { id: 'youtube', label: 'YouTube Class' },
  { id: 'combine', label: 'Combine Study' },
  { id: 'practice', label: 'Practice' },
  { id: 'planner', label: 'Planner' },
  { id: 'tutor', label: 'Buddy AI' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeProfile,
  activeView,
  isAuthenticated,
  isAuthScreen = false,
  alertCount = 0,
  urgentAlertCount = 0,
  resolvedTheme,
  onToggleTheme,
  onSelectView,
  onChangeLanguage,
  onOpenAlerts,
  onOpenSubscription,
  onOpenProfileModal,
  onLoadSample,
  onOpenAuth,
}) => {
  const isDark = resolvedTheme === 'dark';
  const activeSubState = activeProfile
    ? getSubscriptionState(activeProfile.subscription, activeProfile.createdAt)
    : null;

  return (
    <header className="sticky top-0 z-30 bg-[var(--pw-bg)]/95 backdrop-blur-sm border-b border-[var(--pw-border)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2.5 xl:gap-4">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (activeProfile) onSelectView('paths');
          }}
          className="font-display text-xl font-semibold tracking-tight text-[var(--pw-text)] whitespace-nowrap shrink-0"
        >
          Pathwise
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        {activeProfile ? (
          <nav
            aria-label="Primary workspace navigation"
            className="hidden 2xl:flex items-center gap-4 text-[13px] font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              const isLockedPremium = Boolean(activeSubState?.isExpired && isPremiumView(item.id));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={
                    isLockedPremium
                      ? `${item.label} requires Premium (₹${SUBSCRIPTION_PRICE_INR} / ${SUBSCRIPTION_DURATION_YEARS} Yrs or referral code)`
                      : undefined
                  }
                  className={`inline-flex items-center gap-1 py-1 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-[var(--pw-text)] border-[#0284C7] dark:border-sky-400'
                      : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-[var(--pw-text)] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{item.label}</span>
                  {isLockedPremium && (
                    <Lock
                      className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0"
                      aria-label="Premium feature"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        ) : !isAuthScreen ? (
          <nav
            aria-label="Account setup sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            <a href="#student-profile" className="hover:text-[var(--pw-text)] transition-colors whitespace-nowrap shrink-0">
              Class & Syllabus
            </a>
            <a href="#subject-picker" className="hover:text-[var(--pw-text)] transition-colors whitespace-nowrap shrink-0">
              Subjects
            </a>
            <a href="#study-goal" className="hover:text-[var(--pw-text)] transition-colors whitespace-nowrap shrink-0">
              Study Plan
            </a>
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Zone 3: Theme toggle + Language selector + Study streak counter + primary profile/auth action */}
        <div className="flex items-center gap-2 2xl:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle-btn"
            aria-pressed={isDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {activeProfile ? (
            <>
              <div className="hidden sm:block">
                <LanguageSelect
                  id="topbar-language-select"
                  value={activeProfile.language || DEFAULT_LANGUAGE}
                  onChange={onChangeLanguage}
                  compact
                />
              </div>

              {(() => {
                const streak = calculateStudyStreak(activeProfile.completedDates);
                const tooltip =
                  streak.currentStreak === 0
                    ? '0-day study streak — complete a learning module today to start your streak'
                    : streak.completedToday
                    ? `${streak.currentStreak}-day study streak — today’s module completed`
                    : `${streak.currentStreak}-day study streak — complete a module today to extend it`;

                return (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('paths');
                      window.setTimeout(() => {
                        document
                          .getElementById('streak-achievements')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 60);
                    }}
                    title={tooltip}
                    aria-label={tooltip}
                    data-testid="study-streak-counter"
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Flame
                      className={`w-4 h-4 shrink-0 ${
                        streak.completedToday
                          ? 'text-[#D97706] dark:text-amber-400 fill-[#D97706]/25 dark:fill-amber-400/25'
                          : streak.currentStreak > 0
                          ? 'text-[#D97706] dark:text-amber-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs font-semibold tabular-nums text-[var(--pw-text)]">
                      {streak.currentStreak}d
                    </span>
                    <span className="hidden 2xl:inline text-xs text-slate-500 dark:text-slate-400">streak</span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={onOpenAlerts}
                data-testid="study-alerts-bell-btn"
                title={
                  urgentAlertCount > 0
                    ? `${urgentAlertCount} urgent study alert${urgentAlertCount === 1 ? '' : 's'} — click to view reminders`
                    : `${alertCount} study & topic reminder${alertCount === 1 ? '' : 's'}`
                }
                aria-label={
                  urgentAlertCount > 0
                    ? `Study notifications: ${urgentAlertCount} due now`
                    : `Study notifications: ${alertCount} reminders`
                }
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                  urgentAlertCount > 0
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {urgentAlertCount > 0 ? (
                  <BellRing className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Bell className="w-4 h-4" aria-hidden="true" />
                )}
                {alertCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center text-white ${
                      urgentAlertCount > 0 ? 'bg-amber-600' : 'bg-[#0284C7]'
                    }`}
                  >
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </button>

              {activeSubState && (activeSubState.isExpired || activeSubState.isActivePass) && (
                <button
                  type="button"
                  onClick={onOpenSubscription}
                  data-testid="subscription-status-btn"
                  title={
                    activeSubState.isActivePass
                      ? `${SUBSCRIPTION_DURATION_YEARS}-Year Scholar Pass active until ${activeSubState.passExpiryDateLabel} (Combine Study & Buddy AI unlocked)`
                      : `Unlock Combine Study & Buddy AI with the ${SUBSCRIPTION_DURATION_YEARS}-Year Pass (₹${SUBSCRIPTION_PRICE_INR})`
                  }
                  className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeSubState.isActivePass
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  }`}
                >
                  {activeSubState.isActivePass ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{SUBSCRIPTION_DURATION_YEARS}-Year Pass</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>₹{SUBSCRIPTION_PRICE_INR} / {SUBSCRIPTION_DURATION_YEARS} Yrs</span>
                    </>
                  )}
                </button>
              )}

              <button
                key="profile-cta"
                type="button"
                onClick={onOpenProfileModal}
                data-testid="profile-settings-btn"
                className="px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-[var(--pw-text)] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer max-w-[115px] sm:max-w-[145px] 2xl:max-w-[195px] truncate"
              >
                {activeProfile.name.split(' ')[0]} · {activeProfile.classLevel} · {activeProfile.syllabus}
              </button>
            </>
          ) : isAuthenticated || isAuthScreen ? (
            <button
              key="sample-cta-auth"
              type="button"
              onClick={onLoadSample}
              className="px-4 py-2 text-sm font-medium text-[var(--pw-text)] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Preview Sample
            </button>
          ) : (
            <button
              key="signin-cta"
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
      </div>

      {/* Compact secondary navigation strip for viewports below 2xl */}
      {activeProfile && (
        <nav
          aria-label="Mobile workspace navigation"
          className="2xl:hidden border-t border-[var(--pw-border)] px-4 sm:px-6 overflow-x-auto flex items-center gap-5 h-11"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            const isLockedPremium = Boolean(activeSubState?.isExpired && isPremiumView(item.id));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1 text-xs font-medium py-2 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--pw-text)] border-[#0284C7] dark:border-sky-400'
                    : 'text-slate-600 dark:text-slate-400 border-transparent'
                }`}
              >
                <span>{item.label}</span>
                {isLockedPremium && (
                  <Lock
                    className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0"
                    aria-label="Premium feature"
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
