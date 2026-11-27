import type {
  AptitudeQuestion,
  BoardSyllabusSource,
  CrashRevisionPack,
  ExampleQuestion,
  LessonContent,
  MotivationSession,
  PreviousYearPaper,
  QuizQuestion,
  SimilarPaperDifficulty,
  StudyGoal,
  StudyPace,
  SubjectPath,
  TutorMessage,
  YouTubeQuizQuestion,
} from '../types/study';
import { classifySubjectDomain } from './learningPath';
import { normalizeSimilarPaperResponse } from './similarPaper';

async function postJson<T>(url: string, body: unknown, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new Error(
        typeof data?.error === 'string' && data.error.trim()
          ? data.error
          : `Request failed with status ${res.status}`
      );
    }

    if (!data || typeof data !== 'object') {
      throw new Error('The server returned an unexpected response. Please try again.');
    }

    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The AI service took too long to respond. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function generateLearningPathsApi(params: {
  studentName: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  subjects: string[];
  goal: StudyGoal;
  dailyMinutes: StudyPace;
  customNote?: string;
}): Promise<SubjectPath[]> {
  const data = await postJson<{
    paths: Array<Omit<SubjectPath, 'domain'>>;
  }>('/api/learning-path', params);

  return (data.paths ?? []).map((p) => ({
    ...p,
    domain: classifySubjectDomain(p.subject),
  }));
}

export interface AutoUpdateSyllabusResponse {
  academicSession: string;
  boardAuthority: string;
  summary: string;
  highlights: string[];
  sources: BoardSyllabusSource[];
  groundedWithSearch: boolean;
  syncedAt: string;
  paths: SubjectPath[];
}

export async function autoUpdateBoardSyllabusApi(params: {
  studentName: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  subjects: string[];
  goal: StudyGoal;
  dailyMinutes: StudyPace;
}): Promise<AutoUpdateSyllabusResponse> {
  const data = await postJson<{
    academicSession: string;
    boardAuthority: string;
    summary: string;
    highlights: string[];
    sources: BoardSyllabusSource[];
    groundedWithSearch: boolean;
    syncedAt: string;
    paths: Array<Omit<SubjectPath, 'domain'>>;
  }>('/api/syllabus/auto-update', params, 60000);

  const normalizedPaths = (Array.isArray(data.paths) ? data.paths : []).map((p) => ({
    ...p,
    domain: classifySubjectDomain(p.subject),
  }));

  if (normalizedPaths.length === 0) {
    throw new Error(
      `Unable to load updated ${params.syllabus} syllabus paths right now. Please try again.`
    );
  }

  return {
    academicSession:
      typeof data.academicSession === 'string' && data.academicSession.trim()
        ? data.academicSession
        : 'Latest Session',
    boardAuthority:
      typeof data.boardAuthority === 'string' && data.boardAuthority.trim()
        ? data.boardAuthority
        : params.syllabus,
    summary:
      typeof data.summary === 'string' && data.summary.trim()
        ? data.summary
        : `Aligned subjects to the latest ${params.syllabus} ${params.classLevel} syllabus.`,
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    groundedWithSearch: Boolean(data.groundedWithSearch),
    syncedAt:
      typeof data.syncedAt === 'string' && data.syncedAt.trim()
        ? data.syncedAt
        : new Date().toISOString(),
    paths: normalizedPaths,
  };
}

export async function generateLessonApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle: string;
  stage: string;
  objectives: string[];
  goal: StudyGoal;
  mode?: 'standard' | 'simpler' | 'real_world';
}): Promise<LessonContent> {
  const data = await postJson<{ lesson: LessonContent }>('/api/lesson', params);
  return data.lesson;
}

export interface LessonNotesSummary {
  headline: string;
  conciseSummary: string;
  keyPoints: string[];
  nextStepTip: string;
  basedOnPersonalNotes: boolean;
  generatedAt: string;
}

export async function summarizeLessonNotesApi(params: {
  studentName: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle: string;
  moduleSubtitle?: string;
  concepts?: string[];
  lessonSummary?: string;
  lessonConcepts?: Array<{
    heading: string;
    explanation: string;
    formulaOrKeyRule?: string;
  }>;
  studentNotes?: string;
}): Promise<LessonNotesSummary> {
  return postJson<LessonNotesSummary>('/api/notes/summarize', params, 35000);
}

export async function generateQuizApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle: string;
  concepts: string[];
  count?: number;
}): Promise<QuizQuestion[]> {
  const data = await postJson<{ questions: QuizQuestion[] }>('/api/quiz', params);
  return data.questions ?? [];
}

export async function generateExampleQuestionsApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle?: string;
}): Promise<ExampleQuestion[]> {
  const data = await postJson<{ examples: ExampleQuestion[] }>('/api/practice-pack', {
    mode: 'examples',
    ...params,
  });
  return data.examples ?? [];
}

export async function generateAptitudeQuestionsApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle?: string;
}): Promise<AptitudeQuestion[]> {
  const data = await postJson<{ questions: AptitudeQuestion[] }>('/api/practice-pack', {
    mode: 'aptitude',
    ...params,
  });
  return data.questions ?? [];
}

export async function generatePreviousYearPaperApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle?: string;
  referenceYear?: string;
}): Promise<PreviousYearPaper> {
  const data = await postJson<{ paper: PreviousYearPaper }>('/api/practice-pack', {
    mode: 'pyq',
    ...params,
  });
  return data.paper;
}

export async function generateSimilarPreviousYearPaperApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle?: string;
  referenceYear: string;
  difficulty: SimilarPaperDifficulty;
  referencePaper?: PreviousYearPaper;
}): Promise<PreviousYearPaper> {
  const data = await postJson<{ paper: Partial<PreviousYearPaper> }>('/api/practice-pack', {
    mode: 'similar_pyq',
    ...params,
  });
  return normalizeSimilarPaperResponse(data.paper, {
    classLevel: params.classLevel,
    syllabus: params.syllabus,
    subject: params.subject,
    referenceYear: params.referenceYear,
    difficulty: params.difficulty,
    referencePaper: params.referencePaper,
  });
}

export async function generateMotivationClassApi(params: {
  studentName: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  theme: string;
}): Promise<MotivationSession> {
  const data = await postJson<{ session: MotivationSession }>('/api/motivation', params);
  return data.session;
}

export async function generateCrashRevisionApi(params: {
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  timeBudgetMinutes: 30 | 60 | 120 | 180;
  topics?: string[];
  customFocus?: string;
}): Promise<CrashRevisionPack> {
  const data = await postJson<{ pack: CrashRevisionPack }>('/api/crash-revision', params, 50000);
  return data.pack;
}

export async function askTutorApi(params: {
  studentName: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  subject: string;
  moduleTitle?: string;
  goal: StudyGoal;
  history: TutorMessage[];
  message: string;
  image?: { mimeType: string; data: string };
  audio?: { mimeType: string; data: string };
}): Promise<string> {
  const timeoutMs = params.image || params.audio ? 60000 : 45000;
  const data = await postJson<{ reply: string }>('/api/tutor', params, timeoutMs);
  const reply = (data.reply ?? '').trim();
  if (!reply) {
    throw new Error('The AI tutor did not return a reply. Please try again.');
  }
  return reply;
}

export async function fetchYouTubeMetadataApi(videoId: string): Promise<{
  videoId: string;
  url: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
}> {
  const res = await fetch(`/api/youtube/metadata?videoId=${encodeURIComponent(videoId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to fetch video info.');
  }
  return data;
}

export interface YouTubeSearchVideo {
  videoId: string;
  title: string;
  channelName: string;
  duration: string;
  thumbnailUrl: string;
  snippet: string;
}

export async function searchYouTubeClassesApi(params: {
  q?: string;
  classLevel: string;
  syllabus: string;
  subject: string;
  language: string;
}): Promise<{ query: string; videos: YouTubeSearchVideo[] }> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set('q', params.q.trim());
  qs.set('classLevel', params.classLevel);
  qs.set('syllabus', params.syllabus);
  qs.set('subject', params.subject);
  qs.set('language', params.language);

  const res = await fetch(`/api/youtube/search?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Unable to load YouTube classes right now.'
    );
  }
  return {
    query: typeof data?.query === 'string' ? data.query : '',
    videos: Array.isArray(data?.videos) ? data.videos : [],
  };
}

export async function generateYouTubeQuizApi(params: {
  videoId: string;
  url: string;
  title: string;
  channelName: string;
  classLevel: string;
  syllabus: string;
  subject: string;
  language: string;
  notes?: string;
  count?: number;
  existingQuestions?: string[];
}): Promise<{
  summary: string;
  keyTakeaways: string[];
  questions: YouTubeQuizQuestion[];
}> {
  return postJson('/api/youtube/quiz', params, 50000);
}

export async function generateUploadedVideoQuizApi(params: {
  title: string;
  classLevel: string;
  syllabus: string;
  subject: string;
  language: string;
  count?: number;
  existingQuestions?: string[];
  frames?: string[];
  inlineVideo?: { mimeType: string; data: string };
}): Promise<{
  summary: string;
  keyTakeaways: string[];
  questions: YouTubeQuizQuestion[];
}> {
  return postJson('/api/video/quiz', params, 60000);
}

export interface SubscriptionConfigResponse {
  provider: 'razorpay';
  configured: boolean;
  planId: 'scholar_7yr_200inr' | 'scholar_7yr_100inr';
  amountInr: number;
  amountPaise: number;
  currency: 'INR';
  durationYears: 7;
}

export interface SubscriptionOrderResponse {
  orderId: string;
  orderToken: string;
  razorpayKeyId: string;
  planId: 'scholar_7yr_200inr' | 'scholar_7yr_100inr';
  amountInr: number;
  amountPaise: number;
  currency: 'INR';
  durationYears: 7;
  mode: 'razorpay';
}

export interface VerifiedSubscriptionReceipt {
  receiptId: string;
  planId: 'scholar_7yr_200inr' | 'scholar_7yr_100inr';
  amountInr: number;
  currency: 'INR';
  durationYears: 7;
  subscribedAt: string;
  expiresAt: string;
  paymentMethod: string;
  razorpayPaymentId?: string;
  referralCode?: string;
  mode: 'razorpay' | 'referral';
}

export async function fetchSubscriptionConfigApi(): Promise<SubscriptionConfigResponse> {
  const res = await fetch('/api/subscription/config');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : 'Unable to check Razorpay configuration.'
    );
  }
  return data as SubscriptionConfigResponse;
}

export async function createSubscriptionOrderApi(params: {
  studentId: string;
  studentName: string;
}): Promise<SubscriptionOrderResponse> {
  return postJson('/api/subscription/create-order', params, 15000);
}

export async function verifySubscriptionPaymentApi(params: {
  orderId: string;
  orderToken: string;
  studentId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifiedSubscriptionReceipt> {
  return postJson('/api/subscription/verify-payment', params, 15000);
}

export async function redeemSubscriptionCodeApi(params: {
  studentId: string;
  studentName: string;
  code: string;
}): Promise<VerifiedSubscriptionReceipt> {
  return postJson('/api/subscription/redeem-code', params, 15000);
}
