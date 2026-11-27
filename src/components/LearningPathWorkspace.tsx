import React, { useState } from 'react';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  BoardSyllabusSyncRecord,
  LearningModule,
  StudentProfile,
  SubjectPath,
} from '../types/study';
import { calculateOverallProgress, calculateSubjectProgress, STUDY_GOALS } from '../utils/learningPath';
import {
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PRICE_INR,
  formatInrAmount,
  getSubscriptionState,
} from '../utils/subscription';
import { SubjectMotifBanner } from './EditorialIllustration';
import { DashboardStreakAchievements } from './DashboardStreakAchievements';
import { BoardSyllabusSyncBar } from './BoardSyllabusSyncBar';
import type { CelebrationPayload } from '../utils/achievements';

interface LearningPathWorkspaceProps {
  profile: StudentProfile;
  activeSubject: string;
  selectedModuleId: string | null;
  adaptingSubject: string | null;
  adaptError: string | null;
  onSelectSubject: (subject: string) => void;
  onSelectModule: (moduleId: string) => void;
  onOpenStudyDesk: (subject: string, moduleId: string) => void;
  onOpenQuiz: (subject: string, moduleId: string) => void;
  onToggleMastery: (subject: string, moduleId: string) => void;
  onAdaptSubjectPath: (subject: string, note: string) => void;
  onGenerateMissingPath: (subject: string) => void;
  onOpenProfileModal: () => void;
  onOpenSubscription: () => void;
  onScheduleTopicAlert?: (subject: string, module: LearningModule) => void;
  onLogDailyStudyGoal: () => void;
  onTriggerCelebration: (payload: CelebrationPayload) => void;
  syllabusSyncRecord: BoardSyllabusSyncRecord | null;
  autoUpdateSyllabusEnabled: boolean;
  isSyncingBoardSyllabus: boolean;
  syllabusSyncError: string | null;
  onQuickSwitchBoard: (nextBoard: string) => void;
  onToggleAutoUpdateSyllabus: (enabled: boolean) => void;
  onSyncBoardSyllabusNow: () => void;
}

function StatusLabel({ status }: { status: LearningModule['status'] }) {
  if (status === 'mastered') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        Mastered
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] dark:text-sky-400 whitespace-nowrap">
        <PlayCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
      <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Up Next
    </span>
  );
}

export const LearningPathWorkspace: React.FC<LearningPathWorkspaceProps> = ({
  profile,
  activeSubject,
  selectedModuleId,
  adaptingSubject,
  adaptError,
  onSelectSubject,
  onSelectModule,
  onOpenStudyDesk,
  onOpenQuiz,
  onToggleMastery,
  onAdaptSubjectPath,
  onGenerateMissingPath,
  onOpenProfileModal,
  onOpenSubscription,
  onScheduleTopicAlert,
  onLogDailyStudyGoal,
  onTriggerCelebration,
  syllabusSyncRecord,
  autoUpdateSyllabusEnabled,
  isSyncingBoardSyllabus,
  syllabusSyncError,
  onQuickSwitchBoard,
  onToggleAutoUpdateSyllabus,
  onSyncBoardSyllabusNow,
}) => {
  const [adaptNote, setAdaptNote] = useState('');
  const subState = getSubscriptionState(profile.subscription, profile.createdAt);
  const overall = calculateOverallProgress(profile.subjects, profile.paths);
  const currentPath: SubjectPath | undefined = profile.paths[activeSubject];
  const subjectProgress = calculateSubjectProgress(currentPath);

  const selectedModule: LearningModule | null =
    currentPath?.modules.find((m) => m.id === selectedModuleId) ??
    subjectProgress.nextModule ??
    currentPath?.modules[0] ??
    null;

  const goalMeta = STUDY_GOALS.find((g) => g.id === profile.goal);
  const isAdaptingCurrent = adaptingSubject === activeSubject;

  const handleAdaptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adaptNote.trim();
    if (!trimmed) return;
    onAdaptSubjectPath(activeSubject, trimmed);
    setAdaptNote('');
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {goalMeta?.label ?? 'Guided Study'}{' '}
            <span aria-hidden="true">·</span> {profile.dailyMinutes} min/day plan
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
            {profile.name}’s Learning Paths
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpenProfileModal}
          className="inline-flex items-center gap-2 self-start md:self-auto px-4 py-2 text-sm font-medium text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          Manage Class & Syllabus
        </button>
      </div>

      {/* Subscription Banner: hidden during active free trial; shown once trial ends or Scholar Pass is active */}
      {(subState.isExpired || subState.isActivePass) && (
        <section
          aria-label="Student subscription status"
          data-testid="workspace-subscription-banner"
          className={`rounded-xl border px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            subState.isActivePass
              ? 'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/80'
              : 'bg-amber-50/80 dark:bg-amber-950/35 border-amber-300 dark:border-amber-800/80'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            {subState.isActivePass ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            )}
            <div className="text-sm text-[#0F172A] dark:text-slate-100 leading-snug">
              {subState.isActivePass ? (
                <>
                  <span className="font-semibold text-emerald-950 dark:text-emerald-200">7-Year Scholar Pass Active</span>{' '}
                  <span className="text-slate-600 dark:text-slate-300">
                    · Valid until <strong>{subState.passExpiryDateLabel}</strong> (
                    {formatInrAmount(subState.subscription.amountInr)}
                    {subState.subscription.paymentMethod ? ` via ${subState.subscription.paymentMethod}` : ' paid'})
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-amber-950 dark:text-amber-200">
                    Combine Study &amp; Buddy AI Trial Ended
                  </span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">
                    · Ended on <strong>{subState.trialEndDateLabel}</strong>. Learning Paths &amp; Study Kit stay free — unlock Combine Study &amp; Buddy AI with the{' '}
                    <strong className="text-[#0F172A] dark:text-slate-100">
                      ₹{SUBSCRIPTION_PRICE_INR} / {SUBSCRIPTION_DURATION_YEARS}-Year Scholar Pass
                    </strong>{' '}
                    or a referral code.
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSubscription}
            className={`inline-flex items-center justify-center gap-1.5 self-start sm:self-auto px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subState.isActivePass
                ? 'bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40'
                : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
            }`}
          >
            {subState.isActivePass
              ? 'View Pass Receipt'
              : `Unlock ${SUBSCRIPTION_DURATION_YEARS}-Year Pass (₹${SUBSCRIPTION_PRICE_INR})`}
          </button>
        </section>
      )}

      {/* Full-Width 4-Column Overview KPI Strip */}
      <section
        aria-label="Study progress overview"
        className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Subjects</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#0F172A] dark:text-slate-100 tabular-nums">
            {overall.subjectCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {profile.classLevel} · {profile.syllabus}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Modules Mastered</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#0F172A] dark:text-slate-100 tabular-nums">
            {overall.masteredModules}{' '}
            <span className="text-base font-normal text-slate-400 dark:text-slate-500">/ {overall.totalModules}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across selected subjects</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overall Mastery</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
            {overall.overallPercent}%
          </p>
          <div className="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0284C7] dark:bg-sky-400 transition-transform duration-200 origin-left"
              style={{ transform: `scaleX(${Math.max(0.02, overall.overallPercent / 100)})` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Remaining Study Time</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-[#0F172A] dark:text-slate-100 tabular-nums">
            {Math.ceil(overall.remainingMinutes / 60)}h{' '}
            <span className="text-base font-normal text-slate-500 dark:text-slate-400">
              {overall.remainingMinutes % 60}m
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ~{Math.max(1, Math.ceil(overall.remainingMinutes / profile.dailyMinutes))} study days left
          </p>
        </div>
      </section>

      {/* Visual Streak Counter & Achievement Badges */}
      <DashboardStreakAchievements
        profile={profile}
        onLogDailyStudyGoal={onLogDailyStudyGoal}
        onTriggerCelebration={onTriggerCelebration}
      />

      {/* Board Syllabus Auto-Updater (CBSE, ICSE, State Boards, IB, IGCSE) */}
      <BoardSyllabusSyncBar
        profile={profile}
        syncRecord={syllabusSyncRecord}
        autoUpdateEnabled={autoUpdateSyllabusEnabled}
        isSyncing={isSyncingBoardSyllabus}
        syncError={syllabusSyncError}
        onQuickSwitchBoard={onQuickSwitchBoard}
        onToggleAutoUpdate={onToggleAutoUpdateSyllabus}
        onSyncNow={onSyncBoardSyllabusNow}
      />

      {/* Subject Switcher Bar */}
      <div
        role="tablist"
        aria-label="Selected subjects"
        className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
      >
        {profile.subjects.map((subject) => {
          const isActive = subject === activeSubject;
          const prog = calculateSubjectProgress(profile.paths[subject]);
          return (
            <button
              key={subject}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSubject(subject)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2.5 ${
                isActive
                  ? 'border-[#0284C7] dark:border-sky-400 text-[#0F172A] dark:text-slate-100'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span>{subject}</span>
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                {prog.masteredCount}/{prog.totalModules}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content: Either Missing Path Generator OR Two-Zone Roadmap + Inspector */}
      {!currentPath ? (
        <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
            No learning path generated for {activeSubject} yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
            Generate a specialized {profile.classLevel} learning roadmap for {activeSubject},
            structured into four progressive stages aligned to your study goal.
          </p>
          {adaptError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 font-medium">
              {adaptError}
            </p>
          )}
          <button
            type="button"
            onClick={() => onGenerateMissingPath(activeSubject)}
            disabled={isAdaptingCurrent}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {isAdaptingCurrent ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Generating {activeSubject} Path...
              </>
            ) : (
              <>
                Generate {activeSubject} Learning Path
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </section>
      ) : (
        <>
          {/* Subject Strategy Header */}
          <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-[#0284C7] dark:text-sky-400">
                  {profile.classLevel} · {profile.syllabus}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {subjectProgress.percentComplete}% complete
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {subjectProgress.totalMinutes} min total
                </span>
                {currentPath.adaptationNote && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Tailored: “{currentPath.adaptationNote}”</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                {activeSubject} Study Roadmap
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {currentPath.overview}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
                <strong className="font-semibold text-slate-800 dark:text-slate-200">Study Strategy:</strong>{' '}
                {currentPath.focusStrategy}
              </p>
            </div>
            <SubjectMotifBanner domain={currentPath.domain} />
          </section>

          {/* Two-Zone Educational Layout: Left 65% Pathway / Right 35% Module Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Zone: Progressive Staged Roadmap */}
            <section aria-label={`${activeSubject} learning path modules`} className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                  Curriculum Sequence
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Select any module to inspect or study
                </span>
              </div>

              <div className="relative space-y-3">
                {currentPath.modules.map((mod, idx) => {
                  const isSelected = selectedModule?.id === mod.id;
                  return (
                    <div key={mod.id} className="relative">
                      {/* Connecting hairline between consecutive stages */}
                      {idx < currentPath.modules.length - 1 && (
                        <div
                          aria-hidden="true"
                          className="hidden sm:block absolute left-7 top-full h-3 w-px bg-slate-300 dark:bg-slate-700"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectModule(mod.id)}
                        aria-pressed={isSelected}
                        className={`w-full text-left rounded-xl border p-5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 border-[#0284C7] dark:border-sky-400 ring-1 ring-[#0284C7]/25 dark:ring-sky-400/25'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <span
                              className={`font-mono text-sm font-semibold tabular-nums pt-0.5 shrink-0 ${
                                mod.status === 'mastered'
                                  ? 'text-[#059669] dark:text-emerald-400'
                                  : isSelected
                                  ? 'text-[#0284C7] dark:text-sky-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              0{mod.order}.
                            </span>
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{mod.stage}</span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                                  {mod.estimatedMinutes} min
                                </span>
                                {typeof mod.bestQuizScore === 'number' && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                                      Best quiz {mod.bestQuizScore}%
                                    </span>
                                  </>
                                )}
                              </div>

                              <h4 className="text-base font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                                {mod.title}
                              </h4>
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                {mod.subtitle}
                              </p>

                              {mod.concepts.length > 0 && (
                                <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {mod.concepts.join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 pt-0.5">
                            <StatusLabel status={mod.status} />
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Right Zone: Module Inspector & Path Adaptation */}
            <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              {selectedModule && (
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-5">
                  <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Module 0{selectedModule.order} <span aria-hidden="true">·</span>{' '}
                        {selectedModule.stage}
                      </span>
                      <StatusLabel status={selectedModule.status} />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                      {selectedModule.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedModule.whyItMatters}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Learning Objectives
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      {selectedModule.objectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                          <span className="font-mono text-xs text-slate-400 dark:text-slate-500 pt-0.5 tabular-nums shrink-0">
                            {idx + 1}.
                          </span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenStudyDesk(activeSubject, selectedModule.id)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                      Open Study Kit
                    </button>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenQuiz(activeSubject, selectedModule.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                        Practice & PYQs
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleMastery(activeSubject, selectedModule.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            selectedModule.status === 'mastered'
                              ? 'text-[#059669] dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                          aria-hidden="true"
                        />
                        {selectedModule.status === 'mastered' ? 'Mark In Progress' : 'Mark Mastered'}
                      </button>
                    </div>

                    {onScheduleTopicAlert && selectedModule.status !== 'mastered' && (
                      <button
                        type="button"
                        data-testid="module-set-alert-btn"
                        onClick={() => onScheduleTopicAlert(activeSubject, selectedModule)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0284C7] dark:text-sky-300 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                        Set Completion Alert for This Topic
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AI Path Adaptation Control */}
              <form
                onSubmit={handleAdaptSubmit}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 space-y-3"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                    Adapt {activeSubject} Path with AI
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Tell Pathwise what feels challenging or what exam focus you want next, and it
                    will regenerate this subject’s sequence.
                  </p>
                </div>

                <label htmlFor="adapt-path-input" className="sr-only">
                  How should Pathwise adapt your {activeSubject} learning path?
                </label>
                <input
                  id="adapt-path-input"
                  type="text"
                  value={adaptNote}
                  onChange={(e) => setAdaptNote(e.target.value)}
                  placeholder="e.g., Focus more on numerical derivations & board proofs"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                />

                {adaptError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {adaptError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isAdaptingCurrent || !adaptNote.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {isAdaptingCurrent ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      Rebuilding {activeSubject} Path...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Rebuild Subject Path
                    </>
                  )}
                </button>
              </form>
            </aside>
          </div>
        </>
      )}
    </main>
  );
};
