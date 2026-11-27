import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Film,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react';
import type { StudentProfile, YouTubeClassItem, YouTubeQuizQuestion } from '../types/study';
import {
  generateUploadedVideoQuizApi,
  generateYouTubeQuizApi,
  searchYouTubeClassesApi,
  type YouTubeSearchVideo,
} from '../utils/api';
import {
  CURATED_YOUTUBE_CLASSES,
  DEFAULT_LANGUAGE,
  getLanguageDisplayLabel,
} from '../utils/languages';
import { LanguageSelect } from './LanguageSelect';

interface YouTubeClassStudioProps {
  profile: StudentProfile;
  activeSubject: string;
  onChangeLanguage: (language: string) => void;
  onSaveYouTubeClass: (item: YouTubeClassItem) => void;
  onDeleteYouTubeClass: (classId: string) => void;
  onCompleteYouTubeQuiz: (classId: string, percentage: number) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

interface ActivePlayerPreview {
  sourceType: 'youtube' | 'upload';
  videoId: string;
  url: string;
  localVideoUrl?: string;
  title: string;
  channelName: string;
  subject: string;
}

/** Extract up to 6 JPEG keyframes evenly across a local video file for fast multimodal analysis. */
async function extractVideoKeyframes(file: File, maxFrames = 6): Promise<string[]> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const failSafe = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 15000);

    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const width = Math.min(640, video.videoWidth || 640);
      const height = Math.round(width * ((video.videoHeight || 360) / (video.videoWidth || 640)));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        clearTimeout(failSafe);
        cleanup();
        resolve([]);
        return;
      }

      const frames: string[] = [];
      const count = duration < 4 ? 2 : maxFrames;

      for (let i = 0; i < count; i++) {
        const targetTime = Math.min(
          Math.max(0.1, duration - 0.1),
          ((i + 0.5) / count) * duration
        );
        try {
          await new Promise<void>((resSeek, rejSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onErr);
              resSeek();
            };
            const onErr = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onErr);
              rejSeek(new Error('seek failed'));
            };
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onErr);
            video.currentTime = targetTime;
          });
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          const base64 = dataUrl.split(',')[1];
          if (base64) frames.push(base64);
        } catch {
          // Skip unreadable frame
        }
      }

      clearTimeout(failSafe);
      cleanup();
      resolve(frames);
    };

    video.onerror = () => {
      clearTimeout(failSafe);
      cleanup();
      resolve([]);
    };
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = typeof reader.result === 'string' ? reader.result : '';
      const base64 = str.includes(',') ? str.split(',')[1] : str;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read the selected video file.'));
    reader.readAsDataURL(file);
  });
}

export const YouTubeClassStudio: React.FC<YouTubeClassStudioProps> = ({
  profile,
  activeSubject,
  onChangeLanguage,
  onSaveYouTubeClass,
  onDeleteYouTubeClass,
  onCompleteYouTubeQuiz,
}) => {
  const savedClasses = profile.youtubeClasses ?? [];
  const activeLanguage = profile.language || DEFAULT_LANGUAGE;

  // Source tab: browse/search YouTube videos directly OR upload a class video file
  const [sourceTab, setSourceTab] = useState<'browse' | 'upload'>('browse');

  // Direct YouTube video browser & search state
  const [selectedSubject, setSelectedSubject] = useState(
    profile.subjects.includes(activeSubject) ? activeSubject : profile.subjects[0] ?? 'Mathematics'
  );
  const [searchInput, setSearchInput] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [browseVideos, setBrowseVideos] = useState<YouTubeSearchVideo[]>([]);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Local uploaded video classes (kept in session with playable blob URLs)
  const [uploadedClasses, setUploadedClasses] = useState<YouTubeClassItem[]>([]);
  const uploadedMediaCacheRef = useRef<
    Record<string, { frames?: string[]; inlineVideo?: { mimeType: string; data: string } }>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playerSectionRef = useRef<HTMLDivElement | null>(null);
  const [uploadTitleInput, setUploadTitleInput] = useState('');

  // Combined saved YouTube classes + session uploaded video classes
  const allClasses: YouTubeClassItem[] = [...uploadedClasses, ...savedClasses];
  const [activeClassId, setActiveClassId] = useState<string | null>(allClasses[0]?.id ?? null);
  const [loadingPreview, setLoadingPreview] = useState<ActivePlayerPreview | null>(null);

  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isAppendingMore, setIsAppendingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive quiz state
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [quizMode, setQuizMode] = useState<'all' | 'focus'>('all');
  const [focusIndex, setFocusIndex] = useState(0);

  // Manual "Add Question" form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');
  const [newConceptTag, setNewConceptTag] = useState('');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  const activeClass: YouTubeClassItem | null =
    allClasses.find((c) => c.id === activeClassId) ?? allClasses[0] ?? null;

  useEffect(() => {
    if (activeClass && activeClass.id !== activeClassId && !loadingPreview) {
      setActiveClassId(activeClass.id);
    }
  }, [activeClass, activeClassId, loadingPreview]);

  useEffect(() => {
    if (profile.subjects.includes(activeSubject)) {
      setSelectedSubject(activeSubject);
    }
  }, [activeSubject, profile.subjects]);

  // Fetch real playable YouTube classes matching subject, class, syllabus, and selected language
  const fetchClassesForSubject = useCallback(
    async (subjectToLoad: string, customTopic = '') => {
      setIsSearchingVideos(true);
      setSearchError(null);
      try {
        const res = await searchYouTubeClassesApi({
          q: customTopic,
          classLevel: profile.classLevel,
          syllabus: profile.syllabus,
          subject: subjectToLoad,
          language: activeLanguage,
        });
        setLastSearchQuery(res.query);
        if (res.videos.length > 0) {
          setBrowseVideos(res.videos);
        } else {
          // Fallback to verified starter educational classes if YouTube search returned empty
          setBrowseVideos(
            CURATED_YOUTUBE_CLASSES.map((c) => ({
              videoId: c.videoId,
              title: c.title,
              channelName: c.channelName,
              duration: 'Class',
              thumbnailUrl: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
              snippet: c.topicHint,
            }))
          );
        }
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : 'Unable to load YouTube class videos right now.'
        );
        setBrowseVideos(
          CURATED_YOUTUBE_CLASSES.map((c) => ({
            videoId: c.videoId,
            title: c.title,
            channelName: c.channelName,
            duration: 'Class',
            thumbnailUrl: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
            snippet: c.topicHint,
          }))
        );
      } finally {
        setIsSearchingVideos(false);
      }
    },
    [profile.classLevel, profile.syllabus, activeLanguage]
  );

  // Auto-load real YouTube class videos when entering tab or changing subject / language
  useEffect(() => {
    fetchClassesForSubject(selectedSubject, '');
  }, [selectedSubject, activeLanguage, fetchClassesForSubject]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClassesForSubject(selectedSubject, searchInput.trim());
  };

  const persistClassUpdate = (updated: YouTubeClassItem) => {
    if (updated.sourceType === 'upload') {
      setUploadedClasses((prev) => [updated, ...prev.filter((c) => c.id !== updated.id)]);
    } else {
      onSaveYouTubeClass(updated);
    }
  };

  const removeClassRecord = (cls: YouTubeClassItem) => {
    if (cls.sourceType === 'upload') {
      if (cls.localVideoUrl) {
        URL.revokeObjectURL(cls.localVideoUrl);
      }
      delete uploadedMediaCacheRef.current[cls.id];
      setUploadedClasses((prev) => prev.filter((c) => c.id !== cls.id));
    } else {
      onDeleteYouTubeClass(cls.id);
    }
    if (activeClassId === cls.id) {
      setActiveClassId(null);
    }
  };

  const selectSavedClass = (cls: YouTubeClassItem) => {
    setLoadingPreview(null);
    setActiveClassId(cls.id);
    setAnswers({});
    setSubmitted(false);
    setFocusIndex(0);
    setShowAddForm(false);
    setError(null);
  };

  // Play a YouTube class directly & generate interactive quiz questions from it
  const handleSelectYouTubeVideo = async (video: YouTubeSearchVideo) => {
    setError(null);
    setAnswers({});
    setSubmitted(false);
    setFocusIndex(0);
    setShowAddForm(false);

    // If this exact video is already saved in the same language, open it immediately!
    const existing = savedClasses.find(
      (c) =>
        c.videoId === video.videoId &&
        c.language.toLowerCase() === activeLanguage.toLowerCase() &&
        c.questions.length > 0
    );
    if (existing) {
      selectSavedClass(existing);
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    // Immediately display the actual playable YouTube video while quiz generates beside it
    setLoadingPreview({
      sourceType: 'youtube',
      videoId: video.videoId,
      url: canonicalUrl,
      title: video.title,
      channelName: video.channelName,
      subject: selectedSubject,
    });
    setIsGeneratingQuiz(true);

    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    try {
      const generated = await generateYouTubeQuizApi({
        videoId: video.videoId,
        url: canonicalUrl,
        title: video.title,
        channelName: video.channelName,
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        subject: selectedSubject,
        language: activeLanguage,
        notes: video.snippet,
        count: questionCount,
      });

      const now = new Date().toISOString();
      const newClass: YouTubeClassItem = {
        id: `yt-${video.videoId}-${Date.now()}`,
        videoId: video.videoId,
        url: canonicalUrl,
        sourceType: 'youtube',
        title: video.title,
        channelName: video.channelName,
        subject: selectedSubject,
        language: activeLanguage,
        summary: generated.summary,
        keyTakeaways: generated.keyTakeaways,
        questions: generated.questions,
        createdAt: now,
        updatedAt: now,
      };

      onSaveYouTubeClass(newClass);
      setActiveClassId(newClass.id);
      setLoadingPreview(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate quiz questions for this video.'
      );
      setLoadingPreview(null);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Upload a video file directly from device, play it immediately, and ask quiz questions from it
  const handleVideoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WebM, MOV, etc.).');
      return;
    }

    setError(null);
    setAnswers({});
    setSubmitted(false);
    setFocusIndex(0);
    setShowAddForm(false);

    const localVideoUrl = URL.createObjectURL(file);
    const cleanTitle =
      uploadTitleInput.trim() ||
      file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
      `${selectedSubject} Video Class`;
    const classId = `upload-${Date.now()}`;

    setLoadingPreview({
      sourceType: 'upload',
      videoId: classId,
      url: localVideoUrl,
      localVideoUrl,
      title: cleanTitle,
      channelName: 'Uploaded Video Class',
      subject: selectedSubject,
    });
    setIsGeneratingQuiz(true);

    setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    try {
      let mediaPayload: {
        frames?: string[];
        inlineVideo?: { mimeType: string; data: string };
      } = {};

      // For short clips <= 8MB send the video directly (audio + visuals); for larger recordings sample keyframes
      if (file.size <= 8 * 1024 * 1024) {
        const base64 = await readFileAsBase64(file);
        mediaPayload = {
          inlineVideo: { mimeType: file.type || 'video/mp4', data: base64 },
        };
      } else {
        const frames = await extractVideoKeyframes(file, 6);
        if (frames.length === 0) {
          throw new Error(
            'Could not read video frames from this file. Try an MP4 or WebM video file.'
          );
        }
        mediaPayload = { frames };
      }

      uploadedMediaCacheRef.current[classId] = mediaPayload;

      const generated = await generateUploadedVideoQuizApi({
        title: cleanTitle,
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        subject: selectedSubject,
        language: activeLanguage,
        count: questionCount,
        ...mediaPayload,
      });

      const now = new Date().toISOString();
      const newClass: YouTubeClassItem = {
        id: classId,
        videoId: classId,
        url: localVideoUrl,
        sourceType: 'upload',
        localVideoUrl,
        title: cleanTitle,
        channelName: 'Uploaded Video Class',
        subject: selectedSubject,
        language: activeLanguage,
        summary: generated.summary,
        keyTakeaways: generated.keyTakeaways,
        questions: generated.questions,
        createdAt: now,
        updatedAt: now,
      };

      setUploadedClasses((prev) => [newClass, ...prev]);
      setActiveClassId(newClass.id);
      setUploadTitleInput('');
      setLoadingPreview(null);
    } catch (err) {
      URL.revokeObjectURL(localVideoUrl);
      setError(
        err instanceof Error ? err.message : 'Unable to generate quiz questions from this video.'
      );
      setLoadingPreview(null);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGenerateMoreQuestions = async () => {
    if (!activeClass || isAppendingMore) return;
    if (activeClass.questions.length >= 28) {
      setError('This class has reached the maximum of 30 quiz questions.');
      return;
    }

    setError(null);
    setIsAppendingMore(true);
    try {
      const result =
        activeClass.sourceType === 'upload' && uploadedMediaCacheRef.current[activeClass.id]
          ? await generateUploadedVideoQuizApi({
              title: activeClass.title,
              classLevel: profile.classLevel,
              syllabus: profile.syllabus,
              subject: activeClass.subject,
              language: activeLanguage,
              count: 3,
              existingQuestions: activeClass.questions.map((q) => q.question),
              ...uploadedMediaCacheRef.current[activeClass.id],
            })
          : await generateYouTubeQuizApi({
              videoId: activeClass.videoId,
              url: activeClass.url,
              title: activeClass.title,
              channelName: activeClass.channelName,
              classLevel: profile.classLevel,
              syllabus: profile.syllabus,
              subject: activeClass.subject,
              language: activeLanguage,
              count: 3,
              existingQuestions: activeClass.questions.map((q) => q.question),
            });

      const updated: YouTubeClassItem = {
        ...activeClass,
        language: activeLanguage,
        questions: [...activeClass.questions, ...result.questions].slice(0, 30),
        updatedAt: new Date().toISOString(),
      };
      persistClassUpdate(updated);
      setSubmitted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add more AI questions right now.');
    } finally {
      setIsAppendingMore(false);
    }
  };

  const handleRegenerateInSelectedLanguage = async () => {
    if (!activeClass || isGeneratingQuiz) return;
    setError(null);
    setIsGeneratingQuiz(true);
    try {
      const result =
        activeClass.sourceType === 'upload' && uploadedMediaCacheRef.current[activeClass.id]
          ? await generateUploadedVideoQuizApi({
              title: activeClass.title,
              classLevel: profile.classLevel,
              syllabus: profile.syllabus,
              subject: activeClass.subject,
              language: activeLanguage,
              count: Math.max(4, Math.min(6, activeClass.questions.length || 5)),
              ...uploadedMediaCacheRef.current[activeClass.id],
            })
          : await generateYouTubeQuizApi({
              videoId: activeClass.videoId,
              url: activeClass.url,
              title: activeClass.title,
              channelName: activeClass.channelName,
              classLevel: profile.classLevel,
              syllabus: profile.syllabus,
              subject: activeClass.subject,
              language: activeLanguage,
              count: Math.max(4, Math.min(6, activeClass.questions.length || 5)),
            });

      const studentAdded = activeClass.questions.filter((q) => q.addedBy === 'student');
      const updated: YouTubeClassItem = {
        ...activeClass,
        language: activeLanguage,
        summary: result.summary,
        keyTakeaways: result.keyTakeaways,
        questions: [...result.questions, ...studentAdded].slice(0, 30),
        updatedAt: new Date().toISOString(),
      };
      persistClassUpdate(updated);
      setAnswers({});
      setSubmitted(false);
      setFocusIndex(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to regenerate quiz in the selected language.'
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    setAddFormError(null);

    const qText = newQuestionText.trim();
    const cleanedOptions = newOptions.map((o) => o.trim());

    if (qText.length < 4) {
      setAddFormError('Please enter your quiz question.');
      return;
    }
    if (cleanedOptions.some((o) => o.length === 0)) {
      setAddFormError('Please fill in all 4 answer choices (A, B, C, and D).');
      return;
    }
    if (activeClass.questions.length >= 30) {
      setAddFormError('Maximum of 30 questions per class reached.');
      return;
    }

    const customQuestion: YouTubeQuizQuestion = {
      id: `yt-custom-${Date.now()}`,
      question: qText,
      options: cleanedOptions,
      correctIndex: newCorrectIndex,
      explanation:
        newExplanation.trim() ||
        `Correct answer: ${OPTION_LETTERS[newCorrectIndex]} (${cleanedOptions[newCorrectIndex]}).`,
      conceptTag: newConceptTag.trim() || 'Added Question',
      addedBy: 'student',
    };

    const updated: YouTubeClassItem = {
      ...activeClass,
      questions: [...activeClass.questions, customQuestion],
      updatedAt: new Date().toISOString(),
    };

    persistClassUpdate(updated);
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setNewCorrectIndex(0);
    setNewExplanation('');
    setNewConceptTag('');
    setShowAddForm(false);
    setSubmitted(false);
  };

  const handleRemoveQuestion = (questionId: string) => {
    if (!activeClass) return;
    const updated: YouTubeClassItem = {
      ...activeClass,
      questions: activeClass.questions.filter((q) => q.id !== questionId),
      updatedAt: new Date().toISOString(),
    };
    persistClassUpdate(updated);
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    if (focusIndex >= updated.questions.length && updated.questions.length > 0) {
      setFocusIndex(updated.questions.length - 1);
    }
  };

  const handleSubmitQuiz = () => {
    if (!activeClass || activeClass.questions.length === 0) return;
    const correctCount = activeClass.questions.reduce(
      (sum, q) => sum + (answers[q.id] === q.correctIndex ? 1 : 0),
      0
    );
    const pct = Math.round((correctCount / activeClass.questions.length) * 100);
    setSubmitted(true);
    if (activeClass.sourceType === 'upload') {
      persistClassUpdate({
        ...activeClass,
        bestQuizScore: Math.max(activeClass.bestQuizScore ?? 0, pct),
        updatedAt: new Date().toISOString(),
      });
    }
    onCompleteYouTubeQuiz(activeClass.id, pct);
  };

  const displayPlayer: ActivePlayerPreview | null = loadingPreview
    ? loadingPreview
    : activeClass
      ? {
          sourceType: activeClass.sourceType ?? 'youtube',
          videoId: activeClass.videoId,
          url: activeClass.url,
          localVideoUrl: activeClass.localVideoUrl,
          title: activeClass.title,
          channelName: activeClass.channelName,
          subject: activeClass.subject,
        }
      : null;

  const totalQuestions = activeClass?.questions.length ?? 0;
  const answeredCount = activeClass
    ? activeClass.questions.filter((q) => typeof answers[q.id] === 'number').length
    : 0;
  const correctCount =
    submitted && activeClass
      ? activeClass.questions.reduce(
          (sum, q) => sum + (answers[q.id] === q.correctIndex ? 1 : 0),
          0
        )
      : 0;
  const scorePct =
    submitted && totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Video Learning Studio <span aria-hidden="true">·</span>{' '}
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {getLanguageDisplayLabel(activeLanguage)}
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#0F172A] dark:text-slate-100">
            YouTube Classes & Video Quiz
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Watch class videos directly inside the app — or upload your own class video — generate
            interactive quiz questions from the video in Malayalam or any language, and add your own
            questions right into the quiz.
          </p>
        </div>

        <div className="w-full md:w-72 shrink-0">
          <LanguageSelect
            id="yt-studio-language"
            value={activeLanguage}
            onChange={onChangeLanguage}
            label="Class & Quiz Language"
          />
        </div>
      </div>

      {/* Active Video Player & Interactive Quiz Desk (Video-First!) */}
      {displayPlayer && (
        <div ref={playerSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Embedded Video Player + Summary & Takeaways */}
          <div className="lg:col-span-7 space-y-5">
            <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
              <div className="aspect-video w-full bg-slate-950">
                {displayPlayer.sourceType === 'upload' && displayPlayer.localVideoUrl ? (
                  <video
                    key={displayPlayer.localVideoUrl}
                    src={displayPlayer.localVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <iframe
                    key={displayPlayer.videoId}
                    src={`https://www.youtube-nocookie.com/embed/${displayPlayer.videoId}?rel=0`}
                    title={displayPlayer.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                      {displayPlayer.subject} <span aria-hidden="true">·</span>{' '}
                      {displayPlayer.channelName} <span aria-hidden="true">·</span>{' '}
                      {getLanguageDisplayLabel(
                        loadingPreview ? activeLanguage : activeClass?.language || activeLanguage
                      )}
                    </p>
                    <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                      {displayPlayer.title}
                    </h2>
                  </div>

                  {!loadingPreview && activeClass && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeClass.sourceType !== 'upload' && (
                        <a
                          href={activeClass.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          YouTube
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeClassRecord(activeClass)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        aria-label="Delete saved class"
                        title="Remove class"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {!loadingPreview && activeClass && activeClass.language !== activeLanguage && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 px-3.5 py-2.5">
                    <span className="text-xs text-sky-900 dark:text-sky-200">
                      This quiz is in <strong>{activeClass.language}</strong>. Your selected
                      language is <strong>{getLanguageDisplayLabel(activeLanguage)}</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={handleRegenerateInSelectedLanguage}
                      disabled={isGeneratingQuiz}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-md cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    >
                      {isGeneratingQuiz ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      Translate Quiz to {activeLanguage}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Class Overview & Key Takeaways */}
            {!loadingPreview && activeClass && (
              <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                  <h3 className="font-sans text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                    Class Overview & Key Takeaways
                  </h3>
                </div>

                {activeClass.summary && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{activeClass.summary}</p>
                )}

                {activeClass.keyTakeaways.length > 0 && (
                  <ul className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {activeClass.keyTakeaways.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 mt-0.5 shrink-0">
                          0{idx + 1}
                        </span>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          {/* Right 5 Cols: Interactive Quiz & Add Questions Desk */}
          <div className="lg:col-span-5 space-y-5">
            <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 space-y-5">
              {loadingPreview && isGeneratingQuiz ? (
                <div className="py-14 px-4 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
                  <h3 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                    Creating Class Quiz in {getLanguageDisplayLabel(activeLanguage)}...
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    You can start watching the video right now while Pathwise prepares your summary
                    and quiz questions from the class.
                  </p>
                </div>
              ) : activeClass ? (
                <>
                  {/* Quiz Header & Actions */}
                  <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                          Class Quiz ({totalQuestions})
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {activeClass.bestQuizScore !== undefined
                            ? `Best score: ${activeClass.bestQuizScore}% · `
                            : ''}
                          Language: {getLanguageDisplayLabel(activeClass.language)}
                        </p>
                      </div>

                      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQuizMode('all')}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                            quizMode === 'all'
                              ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizMode('focus');
                            setFocusIndex(0);
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                            quizMode === 'focus'
                              ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                          }`}
                        >
                          1-by-1
                        </button>
                      </div>
                    </div>

                    {/* Add Questions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm((prev) => !prev);
                          setAddFormError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        {showAddForm ? 'Close Add Form' : 'Add Question'}
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateMoreQuestions}
                        disabled={isAppendingMore || isGeneratingQuiz}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/80 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                      >
                        {isAppendingMore ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        {isAppendingMore ? 'Adding AI Questions...' : '+3 AI Questions'}
                      </button>
                    </div>
                  </div>

                  {/* Manual Add Question Form */}
                  {showAddForm && (
                    <form
                      onSubmit={handleAddCustomQuestion}
                      className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/30 p-4 space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0F172A] dark:text-slate-100">
                          Add Your Own Question Into This Class Quiz
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Type in {activeLanguage} or any language
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="custom-q-text"
                          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Question
                        </label>
                        <textarea
                          id="custom-q-text"
                          rows={2}
                          maxLength={400}
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          placeholder="Write your question from the video..."
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Answer Choices (select the correct answer)
                        </p>
                        {OPTION_LETTERS.map((letter, idx) => (
                          <div key={letter} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="custom-correct-option"
                              id={`custom-opt-radio-${idx}`}
                              checked={newCorrectIndex === idx}
                              onChange={() => setNewCorrectIndex(idx)}
                              aria-label={`Mark option ${letter} as correct`}
                              className="h-4 w-4 accent-[#0284C7] cursor-pointer"
                            />
                            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 w-4">
                              {letter}
                            </span>
                            <input
                              type="text"
                              maxLength={220}
                              value={newOptions[idx]}
                              onChange={(e) => {
                                const next: [string, string, string, string] = [...newOptions];
                                next[idx] = e.target.value;
                                setNewOptions(next);
                              }}
                              placeholder={`Option ${letter}`}
                              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label
                            htmlFor="custom-q-tag"
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            Topic Tag (optional)
                          </label>
                          <input
                            id="custom-q-tag"
                            type="text"
                            maxLength={60}
                            value={newConceptTag}
                            onChange={(e) => setNewConceptTag(e.target.value)}
                            placeholder="e.g., Formula, Exam Tip"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="custom-q-exp"
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            Explanation (optional)
                          </label>
                          <input
                            id="custom-q-exp"
                            type="text"
                            maxLength={350}
                            value={newExplanation}
                            onChange={(e) => setNewExplanation(e.target.value)}
                            placeholder="Why is this answer right?"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      {addFormError && (
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">{addFormError}</p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Save Question to Quiz
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Score Result Banner */}
                  {submitted && totalQuestions > 0 && (
                    <div
                      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        scorePct >= 70
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            scorePct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold">
                            Score: {scorePct}% ({correctCount}/{totalQuestions})
                          </p>
                          <p className="text-xs opacity-85 mt-0.5">
                            {scorePct >= 70
                              ? 'Great mastery of this video class — counted toward your study streak.'
                              : 'Review the explanations below, rewatch the video, and try again.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAnswers({});
                          setSubmitted(false);
                          setFocusIndex(0);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        Retake Quiz
                      </button>
                    </div>
                  )}

                  {/* Questions List */}
                  {totalQuestions === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        No quiz questions in this class yet. Add your own question or generate AI
                        questions above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {(quizMode === 'focus'
                        ? [activeClass.questions[Math.min(focusIndex, totalQuestions - 1)]]
                        : activeClass.questions
                      ).map((q, idx) => {
                        const displayNumber = quizMode === 'focus' ? focusIndex + 1 : idx + 1;
                        const chosen = answers[q.id];
                        const isCorrect = submitted && chosen === q.correctIndex;

                        return (
                          <article
                            key={q.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4 sm:p-5 space-y-3.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  <span className="font-mono text-[#0F172A] dark:text-slate-100 font-semibold">
                                    Q{displayNumber}
                                  </span>
                                  <span>·</span>
                                  <span className="text-[#0284C7] dark:text-sky-400">{q.conceptTag}</span>
                                  {q.timestampHint && (
                                    <>
                                      <span>·</span>
                                      <span>{q.timestampHint}</span>
                                    </>
                                  )}
                                  {q.addedBy === 'student' && (
                                    <>
                                      <span>·</span>
                                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                        Added by You
                                      </span>
                                    </>
                                  )}
                                </div>
                                <h3 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
                                  {q.question}
                                </h3>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(q.id)}
                                aria-label={`Delete question ${displayNumber}`}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>

                            <div className="space-y-2">
                              {q.options.map((opt, oIdx) => {
                                const isPicked = chosen === oIdx;
                                const isRightOption = oIdx === q.correctIndex;
                                let btnStyle =
                                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500';

                                if (submitted) {
                                  if (isRightOption) {
                                    btnStyle =
                                      'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-600 text-emerald-950 dark:text-emerald-200 font-medium';
                                  } else if (isPicked && !isRightOption) {
                                    btnStyle = 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700 text-red-900 dark:text-red-300';
                                  } else {
                                    btnStyle = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500';
                                  }
                                } else if (isPicked) {
                                  btnStyle =
                                    'bg-[#0284C7]/10 dark:bg-sky-950/60 border-[#0284C7] dark:border-sky-500 text-[#0F172A] dark:text-slate-100 font-medium';
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    disabled={submitted}
                                    onClick={() =>
                                      setAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: oIdx,
                                      }))
                                    }
                                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors flex items-start gap-2.5 cursor-pointer disabled:cursor-default ${btnStyle}`}
                                  >
                                    <span className="font-mono text-xs font-semibold mt-0.5 shrink-0">
                                      {OPTION_LETTERS[oIdx] ?? oIdx + 1}.
                                    </span>
                                    <span className="leading-snug">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {submitted && (
                              <div
                                className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                                  isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80'
                                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <span className="font-semibold">
                                  {isCorrect ? 'Correct: ' : 'Explanation: '}
                                </span>
                                {q.explanation}
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {/* Focus Mode Prev/Next Controls */}
                      {quizMode === 'focus' && totalQuestions > 1 && (
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            disabled={focusIndex === 0}
                            onClick={() => setFocusIndex((i) => Math.max(0, i - 1))}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                          >
                            Previous
                          </button>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {focusIndex + 1} / {totalQuestions}
                          </span>
                          <button
                            type="button"
                            disabled={focusIndex >= totalQuestions - 1}
                            onClick={() =>
                              setFocusIndex((i) => Math.min(totalQuestions - 1, i + 1))
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                          >
                            Next Question
                          </button>
                        </div>
                      )}

                      {/* Submit Quiz Action */}
                      {!submitted && (
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {answeredCount === totalQuestions
                              ? 'All questions answered — ready to check!'
                              : `Select answers (${answeredCount}/${totalQuestions} answered)`}
                          </span>
                          <button
                            type="button"
                            disabled={answeredCount === 0}
                            onClick={handleSubmitQuiz}
                            className="px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 bg-[#0F172A] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Check Quiz Answers
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </section>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Saved Classes Switcher */}
      {allClasses.length > 0 && (
        <section aria-label="Saved video classes" className="space-y-2.5">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Watched Classes ({allClasses.length})
          </h2>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {allClasses.map((cls) => {
              const isSelected = !loadingPreview && activeClass?.id === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => selectSavedClass(cls)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-left transition-colors cursor-pointer shrink-0 max-w-[290px] ${
                    isSelected
                      ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  {cls.sourceType === 'upload' ? (
                    <Film className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{cls.title}</p>
                    <p
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-slate-300 dark:text-slate-900/80' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cls.subject} · {cls.questions.length} Qs · {cls.language}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Direct Video Library Browser & Upload Studio (No Link Pasting!) */}
      <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSourceTab('browse')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                sourceTab === 'browse'
                  ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Youtube className="w-4 h-4 text-red-500" aria-hidden="true" />
              Browse YouTube Classes
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('upload')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                sourceTab === 'upload'
                  ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Video File
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="yt-quiz-size" className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Quiz Size:
            </label>
            <select
              id="yt-quiz-size"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-[#0F172A] dark:text-slate-100"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={8}>8 Questions</option>
            </select>
          </div>
        </div>

        {sourceTab === 'browse' ? (
          <div className="space-y-5">
            {/* Search Topic Bar & Subject Switcher */}
            <div className="space-y-3">
              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
              >
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="yt-topic-search"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={`Search any ${selectedSubject} chapter or topic in ${activeLanguage}...`}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingVideos}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isSearchingVideos ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="w-4 h-4" aria-hidden="true" />
                  )}
                  Find Videos
                </button>
              </form>

              {/* Subject Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {profile.subjects.map((sub) => {
                  const isActiveSub = selectedSubject === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setSelectedSubject(sub);
                        setSearchInput('');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isActiveSub
                          ? 'bg-[#0284C7]/10 dark:bg-sky-950/60 border-[#0284C7] dark:border-sky-500 text-[#0284C7] dark:text-sky-400'
                          : 'bg-[#F8FAFC] dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-[#0F172A] dark:hover:text-white'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>

            {searchError && (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg px-3.5 py-2">
                {searchError} Showing verified starter classes below.
              </p>
            )}

            {/* Video Cards Gallery Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {lastSearchQuery
                    ? `Showing YouTube classes for "${lastSearchQuery}"`
                    : `Recommended ${selectedSubject} classes in ${getLanguageDisplayLabel(activeLanguage)}`}
                </span>
                <span>Click any video to play & ask quiz</span>
              </div>

              {isSearchingVideos ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-800/50 animate-pulse"
                    >
                      <div className="aspect-video bg-slate-200 dark:bg-slate-700" />
                      <div className="p-3.5 space-y-2">
                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {browseVideos.map((video) => {
                    const isCurrentlyPlaying =
                      displayPlayer?.sourceType === 'youtube' &&
                      displayPlayer.videoId === video.videoId;
                    return (
                      <button
                        key={video.videoId}
                        type="button"
                        disabled={isGeneratingQuiz}
                        onClick={() => handleSelectYouTubeVideo(video)}
                        className={`group text-left rounded-xl border overflow-hidden transition-all cursor-pointer disabled:opacity-60 flex flex-col ${
                          isCurrentlyPlaying
                            ? 'border-[#0284C7] dark:border-sky-500 ring-2 ring-[#0284C7]/20 dark:ring-sky-500/20 bg-sky-50/40 dark:bg-sky-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/35 transition-colors flex items-center justify-center">
                            <span className="w-11 h-11 rounded-full bg-[#0F172A]/85 group-hover:bg-[#0284C7] text-white flex items-center justify-center transition-colors shadow-sm">
                              <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                            </span>
                          </div>
                          {video.duration && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/85 text-white font-mono text-[11px] font-medium">
                              {video.duration}
                            </span>
                          )}
                        </div>

                        <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-100 line-clamp-2 leading-snug">
                              {video.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {video.channelName}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] dark:text-sky-400">
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            {isCurrentlyPlaying ? 'Now Playing' : 'Watch & Ask Quiz'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Upload Local Class Video File Directly */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="upload-video-title"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Class Video Title (optional)
                </label>
                <input
                  id="upload-video-title"
                  type="text"
                  maxLength={180}
                  value={uploadTitleInput}
                  onChange={(e) => setUploadTitleInput(e.target.value)}
                  placeholder="e.g., Chapter 4 Physics Class Recording"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-video-subject"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Subject
                </label>
                <select
                  id="upload-video-subject"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-[#0F172A] dark:text-slate-100"
                >
                  {profile.subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                  <option value="General Studies">General Studies</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/50 p-8 text-center space-y-3">
              <Film className="w-9 h-9 text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                  Select a Class Video from Your Device
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Choose any MP4, WebM, or MOV lecture video. Pathwise plays the video directly and
                  analyzes its content to create quiz questions in{' '}
                  <strong>{getLanguageDisplayLabel(activeLanguage)}</strong>.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileSelected}
                className="hidden"
                aria-label="Upload class video file"
              />
              <button
                type="button"
                disabled={isGeneratingQuiz}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Analyzing Video & Creating Quiz...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    Choose Video File
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
