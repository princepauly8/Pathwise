export type StudyGoal = 'foundations' | 'exam_prep' | 'deep_mastery';

export type StudyPace = 20 | 45 | 90;

export type ModuleStatus = 'mastered' | 'in_progress' | 'up_next';

export type SubjectDomain = 'stem' | 'humanities';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ClassLevelOption {
  id: string;
  label: string;
  group: 'Middle School' | 'High School' | 'Higher & Exam Prep';
  recommendedSubjects: string[];
}

export interface SyllabusOption {
  id: string;
  label: string;
  description: string;
}

export interface LessonConcept {
  heading: string;
  explanation: string;
  formulaOrKeyRule?: string;
}

export interface RecallCheck {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface VisualDiagramNode {
  label: string;
  detail: string;
  formula?: string;
}

export interface VisualDiagram {
  title: string;
  caption: string;
  centralConcept: string;
  nodes: VisualDiagramNode[];
}

export interface StudyShortcut {
  title: string;
  trick: string;
  whenToUse: string;
}

export interface RevisionCard {
  id: string;
  front: string;
  back: string;
}

export interface LessonContent {
  summary: string;
  concepts: LessonConcept[];
  shortNotes?: string[];
  studyShortcuts?: StudyShortcut[];
  visualDiagram?: VisualDiagram;
  revisionCards?: RevisionCard[];
  workedExample: {
    prompt: string;
    steps: string[];
    takeaway: string;
  };
  recallCheck: RecallCheck;
  mode?: 'standard' | 'simpler' | 'real_world';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  conceptTag: string;
}

export interface ExampleQuestion {
  id: string;
  question: string;
  marks: number;
  difficulty: 'Easy' | 'Standard' | 'Challenge';
  steps: string[];
  finalAnswer: string;
  examTip: string;
}

export interface AptitudeQuestion {
  id: string;
  category: 'Quantitative' | 'Logical Reasoning' | 'Pattern & Data';
  question: string;
  options: string[];
  correctIndex: number;
  shortcutMethod: string;
}

export type SimilarPaperDifficulty = 'same' | 'challenging' | 'revision';

export interface PreviousYearQuestion {
  number: string;
  section: string;
  marks: number;
  question: string;
  markingScheme: string;
  conceptTested?: string;
  similarTo?: string;
  referenceQuestion?: string;
}

export interface PreviousYearPaper {
  title: string;
  year: string;
  syllabus: string;
  classLevel: string;
  subject: string;
  durationMinutes: number;
  maxMarks: number;
  basedOnYear?: string;
  basedOnTitle?: string;
  difficulty?: SimilarPaperDifficulty;
  patternNote?: string;
  questions: PreviousYearQuestion[];
}

export interface TimetableSlot {
  id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  timeRange: string;
  subject: string;
  activity: 'New Lesson & Notes' | 'Practice & Aptitude' | 'Short Notes & Revision' | 'PYQ Paper Drill';
  durationMinutes: number;
  completed: boolean;
}

export interface MotivationSegment {
  minuteRange: string;
  title: string;
  guidance: string;
}

export interface MotivationSession {
  id: string;
  theme: string;
  subtitle: string;
  durationMinutes: 10;
  affirmation: string;
  segments: MotivationSegment[];
  actionPrompt: string;
}

export interface LearningModule {
  id: string;
  order: number;
  stage: 'Foundations' | 'Core Mechanics' | 'Applied Practice' | 'Synthesis & Mastery';
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  concepts: string[];
  objectives: string[];
  whyItMatters: string;
  status: ModuleStatus;
  lesson?: LessonContent;
  quiz?: QuizQuestion[];
  bestQuizScore?: number;
  studentNotes?: string;
  studentNotesUpdatedAt?: string;
}

export interface SubjectPath {
  subject: string;
  domain: SubjectDomain;
  overview: string;
  focusStrategy: string;
  adaptationNote?: string;
  modules: LearningModule[];
  generatedByAi: boolean;
  updatedAt: string;
}

export interface TutorMediaPayload {
  image?: {
    mimeType: string;
    data: string;
    previewUrl: string;
  };
  audio?: {
    mimeType: string;
    data: string;
    durationSec: number;
  };
}

export interface TutorMessage {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: string;
  imagePreviewUrl?: string;
  hasImage?: boolean;
  hasAudio?: boolean;
  audioDurationSec?: number;
}

export interface YouTubeQuizQuestion extends QuizQuestion {
  addedBy?: 'ai' | 'student';
  timestampHint?: string;
}

export interface YouTubeClassItem {
  id: string;
  videoId: string;
  url: string;
  sourceType?: 'youtube' | 'upload';
  localVideoUrl?: string;
  title: string;
  channelName: string;
  subject: string;
  language: string;
  summary: string;
  keyTakeaways: string[];
  questions: YouTubeQuizQuestion[];
  bestQuizScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSubscription {
  planId: 'scholar_7yr_200inr' | 'scholar_7yr_100inr';
  status: 'trial' | 'active' | 'expired';
  trialStartedAt: string;
  trialEndsAt: string;
  subscribedAt?: string;
  expiresAt?: string;
  amountInr: number;
  currency: 'INR';
  durationYears: 7;
  paymentMethod?: string;
  receiptId?: string;
  referralCode?: string;
}

export interface TopicReminderItem {
  id: string;
  subject: string;
  moduleId?: string;
  topicTitle: string;
  dueAt: string;
  note?: string;
  completed: boolean;
  notifiedAt?: string;
}

export interface StudyReminderSettings {
  enabled: boolean;
  dailyStudyTime: string;
  soundEnabled: boolean;
  browserNotifications: boolean;
  topicAlerts: TopicReminderItem[];
}

export type StudyAlertKind =
  | 'scheduled_topic'
  | 'incomplete_topic'
  | 'timetable_slot'
  | 'daily_study'
  | 'test_alert';

export interface ActiveStudyAlert {
  id: string;
  kind: StudyAlertKind;
  severity: 'urgent' | 'upcoming' | 'info';
  title: string;
  message: string;
  subject?: string;
  moduleId?: string;
  reminderId?: string;
  dueLabel?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email?: string;
  classLevel: string;
  syllabus: string;
  language?: string;
  theme?: ThemePreference;
  subjects: string[];
  goal: StudyGoal;
  dailyMinutes: StudyPace;
  paths: Record<string, SubjectPath>;
  tutorHistory: Record<string, TutorMessage[]>;
  timetable?: TimetableSlot[];
  completedDates?: string[];
  youtubeClasses?: YouTubeClassItem[];
  subscription?: StudentSubscription;
  reminders?: StudyReminderSettings;
  createdAt: string;
}

export interface CrashSprintBlock {
  blockNumber: number;
  minutes: number;
  title: string;
  focusAction: string;
}

export interface CrashHighYieldTopic {
  id: string;
  topic: string;
  weightage: 'Must-Know' | 'High' | 'Quick Win';
  keyPoints: string[];
  examTrigger: string;
}

export interface CrashFormulaCard {
  label: string;
  expression: string;
  quickMemoryTip: string;
}

export interface CrashMistakeTrap {
  trap: string;
  fix: string;
}

export interface CrashRapidQuestion {
  id: string;
  question: string;
  marks: number;
  options: string[];
  correctIndex: number;
  answerKey: string;
  markingPoints: string[];
}

export interface CrashRevisionPack {
  id: string;
  subject: string;
  syllabus: string;
  classLevel: string;
  language: string;
  timeBudgetMinutes: number;
  title: string;
  examStrategy: string;
  sprintBlocks: CrashSprintBlock[];
  highYieldTopics: CrashHighYieldTopic[];
  formulaCheatSheet: CrashFormulaCard[];
  commonMistakes: CrashMistakeTrap[];
  rapidFireQuestions: CrashRapidQuestion[];
  createdAt: string;
}

export interface Revision147Item {
  id: string;
  subject: string;
  moduleId?: string;
  topicTitle: string;
  startDate: string; // YYYY-MM-DD (Day 1)
  day1Date: string; // YYYY-MM-DD
  day4Date: string; // YYYY-MM-DD (+3 days)
  day7Date: string; // YYYY-MM-DD (+6 days)
  day1Done: boolean;
  day4Done: boolean;
  day7Done: boolean;
  notes?: string;
  createdAt: string;
}

export interface BoardSyllabusSource {
  title: string;
  uri: string;
}

export interface BoardSyllabusSyncRecord {
  board: string;
  classLevel: string;
  academicSession: string;
  boardAuthority: string;
  summary: string;
  highlights: string[];
  sources: BoardSyllabusSource[];
  groundedWithSearch: boolean;
  syncedAt: string;
  autoUpdateEnabled: boolean;
  subjectCount: number;
}

export type WorkspaceView =
  | 'paths'
  | 'study'
  | 'revision'
  | 'classroom'
  | 'youtube'
  | 'combine'
  | 'practice'
  | 'planner'
  | 'tutor';
