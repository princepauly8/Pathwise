import React from 'react';
import { ArrowLeft, Bot, CheckCircle2, Lock, Sparkles, Tag, Users } from 'lucide-react';
import {
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PRICE_INR,
} from '../utils/subscription';

interface PremiumFeatureGateProps {
  feature: 'combine' | 'tutor';
  trialEndDateLabel: string;
  onUnlockPremium: () => void;
  onBackToPaths: () => void;
}

const FEATURE_META = {
  combine: {
    title: 'Combine Study is a Premium Feature',
    subtitle:
      'Study live with classmates using shared focus timers, real-time room chat, and synchronized subject sprints.',
    icon: Users,
    highlights: [
      'Create or join private live Combine Study rooms with friends',
      'Shared Pomodoro sprint timer, presence board, and room chat',
      'Also unlocks unlimited Buddy AI 24/7 doubt solving for 7 years',
    ],
  },
  tutor: {
    title: 'Buddy AI Tutor is a Premium Feature',
    subtitle:
      'Ask syllabus-aligned doubts by text, voice, or photo and get step-by-step explanations in 47+ languages.',
    icon: Bot,
    highlights: [
      'Unlimited step-by-step doubt solving tailored to your class & syllabus',
      'Upload textbook photos or record voice questions in your native language',
      'Also unlocks live Combine Study rooms with friends for 7 years',
    ],
  },
} as const;

export const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  feature,
  trialEndDateLabel,
  onUnlockPremium,
  onBackToPaths,
}) => {
  const meta = FEATURE_META[feature];
  const Icon = meta.icon;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section
        data-testid="premium-feature-gate"
        data-feature={feature}
        aria-labelledby="premium-gate-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950/60 px-6 sm:px-8 py-6 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0284C7] dark:text-sky-400">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pathwise Premium · Combine Study &amp; Buddy AI</span>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1
                id="premium-gate-heading"
                className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100"
              >
                {meta.title}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                {meta.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Included with the {SUBSCRIPTION_DURATION_YEARS}-Year Scholar Pass
              </p>
              <span className="font-mono text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                ₹{SUBSCRIPTION_PRICE_INR} one-time · {SUBSCRIPTION_DURATION_YEARS} years
              </span>
            </div>

            <ul className="space-y-2.5">
              {meta.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-950/30 px-4 py-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2.5 leading-relaxed">
            <Tag className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-[#0F172A] dark:text-slate-100">
                Core tools stay free:
              </strong>{' '}
              Learning Paths, Study Kit, Exam Revision, YouTube Class, Practice, and Planner remain
              free even after your trial{trialEndDateLabel ? ` (ended ${trialEndDateLabel})` : ''}.
              Premium applies only to <strong>Combine Study</strong> and <strong>Buddy AI</strong>,
              and you can also apply a referral code during checkout.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              data-testid="premium-gate-back-btn"
              onClick={onBackToPaths}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Learning Paths
            </button>

            <button
              type="button"
              data-testid="premium-gate-unlock-btn"
              onClick={onUnlockPremium}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Unlock Combine Study &amp; Buddy AI (₹{SUBSCRIPTION_PRICE_INR} / {SUBSCRIPTION_DURATION_YEARS} Yrs)
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
