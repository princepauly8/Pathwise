import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  CrashRevisionPack,
  Revision147Item,
  StudentProfile,
  TopicReminderItem,
} from '../types/study';
import { generateCrashRevisionApi } from '../utils/api';
import { generateCrashRevisionPdf } from '../utils/pdfMaker';
import {
  type Revision147Stage,
  build147AlertsForItem,
  create147Item,
  formatShortCalendarDate,
  get147StageStatus,
  getDue147Reviews,
  load147Items,
  loadCrashPacks,
  save147Items,
  saveCrashPacks,
  toggle147Stage,
} from '../utils/revision147';
import { getLocalDateKey } from '../utils/studyAlerts';

type RevisionMode = 'crash' | 'method147';
type CrashSectionTab = 'plan' | 'formulas' | 'drill' | 'traps';
type CrashBudget = 30 | 60 | 120 | 180;

interface RevisionHubProps {
  profile: StudentProfile;
  activeSubject: string;
  onSelectSubject: (subject: string) => void;
  onOpenStudyDesk: (subject: string, moduleId?: string) => void;
  onOpenPractice: (subject: string, moduleId?: string) => void;
  onSchedule147Alerts: (alerts: TopicReminderItem[]) => void;
}

const TIME_BUDGETS: Array<{ value: CrashBudget; label: string; hint: string }> = [
  { value: 30, label: '30 Min', hint: 'Last-Minute Sprint' },
  { value: 60, label: '1 Hour', hint: 'Rapid Exam Crash' },
  { value: 120, label: '2 Hours', hint: 'Full Subject Review' },
  { value: 180, label: '3 Hours', hint: 'Deep Exam Cram' },
];

function formatTimerClock(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const RevisionHub: React.FC<RevisionHubProps> = ({
  profile,
  activeSubject,
  onSelectSubject,
  onOpenStudyDesk,
  onOpenPractice,
  onSchedule147Alerts,
}) => {
  const [mode, setMode] = useState<RevisionMode>('crash');

  // --- EXAM CRASH REVISION STATE ---
  const [selectedSubject, setSelectedSubject] = useState<string>(
    activeSubject || profile.subjects[0] || 'Mathematics'
  );
  const [timeBudget, setTimeBudget] = useState<CrashBudget>(60);
  const [selectedTopicTitles, setSelectedTopicTitles] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState('');
  const [crashPacks, setCrashPacks] = useState<Record<string, CrashRevisionPack>>(() =>
    loadCrashPacks(profile.id)
  );
  const [isGeneratingCrash, setIsGeneratingCrash] = useState(false);
  const [crashError, setCrashError] = useState<string | null>(null);
  const [crashTab, setCrashTab] = useState<CrashSectionTab>('plan');
  const [revisedTopicIds, setRevisedTopicIds] = useState<Record<string, boolean>>({});
  const [recallHideFormulas, setRecallHideFormulas] = useState(false);
  const [revealedFormulaIdxs, setRevealedFormulaIdxs] = useState<Record<number, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Sprint Countdown Timer state
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [blockSecondsLeft, setBlockSecondsLeft] = useState(15 * 60);
  const [isSprintRunning, setIsSprintRunning] = useState(false);

  // --- 1-4-7 STUDY METHOD STATE ---
  const [items147, setItems147] = useState<Revision147Item[]>(() => load147Items(profile.id));
  const [new147Subject, setNew147Subject] = useState<string>(
    activeSubject || profile.subjects[0] || 'Mathematics'
  );
  const [new147ModuleId, setNew147ModuleId] = useState<string>('');
  const [new147Topic, setNew147Topic] = useState<string>('');
  const [new147StartDate, setNew147StartDate] = useState<string>(() => getLocalDateKey());
  const [new147Day1Done, setNew147Day1Done] = useState<boolean>(true);
  const [new147AutoAlert, setNew147AutoAlert] = useState<boolean>(true);
  const [method147Feedback, setMethod147Feedback] = useState<string | null>(null);

  useEffect(() => {
    setCrashPacks(loadCrashPacks(profile.id));
    setItems147(load147Items(profile.id));
  }, [profile.id]);

  useEffect(() => {
    if (activeSubject && profile.subjects.includes(activeSubject)) {
      setSelectedSubject(activeSubject);
      setNew147Subject(activeSubject);
    }
  }, [activeSubject, profile.subjects]);

  const currentPack: CrashRevisionPack | null = crashPacks[selectedSubject] ?? null;

  const subjectModules = useMemo(
    () => profile.paths[selectedSubject]?.modules ?? [],
    [profile.paths, selectedSubject]
  );

  const method147SubjectModules = useMemo(
    () => profile.paths[new147Subject]?.modules ?? [],
    [profile.paths, new147Subject]
  );

  // Sync timer when pack or block index changes
  useEffect(() => {
    if (!currentPack || currentPack.sprintBlocks.length === 0) return;
    const block = currentPack.sprintBlocks[activeBlockIdx] ?? currentPack.sprintBlocks[0];
    setBlockSecondsLeft(block.minutes * 60);
    setIsSprintRunning(false);
  }, [currentPack?.id, activeBlockIdx]);

  useEffect(() => {
    if (!isSprintRunning) return;
    const timer = window.setInterval(() => {
      setBlockSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsSprintRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSprintRunning]);

  const update147List = (next: Revision147Item[]) => {
    setItems147(next);
    save147Items(profile.id, next);
  };

  const handleToggleTopicChip = (title: string) => {
    setSelectedTopicTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title].slice(0, 8)
    );
  };

  const handleGenerateCrashPack = async () => {
    setIsGeneratingCrash(true);
    setCrashError(null);
    setPdfToast(null);
    try {
      const pack = await generateCrashRevisionApi({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: selectedSubject,
        timeBudgetMinutes: timeBudget,
        topics: selectedTopicTitles.length > 0 ? selectedTopicTitles : undefined,
        customFocus: customFocus.trim() || undefined,
      });

      const nextPacks = {
        ...crashPacks,
        [selectedSubject]: pack,
      };
      setCrashPacks(nextPacks);
      saveCrashPacks(profile.id, nextPacks);
      setRevisedTopicIds({});
      setSelectedAnswers({});
      setRevealedFormulaIdxs({});
      setActiveBlockIdx(0);
      setCrashTab('plan');
    } catch (err) {
      setCrashError(
        err instanceof Error ? err.message : 'Unable to generate Exam Crash Revision pack.'
      );
    } finally {
      setIsGeneratingCrash(false);
    }
  };

  const handleEnrollIn147 = (params: {
    subject: string;
    topicTitle: string;
    moduleId?: string;
    startDate?: string;
    day1Done?: boolean;
    autoAlert?: boolean;
  }) => {
    const cleanTitle = params.topicTitle.trim();
    if (!cleanTitle) return;

    const alreadyExists = items147.some(
      (it) =>
        it.subject.toLowerCase() === params.subject.toLowerCase() &&
        it.topicTitle.toLowerCase() === cleanTitle.toLowerCase()
    );
    if (alreadyExists) {
      setMethod147Feedback(`“${cleanTitle}” is already tracked in your 1-4-7 schedule.`);
      return;
    }

    const newItem = create147Item({
      subject: params.subject,
      topicTitle: cleanTitle,
      moduleId: params.moduleId,
      startDate: params.startDate,
      day1Done: params.day1Done,
    });
    update147List([newItem, ...items147]);

    if (params.autoAlert !== false) {
      const alerts = build147AlertsForItem(
        newItem,
        profile.reminders?.dailyStudyTime || '18:00'
      );
      onSchedule147Alerts(alerts);
      setMethod147Feedback(
        `Added “${newItem.topicTitle}” to 1-4-7! Alerts scheduled for Day 4 (${formatShortCalendarDate(
          newItem.day4Date
        )}) and Day 7 (${formatShortCalendarDate(newItem.day7Date)}).`
      );
    } else {
      setMethod147Feedback(
        `Added “${newItem.topicTitle}” to your 1-4-7 Revision Tracker.`
      );
    }
  };

  const handleAdd147FormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!new147Topic.trim()) {
      setMethod147Feedback('Please select or enter a topic name to start a 1-4-7 cycle.');
      return;
    }
    handleEnrollIn147({
      subject: new147Subject,
      topicTitle: new147Topic,
      moduleId: new147ModuleId || undefined,
      startDate: new147StartDate,
      day1Done: new147Day1Done,
      autoAlert: new147AutoAlert,
    });
    setNew147Topic('');
    setNew147ModuleId('');
  };

  const handleEnrollActiveSyllabusTopics = () => {
    const today = getLocalDateKey();
    const toAdd: Revision147Item[] = [];
    const generatedAlerts: TopicReminderItem[] = [];

    for (const sub of profile.subjects) {
      const mods = profile.paths[sub]?.modules ?? [];
      const candidate =
        mods.find((m) => m.status === 'in_progress') ?? mods.find((m) => m.status === 'up_next');
      if (!candidate) continue;

      const exists = items147.some(
        (it) =>
          it.subject === sub &&
          it.topicTitle.toLowerCase() === candidate.title.toLowerCase()
      );
      if (exists) continue;

      const created = create147Item({
        subject: sub,
        moduleId: candidate.id,
        topicTitle: candidate.title,
        startDate: today,
        day1Done: false,
      });
      toAdd.push(created);
      generatedAlerts.push(
        ...build147AlertsForItem(created, profile.reminders?.dailyStudyTime || '18:00')
      );
      if (toAdd.length >= 4) break;
    }

    if (toAdd.length === 0) {
      setMethod147Feedback('All your active syllabus topics are already in the 1-4-7 tracker!');
      return;
    }

    update147List([...toAdd, ...items147]);
    onSchedule147Alerts(generatedAlerts);
    setMethod147Feedback(
      `Enrolled ${toAdd.length} active syllabus topic${toAdd.length === 1 ? '' : 's'} with automatic Day 4 & Day 7 revision alerts.`
    );
  };

  const handleToggle147Stage = (id: string, stage: Revision147Stage) => {
    update147List(items147.map((item) => (item.id === id ? toggle147Stage(item, stage) : item)));
  };

  const handleDelete147Item = (id: string) => {
    update147List(items147.filter((item) => item.id !== id));
  };

  const todayKey = getLocalDateKey();
  const due147Reviews = useMemo(() => getDue147Reviews(items147, todayKey), [items147, todayKey]);
  const completed147Cycles = items147.filter((i) => i.day1Done && i.day4Done && i.day7Done).length;

  // Crash readiness stats
  const totalCrashTopics = currentPack?.highYieldTopics.length ?? 0;
  const revisedCrashCount = currentPack
    ? currentPack.highYieldTopics.filter((t) => revisedTopicIds[t.id]).length
    : 0;
  const totalDrillQs = currentPack?.rapidFireQuestions.length ?? 0;
  const correctDrillCount = currentPack
    ? currentPack.rapidFireQuestions.filter((q) => selectedAnswers[q.id] === q.correctIndex).length
    : 0;
  const readinessPct =
    totalCrashTopics + totalDrillQs > 0
      ? Math.round(((revisedCrashCount + correctDrillCount) / (totalCrashTopics + totalDrillQs)) * 100)
      : 0;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header + Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {profile.language || 'English'}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
            Exam Crash Revision & 1-4-7 Study Method
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Run an AI-generated high-yield exam crash sprint when exams are close, or lock chapters
            into long-term memory with the 1-4-7 spaced revision cycle.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Revision mode selector"
          className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start"
        >
          <button
            type="button"
            role="tab"
            data-testid="mode-crash-tab"
            aria-selected={mode === 'crash'}
            onClick={() => setMode('crash')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'crash'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-[#D97706] dark:text-amber-400" aria-hidden="true" />
            Exam Crash Revision
          </button>

          <button
            type="button"
            role="tab"
            data-testid="mode-147-tab"
            aria-selected={mode === 'method147'}
            onClick={() => setMode('method147')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'method147'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
            1-4-7 Study Method
            {due147Reviews.length > 0 && (
              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                {due147Reviews.length} due
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: EXAM CRASH REVISION                                           */}
      {/* ===================================================================== */}
      {mode === 'crash' && (
        <section aria-label="Exam Crash Revision Studio" className="space-y-6">
          {/* Setup Controls Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Subject Picker */}
              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="crash-subject-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Exam Subject
                </label>
                <select
                  id="crash-subject-select"
                  data-testid="crash-subject-select"
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedTopicTitles([]);
                    onSelectSubject(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#0F172A] dark:text-slate-100"
                >
                  {profile.subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Budget Picker */}
              <div className="md:col-span-5 space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Time Left Before Exam
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_BUDGETS.map((b) => {
                    const active = timeBudget === b.value;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setTimeBudget(b.value)}
                        aria-pressed={active}
                        className={`px-2.5 py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span className="block text-xs">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate CTA */}
              <div className="md:col-span-3">
                <button
                  type="button"
                  data-testid="generate-crash-pack-btn"
                  disabled={isGeneratingCrash}
                  onClick={handleGenerateCrashPack}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isGeneratingCrash ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Building Crash Pack...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      {currentPack ? 'Rebuild Crash Pack' : 'Build Crash Pack'}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Optional Syllabus Topic Filters + Weak Area Focus */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Focus Chapters (Optional — leave unselected for full high-weightage syllabus)
                  </span>
                  {selectedTopicTitles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopicTitles([])}
                      className="text-xs text-[#0284C7] dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Clear ({selectedTopicTitles.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {subjectModules.map((mod) => {
                    const selected = selectedTopicTitles.includes(mod.title);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleToggleTopicChip(mod.title)}
                        aria-pressed={selected}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {mod.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-1.5">
                <label
                  htmlFor="crash-focus-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Weak Areas or Exam Note (Optional)
                </label>
                <input
                  id="crash-focus-input"
                  type="text"
                  maxLength={240}
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  placeholder="e.g., Focus on numericals, derivations, and 5-mark proofs"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {crashError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
              <span>{crashError}</span>
            </div>
          )}

          {!currentPack ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-[#D97706] dark:text-amber-400 flex items-center justify-center mx-auto">
                <Zap className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-lg mx-auto">
                <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                  Ready for a {timeBudget}-Minute {selectedSubject} Exam Crash Sprint?
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Pathwise will generate a minute-by-minute revision schedule, must-know exam topics,
                  a formula/fact cheat sheet with Memory Recall Mode, common exam traps, and a
                  6-question rapid-fire drill — plus a downloadable PDF cheat sheet.
                </p>
              </div>
              <button
                type="button"
                disabled={isGeneratingCrash}
                onClick={handleGenerateCrashPack}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Generate {selectedSubject} Crash Revision Pack
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Pack Banner + Live Sprint Countdown + Readiness Meter */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Pack Overview & Readiness */}
                <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#0284C7] dark:text-sky-400">
                        {currentPack.subject} · {currentPack.timeBudgetMinutes}-Min Crash Pack ·{' '}
                        {currentPack.language}
                      </p>
                      <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                        {currentPack.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const fname = generateCrashRevisionPdf(currentPack, profile.name);
                        setPdfToast(`Downloaded ${fname}`);
                        window.setTimeout(() => setPdfToast(null), 3500);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                      Download Cheat Sheet PDF
                    </button>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {currentPack.examStrategy}
                  </p>

                  {pdfToast && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
                      {pdfToast}
                    </p>
                  )}

                  {/* Exam Readiness Progress */}
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0F172A] dark:text-slate-100">Crash Exam Readiness</span>
                      <span className="font-mono font-semibold text-[#059669] dark:text-emerald-400 tabular-nums">
                        {readinessPct}% ({revisedCrashCount}/{totalCrashTopics} topics ·{' '}
                        {correctDrillCount}/{totalDrillQs} drill)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#059669] dark:bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.max(4, readinessPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Live Timed Sprint Block Timer */}
                <div className="lg:col-span-5 rounded-xl bg-[#0F172A] dark:border dark:border-slate-700 text-white p-6 flex flex-col justify-between space-y-4">
                  {(() => {
                    const block =
                      currentPack.sprintBlocks[activeBlockIdx] ?? currentPack.sprintBlocks[0];
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                            Sprint Block {activeBlockIdx + 1} of{' '}
                            {Math.max(1, currentPack.sprintBlocks.length)}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {block ? `${block.minutes}m target` : ''}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            {block?.title || 'Focused Crash Revision'}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {block?.focusAction || 'Work through high-yield topics and formulas.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span
                            aria-live="polite"
                            className="font-mono text-4xl font-semibold tabular-nums tracking-tight"
                          >
                            {formatTimerClock(blockSecondsLeft)}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsSprintRunning((r) => !r)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg cursor-pointer"
                            >
                              {isSprintRunning ? (
                                <>
                                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                                  Start
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              aria-label="Reset block timer"
                              onClick={() => {
                                setIsSprintRunning(false);
                                setBlockSecondsLeft((block?.minutes ?? 15) * 60);
                              }}
                              className="p-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>

                            {currentPack.sprintBlocks.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveBlockIdx(
                                    (idx) => (idx + 1) % currentPack.sprintBlocks.length
                                  )
                                }
                                className="px-2.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                              >
                                Next
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Crash Sub-Navigation Tabs */}
              <div
                role="tablist"
                aria-label="Crash revision sections"
                className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3"
              >
                {[
                  {
                    id: 'plan' as const,
                    label: `High-Yield Plan (${currentPack.highYieldTopics.length})`,
                  },
                  {
                    id: 'formulas' as const,
                    label: `Formula & Fact Sheet (${currentPack.formulaCheatSheet.length})`,
                  },
                  {
                    id: 'drill' as const,
                    label: `Rapid-Fire Drill (${currentPack.rapidFireQuestions.length})`,
                  },
                  {
                    id: 'traps' as const,
                    label: `Exam Traps (${currentPack.commonMistakes.length})`,
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={crashTab === t.id}
                    onClick={() => setCrashTab(t.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      crashTab === t.id
                        ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* SUB-TAB 1: HIGH-YIELD TOPICS & TIMED BLOCKS */}
              {crashTab === 'plan' && (
                <div className="space-y-5">
                  {/* Sprint Timeline Strip */}
                  {currentPack.sprintBlocks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {currentPack.sprintBlocks.map((block, idx) => {
                        const isActive = idx === activeBlockIdx;
                        return (
                          <button
                            key={block.blockNumber}
                            type="button"
                            onClick={() => setActiveBlockIdx(idx)}
                            className={`text-left rounded-xl border p-4 space-y-1 transition-colors cursor-pointer ${
                              isActive
                                ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50/60 dark:bg-sky-950/40'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-semibold text-[#0284C7] dark:text-sky-400">
                                Block 0{block.blockNumber}
                              </span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">{block.minutes}m</span>
                            </div>
                            <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{block.title}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {block.focusAction}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Checkable High-Yield Topics */}
                  <div className="space-y-3">
                    {currentPack.highYieldTopics.map((item) => {
                      const done = Boolean(revisedTopicIds[item.id]);
                      return (
                        <article
                          key={item.id}
                          className={`rounded-xl border p-5 space-y-3 transition-colors ${
                            done
                              ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/30'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setRevisedTopicIds((prev) => ({
                                  ...prev,
                                  [item.id]: !prev[item.id],
                                }))
                              }
                              className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                            >
                              {done ? (
                                <CheckCircle2
                                  className="w-5 h-5 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Circle
                                  className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3
                                    className={`font-display text-lg font-semibold ${
                                      done ? 'line-through text-slate-500 dark:text-slate-400' : 'text-[#0F172A] dark:text-slate-100'
                                    }`}
                                  >
                                    {item.topic}
                                  </h3>
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                      item.weightage === 'Must-Know'
                                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300'
                                        : item.weightage === 'Quick Win'
                                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                          : 'bg-sky-100 dark:bg-sky-900/50 text-[#0284C7] dark:text-sky-300'
                                    }`}
                                  >
                                    {item.weightage}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  <strong>Exam clue:</strong> {item.examTrigger}
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleEnrollIn147({
                                  subject: currentPack.subject,
                                  topicTitle: item.topic,
                                  day1Done: true,
                                  autoAlert: true,
                                });
                                setMode('method147');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0284C7] dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/80 rounded-lg cursor-pointer self-start shrink-0"
                            >
                              <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              Track in 1-4-7
                            </button>
                          </div>

                          <ul className="pl-8 space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc">
                            {item.keyPoints.map((kp, i) => (
                              <li key={i} className="leading-relaxed">
                                {kp}
                              </li>
                            ))}
                          </ul>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: FORMULA & KEY-FACT CHEAT SHEET WITH MEMORY RECALL MODE */}
              {crashTab === 'formulas' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Toggle <strong>Memory Recall Mode</strong> to hide formulas and test active
                      recall before checking each card.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRecallHideFormulas((prev) => !prev);
                        setRevealedFormulaIdxs({});
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        recallHideFormulas
                          ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                          : 'bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {recallHideFormulas ? (
                        <>
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          Show All Formulas
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          Memory Recall Mode
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentPack.formulaCheatSheet.map((card, idx) => {
                      const isMasked = recallHideFormulas && !revealedFormulaIdxs[idx];
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{card.label}</h3>
                            {recallHideFormulas && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedFormulaIdxs((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="text-xs font-medium text-[#0284C7] dark:text-sky-400 hover:underline cursor-pointer"
                              >
                                {isMasked ? 'Reveal' : 'Hide'}
                              </button>
                            )}
                          </div>

                          <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3.5 py-3 font-mono text-sm font-semibold text-[#0284C7] dark:text-sky-400">
                            {isMasked ? '• • • Tap “Reveal” after recalling • • •' : card.expression}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            <strong>Memory tip:</strong> {card.quickMemoryTip}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: RAPID-FIRE EXAM DRILL */}
              {crashTab === 'drill' && (
                <div className="space-y-4">
                  {currentPack.rapidFireQuestions.map((q, idx) => {
                    const picked = selectedAnswers[q.id];
                    const answered = typeof picked === 'number';
                    const isCorrect = answered && picked === q.correctIndex;
                    return (
                      <article
                        key={q.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                            Q{idx + 1}. {q.question}
                          </h3>
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                            {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIdx) => {
                            const isPicked = picked === optIdx;
                            const isRightOpt = optIdx === q.correctIndex;
                            let cls =
                              'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 text-[#0F172A] dark:text-slate-100';
                            if (answered) {
                              if (isRightOpt) {
                                cls = 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold';
                              } else if (isPicked) {
                                cls = 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-300';
                              }
                            }
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                }
                                className={`text-left px-3.5 py-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${cls}`}
                              >
                                <span className="font-mono font-semibold mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {answered && (
                          <div
                            className={`rounded-lg border p-3.5 space-y-2 text-xs ${
                              isCorrect
                                ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
                                : 'border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                            }`}
                          >
                            <p className="font-semibold">
                              {isCorrect ? 'Correct!' : 'Review Answer Key:'} {q.answerKey}
                            </p>
                            {q.markingPoints.length > 0 && (
                              <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                                {q.markingPoints.map((mp, i) => (
                                  <li key={i}>{mp}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB 4: COMMON EXAM TRAPS */}
              {crashTab === 'traps' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentPack.commonMistakes.map((m, idx) => (
                    <article
                      key={idx}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="w-4 h-4 text-[#D97706] dark:text-amber-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Exam Trap #{idx + 1}
                          </p>
                          <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{m.trap}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                        <strong>How to avoid it:</strong> {m.fix}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: 1-4-7 STUDY METHOD (SPACED REPETITION TRACKER)                */}
      {/* ===================================================================== */}
      {mode === 'method147' && (
        <section aria-label="1-4-7 Study Method Tracker" className="space-y-6">
          {/* 3-Step 1-4-7 Explainer Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                day: 'DAY 1',
                title: 'Learn Deeply',
                desc: 'Understand the chapter concepts, make short notes, and work through core examples.',
                accent: 'text-[#0284C7] dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/80',
              },
              {
                day: 'DAY 4 (+3 Days)',
                title: 'Active Recall & Fix Gaps',
                desc: 'Test your memory without rereading passively—recall formulas and fix weak areas.',
                accent: 'text-[#D97706] dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80',
              },
              {
                day: 'DAY 7 (+6 Days)',
                title: 'Final Exam Mastery',
                desc: 'Solve timed exam-style questions to move the topic into long-term memory.',
                accent: 'text-[#059669] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80',
              },
            ].map((step) => (
              <div
                key={step.day}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2"
              >
                <span
                  className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${step.accent}`}
                >
                  {step.day}
                </span>
                <h2 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">{step.title}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Due Today / Overdue 1-4-7 Revision Queue */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                  Today’s 1-4-7 Revision Queue ({due147Reviews.length})
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Complete every due Day 1, Day 4, or Day 7 review below to beat the forgetting
                  curve.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono font-semibold text-[#059669] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-md">
                  {completed147Cycles} / {items147.length} Full 1-4-7 Cycles Mastered
                </span>
              </div>
            </div>

            {due147Reviews.length === 0 ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>
                  {items147.length === 0
                    ? 'No topics enrolled in 1-4-7 yet. Add a topic below or enroll your active syllabus topics in one click.'
                    : 'All due 1-4-7 revisions for today are complete! Check upcoming Day 4 & Day 7 dates below.'}
                </span>
                {items147.length === 0 && (
                  <button
                    type="button"
                    data-testid="enroll-syllabus-147-btn"
                    onClick={handleEnrollActiveSyllabusTopics}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  >
                    <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                    Enroll Active Syllabus Topics
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {due147Reviews.map((entry) => (
                  <article
                    key={`${entry.item.id}-${entry.stage}`}
                    className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      entry.status === 'overdue'
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30'
                        : 'border-sky-200 dark:border-sky-800/80 bg-sky-50/40 dark:bg-sky-950/30'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            entry.status === 'overdue'
                              ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200'
                              : 'bg-sky-100 dark:bg-sky-900/50 text-[#0284C7] dark:text-sky-300'
                          }`}
                        >
                          {entry.stageLabel} ·{' '}
                          {entry.status === 'overdue' ? 'Overdue' : 'Due Today'}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.item.subject}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                        {entry.item.topicTitle}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{entry.stageAction}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          entry.stage === 7
                            ? onOpenPractice(entry.item.subject, entry.item.moduleId)
                            : onOpenStudyDesk(entry.item.subject, entry.item.moduleId)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        {entry.stage === 7 ? (
                          <>
                            <ClipboardCheck className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                            Quiz Now
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                            Study Notes
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle147Stage(entry.item.id, entry.stage)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#059669] hover:bg-emerald-700 rounded-lg cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Mark Day {entry.stage} Done
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Add Topic to 1-4-7 Form */}
          <form
            onSubmit={handleAdd147FormSubmit}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                  Start a New 1-4-7 Revision Cycle
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Pick a topic you studied today—Pathwise automatically calculates Day 4 and Day 7
                  dates and schedules reminders.
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnrollActiveSyllabusTopics}
                className="text-xs font-semibold text-[#0284C7] dark:text-sky-400 hover:underline cursor-pointer self-start sm:self-auto"
              >
                + Auto-add Active Syllabus Topics
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="r147-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <select
                  id="r147-subject"
                  value={new147Subject}
                  onChange={(e) => {
                    setNew147Subject(e.target.value);
                    setNew147ModuleId('');
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
                >
                  {profile.subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="r147-module" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pick Syllabus Chapter (Optional)
                </label>
                <select
                  id="r147-module"
                  value={new147ModuleId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNew147ModuleId(id);
                    const mod = method147SubjectModules.find((m) => m.id === id);
                    if (mod) setNew147Topic(mod.title);
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
                >
                  <option value="">Custom topic name</option>
                  {method147SubjectModules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="r147-topic" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Name
                </label>
                <input
                  id="r147-topic"
                  data-testid="r147-topic-input"
                  type="text"
                  maxLength={140}
                  required
                  value={new147Topic}
                  onChange={(e) => setNew147Topic(e.target.value)}
                  placeholder="e.g., Laws of Motion"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label htmlFor="r147-start-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Day 1 Study Date
                </label>
                <input
                  id="r147-start-date"
                  type="date"
                  value={new147StartDate}
                  onChange={(e) => setNew147StartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-[#0F172A] dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={new147Day1Done}
                    onChange={(e) => setNew147Day1Done(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#0284C7]"
                  />
                  I finished Day 1 study today
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={new147AutoAlert}
                    onChange={(e) => setNew147AutoAlert(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#0284C7]"
                  />
                  <span className="inline-flex items-center gap-1">
                    <BellRing className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                    Auto-schedule Day 4 & Day 7 alerts
                  </span>
                </label>
              </div>

              <button
                type="submit"
                data-testid="add-147-topic-btn"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add to 1-4-7 Tracker
              </button>
            </div>

            {method147Feedback && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
                {method147Feedback}
              </p>
            )}
          </form>

          {/* All 1-4-7 Tracked Topics Board */}
          {items147.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                All Tracked 1-4-7 Topics ({items147.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items147.map((item) => {
                  const fullyMastered = item.day1Done && item.day4Done && item.day7Done;
                  const stages: Array<{
                    stage: Revision147Stage;
                    label: string;
                    date: string;
                    done: boolean;
                  }> = [
                    { stage: 1, label: 'Day 1 · Learn', date: item.day1Date, done: item.day1Done },
                    { stage: 4, label: 'Day 4 · Recall', date: item.day4Date, done: item.day4Done },
                    { stage: 7, label: 'Day 7 · Master', date: item.day7Date, done: item.day7Done },
                  ];

                  return (
                    <article
                      key={item.id}
                      data-testid="r147-topic-card"
                      className={`rounded-xl border p-5 space-y-4 ${
                        fullyMastered
                          ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-[#0284C7] dark:text-sky-400">{item.subject}</span>
                            {fullyMastered && (
                              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                1-4-7 Mastered
                              </span>
                            )}
                          </div>
                          <h3 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100 truncate">
                            {item.topicTitle}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete147Item(item.id)}
                          aria-label={`Remove ${item.topicTitle} from 1-4-7 tracker`}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      {/* 3-Stage 1-4-7 Stepper */}
                      <div className="grid grid-cols-3 gap-2">
                        {stages.map((st) => {
                          const status = get147StageStatus(st.date, st.done, todayKey);
                          const style =
                            status === 'done'
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                              : status === 'overdue'
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
                                : status === 'due_today'
                                  ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-300'
                                  : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 text-slate-600 dark:text-slate-400';

                          return (
                            <button
                              key={st.stage}
                              type="button"
                              onClick={() => handleToggle147Stage(item.id, st.stage)}
                              className={`rounded-lg border p-2.5 text-left space-y-1 transition-colors cursor-pointer ${style}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold">{st.label}</span>
                                {st.done ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden="true" />
                                )}
                              </div>
                              <p className="font-mono text-[11px] tabular-nums">
                                {formatShortCalendarDate(st.date)}
                              </p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide">
                                {status === 'done'
                                  ? 'Done'
                                  : status === 'overdue'
                                    ? 'Overdue'
                                    : status === 'due_today'
                                      ? 'Today'
                                      : 'Upcoming'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
};
