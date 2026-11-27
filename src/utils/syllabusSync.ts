import type {
  BoardSyllabusSyncRecord,
  LearningModule,
  StudentProfile,
  SubjectPath,
} from '../types/study';

export interface BoardQuickPreset {
  id: string;
  label: string;
  group: 'National & International' | 'State Boards';
}

export const BOARD_QUICK_PRESETS: BoardQuickPreset[] = [
  { id: 'CBSE', label: 'CBSE (NCERT)', group: 'National & International' },
  { id: 'ICSE / ISC', label: 'ICSE / ISC (CISCE)', group: 'National & International' },
  { id: 'State Board', label: 'State Board (General)', group: 'State Boards' },
  { id: 'Kerala SCERT', label: 'Kerala State Board (SCERT)', group: 'State Boards' },
  { id: 'Maharashtra MSBSHSE', label: 'Maharashtra State Board (MSBSHSE)', group: 'State Boards' },
  { id: 'Tamil Nadu Samacheer', label: 'Tamil Nadu Board (TNSCERT)', group: 'State Boards' },
  { id: 'Karnataka KSEAB', label: 'Karnataka State Board (KSEAB)', group: 'State Boards' },
  { id: 'UP Board (UPMSP)', label: 'Uttar Pradesh Board (UPMSP)', group: 'State Boards' },
  { id: 'Andhra / Telangana SCERT', label: 'Andhra / Telangana Board (SCERT)', group: 'State Boards' },
  { id: 'West Bengal WBBSE / WBCHSE', label: 'West Bengal Board (WBBSE / WBCHSE)', group: 'State Boards' },
  { id: 'Gujarat GSEB', label: 'Gujarat State Board (GSEB)', group: 'State Boards' },
  { id: 'IB (International Baccalaureate)', label: 'IB (International Baccalaureate)', group: 'National & International' },
  { id: 'IGCSE / Cambridge', label: 'IGCSE / Cambridge', group: 'National & International' },
  { id: 'Competitive / Entrance', label: 'Competitive / Entrance (JEE / NEET)', group: 'National & International' },
];

export const STATE_BOARD_PRESETS: string[] = BOARD_QUICK_PRESETS.filter(
  (b) => b.group === 'State Boards' && b.id !== 'State Board'
).map((b) => b.id);

const SYNC_STORAGE_PREFIX = 'pathwise_board_syllabus_sync_v1_';
const AUTO_SYNC_PREF_PREFIX = 'pathwise_board_autosync_pref_v1_';
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

function titlesMatchClosely(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }
  const tokensA = normalizeTokens(cleanA);
  const tokensB = normalizeTokens(cleanB);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let overlap = 0;
  for (const tok of tokensA) {
    if (tokensB.has(tok)) overlap += 1;
  }
  const ratio = overlap / Math.min(tokensA.size, tokensB.size);
  return ratio >= 0.5;
}

/**
 * Merges newly synced official board paths into the student's existing paths.
 * When `preserveMastery` is true (same board refresh), matching chapters retain
 * mastery status, quiz scores, and generated lesson/quiz caches.
 */
export function mergeSyncedSubjectPaths(
  existingPaths: Record<string, SubjectPath>,
  syncedPaths: SubjectPath[],
  preserveMastery: boolean
): Record<string, SubjectPath> {
  const nextRecord: Record<string, SubjectPath> = {};

  for (const synced of syncedPaths) {
    const previous = existingPaths[synced.subject];
    if (!preserveMastery || !previous) {
      nextRecord[synced.subject] = synced;
      continue;
    }

    const mergedModules: LearningModule[] = synced.modules.map((mod) => {
      const matched = previous.modules.find((oldMod) =>
        titlesMatchClosely(oldMod.title, mod.title)
      );
      if (!matched) return mod;
      return {
        ...mod,
        status: matched.status,
        bestQuizScore: matched.bestQuizScore,
        lesson: matched.lesson,
        quiz: matched.quiz,
      };
    });

    // Ensure at least one module is marked in_progress if not all are mastered
    const allMastered = mergedModules.every((m) => m.status === 'mastered');
    const hasInProgress = mergedModules.some((m) => m.status === 'in_progress');
    if (!allMastered && !hasInProgress) {
      const firstPendingIdx = mergedModules.findIndex((m) => m.status !== 'mastered');
      if (firstPendingIdx !== -1) {
        mergedModules[firstPendingIdx] = {
          ...mergedModules[firstPendingIdx],
          status: 'in_progress',
        };
      }
    }

    nextRecord[synced.subject] = {
      ...synced,
      modules: mergedModules,
    };
  }

  return nextRecord;
}

export function loadAutoSyncEnabled(profileId: string): boolean {
  try {
    const raw = window.localStorage.getItem(`${AUTO_SYNC_PREF_PREFIX}${profileId}`);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function saveAutoSyncEnabled(profileId: string, enabled: boolean): void {
  try {
    window.localStorage.setItem(`${AUTO_SYNC_PREF_PREFIX}${profileId}`, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSyllabusSyncRecord(profileId: string): BoardSyllabusSyncRecord | null {
  try {
    const raw = window.localStorage.getItem(`${SYNC_STORAGE_PREFIX}${profileId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardSyllabusSyncRecord>;
    if (!parsed || typeof parsed.board !== 'string' || typeof parsed.syncedAt !== 'string') {
      return null;
    }
    return {
      board: parsed.board,
      classLevel: String(parsed.classLevel ?? ''),
      academicSession: String(parsed.academicSession ?? 'Latest Session'),
      boardAuthority: String(parsed.boardAuthority ?? parsed.board),
      summary: String(parsed.summary ?? ''),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      groundedWithSearch: Boolean(parsed.groundedWithSearch),
      syncedAt: parsed.syncedAt,
      autoUpdateEnabled: loadAutoSyncEnabled(profileId),
      subjectCount: Number(parsed.subjectCount) || 0,
    };
  } catch {
    return null;
  }
}

export function saveSyllabusSyncRecord(
  profileId: string,
  record: BoardSyllabusSyncRecord
): void {
  try {
    window.localStorage.setItem(`${SYNC_STORAGE_PREFIX}${profileId}`, JSON.stringify(record));
    saveAutoSyncEnabled(profileId, record.autoUpdateEnabled);
  } catch {
    // Ignore storage quota errors
  }
}

export function evaluateSyllabusSyncStatus(
  profile: StudentProfile,
  record: BoardSyllabusSyncRecord | null,
  nowMs: number = Date.now()
): {
  needsSync: boolean;
  reason: 'board_changed' | 'class_changed' | 'missing_subjects' | 'stale' | 'up_to_date';
  missingSubjects: string[];
} {
  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];
  const paths = profile.paths ?? {};
  const missingSubjects = subjects.filter((s) => !paths[s]);
  if (missingSubjects.length > 0) {
    return { needsSync: true, reason: 'missing_subjects', missingSubjects };
  }

  if (!record) {
    return { needsSync: false, reason: 'up_to_date', missingSubjects: [] };
  }

  if ((record.board ?? '').trim().toLowerCase() !== (profile.syllabus ?? '').trim().toLowerCase()) {
    return { needsSync: true, reason: 'board_changed', missingSubjects: [] };
  }

  if (
    (record.classLevel ?? '').trim().toLowerCase() !==
    (profile.classLevel ?? '').trim().toLowerCase()
  ) {
    return { needsSync: true, reason: 'class_changed', missingSubjects: [] };
  }

  const syncedMs = Date.parse(record.syncedAt ?? '');
  if (Number.isNaN(syncedMs) || nowMs - syncedMs > STALE_AFTER_MS) {
    return { needsSync: true, reason: 'stale', missingSubjects: [] };
  }

  return { needsSync: false, reason: 'up_to_date', missingSubjects: [] };
}

export function formatSyncTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Recently';
  const diffMin = Math.floor((Date.now() - ms) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
