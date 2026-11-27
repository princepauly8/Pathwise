import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Mic,
  NotebookPen,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import { summarizeLessonNotesApi, type LessonNotesSummary } from '../utils/api';
import type {
  LearningModule,
  RevisionCard,
  StudentProfile,
  VisualDiagram,
} from '../types/study';
import { generateStudyGuidePdf, type PdfMakerOptions } from '../utils/pdfMaker';
import {
  MAX_MODULE_NOTES_LENGTH,
  SPEECH_LOCALE_OPTIONS,
  appendTranscriptText,
  countWords,
  formatSpeechErrorMessage,
  getSpeechLocaleForLanguage,
  getSpeechRecognitionConstructor,
  type SpeechRecognitionInstance,
} from '../utils/speechRecognition';
import {
  TTS_RATE_OPTIONS,
  buildLessonReadAloudText,
  isSpeechSynthesisSupported,
  pickBestVoiceForLocale,
  splitTextIntoSpeechChunks,
  type TtsRateOption,
} from '../utils/speechSynthesis';
import { ConceptVisualDiagram } from './EditorialIllustration';

type StudyTab = 'notes' | 'short_notes' | 'shortcuts' | 'visual' | 'revision' | 'pdf';

interface StudyKitProps {
  profile: StudentProfile;
  activeSubject: string;
  activeModuleId: string | null;
  isLoadingLesson: boolean;
  lessonError: string | null;
  onSelectSubjectAndModule: (subject: string, moduleId: string) => void;
  onGenerateLesson: (
    subject: string,
    module: LearningModule,
    mode: 'standard' | 'simpler' | 'real_world'
  ) => void;
  onToggleMastery: (subject: string, moduleId: string) => void;
  onSaveModuleNotes: (subject: string, moduleId: string, notes: string) => void;
  onGoToPractice: (subject: string, moduleId: string) => void;
  onGoToTutor: (subject: string, moduleId: string) => void;
  onBackToPaths: () => void;
}

const STUDY_TABS: { id: StudyTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'notes', label: 'Full Notes', icon: BookOpen },
  { id: 'short_notes', label: 'Short Notes', icon: FileText },
  { id: 'shortcuts', label: 'Study Shortcuts', icon: Zap },
  { id: 'visual', label: 'Photo Representation', icon: ImageIcon },
  { id: 'revision', label: 'Revision Deck', icon: Layers },
  { id: 'pdf', label: 'PDF Maker', icon: Download },
];

export const StudyKit: React.FC<StudyKitProps> = ({
  profile,
  activeSubject,
  activeModuleId,
  isLoadingLesson,
  lessonError,
  onSelectSubjectAndModule,
  onGenerateLesson,
  onToggleMastery,
  onSaveModuleNotes,
  onGoToPractice,
  onGoToTutor,
  onBackToPaths,
}) => {
  const [activeTab, setActiveTab] = useState<StudyTab>('notes');
  const [selectedRecallOption, setSelectedRecallOption] = useState<number | null>(null);
  const [recallSubmitted, setRecallSubmitted] = useState(false);

  // Revision flashcard deck state
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Record<string, 'got_it' | 'review'>>({});

  // PDF Maker options state
  const [pdfOptions, setPdfOptions] = useState<PdfMakerOptions>({
    includeFullNotes: true,
    includeShortNotes: true,
    includeShortcuts: true,
    includeWorkedExample: true,
    includeRevisionCards: true,
    includeRoadmapOverview: true,
  });
  const [lastPdfFileName, setLastPdfFileName] = useState<string | null>(null);

  const currentPath = profile.paths[activeSubject];
  const activeModule: LearningModule | undefined =
    currentPath?.modules.find((m) => m.id === activeModuleId) ??
    currentPath?.modules.find((m) => m.status === 'in_progress') ??
    currentPath?.modules[0];

  const lesson = activeModule?.lesson;

  // Student personal notes & Web Speech API voice dictation state
  const [notesDraft, setNotesDraft] = useState<string>(activeModule?.studentNotes ?? '');
  const [notesSaveStatus, setNotesSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [speechLocale, setSpeechLocale] = useState<string>(() =>
    getSpeechLocaleForLanguage(profile.language)
  );
  const [isDictating, setIsDictating] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Buddy AI concise notes summary toggle & per-module cache
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
  const [aiSummariesByKey, setAiSummariesByKey] = useState<
    Record<string, { summary: LessonNotesSummary; notesSnapshot: string }>
  >({});
  const [isSummarizingNotes, setIsSummarizingNotes] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const summaryRequestIdRef = useRef(0);

  const speechSupported = useMemo(() => getSpeechRecognitionConstructor() !== null, []);
  const ttsSupported = useMemo(() => isSpeechSynthesisSupported(), []);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [ttsRate, setTtsRate] = useState<TtsRateOption>(1);
  const [ttsChunkIndex, setTtsChunkIndex] = useState(0);
  const [ttsTotalChunks, setTtsTotalChunks] = useState(0);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsSessionRef = useRef(0);
  const ttsChunksRef = useRef<string[]>([]);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const notesDraftRef = useRef(notesDraft);
  const activeModuleRef = useRef<{ subject: string; moduleId: string } | null>(
    activeModule ? { subject: activeSubject, moduleId: activeModule.id } : null
  );
  const onSaveModuleNotesRef = useRef(onSaveModuleNotes);

  useEffect(() => {
    notesDraftRef.current = notesDraft;
  }, [notesDraft]);

  useEffect(() => {
    onSaveModuleNotesRef.current = onSaveModuleNotes;
  }, [onSaveModuleNotes]);

  useEffect(() => {
    activeModuleRef.current = activeModule
      ? { subject: activeSubject, moduleId: activeModule.id }
      : null;
  }, [activeSubject, activeModule?.id]);

  // Keep speech locale synced when student changes their preferred study language
  useEffect(() => {
    setSpeechLocale(getSpeechLocaleForLanguage(profile.language));
  }, [profile.language]);

  const stopDictation = () => {
    const rec = recognitionRef.current;
    if (rec) {
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch {
        // Ignore already-stopped recognition errors
      }
    }
    setIsDictating(false);
    setInterimTranscript('');
  };

  const stopLessonSpeech = () => {
    ttsSessionRef.current += 1;
    ttsChunksRef.current = [];
    if (isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser cancel errors
      }
    }
    setTtsStatus('idle');
    setTtsChunkIndex(0);
    setTtsTotalChunks(0);
  };

  const speakLessonChunk = (
    index: number,
    chunks: string[],
    rate: TtsRateOption,
    sessionId: number
  ) => {
    if (ttsSessionRef.current !== sessionId || !isSpeechSynthesisSupported()) {
      return;
    }
    if (index >= chunks.length) {
      setTtsStatus('idle');
      setTtsChunkIndex(0);
      setTtsTotalChunks(0);
      return;
    }

    setTtsChunkIndex(index);
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.lang = speechLocale;
    utterance.rate = rate;

    try {
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = pickBestVoiceForLocale(voices, speechLocale);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    } catch {
      // Proceed with default browser voice
    }

    utterance.onend = () => {
      if (ttsSessionRef.current !== sessionId) return;
      speakLessonChunk(index + 1, chunks, rate, sessionId);
    };

    utterance.onerror = (event) => {
      if (ttsSessionRef.current !== sessionId) return;
      if (event.error === 'interrupted' || event.error === 'canceled') {
        return;
      }
      setTtsStatus('idle');
      setTtsChunkIndex(0);
      setTtsTotalChunks(0);
      setTtsError('Could not read the lesson aloud in this browser. Please try again.');
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleLessonReadAloud = () => {
    if (!activeModule || !lesson) return;
    setTtsError(null);

    if (!isSpeechSynthesisSupported()) {
      setTtsError(
        'Text-to-speech is not supported in this browser. Try Chrome, Edge, or Safari to listen to lessons.'
      );
      return;
    }

    if (ttsStatus === 'speaking') {
      try {
        window.speechSynthesis.pause();
        setTtsStatus('paused');
      } catch {
        stopLessonSpeech();
      }
      return;
    }

    if (ttsStatus === 'paused') {
      try {
        window.speechSynthesis.resume();
        setTtsStatus('speaking');
      } catch {
        const chunks = ttsChunksRef.current;
        if (chunks.length > 0) {
          const nextSession = ttsSessionRef.current + 1;
          ttsSessionRef.current = nextSession;
          window.speechSynthesis.cancel();
          setTtsStatus('speaking');
          speakLessonChunk(ttsChunkIndex, chunks, ttsRate, nextSession);
        } else {
          stopLessonSpeech();
        }
      }
      return;
    }

    // Stop microphone dictation before reading aloud so audio input and output do not conflict
    if (isDictating) {
      stopDictation();
    }

    const fullText = buildLessonReadAloudText(activeModule, lesson);
    const chunks = splitTextIntoSpeechChunks(fullText);
    if (chunks.length === 0) {
      setTtsError('No lesson content is available to read aloud yet.');
      return;
    }

    const sessionId = ttsSessionRef.current + 1;
    ttsSessionRef.current = sessionId;
    ttsChunksRef.current = chunks;
    setTtsTotalChunks(chunks.length);
    setTtsChunkIndex(0);
    setTtsStatus('speaking');

    try {
      window.speechSynthesis.cancel();
      speakLessonChunk(0, chunks, ttsRate, sessionId);
    } catch {
      stopLessonSpeech();
      setTtsError('Could not start text-to-speech playback. Please try again.');
    }
  };

  const handleChangeTtsRate = (nextRate: TtsRateOption) => {
    setTtsRate(nextRate);
    if (ttsStatus === 'speaking' && ttsChunksRef.current.length > 0 && isSpeechSynthesisSupported()) {
      const nextSession = ttsSessionRef.current + 1;
      ttsSessionRef.current = nextSession;
      try {
        window.speechSynthesis.cancel();
        speakLessonChunk(ttsChunkIndex, ttsChunksRef.current, nextRate, nextSession);
      } catch {
        stopLessonSpeech();
      }
    }
  };

  // Sync draft when switching modules/subjects and stop any active dictation or TTS cleanly
  const activeModuleKey = activeModule ? `${activeSubject}::${activeModule.id}` : '';
  useEffect(() => {
    stopDictation();
    stopLessonSpeech();
    setSpeechError(null);
    setTtsError(null);
    setNotesDraft(activeModule?.studentNotes ?? '');
    setNotesSaveStatus('saved');
    summaryRequestIdRef.current += 1;
    setIsAiSummaryOpen(false);
    setIsSummarizingNotes(false);
    setSummaryError(null);
    setCopiedSummary(false);
  }, [activeModuleKey]);

  // Stop speech when regenerating lesson content or switching away from Full Notes
  useEffect(() => {
    if (isLoadingLesson || !lesson) {
      stopLessonSpeech();
    }
  }, [isLoadingLesson, lesson]);

  // Stop active dictation and TTS if student leaves the Full Notes tab
  useEffect(() => {
    if (activeTab !== 'notes') {
      if (isDictating) stopDictation();
      if (ttsStatus !== 'idle') stopLessonSpeech();
    }
  }, [activeTab, isDictating, ttsStatus]);

  useEffect(() => {
    return () => {
      const target = activeModuleRef.current;
      if (target) {
        onSaveModuleNotesRef.current(
          target.subject,
          target.moduleId,
          notesDraftRef.current.slice(0, MAX_MODULE_NOTES_LENGTH)
        );
      }
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        try {
          rec.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
      ttsSessionRef.current += 1;
      if (isSpeechSynthesisSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  // Debounced auto-save for module notes
  useEffect(() => {
    if (!activeModule) return;
    const persisted = activeModule.studentNotes ?? '';
    if (notesDraft === persisted) {
      setNotesSaveStatus('saved');
      return;
    }
    setNotesSaveStatus('unsaved');
    const timer = window.setTimeout(() => {
      setNotesSaveStatus('saving');
      onSaveModuleNotesRef.current(activeSubject, activeModule.id, notesDraft);
      setNotesSaveStatus('saved');
    }, 550);

    return () => window.clearTimeout(timer);
  }, [notesDraft, activeSubject, activeModule?.id, activeModule?.studentNotes]);

  const flushModuleNotesNow = (nextText?: string) => {
    const target = activeModuleRef.current;
    if (!target) return;
    const textToSave = (nextText ?? notesDraftRef.current).slice(0, MAX_MODULE_NOTES_LENGTH);
    onSaveModuleNotesRef.current(target.subject, target.moduleId, textToSave);
    setNotesSaveStatus('saved');
  };

  const handleToggleDictation = () => {
    if (isDictating) {
      stopDictation();
      flushModuleNotesNow();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setSpeechError(
        'Your browser does not support Web Speech dictation. Try Chrome, Edge, or Safari, or type your reflection below.'
      );
      return;
    }

    if (ttsStatus !== 'idle') {
      stopLessonSpeech();
    }

    setSpeechError(null);
    setInterimTranscript('');

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechLocale;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsDictating(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interimChunk += transcript;
          }
        }

        if (finalChunk.trim()) {
          setNotesDraft((prev) => {
            const updated = appendTranscriptText(prev, finalChunk, MAX_MODULE_NOTES_LENGTH);
            notesDraftRef.current = updated;
            return updated;
          });
        }
        setInterimTranscript(interimChunk.trim());
      };

      recognition.onerror = (event) => {
        const message = formatSpeechErrorMessage(event.error);
        if (message) {
          setSpeechError(message);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsDictating(false);
        setInterimTranscript('');
        flushModuleNotesNow();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsDictating(false);
      setSpeechError('Could not start voice dictation. Please check microphone access and try again.');
    }
  };

  const handleInsertReflectionPrompt = (prefix: string) => {
    setNotesDraft((prev) => {
      const trimmedEnd = prev.trimEnd();
      const next = trimmedEnd ? `${trimmedEnd}\n${prefix} ` : `${prefix} `;
      return next.slice(0, MAX_MODULE_NOTES_LENGTH);
    });
  };

  const cachedSummaryEntry = activeModuleKey ? aiSummariesByKey[activeModuleKey] : undefined;
  const currentSummary = cachedSummaryEntry?.summary ?? null;
  const isSummaryStale =
    cachedSummaryEntry !== undefined &&
    cachedSummaryEntry.notesSnapshot !== notesDraft.trim();

  const requestNotesSummary = async () => {
    if (!activeModule || !activeModuleKey) return;
    const reqId = summaryRequestIdRef.current + 1;
    summaryRequestIdRef.current = reqId;
    const snapshot = notesDraftRef.current.trim();

    setIsSummarizingNotes(true);
    setSummaryError(null);
    setCopiedSummary(false);

    try {
      const summary = await summarizeLessonNotesApi({
        studentName: profile.name,
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        moduleTitle: activeModule.title,
        moduleSubtitle: activeModule.subtitle,
        concepts: activeModule.concepts,
        lessonSummary: lesson?.summary,
        lessonConcepts: lesson?.concepts,
        studentNotes: snapshot,
      });

      if (summaryRequestIdRef.current !== reqId) return;
      setAiSummariesByKey((prev) => ({
        ...prev,
        [activeModuleKey]: {
          summary,
          notesSnapshot: snapshot,
        },
      }));
    } catch (err) {
      if (summaryRequestIdRef.current !== reqId) return;
      setSummaryError(
        err instanceof Error
          ? err.message
          : 'Buddy could not summarize these notes right now. Please try again.'
      );
    } finally {
      if (summaryRequestIdRef.current === reqId) {
        setIsSummarizingNotes(false);
      }
    }
  };

  const handleToggleAiSummary = () => {
    if (isAiSummaryOpen) {
      summaryRequestIdRef.current += 1;
      setIsAiSummaryOpen(false);
      setIsSummarizingNotes(false);
      setSummaryError(null);
      return;
    }

    setIsAiSummaryOpen(true);
    if (!cachedSummaryEntry || cachedSummaryEntry.notesSnapshot !== notesDraft.trim()) {
      void requestNotesSummary();
    }
  };

  const handleCopySummary = async () => {
    if (!currentSummary) return;
    const formatted = [
      currentSummary.headline,
      '',
      currentSummary.conciseSummary,
      ...(currentSummary.keyPoints.length > 0
        ? ['', ...currentSummary.keyPoints.map((pt, i) => `${i + 1}. ${pt}`)]
        : []),
      '',
      `Buddy's Tip: ${currentSummary.nextStepTip}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  const wordCount = useMemo(() => countWords(notesDraft), [notesDraft]);
  const selectedLocaleLabel =
    SPEECH_LOCALE_OPTIONS.find((opt) => opt.code === speechLocale)?.label ?? speechLocale;

  const shortNotes = useMemo(() => {
    if (lesson?.shortNotes && lesson.shortNotes.length > 0) {
      return lesson.shortNotes;
    }
    if (!activeModule) return [];
    return [
      ...activeModule.concepts.map((c) => `Key topic: ${c}`),
      ...activeModule.objectives.map((o) => `Be able to: ${o}`),
    ];
  }, [lesson, activeModule]);

  const shortcuts = useMemo(() => {
    if (lesson?.studyShortcuts && lesson.studyShortcuts.length > 0) {
      return lesson.studyShortcuts;
    }
    if (!activeModule || !currentPath) return [];
    return [
      {
        title: `${profile.syllabus} Exam Anchor`,
        trick: currentPath.focusStrategy,
        whenToUse: `Whenever revising ${activeModule.title} before a test.`,
      },
      {
        title: '3-Step Active Recall Loop',
        trick: `Read "${activeModule.concepts[0] ?? activeModule.title}", close your notes, write the main formula or definition from memory, and immediately check against the Short Notes tab.`,
        whenToUse: 'During 20-minute daily revision blocks.',
      },
    ];
  }, [lesson, activeModule, currentPath, profile.syllabus]);

  const visualDiagram: VisualDiagram | null = useMemo(() => {
    if (lesson?.visualDiagram) return lesson.visualDiagram;
    if (!activeModule) return null;
    const nodes = activeModule.concepts.slice(0, 4).map((c, idx) => ({
      label: c,
      detail: activeModule.objectives[idx] ?? `Core principle for ${profile.syllabus}`,
      formula: lesson?.concepts[idx]?.formulaOrKeyRule,
    }));
    while (nodes.length < 3) {
      nodes.push({
        label: `Stage 0${nodes.length + 1}`,
        detail: activeModule.subtitle,
        formula: undefined,
      });
    }
    return {
      title: `${activeModule.title} — Concept Map`,
      caption: `Visual overview connecting the main ideas in ${profile.classLevel} ${profile.syllabus} ${activeSubject}.`,
      centralConcept: activeModule.title,
      nodes,
    };
  }, [lesson, activeModule, profile.classLevel, profile.syllabus, activeSubject]);

  const revisionCards: RevisionCard[] = useMemo(() => {
    if (lesson?.revisionCards && lesson.revisionCards.length > 0) {
      return lesson.revisionCards;
    }
    if (!activeModule) return [];
    return activeModule.objectives.map((obj, idx) => ({
      id: `fallback-rc-${activeModule.id}-${idx}`,
      front: `Objective ${idx + 1}: Explain ${activeModule.concepts[idx] ?? activeModule.title}`,
      back: obj,
    }));
  }, [lesson, activeModule]);

  const safeCardIndex = revisionCards.length > 0 ? cardIndex % revisionCards.length : 0;
  const activeCard = revisionCards[safeCardIndex];
  const gotItCount = revisionCards.filter((c) => masteredCards[c.id] === 'got_it').length;

  const resetModuleLocalState = () => {
    setSelectedRecallOption(null);
    setRecallSubmitted(false);
    setCardIndex(0);
    setIsCardFlipped(false);
    setMasteredCards({});
    setLastPdfFileName(null);
  };

  if (!currentPath || !activeModule) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
            Select a subject path first
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Generate or choose a subject roadmap to unlock notes, short notes, shortcuts, visual
            diagrams, revision flashcards, and the PDF Maker.
          </p>
          <button
            type="button"
            onClick={onBackToPaths}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Return to Learning Paths
          </button>
        </div>
      </main>
    );
  }

  const handleDownloadPdf = () => {
    const fileName = generateStudyGuidePdf({
      profile,
      subjectPath: currentPath,
      module: activeModule,
      options: pdfOptions,
    });
    setLastPdfFileName(fileName);
  };

  const togglePdfOption = (key: keyof PdfMakerOptions) => {
    setPdfOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    setLastPdfFileName(null);
  };

  const hasAnyPdfSection = Object.values(pdfOptions).some(Boolean);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Subject & Module Selector Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <button
          type="button"
          onClick={() => {
            flushModuleNotesNow();
            onBackToPaths();
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Learning Paths
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="study-subject-select" className="sr-only">
            Choose subject
          </label>
          <select
            id="study-subject-select"
            value={activeSubject}
            onChange={(e) => {
              flushModuleNotesNow();
              const nextSub = e.target.value;
              const firstMod = profile.paths[nextSub]?.modules[0]?.id ?? '';
              resetModuleLocalState();
              onSelectSubjectAndModule(nextSub, firstMod);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100"
          >
            {profile.subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          <label htmlFor="study-module-select" className="sr-only">
            Choose module
          </label>
          <select
            id="study-module-select"
            value={activeModule.id}
            onChange={(e) => {
              flushModuleNotesNow();
              resetModuleLocalState();
              onSelectSubjectAndModule(activeSubject, e.target.value);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 max-w-xs"
          >
            {currentPath.modules.map((m) => (
              <option key={m.id} value={m.id}>
                0{m.order}. {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Module Header */}
      <header className="space-y-2.5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span> <span aria-hidden="true">·</span>{' '}
          {profile.classLevel} <span aria-hidden="true">·</span> {activeSubject}{' '}
          <span aria-hidden="true">·</span> Module 0{activeModule.order} ({activeModule.stage}){' '}
          <span aria-hidden="true">·</span>{' '}
          <span className="font-mono tabular-nums">{activeModule.estimatedMinutes} min</span>
        </p>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
              {activeModule.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">{activeModule.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleMastery(activeSubject, activeModule.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                activeModule.status === 'mastered'
                  ? 'bg-[#059669]/10 dark:bg-emerald-950/50 text-[#059669] dark:text-emerald-400 border-[#059669]/40 dark:border-emerald-700/70'
                  : 'bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {activeModule.status === 'mastered' ? 'Mastered' : 'Mark Mastered'}
            </button>

            <button
              type="button"
              onClick={() => onGoToPractice(activeSubject, activeModule.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Practice & PYQs
            </button>
          </div>
        </div>
      </header>

      {/* Study Kit Sub-Tabs (Notes, Short Notes, Shortcuts, Photo Representation, Revision, PDF Maker) */}
      <div
        role="tablist"
        aria-label="Study kit tools"
        className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-0.5"
      >
        {STUDY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {lessonError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          <span>{lessonError}</span>
        </div>
      )}

      {/* TAB 1: FULL NOTES */}
      {activeTab === 'notes' && (
        <section aria-label="Full study notes" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <strong className="font-semibold text-[#0F172A] dark:text-slate-100">AI Explanation Depth:</strong>{' '}
              Regenerate notes, short notes, shortcuts, and visual diagram for {profile.syllabus}{' '}
              {profile.classLevel}.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'standard', label: 'Standard Notes' },
                  { id: 'simpler', label: 'Explain Simply' },
                  { id: 'real_world', label: 'Real-World Focus' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  disabled={isLoadingLesson}
                  onClick={() => {
                    setSelectedRecallOption(null);
                    setRecallSubmitted(false);
                    onGenerateLesson(activeSubject, activeModule, mode.id);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    lesson?.mode === mode.id
                      ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                      : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-6">
              {isLoadingLesson ? (
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-12 text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-medium text-[#0F172A] dark:text-slate-100">
                    Building your {profile.syllabus} {profile.classLevel} Study Kit...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generating structured notes, short notes, shortcuts, visual concept map, and revision cards.
                  </p>
                </div>
              ) : !lesson ? (
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 text-center space-y-4">
                  <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                    Ready to generate your complete Study Kit for this module
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                    Pathwise will generate tailored {profile.syllabus} {profile.classLevel} notes,
                    exam-night short notes, study shortcuts, a visual concept map, and revision
                    flashcards for <strong className="text-[#0F172A] dark:text-slate-100">{activeModule.title}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => onGenerateLesson(activeSubject, activeModule, 'standard')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    Generate Complete Study Kit
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Text-to-Speech Lesson Audio Reader Bar */}
                  <div
                    data-testid="studykit-tts-bar"
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 px-4 sm:px-5 py-3.5 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            ttsStatus === 'speaking'
                              ? 'bg-[#0284C7]/15 dark:bg-sky-900/60 border-[#0284C7]/40 dark:border-sky-600 text-[#0284C7] dark:text-sky-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Volume2 className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                            Listen to Generated Lesson
                          </p>
                          <p
                            data-testid="studykit-tts-status"
                            className="text-[11px] text-slate-500 dark:text-slate-400 truncate"
                          >
                            {ttsStatus === 'speaking'
                              ? `Reading aloud · part ${ttsChunkIndex + 1} of ${Math.max(1, ttsTotalChunks)} · ${ttsRate}x`
                              : ttsStatus === 'paused'
                                ? `Paused · part ${ttsChunkIndex + 1} of ${Math.max(1, ttsTotalChunks)}`
                                : ttsSupported
                                  ? 'Reads Core Summary, Concepts, Formulas & Worked Example aloud'
                                  : 'Text-to-speech is not supported in this browser'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label htmlFor="studykit-tts-rate-select" className="sr-only">
                          Reading speed
                        </label>
                        <select
                          id="studykit-tts-rate-select"
                          data-testid="studykit-tts-rate"
                          value={ttsRate}
                          onChange={(e) => handleChangeTtsRate(Number(e.target.value) as TtsRateOption)}
                          disabled={!ttsSupported}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-medium text-[#0F172A] dark:text-slate-100 disabled:opacity-50"
                        >
                          {TTS_RATE_OPTIONS.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate === 1 ? '1.0x' : `${rate}x`}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          data-testid="studykit-tts-btn"
                          onClick={handleToggleLessonReadAloud}
                          disabled={!ttsSupported}
                          aria-pressed={ttsStatus === 'speaking'}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                            ttsStatus === 'speaking'
                              ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-sky-400'
                              : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                          }`}
                        >
                          {ttsStatus === 'speaking' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                              Pause Reading
                            </>
                          ) : ttsStatus === 'paused' ? (
                            <>
                              <Play className="w-3.5 h-3.5" aria-hidden="true" />
                              Resume Reading
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Read Lesson Aloud
                            </>
                          )}
                        </button>

                        {ttsStatus !== 'idle' && (
                          <button
                            type="button"
                            data-testid="studykit-tts-stop-btn"
                            onClick={stopLessonSpeech}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Square className="w-3 h-3" aria-hidden="true" />
                            Stop
                          </button>
                        )}
                      </div>
                    </div>

                    {ttsError && (
                      <p
                        role="alert"
                        className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{ttsError}</span>
                      </p>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-2">
                    <p className="text-xs font-semibold text-[#0284C7] dark:text-sky-400">Core Summary</p>
                    <p className="text-base text-[#0F172A] dark:text-slate-100 leading-relaxed">{lesson.summary}</p>
                  </div>

                  {/* Structured Concepts */}
                  <div className="grid grid-cols-1 gap-4">
                    {lesson.concepts.map((concept, idx) => (
                      <article
                        key={idx}
                        className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-3"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
                            0{idx + 1}.
                          </span>
                          <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                            {concept.heading}
                          </h2>
                        </div>
                        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                          {concept.explanation}
                        </p>
                        {concept.formulaOrKeyRule && (
                          <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-2.5 font-mono text-xs sm:text-sm text-[#0F172A] dark:text-sky-200 overflow-x-auto">
                            {concept.formulaOrKeyRule}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  {/* Worked Example */}
                  <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3 space-y-1">
                      <p className="text-xs font-semibold text-[#0284C7] dark:text-sky-400">Worked Example</p>
                      <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                        {lesson.workedExample.prompt}
                      </h2>
                    </div>
                    <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                      {lesson.workedExample.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3 leading-relaxed">
                          <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 pt-0.5 tabular-nums shrink-0">
                            Step {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
                      <strong className="font-semibold text-[#0F172A] dark:text-slate-100">Key Takeaway:</strong>{' '}
                      {lesson.workedExample.takeaway}
                    </p>
                  </section>

                  {/* Inline Recall Check */}
                  <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quick Recall Check</p>
                      <h2 className="text-base font-semibold text-[#0F172A] dark:text-slate-100">
                        {lesson.recallCheck.question}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {lesson.recallCheck.options.map((opt, idx) => {
                        const isPicked = selectedRecallOption === idx;
                        const isCorrect = idx === lesson.recallCheck.correctIndex;
                        let cls =
                          'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500';
                        if (recallSubmitted) {
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
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!recallSubmitted) setSelectedRecallOption(idx);
                            }}
                            className={`text-left px-4 py-3 text-sm rounded-lg border transition-colors cursor-pointer ${cls}`}
                          >
                            <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {!recallSubmitted ? (
                      <button
                        type="button"
                        disabled={selectedRecallOption === null}
                        onClick={() => setRecallSubmitted(true)}
                        className="px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                      >
                        Check Recall Answer
                      </button>
                    ) : (
                      <div className="rounded-lg bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        <p
                          className={`font-semibold ${
                            selectedRecallOption === lesson.recallCheck.correctIndex
                              ? 'text-[#059669] dark:text-emerald-400'
                              : 'text-[#0F172A] dark:text-slate-100'
                          }`}
                        >
                          {selectedRecallOption === lesson.recallCheck.correctIndex
                            ? 'Correct — great grasp of the rule.'
                            : 'Review this point before moving on:'}
                        </p>
                        <p>{lesson.recallCheck.explanation}</p>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>

            {/* Sticky Personal Module Notes & Voice Dictation Studio */}
            <aside
              aria-label="Personal module notes and voice dictation"
              data-testid="studykit-module-notes-section"
              className="lg:col-span-5 lg:sticky lg:top-24 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <NotebookPen className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                    <span>Personal Notebook</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                  </p>
                  <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                    My Summary & Reflections
                  </h2>
                </div>
                <span
                  data-testid="studykit-notes-save-status"
                  className={`text-xs font-medium shrink-0 pt-1 ${
                    notesSaveStatus === 'saved'
                      ? 'text-[#059669] dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {notesSaveStatus === 'saved'
                    ? 'Saved'
                    : notesSaveStatus === 'saving'
                      ? 'Saving…'
                      : 'Unsaved'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Dictate your own explanation, doubts, or key formulas for{' '}
                <strong className="font-semibold text-[#0F172A] dark:text-slate-200">{activeModule.title}</strong>{' '}
                while you study. Saved notes also export in your Study PDF.
              </p>

              {/* Voice Dictation Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="studykit-dictate-btn"
                  onClick={handleToggleDictation}
                  disabled={!speechSupported}
                  aria-pressed={isDictating}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDictating
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                  }`}
                >
                  {isDictating ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      Stop Dictation
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      Start Dictation
                    </>
                  )}
                </button>

                <label htmlFor="studykit-dictate-lang" className="sr-only">
                  Voice dictation language
                </label>
                <select
                  id="studykit-dictate-lang"
                  data-testid="studykit-dictate-lang"
                  value={speechLocale}
                  disabled={!speechSupported || isDictating}
                  onChange={(e) => setSpeechLocale(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 disabled:opacity-60 max-w-[180px]"
                >
                  {SPEECH_LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {!speechSupported && (
                <p
                  role="status"
                  data-testid="studykit-speech-unsupported"
                  className="rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 leading-relaxed"
                >
                  Voice dictation requires a browser with Web Speech API support (Chrome, Edge, or
                  Safari). You can type and save your notes below.
                </p>
              )}

              {isDictating && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="studykit-interim-transcript"
                  className="rounded-lg border border-sky-200 dark:border-sky-800/80 bg-sky-50/80 dark:bg-sky-950/40 px-3.5 py-2.5 space-y-1"
                >
                  <p className="text-xs font-semibold text-[#0284C7] dark:text-sky-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Listening in {selectedLocaleLabel}… Speak your summary or reflection.
                  </p>
                  {interimTranscript && (
                    <p className="text-xs italic text-slate-700 dark:text-slate-300 leading-relaxed">
                      “{interimTranscript}”
                    </p>
                  )}
                </div>
              )}

              {speechError && (
                <div
                  role="alert"
                  data-testid="studykit-speech-error"
                  className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-300 flex items-start justify-between gap-2"
                >
                  <span>{speechError}</span>
                  <button
                    type="button"
                    onClick={() => setSpeechError(null)}
                    className="font-semibold underline shrink-0 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Quick Reflection Starters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
                  Quick insert:
                </span>
                {[
                  { label: 'Summary', prefix: 'Summary:' },
                  { label: 'Key Doubt', prefix: 'Question to revise:' },
                  { label: 'Exam Tip', prefix: 'Exam reminder:' },
                ].map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => handleInsertReflectionPrompt(prompt.prefix)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer"
                  >
                    + {prompt.label}
                  </button>
                ))}
              </div>

              {/* Editable & Dictated Notes Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="studykit-notes-textarea" className="sr-only">
                  Personal summary and reflections for {activeModule.title}
                </label>
                <textarea
                  id="studykit-notes-textarea"
                  data-testid="studykit-notes-textarea"
                  rows={9}
                  maxLength={MAX_MODULE_NOTES_LENGTH}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={() => flushModuleNotesNow()}
                  placeholder="Click Start Dictation to speak your thoughts aloud, or type your own summary, formulas to remember, and questions for this topic..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/70 px-3.5 py-3 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed focus:border-[#0284C7] dark:focus:border-sky-400 resize-y"
                />
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono tabular-nums">
                    {notesDraft.length} / {MAX_MODULE_NOTES_LENGTH} chars
                  </span>
                  <div className="flex items-center gap-2">
                    {notesDraft.length > 0 && (
                      <button
                        type="button"
                        data-testid="studykit-clear-notes-btn"
                        onClick={() => {
                          setNotesDraft('');
                          flushModuleNotesNow('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="studykit-save-notes-btn"
                      onClick={() => flushModuleNotesNow()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>

              {/* Buddy AI Concise Summary Toggle & Output (Directly Below User's Notes) */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                      <span>Buddy AI Summary</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Toggle for a concise AI summary of this lesson and your notes
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAiSummaryOpen}
                    aria-label="Toggle Buddy AI concise summary of current lesson notes"
                    data-testid="studykit-ai-summary-toggle"
                    onClick={handleToggleAiSummary}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                      isAiSummaryOpen
                        ? 'bg-[#0284C7] border-[#0284C7]'
                        : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        isAiSummaryOpen ? 'translate-x-5.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isAiSummaryOpen && (
                  <div
                    data-testid="studykit-ai-summary-panel"
                    className="rounded-xl border border-sky-200/80 dark:border-sky-800/70 bg-sky-50/55 dark:bg-sky-950/30 p-4 space-y-3"
                  >
                    {isSummarizingNotes ? (
                      <div className="flex items-center gap-2.5 py-2 text-xs text-slate-700 dark:text-slate-300">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                        <span>
                          Buddy is summarizing {notesDraft.trim() ? 'your notes & this lesson' : 'the current lesson notes'}…
                        </span>
                      </div>
                    ) : summaryError ? (
                      <div role="alert" className="space-y-2.5">
                        <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                          <span>{summaryError}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => void requestNotesSummary()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                          Try Again
                        </button>
                      </div>
                    ) : currentSummary ? (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-[11px] font-semibold text-[#0284C7] dark:text-sky-400">
                              {currentSummary.basedOnPersonalNotes
                                ? 'Lesson + Your Notes'
                                : 'Current Lesson Notes'}
                              {isSummaryStale ? ' · Notes edited' : ''}
                            </p>
                            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                              {currentSummary.headline}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid="studykit-ai-summary-copy"
                              onClick={() => void handleCopySummary()}
                              title="Copy concise summary"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md transition-colors cursor-pointer"
                            >
                              {copiedSummary ? (
                                <>
                                  <Check className="w-3 h-3 text-[#059669] dark:text-emerald-400" aria-hidden="true" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" aria-hidden="true" />
                                  Copy
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              data-testid="studykit-ai-summary-refresh"
                              onClick={() => void requestNotesSummary()}
                              title="Regenerate summary with latest notes"
                              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                                isSummaryStale
                                  ? 'bg-[#0284C7] border-[#0284C7] text-white hover:bg-[#0369A1]'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
                              }`}
                            >
                              <RefreshCw className="w-3 h-3" aria-hidden="true" />
                              Refresh
                            </button>
                          </div>
                        </div>

                        <p
                          data-testid="studykit-ai-summary-text"
                          className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                        >
                          {currentSummary.conciseSummary}
                        </p>

                        {currentSummary.keyPoints.length > 0 && (
                          <ul className="space-y-1.5 pt-1">
                            {currentSummary.keyPoints.map((point, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                              >
                                <span className="font-mono text-[11px] font-semibold text-[#0284C7] dark:text-sky-400 pt-0.5 shrink-0 tabular-nums">
                                  0{idx + 1}.
                                </span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="rounded-lg bg-white/85 dark:bg-slate-900/75 border border-sky-200/70 dark:border-sky-800/60 px-3 py-2.5 flex items-start justify-between gap-2.5">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <strong className="font-semibold text-[#0F172A] dark:text-slate-100">
                              Buddy’s Tip:
                            </strong>{' '}
                            {currentSummary.nextStepTip}
                          </p>
                          <button
                            type="button"
                            onClick={() => onGoToTutor(activeSubject, activeModule.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] dark:text-sky-400 hover:underline shrink-0 cursor-pointer pt-0.5"
                          >
                            <MessageSquare className="w-3 h-3" aria-hidden="true" />
                            Ask Buddy
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* TAB 2: SHORT NOTES */}
      {activeTab === 'short_notes' && (
        <section aria-label="Exam-night short notes" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                Exam-Night Cram Sheet · {profile.syllabus} {profile.classLevel}
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                Short Notes — {activeModule.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Export in PDF Maker
            </button>
          </div>

          <ul className="space-y-3">
            {shortNotes.map((bullet, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 px-4 py-3.5 text-sm sm:text-base text-[#0F172A] dark:text-slate-100 leading-relaxed"
              >
                <span className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 pt-1 tabular-nums shrink-0">
                  0{idx + 1}
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {!lesson && (
            <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Want deeper AI-generated formulas and short notes tailored to {profile.syllabus}?
              </p>
              <button
                type="button"
                disabled={isLoadingLesson}
                onClick={() => onGenerateLesson(activeSubject, activeModule, 'standard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
              >
                {isLoadingLesson ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Generate AI Short Notes
              </button>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: STUDY SHORTCUTS */}
      {activeTab === 'shortcuts' && (
        <section aria-label="Shortcuts for study" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                Mnemonics & Fast Problem-Solving Tricks
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                Shortcuts for Studying {activeModule.title}
              </h2>
            </div>
            {!lesson && (
              <button
                type="button"
                disabled={isLoadingLesson}
                onClick={() => onGenerateLesson(activeSubject, activeModule, 'standard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg cursor-pointer self-start whitespace-nowrap"
              >
                {isLoadingLesson ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Generate AI Study Shortcuts
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortcuts.map((sc, idx) => (
              <article
                key={idx}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-3"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
                    TRICK 0{idx + 1}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                    {sc.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{sc.trick}</p>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">When to use:</strong>{' '}
                  {sc.whenToUse}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: PHOTO REPRESENTATION (VISUAL CONCEPT DIAGRAM) */}
      {activeTab === 'visual' && visualDiagram && (
        <section aria-label="Photo and visual concept representation" className="space-y-4">
          <ConceptVisualDiagram diagram={visualDiagram} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visualDiagram.nodes.map((node, idx) => (
              <div
                key={idx}
                className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-4 space-y-1.5"
              >
                <p className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
                  0{idx + 1}. {node.label}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{node.detail}</p>
                {node.formula && (
                  <p className="font-mono text-xs text-[#0F172A] dark:text-sky-200 bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5">
                    {node.formula}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 5: REVISION DECK (INTERACTIVE FLASHCARDS) */}
      {activeTab === 'revision' && (
        <section aria-label="Active recall revision deck" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">Active-Recall Flashcards</p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                Revision Deck — {activeModule.title}
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              <span>
                Card {safeCardIndex + 1} / {revisionCards.length}
              </span>
              <span className="text-[#059669] dark:text-emerald-400 font-semibold">
                {gotItCount} / {revisionCards.length} Mastered
              </span>
              <button
                type="button"
                onClick={() => {
                  setMasteredCards({});
                  setCardIndex(0);
                  setIsCardFlipped(false);
                }}
                className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white font-sans font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          {activeCard && (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-10 space-y-6 max-w-3xl">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-[#0284C7] dark:text-sky-400">
                  {isCardFlipped ? 'Answer / Concept Rule' : 'Recall Prompt'}
                </span>
                {masteredCards[activeCard.id] && (
                  <span
                    className={
                      masteredCards[activeCard.id] === 'got_it'
                        ? 'font-semibold text-[#059669] dark:text-emerald-400'
                        : 'font-medium text-amber-700 dark:text-amber-400'
                    }
                  >
                    {masteredCards[activeCard.id] === 'got_it' ? 'Marked Got It' : 'Queued for Review'}
                  </span>
                )}
              </div>

              <div className="min-h-[120px] flex items-center">
                <p className="font-display text-xl sm:text-2xl font-medium text-[#0F172A] dark:text-slate-100 leading-snug">
                  {isCardFlipped ? activeCard.back : activeCard.front}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCardFlipped((prev) => !prev)}
                  className="px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors cursor-pointer"
                >
                  {isCardFlipped ? 'Show Question' : 'Reveal Answer'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMasteredCards((prev) => ({ ...prev, [activeCard.id]: 'review' }));
                      setIsCardFlipped(false);
                      setCardIndex((prev) => (prev + 1) % revisionCards.length);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    Review Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMasteredCards((prev) => ({ ...prev, [activeCard.id]: 'got_it' }));
                      setIsCardFlipped(false);
                      setCardIndex((prev) => (prev + 1) % revisionCards.length);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg cursor-pointer"
                  >
                    Got It — Next Card
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 6: PDF MAKER */}
      {activeTab === 'pdf' && (
        <section aria-label="Study guide PDF maker" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">Offline Printable Study Guide</p>
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                PDF Maker
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose the sections you want to bundle into a clean, print-ready A4 PDF for{' '}
                <strong className="text-[#0F172A] dark:text-slate-100">{activeModule.title}</strong> ({profile.syllabus} · {profile.classLevel}).
              </p>
            </div>

            <div className="space-y-2.5">
              {(
                [
                  {
                    key: 'includeFullNotes',
                    label: '1. Detailed Study Notes & Formulas',
                    desc: 'Complete concept breakdowns and highlighted key rules.',
                  },
                  {
                    key: 'includeShortNotes',
                    label: '2. Exam-Night Short Notes',
                    desc: 'High-yield bullet cram sheet for last-minute revision.',
                  },
                  {
                    key: 'includeShortcuts',
                    label: '3. Study Shortcuts & Memory Tricks',
                    desc: 'Fast-solving mnemonics and when to apply them.',
                  },
                  {
                    key: 'includeWorkedExample',
                    label: '4. Worked Example Question',
                    desc: 'Step-by-step solved problem with board takeaway.',
                  },
                  {
                    key: 'includeRevisionCards',
                    label: '5. Quick Revision Q&A Sheet',
                    desc: 'Flashcard prompts paired with concise answers.',
                  },
                  {
                    key: 'includeRoadmapOverview',
                    label: `6. Full ${activeSubject} Syllabus Roadmap`,
                    desc: 'All 4 progressive modules with estimated study times.',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-[#F8FAFC]/60 dark:bg-slate-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={pdfOptions[item.key]}
                    onChange={() => togglePdfOption(item.key)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-[#0284C7] focus:ring-[#0284C7]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                disabled={!hasAnyPdfSection}
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Download Study PDF
              </button>

              {lastPdfFileName && (
                <p role="status" className="text-xs font-medium text-[#059669] dark:text-emerald-400">
                  Downloaded <span className="font-mono">{lastPdfFileName}</span>
                </p>
              )}
            </div>
          </div>

          <aside className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Document Header Preview</p>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 p-5 space-y-3">
              <p className="font-mono text-[11px] font-semibold text-[#0284C7] dark:text-sky-400 tracking-wide">
                PATHWISE STUDY GUIDE · {profile.syllabus.toUpperCase()} ·{' '}
                {profile.classLevel.toUpperCase()}
              </p>
              <h3 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                {activeSubject}: {activeModule.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prepared for {profile.name} · Stage: {activeModule.stage} ·{' '}
                {activeModule.estimatedMinutes} min
              </p>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Included sections:</p>
                <p className="font-mono tabular-nums">
                  {Object.values(pdfOptions).filter(Boolean).length} of 6 sections selected
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}

      {/* Bottom Helper Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Have a doubt on {activeModule.title}? Ask Buddy, your AI Tutor, for step-by-step guidance.
        </p>
        <button
          type="button"
          onClick={() => onGoToTutor(activeSubject, activeModule.id)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
          Ask Buddy about this module
        </button>
      </div>
    </main>
  );
};
