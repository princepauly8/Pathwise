import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CopyCheck,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  HelpCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type {
  AptitudeQuestion,
  ExampleQuestion,
  LearningModule,
  PreviousYearPaper,
  SimilarPaperDifficulty,
  StudentProfile,
} from '../types/study';
import {
  generateAptitudeQuestionsApi,
  generateExampleQuestionsApi,
  generatePreviousYearPaperApi,
  generateSimilarPreviousYearPaperApi,
} from '../utils/api';
import {
  evaluateQuizScore,
  getSampleAptitudeQuestions,
  getSampleExampleQuestions,
  getSamplePreviousYearPaper,
} from '../utils/learningPath';
import { generatePreviousYearPaperPdf } from '../utils/pdfMaker';
import {
  PREVIOUS_YEAR_OPTIONS,
  SIMILAR_DIFFICULTY_OPTIONS,
  buildSampleSimilarPreviousYearPaper,
  extractYearDigits,
} from '../utils/similarPaper';

type PracticeTab = 'quiz' | 'examples' | 'aptitude' | 'pyq' | 'similar_pyq';

interface PracticeStudioProps {
  profile: StudentProfile;
  activeSubject: string;
  activeModuleId: string | null;
  isGeneratingQuiz: boolean;
  quizError: string | null;
  onSelectSubjectAndModule: (subject: string, moduleId: string) => void;
  onGenerateQuiz: (subject: string, module: LearningModule) => void;
  onRecordScore: (subject: string, moduleId: string, percentage: number) => void;
  onOpenStudyKit: (subject: string, moduleId: string) => void;
}

const PRACTICE_TABS: {
  id: PracticeTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'quiz', label: 'Quiz', icon: ClipboardCheck },
  { id: 'examples', label: 'Example Questions', icon: HelpCircle },
  { id: 'aptitude', label: 'Aptitude Questions', icon: Brain },
  { id: 'pyq', label: 'Previous Year Paper', icon: FileSpreadsheet },
  { id: 'similar_pyq', label: 'Similar Past Paper', icon: CopyCheck },
];

export const PracticeStudio: React.FC<PracticeStudioProps> = ({
  profile,
  activeSubject,
  activeModuleId,
  isGeneratingQuiz,
  quizError,
  onSelectSubjectAndModule,
  onGenerateQuiz,
  onRecordScore,
  onOpenStudyKit,
}) => {
  const [activeTab, setActiveTab] = useState<PracticeTab>('quiz');

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Example Questions state (cached per subject)
  const [exampleCache, setExampleCache] = useState<Record<string, ExampleQuestion[]>>({});
  const [expandedExamples, setExpandedExamples] = useState<Record<string, boolean>>({});
  const [loadingExamples, setLoadingExamples] = useState(false);

  // Aptitude Questions state
  const [aptitudeCache, setAptitudeCache] = useState<Record<string, AptitudeQuestion[]>>({});
  const [aptitudePicks, setAptitudePicks] = useState<Record<string, number>>({});
  const [aptitudeChecked, setAptitudeChecked] = useState<Record<string, boolean>>({});
  const [loadingAptitude, setLoadingAptitude] = useState(false);

  // PYQ Paper state
  const [pyqYear, setPyqYear] = useState<string>(PREVIOUS_YEAR_OPTIONS[0]);
  const [pyqCache, setPyqCache] = useState<Record<string, PreviousYearPaper>>({});
  const [expandedPyq, setExpandedPyq] = useState<Record<string, boolean>>({});
  const [loadingPyq, setLoadingPyq] = useState(false);

  // Similar Question Paper from Previous Year state
  const [similarYear, setSimilarYear] = useState<string>(PREVIOUS_YEAR_OPTIONS[0]);
  const [similarDifficulty, setSimilarDifficulty] = useState<SimilarPaperDifficulty>('same');
  const [similarCache, setSimilarCache] = useState<Record<string, PreviousYearPaper>>({});
  const [expandedSimilarScheme, setExpandedSimilarScheme] = useState<Record<string, boolean>>({});
  const [expandedSimilarCompare, setExpandedSimilarCompare] = useState<Record<string, boolean>>({});
  const [includeSolutionsInPdf, setIncludeSolutionsInPdf] = useState(false);
  const [lastPaperPdfName, setLastPaperPdfName] = useState<string | null>(null);
  const [loadingSimilarPyq, setLoadingSimilarPyq] = useState(false);

  const [packError, setPackError] = useState<string | null>(null);

  const currentPath = profile.paths[activeSubject];
  const activeModule: LearningModule | undefined =
    currentPath?.modules.find((m) => m.id === activeModuleId) ??
    currentPath?.modules.find((m) => m.status === 'in_progress') ??
    currentPath?.modules[0];

  const questions = activeModule?.quiz ?? [];
  const evaluation = useMemo(
    () => (quizSubmitted ? evaluateQuizScore(questions, quizAnswers) : null),
    [quizSubmitted, questions, quizAnswers]
  );

  const cacheKey = `${activeSubject}::${profile.syllabus}::${profile.classLevel}`;
  const pyqCacheKey = `${cacheKey}::${pyqYear}`;
  const similarCacheKey = `${cacheKey}::${similarYear}::${similarDifficulty}`;

  const exampleQuestions = useMemo(
    () => exampleCache[cacheKey] ?? getSampleExampleQuestions(activeSubject, profile.syllabus),
    [exampleCache, cacheKey, activeSubject, profile.syllabus]
  );

  const aptitudeQuestions = useMemo(
    () => aptitudeCache[cacheKey] ?? getSampleAptitudeQuestions(profile.classLevel),
    [aptitudeCache, cacheKey, profile.classLevel]
  );

  const pyqPaper = useMemo(() => {
    const cached = pyqCache[pyqCacheKey];
    if (cached) return cached;
    const base = getSamplePreviousYearPaper(profile.classLevel, profile.syllabus, activeSubject);
    return {
      ...base,
      year: `${pyqYear} Board Pattern`,
      title: `${profile.syllabus} ${profile.classLevel} ${activeSubject} — ${pyqYear} Board Question Paper`,
    };
  }, [pyqCache, pyqCacheKey, pyqYear, profile.classLevel, profile.syllabus, activeSubject]);

  const similarPaper = useMemo(
    () =>
      similarCache[similarCacheKey] ??
      buildSampleSimilarPreviousYearPaper({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        subject: activeSubject,
        referenceYear: similarYear,
        difficulty: similarDifficulty,
        referencePaper: pyqCache[`${cacheKey}::${similarYear}`] ?? (pyqYear === similarYear ? pyqPaper : undefined),
      }),
    [
      similarCache,
      similarCacheKey,
      profile.classLevel,
      profile.syllabus,
      activeSubject,
      similarYear,
      similarDifficulty,
      pyqCache,
      cacheKey,
      pyqYear,
      pyqPaper,
    ]
  );

  const handleSelectSubjectModule = (subject: string, modId: string) => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setPackError(null);
    onSelectSubjectAndModule(subject, modId);
  };

  const handleSubmitQuiz = () => {
    if (!activeModule || questions.length === 0) return;
    const result = evaluateQuizScore(questions, quizAnswers);
    setQuizSubmitted(true);
    onRecordScore(activeSubject, activeModule.id, result.percentage);
  };

  const handleGenerateExamples = async () => {
    setLoadingExamples(true);
    setPackError(null);
    try {
      const generated = await generateExampleQuestionsApi({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        moduleTitle: activeModule?.title,
      });
      if (generated.length > 0) {
        setExampleCache((prev) => ({ ...prev, [cacheKey]: generated }));
        setExpandedExamples({});
      }
    } catch (err) {
      setPackError(err instanceof Error ? err.message : 'Unable to generate example questions.');
    } finally {
      setLoadingExamples(false);
    }
  };

  const handleGenerateAptitude = async () => {
    setLoadingAptitude(true);
    setPackError(null);
    try {
      const generated = await generateAptitudeQuestionsApi({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        moduleTitle: activeModule?.title,
      });
      if (generated.length > 0) {
        setAptitudeCache((prev) => ({ ...prev, [cacheKey]: generated }));
        setAptitudePicks({});
        setAptitudeChecked({});
      }
    } catch (err) {
      setPackError(err instanceof Error ? err.message : 'Unable to generate aptitude questions.');
    } finally {
      setLoadingAptitude(false);
    }
  };

  const handleGeneratePyq = async () => {
    setLoadingPyq(true);
    setPackError(null);
    setLastPaperPdfName(null);
    try {
      const paper = await generatePreviousYearPaperApi({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        moduleTitle: activeModule?.title,
        referenceYear: pyqYear,
      });
      if (paper && paper.questions?.length > 0) {
        setPyqCache((prev) => ({ ...prev, [pyqCacheKey]: paper }));
        setExpandedPyq({});
      }
    } catch (err) {
      setPackError(err instanceof Error ? err.message : 'Unable to generate previous year paper.');
    } finally {
      setLoadingPyq(false);
    }
  };

  const handleGenerateSimilarPyq = async (overrideOpts?: {
    year?: string;
    difficulty?: SimilarPaperDifficulty;
    referencePaper?: PreviousYearPaper;
  }) => {
    const targetYear = extractYearDigits(overrideOpts?.year ?? similarYear);
    const targetDifficulty = overrideOpts?.difficulty ?? similarDifficulty;
    const targetRefPaper =
      overrideOpts?.referencePaper ??
      pyqCache[`${cacheKey}::${targetYear}`] ??
      (pyqYear === targetYear ? pyqPaper : undefined);
    const targetKey = `${cacheKey}::${targetYear}::${targetDifficulty}`;

    setSimilarYear(targetYear);
    setSimilarDifficulty(targetDifficulty);
    setLoadingSimilarPyq(true);
    setPackError(null);
    setLastPaperPdfName(null);

    try {
      const paper = await generateSimilarPreviousYearPaperApi({
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        moduleTitle: activeModule?.title,
        referenceYear: targetYear,
        difficulty: targetDifficulty,
        referencePaper: targetRefPaper,
      });
      if (paper && paper.questions?.length > 0) {
        setSimilarCache((prev) => ({ ...prev, [targetKey]: paper }));
        setExpandedSimilarScheme({});
        setExpandedSimilarCompare({});
      }
    } catch (err) {
      setPackError(
        err instanceof Error
          ? err.message
          : 'Unable to generate a similar previous year question paper right now.'
      );
    } finally {
      setLoadingSimilarPyq(false);
    }
  };

  const handleCreateSimilarFromCurrentPyq = () => {
    const refYear = extractYearDigits(pyqPaper.year || pyqYear);
    setActiveTab('similar_pyq');
    void handleGenerateSimilarPyq({
      year: refYear,
      difficulty: similarDifficulty,
      referencePaper: pyqPaper,
    });
  };

  const handleDownloadPaperPdf = (paper: PreviousYearPaper, withSolutions: boolean) => {
    const fileName = generatePreviousYearPaperPdf(paper, profile.name, {
      includeMarkingScheme: withSolutions,
    });
    setLastPaperPdfName(fileName);
  };

  const allSimilarSchemesExpanded =
    similarPaper.questions.length > 0 &&
    similarPaper.questions.every((item) =>
      Boolean(expandedSimilarScheme[`${similarPaper.title}-${item.number}`])
    );

  const handleToggleAllSimilarSchemes = () => {
    if (allSimilarSchemesExpanded) {
      setExpandedSimilarScheme({});
      return;
    }
    const next: Record<string, boolean> = {};
    similarPaper.questions.forEach((item) => {
      next[`${similarPaper.title}-${item.number}`] = true;
    });
    setExpandedSimilarScheme(next);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Subject/Module Pickers */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {activeSubject}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
            Practice, Aptitude & Past Papers
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="practice-subject-select" className="sr-only">
            Choose subject
          </label>
          <select
            id="practice-subject-select"
            value={activeSubject}
            onChange={(e) => {
              const nextSub = e.target.value;
              const firstMod = profile.paths[nextSub]?.modules[0]?.id ?? '';
              handleSelectSubjectModule(nextSub, firstMod);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100"
          >
            {profile.subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          {currentPath && activeModule && (
            <>
              <label htmlFor="practice-module-select" className="sr-only">
                Choose module
              </label>
              <select
                id="practice-module-select"
                value={activeModule.id}
                onChange={(e) => handleSelectSubjectModule(activeSubject, e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 max-w-xs"
              >
                {currentPath.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    0{m.order}. {m.title}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Practice Mode Tabs */}
      <div
        role="tablist"
        aria-label="Practice modes"
        className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-0.5"
      >
        {PRACTICE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                setPackError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'border-[#0284C7] dark:border-sky-400 text-[#0F172A] dark:text-slate-100'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0284C7] dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {(quizError || packError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          <span>{quizError ?? packError}</span>
        </div>
      )}

      {/* MODE 1: CHECKPOINT QUIZ */}
      {activeTab === 'quiz' && (
        <section aria-label="Module checkpoint quiz" className="space-y-6">
          {!activeModule ? (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Generate a learning path for {activeSubject} first to run a module checkpoint quiz.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Module 0{activeModule.order} Checkpoint <span aria-hidden="true">·</span> Pass
                    threshold 70%
                    {typeof activeModule.bestQuizScore === 'number' && (
                      <>
                        {' '}
                        <span aria-hidden="true">·</span>{' '}
                        <span className="font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                          Best: {activeModule.bestQuizScore}%
                        </span>
                      </>
                    )}
                  </p>
                  <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                    {activeModule.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isGeneratingQuiz}
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                      onGenerateQuiz(activeSubject, activeModule);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {isGeneratingQuiz ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    Generate Fresh AI Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenStudyKit(activeSubject, activeModule.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    Study Notes
                  </button>
                </div>
              </div>

              {isGeneratingQuiz ? (
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-12 text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-medium text-[#0F172A] dark:text-slate-100">
                    Generating {profile.syllabus} checkpoint questions...
                  </p>
                </div>
              ) : questions.length === 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 text-center space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No checkpoint quiz generated for this module yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => onGenerateQuiz(activeSubject, activeModule)}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
                  >
                    Generate AI Quiz Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluation && (
                    <div
                      className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        evaluation.passed
                          ? 'bg-[#059669]/10 dark:bg-emerald-950/40 border-[#059669]/30 dark:border-emerald-800/80'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="font-mono text-lg font-semibold text-[#0F172A] dark:text-slate-100 tabular-nums">
                          Score: {evaluation.correct} / {evaluation.total} ({evaluation.percentage}%)
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {evaluation.passed
                            ? 'Mastery verified — this module is automatically marked Mastered on your roadmap.'
                            : 'Score 70% or higher to mark this module mastered. Review missed explanations below.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizAnswers({});
                          setQuizSubmitted(false);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
                      >
                        Retake Quiz
                      </button>
                    </div>
                  )}

                  {questions.map((q, qIdx) => {
                    const picked = quizAnswers[q.id];
                    return (
                      <article
                        key={q.id}
                        className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              Q0{qIdx + 1} · {q.conceptTag}
                            </p>
                            <h3 className="text-base font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                              {q.question}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIdx) => {
                            const isPicked = picked === optIdx;
                            const isCorrect = optIdx === q.correctIndex;
                            let cls =
                              'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500';
                            if (quizSubmitted) {
                              if (isCorrect) {
                                cls = 'bg-[#059669]/10 dark:bg-emerald-950/50 border-[#059669] dark:border-emerald-500 text-[#0F172A] dark:text-emerald-100';
                              } else if (isPicked) {
                                cls = 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-500 text-red-900 dark:text-red-200';
                              }
                            } else if (isPicked) {
                              cls = 'bg-[#0284C7]/10 dark:bg-sky-950/50 border-[#0284C7] dark:border-sky-400 text-[#0F172A] dark:text-sky-100';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => {
                                  if (!quizSubmitted) {
                                    setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                                  }
                                }}
                                className={`text-left px-4 py-3 text-sm rounded-lg border transition-colors cursor-pointer ${cls}`}
                              >
                                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
                            <strong className="font-semibold text-[#0F172A] dark:text-slate-100">Explanation:</strong>{' '}
                            {q.explanation}
                          </p>
                        )}
                      </article>
                    );
                  })}

                  {!quizSubmitted && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {Object.keys(quizAnswers).length} / {questions.length} answered
                      </span>
                      <button
                        type="button"
                        disabled={Object.keys(quizAnswers).length < questions.length}
                        onClick={handleSubmitQuiz}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                      >
                        Submit Checkpoint Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* MODE 2: EXAMPLE QUESTIONS */}
      {activeTab === 'examples' && (
        <section aria-label="Worked example questions" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                Step-by-Step Board Solutions · {profile.syllabus}
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                Example Questions — {activeSubject}
              </h2>
            </div>
            <button
              type="button"
              disabled={loadingExamples}
              onClick={handleGenerateExamples}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer self-start whitespace-nowrap"
            >
              {loadingExamples ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Generate New AI Examples
            </button>
          </div>

          <div className="space-y-4">
            {exampleQuestions.map((ex, idx) => {
              const isOpen = expandedExamples[ex.id] ?? idx === 0;
              return (
                <article
                  key={ex.id}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden"
                >
                  <div className="p-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">
                        Example 0{idx + 1} · {ex.marks} Marks · {ex.difficulty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedExamples((prev) => ({ ...prev, [ex.id]: !isOpen }))
                        }
                        className="inline-flex items-center gap-1 font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer"
                      >
                        {isOpen ? 'Hide Solution' : 'Show Step-by-Step Solution'}
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <h3 className="text-base font-semibold text-[#0F172A] dark:text-slate-100 leading-relaxed">
                      {ex.question}
                    </h3>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 p-6 space-y-4">
                      <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                        {ex.steps.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-3 leading-relaxed">
                            <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 pt-0.5 tabular-nums shrink-0">
                              Step {sIdx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-[#0F172A] dark:text-slate-100">
                        <strong className="font-semibold text-[#059669] dark:text-emerald-400">Final Answer:</strong>{' '}
                        {ex.finalAnswer}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">Examiner Tip:</strong>{' '}
                        {ex.examTip}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* MODE 3: APTITUDE TYPE QUESTIONS */}
      {activeTab === 'aptitude' && (
        <section aria-label="Aptitude type questions" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                Quantitative · Logical Reasoning · Pattern & Data
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                Aptitude Type Questions
              </h2>
            </div>
            <button
              type="button"
              disabled={loadingAptitude}
              onClick={handleGenerateAptitude}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer self-start whitespace-nowrap"
            >
              {loadingAptitude ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Generate New Aptitude Drill
            </button>
          </div>

          <div className="space-y-4">
            {aptitudeQuestions.map((q, idx) => {
              const picked = aptitudePicks[q.id];
              const isChecked = Boolean(aptitudeChecked[q.id]);
              return (
                <article
                  key={q.id}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Aptitude 0{idx + 1} · {q.category}
                    </p>
                    <h3 className="text-base font-semibold text-[#0F172A] dark:text-slate-100 leading-relaxed">
                      {q.question}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isPicked = picked === optIdx;
                      const isCorrect = optIdx === q.correctIndex;
                      let cls =
                        'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500';
                      if (isChecked) {
                        if (isCorrect) {
                          cls = 'bg-[#059669]/10 dark:bg-emerald-950/50 border-[#059669] dark:border-emerald-500 text-[#0F172A] dark:text-emerald-100';
                        } else if (isPicked) {
                          cls = 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-500 text-red-900 dark:text-red-200';
                        }
                      } else if (isPicked) {
                        cls = 'bg-[#0284C7]/10 dark:bg-sky-950/50 border-[#0284C7] dark:border-sky-400 text-[#0F172A] dark:text-sky-100';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => {
                            if (!isChecked) {
                              setAptitudePicks((prev) => ({ ...prev, [q.id]: optIdx }));
                            }
                          }}
                          className={`text-left px-4 py-3 text-sm rounded-lg border transition-colors cursor-pointer ${cls}`}
                        >
                          <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {!isChecked ? (
                    <button
                      type="button"
                      disabled={picked === undefined}
                      onClick={() =>
                        setAptitudeChecked((prev) => ({ ...prev, [q.id]: true }))
                      }
                      className="px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 rounded-lg cursor-pointer"
                    >
                      Check & Reveal Shortcut Method
                    </button>
                  ) : (
                    <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      <p
                        className={`font-semibold inline-flex items-center gap-1.5 ${
                          picked === q.correctIndex ? 'text-[#059669] dark:text-emerald-400' : 'text-[#0F172A] dark:text-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        {picked === q.correctIndex
                          ? 'Spot on!'
                          : `Correct answer: ${q.options[q.correctIndex]}`}
                      </p>
                      <p>
                        <strong className="font-semibold text-[#0F172A] dark:text-slate-100">
                          Fast Shortcut Method:
                        </strong>{' '}
                        {q.shortcutMethod}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* MODE 4: PREVIOUS YEAR QUESTION PAPER */}
      {activeTab === 'pyq' && (
        <section aria-label="Previous year question paper" className="space-y-5">
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-mono text-[#0284C7] dark:text-sky-400 tabular-nums">
                  {pyqPaper.year} · {pyqPaper.syllabus} · {pyqPaper.classLevel} · Max Marks:{' '}
                  {pyqPaper.maxMarks} · Time: {pyqPaper.durationMinutes} min
                </p>
                <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                  {pyqPaper.title}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label htmlFor="pyq-year-select" className="sr-only">
                  Previous year
                </label>
                <select
                  id="pyq-year-select"
                  data-testid="pyq-year-select"
                  value={pyqYear}
                  onChange={(e) => {
                    setPyqYear(e.target.value);
                    setExpandedPyq({});
                    setLastPaperPdfName(null);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-medium text-[#0F172A] dark:text-slate-100"
                >
                  {PREVIOUS_YEAR_OPTIONS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} Paper
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={loadingPyq}
                  onClick={handleGeneratePyq}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {loadingPyq ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Generate Board Paper
                </button>

                <button
                  type="button"
                  data-testid="pyq-create-similar-btn"
                  disabled={loadingSimilarPyq}
                  onClick={handleCreateSimilarFromCurrentPyq}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <CopyCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Create Similar Paper
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPaperPdf(pyqPaper, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pyqPaper.questions.map((item) => {
              const key = `${pyqPaper.title}-${item.number}`;
              const isOpen = Boolean(expandedPyq[key]);
              return (
                <article
                  key={key}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden"
                >
                  <div className="p-6 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">
                        {item.number} · {item.section} · [{item.marks}{' '}
                        {item.marks === 1 ? 'Mark' : 'Marks'}]
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPyq((prev) => ({ ...prev, [key]: !isOpen }))
                        }
                        className="inline-flex items-center gap-1 font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer"
                      >
                        {isOpen ? 'Hide Marking Scheme' : 'Official Marking Scheme'}
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="text-base font-medium text-[#0F172A] dark:text-slate-100 leading-relaxed">
                      {item.question}
                    </p>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 px-6 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <strong className="font-semibold text-[#059669] dark:text-emerald-400">
                        Board Marking Scheme:
                      </strong>{' '}
                      {item.markingScheme}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* MODE 5: SIMILAR QUESTION PAPER FROM PREVIOUS YEAR */}
      {activeTab === 'similar_pyq' && (
        <section
          aria-label="Similar question paper from previous year"
          data-testid="similar-pyq-section"
          className="space-y-5"
        >
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-mono text-[#0284C7] dark:text-sky-400 tabular-nums">
                  Modeled on {similarPaper.basedOnYear ?? similarYear} Board Paper ·{' '}
                  {similarPaper.syllabus} · {similarPaper.classLevel} · Max Marks:{' '}
                  {similarPaper.maxMarks} · Time: {similarPaper.durationMinutes} min
                </p>
                <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                  {similarPaper.title}
                </h2>
                {similarPaper.patternNote && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                    {similarPaper.patternNote}
                  </p>
                )}
              </div>

              <button
                type="button"
                data-testid="generate-similar-pyq-btn"
                disabled={loadingSimilarPyq}
                onClick={() => void handleGenerateSimilarPyq()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer self-start whitespace-nowrap shrink-0"
              >
                {loadingSimilarPyq ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {loadingSimilarPyq
                  ? `Building ${similarYear}-Style Paper...`
                  : `Generate Similar ${similarYear} Paper`}
              </button>
            </div>

            {/* Configuration & Export Toolbar */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <label htmlFor="similar-pyq-year-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Reference Year:
                </label>
                <select
                  id="similar-pyq-year-select"
                  data-testid="similar-pyq-year-select"
                  value={similarYear}
                  disabled={loadingSimilarPyq}
                  onChange={(e) => {
                    setSimilarYear(e.target.value);
                    setExpandedSimilarScheme({});
                    setExpandedSimilarCompare({});
                    setLastPaperPdfName(null);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-medium text-[#0F172A] dark:text-slate-100"
                >
                  {PREVIOUS_YEAR_OPTIONS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} Board Pattern
                    </option>
                  ))}
                </select>

                <label htmlFor="similar-pyq-difficulty-select" className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
                  Calibration:
                </label>
                <select
                  id="similar-pyq-difficulty-select"
                  data-testid="similar-pyq-difficulty-select"
                  value={similarDifficulty}
                  disabled={loadingSimilarPyq}
                  onChange={(e) => {
                    setSimilarDifficulty(e.target.value as SimilarPaperDifficulty);
                    setLastPaperPdfName(null);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-slate-100"
                >
                  {SIMILAR_DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="similar-pyq-toggle-all-btn"
                  onClick={handleToggleAllSimilarSchemes}
                  className="text-xs font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer whitespace-nowrap"
                >
                  {allSimilarSchemesExpanded ? 'Hide All Solutions' : 'Show All Solutions'}
                </button>

                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={includeSolutionsInPdf}
                    onChange={(e) => setIncludeSolutionsInPdf(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#0284C7] focus:ring-[#0284C7]"
                  />
                  Include answers in PDF
                </label>

                <button
                  type="button"
                  data-testid="download-similar-pyq-pdf-btn"
                  onClick={() => handleDownloadPaperPdf(similarPaper, includeSolutionsInPdf)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download PDF
                </button>
              </div>
            </div>

            {lastPaperPdfName && (
              <p className="text-xs text-[#059669] dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Downloaded {lastPaperPdfName}</span>
              </p>
            )}
          </div>

          {loadingSimilarPyq ? (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-12 text-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-[#0F172A] dark:text-slate-100">
                Crafting a fresh {profile.syllabus} {profile.classLevel} practice paper modeled on{' '}
                {similarYear}...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matching section weightage, concepts, and step-marked official solutions with brand-new questions.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {similarPaper.questions.map((item) => {
                const key = `${similarPaper.title}-${item.number}`;
                const isSchemeOpen = Boolean(expandedSimilarScheme[key]);
                const isCompareOpen = Boolean(expandedSimilarCompare[key]);
                const refYr = similarPaper.basedOnYear ?? similarYear;

                return (
                  <article
                    key={key}
                    data-testid="similar-pyq-question"
                    className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden"
                  >
                    <div className="p-6 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums">
                          {item.number} · {item.section} · [{item.marks}{' '}
                          {item.marks === 1 ? 'Mark' : 'Marks'}]
                          {item.conceptTested ? ` · ${item.conceptTested}` : ''}
                        </span>

                        <div className="flex flex-wrap items-center gap-4">
                          {item.referenceQuestion && (
                            <button
                              type="button"
                              data-testid="similar-pyq-compare-btn"
                              onClick={() =>
                                setExpandedSimilarCompare((prev) => ({
                                  ...prev,
                                  [key]: !isCompareOpen,
                                }))
                              }
                              className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white cursor-pointer whitespace-nowrap"
                            >
                              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
                              {isCompareOpen ? `Hide ${refYr} Reference` : `Compare with ${refYr} PYQ`}
                            </button>
                          )}

                          <button
                            type="button"
                            data-testid="similar-pyq-scheme-btn"
                            onClick={() =>
                              setExpandedSimilarScheme((prev) => ({
                                ...prev,
                                [key]: !isSchemeOpen,
                              }))
                            }
                            className="inline-flex items-center gap-1 font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer whitespace-nowrap"
                          >
                            {isSchemeOpen ? 'Hide Marking Scheme' : 'Official Marking Scheme'}
                            {isSchemeOpen ? (
                              <ChevronUp className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-base font-medium text-[#0F172A] dark:text-slate-100 leading-relaxed">
                        {item.question}
                      </p>

                      {item.similarTo && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Pattern match:
                          </span>{' '}
                          {item.similarTo}
                        </p>
                      )}
                    </div>

                    {isCompareOpen && item.referenceQuestion && (
                      <div
                        data-testid="similar-pyq-compare-panel"
                        className="border-t border-slate-100 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/25 px-6 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                      >
                        <strong className="font-semibold text-[#0284C7] dark:text-sky-400">
                          Reference {refYr} Board Question:
                        </strong>{' '}
                        {item.referenceQuestion}
                      </div>
                    )}

                    {isSchemeOpen && (
                      <div
                        data-testid="similar-pyq-scheme-panel"
                        className="border-t border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 px-6 py-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                      >
                        <strong className="font-semibold text-[#059669] dark:text-emerald-400">
                          Board Marking Scheme:
                        </strong>{' '}
                        {item.markingScheme}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
};
