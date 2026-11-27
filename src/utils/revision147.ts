import type { CrashRevisionPack, Revision147Item, TopicReminderItem } from '../types/study';
import { getLocalDateKey } from './studyAlerts';

const REVISION_147_KEY_PREFIX = 'pathwise_revision_147_v1_';
const CRASH_PACKS_KEY_PREFIX = 'pathwise_crash_packs_v1_';

export type Revision147Stage = 1 | 4 | 7;
export type Revision147StageStatus = 'done' | 'overdue' | 'due_today' | 'upcoming';

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  const base = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
    : new Date();
  base.setDate(base.getDate() + deltaDays);
  return getLocalDateKey(base);
}

export function formatShortCalendarDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return dateKey;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function create147Item(params: {
  subject: string;
  topicTitle: string;
  moduleId?: string;
  startDate?: string;
  notes?: string;
  day1Done?: boolean;
}): Revision147Item {
  const start =
    params.startDate && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
      ? params.startDate
      : getLocalDateKey();

  return {
    id: `r147-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: params.subject.trim().slice(0, 80) || 'General Study',
    moduleId: params.moduleId?.trim().slice(0, 80) || undefined,
    topicTitle: params.topicTitle.trim().slice(0, 140) || 'Study Topic',
    startDate: start,
    day1Date: start,
    day4Date: addDaysToDateKey(start, 3), // Day 1 -> Day 4 is +3 calendar days
    day7Date: addDaysToDateKey(start, 6), // Day 1 -> Day 7 is +6 calendar days
    day1Done: Boolean(params.day1Done),
    day4Done: false,
    day7Done: false,
    notes: params.notes?.trim() ? params.notes.trim().slice(0, 180) : undefined,
    createdAt: new Date().toISOString(),
  };
}

export function get147StageStatus(
  dateKey: string,
  done: boolean,
  todayKey: string = getLocalDateKey()
): Revision147StageStatus {
  if (done) return 'done';
  if (dateKey < todayKey) return 'overdue';
  if (dateKey === todayKey) return 'due_today';
  return 'upcoming';
}

export function toggle147Stage(
  item: Revision147Item,
  stage: Revision147Stage
): Revision147Item {
  if (stage === 1) return { ...item, day1Done: !item.day1Done };
  if (stage === 4) return { ...item, day4Done: !item.day4Done };
  return { ...item, day7Done: !item.day7Done };
}

export interface Due147Review {
  item: Revision147Item;
  stage: Revision147Stage;
  stageLabel: string;
  stageAction: string;
  dueDate: string;
  status: 'overdue' | 'due_today';
}

export function getDue147Reviews(
  items: Revision147Item[],
  todayKey: string = getLocalDateKey()
): Due147Review[] {
  const due: Due147Review[] = [];

  for (const item of items) {
    const stages: Array<{
      stage: Revision147Stage;
      date: string;
      done: boolean;
      label: string;
      action: string;
    }> = [
      {
        stage: 1,
        date: item.day1Date,
        done: item.day1Done,
        label: 'Day 1 · Learn',
        action: 'Read concepts, make short notes, and solve core examples.',
      },
      {
        stage: 4,
        date: item.day4Date,
        done: item.day4Done,
        label: 'Day 4 · Active Recall',
        action: 'Recall key formulas & points without looking, then fix weak gaps.',
      },
      {
        stage: 7,
        date: item.day7Date,
        done: item.day7Done,
        label: 'Day 7 · Mastery Test',
        action: 'Take a timed exam-style quiz to lock this topic into long-term memory.',
      },
    ];

    for (const entry of stages) {
      const status = get147StageStatus(entry.date, entry.done, todayKey);
      if (status === 'overdue' || status === 'due_today') {
        due.push({
          item,
          stage: entry.stage,
          stageLabel: entry.label,
          stageAction: entry.action,
          dueDate: entry.date,
          status,
        });
      }
    }
  }

  return due.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function build147AlertsForItem(
  item: Revision147Item,
  dailyStudyTime: string = '18:00'
): TopicReminderItem[] {
  const [hh, mm] = /^([01]\d|2[0-3]):([0-5]\d)$/.test(dailyStudyTime)
    ? dailyStudyTime.split(':').map(Number)
    : [18, 0];

  const toDueIso = (dateKey: string): string => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  };

  return [
    {
      id: `r147-${item.id}-d4`.slice(0, 64),
      subject: item.subject,
      moduleId: item.moduleId,
      topicTitle: `1-4-7 Day 4 Recall: ${item.topicTitle}`.slice(0, 140),
      dueAt: toDueIso(item.day4Date),
      note: 'Day 4 spaced revision — test active recall & formulas.',
      completed: item.day4Done,
    },
    {
      id: `r147-${item.id}-d7`.slice(0, 64),
      subject: item.subject,
      moduleId: item.moduleId,
      topicTitle: `1-4-7 Day 7 Mastery: ${item.topicTitle}`.slice(0, 140),
      dueAt: toDueIso(item.day7Date),
      note: 'Day 7 final revision — solve timed exam questions to lock in.',
      completed: item.day7Done,
    },
  ];
}

export function load147Items(profileId: string): Revision147Item[] {
  try {
    const raw = window.localStorage.getItem(`${REVISION_147_KEY_PREFIX}${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Revision147Item[]).slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function save147Items(profileId: string, items: Revision147Item[]): void {
  try {
    window.localStorage.setItem(
      `${REVISION_147_KEY_PREFIX}${profileId}`,
      JSON.stringify(items.slice(0, 40))
    );
  } catch {
    // Ignore storage errors
  }
}

export function loadCrashPacks(profileId: string): Record<string, CrashRevisionPack> {
  try {
    const raw = window.localStorage.getItem(`${CRASH_PACKS_KEY_PREFIX}${profileId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, CrashRevisionPack>)
      : {};
  } catch {
    return {};
  }
}

export function saveCrashPacks(
  profileId: string,
  packs: Record<string, CrashRevisionPack>
): void {
  try {
    window.localStorage.setItem(
      `${CRASH_PACKS_KEY_PREFIX}${profileId}`,
      JSON.stringify(packs)
    );
  } catch {
    // Ignore storage errors
  }
}
