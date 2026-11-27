import type { StudentProfile } from '../types/study';
import { calculateOverallProgress, calculateStudyStreak, calculateSubjectProgress } from './learningPath';

export type StudyBuddyMessageKind = 'chat' | 'question' | 'progress' | 'system';
export type StudyBuddyReactionKey = 'helpful' | 'cheers';
export type StudyBuddyFilter = 'all' | 'question' | 'progress';

export interface StudyRoomChatMessage {
  id: string;
  peerId: string;
  senderName: string;
  senderClass?: string;
  kind: StudyBuddyMessageKind;
  text: string;
  subjectTag?: string;
  progressPercent?: number;
  resolved?: boolean;
  resolvedBy?: string;
  reactions?: Partial<Record<StudyBuddyReactionKey, string[]>>;
  replyToId?: string;
  replyToSender?: string;
  replyToPreview?: string;
  timestamp: string;
}

export interface LiveProgressDraft {
  text: string;
  progressPercent: number;
  subjectTag: string;
}

/**
 * Builds a concise, authentic progress update draft directly from the student's
 * real Pathwise subject progress, current active module, and study streak.
 */
export function buildLiveProgressUpdate(
  profile: StudentProfile,
  subjectName: string
): LiveProgressDraft {
  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];
  const paths = profile.paths ?? {};
  const targetSubject =
    (subjectName && paths[subjectName] ? subjectName : subjects[0]) ||
    subjectName ||
    'General Studies';
  const subjectPath = paths[targetSubject];
  const streak = calculateStudyStreak(profile.completedDates ?? []);

  if (subjectPath && Array.isArray(subjectPath.modules) && subjectPath.modules.length > 0) {
    const progress = calculateSubjectProgress(subjectPath);
    const activeMod =
      subjectPath.modules.find((m) => m.status === 'in_progress') ??
      subjectPath.modules.find((m) => m.status !== 'mastered') ??
      subjectPath.modules[subjectPath.modules.length - 1];

    const parts: string[] = [
      `${targetSubject}: ${progress.masteredCount}/${progress.totalModules} modules mastered (${progress.percentComplete}%)`,
    ];
    if (progress.percentComplete === 100) {
      parts.push('Completed all chapters in this subject path!');
    } else if (activeMod?.title) {
      parts.push(`Currently revising "${activeMod.title}"`);
    }
    if (streak.currentStreak > 0) {
      parts.push(`${streak.currentStreak}-day study streak`);
    }

    return {
      text: parts.join(' · ').slice(0, 500),
      progressPercent: progress.percentComplete,
      subjectTag: targetSubject.slice(0, 80),
    };
  }

  const overall = calculateOverallProgress(subjects, paths);
  const fallbackParts: string[] = [
    `Overall mastery: ${overall.masteredModules}/${overall.totalModules} modules (${overall.overallPercent}%)`,
  ];
  if (streak.currentStreak > 0) {
    fallbackParts.push(`${streak.currentStreak}-day study streak`);
  }

  return {
    text: fallbackParts.join(' · ').slice(0, 500),
    progressPercent: overall.overallPercent,
    subjectTag: targetSubject.slice(0, 80),
  };
}

export function normalizeBuddyMessage(raw: Partial<StudyRoomChatMessage>): StudyRoomChatMessage {
  const validKind: StudyBuddyMessageKind =
    raw.kind === 'question' || raw.kind === 'progress' || raw.kind === 'system'
      ? raw.kind
      : 'chat';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `chat_${Date.now()}`,
    peerId: typeof raw.peerId === 'string' ? raw.peerId : '',
    senderName: typeof raw.senderName === 'string' && raw.senderName ? raw.senderName : 'Student',
    senderClass: typeof raw.senderClass === 'string' ? raw.senderClass : undefined,
    kind: validKind,
    text: typeof raw.text === 'string' ? raw.text : '',
    subjectTag: typeof raw.subjectTag === 'string' ? raw.subjectTag : undefined,
    progressPercent:
      typeof raw.progressPercent === 'number' && Number.isFinite(raw.progressPercent)
        ? Math.max(0, Math.min(100, Math.round(raw.progressPercent)))
        : undefined,
    resolved: Boolean(raw.resolved),
    resolvedBy: typeof raw.resolvedBy === 'string' ? raw.resolvedBy : undefined,
    reactions: raw.reactions && typeof raw.reactions === 'object' ? raw.reactions : undefined,
    replyToId: typeof raw.replyToId === 'string' ? raw.replyToId : undefined,
    replyToSender: typeof raw.replyToSender === 'string' ? raw.replyToSender : undefined,
    replyToPreview: typeof raw.replyToPreview === 'string' ? raw.replyToPreview : undefined,
    timestamp:
      typeof raw.timestamp === 'string' && raw.timestamp
        ? raw.timestamp
        : new Date().toISOString(),
  };
}

export function filterBuddyMessages(
  messages: StudyRoomChatMessage[],
  filter: StudyBuddyFilter
): StudyRoomChatMessage[] {
  if (filter === 'all') return messages;
  return messages.filter((m) => m.kind === filter);
}

export function countOpenQuestions(messages: StudyRoomChatMessage[]): number {
  return messages.filter((m) => m.kind === 'question' && !m.resolved).length;
}

export function countProgressUpdates(messages: StudyRoomChatMessage[]): number {
  return messages.filter((m) => m.kind === 'progress').length;
}

export function formatChatTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
