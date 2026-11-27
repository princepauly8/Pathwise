import type {
  ActiveStudyAlert,
  StudentProfile,
  StudyReminderSettings,
  TimetableSlot,
  TopicReminderItem,
} from '../types/study';
import { calculateStudyStreak } from './learningPath';

export function getLocalDateKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const MAX_TOPIC_ALERTS = 20;
export const DEFAULT_DAILY_STUDY_TIME = '18:00';

const DAY_INDEX_TO_SLOT_DAY: Record<number, TimetableSlot['day']> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export function isValidTimeHHMM(val: unknown): val is string {
  return typeof val === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(val.trim());
}

export function createDefaultReminderSettings(): StudyReminderSettings {
  return {
    enabled: true,
    dailyStudyTime: DEFAULT_DAILY_STUDY_TIME,
    soundEnabled: true,
    browserNotifications: false,
    topicAlerts: [],
  };
}

export function ensureReminderSettings(
  raw: Partial<StudyReminderSettings> | undefined
): StudyReminderSettings {
  const defaults = createDefaultReminderSettings();
  if (!raw || typeof raw !== 'object') return defaults;

  const topicAlerts: TopicReminderItem[] = Array.isArray(raw.topicAlerts)
    ? raw.topicAlerts
        .slice(0, MAX_TOPIC_ALERTS)
        .filter((item): item is TopicReminderItem => Boolean(item && typeof item === 'object'))
        .map((item, idx) => ({
          id: String(item.id || `rem-${idx + 1}`).trim().slice(0, 64),
          subject: String(item.subject || 'General Study').trim().slice(0, 80),
          moduleId: item.moduleId ? String(item.moduleId).trim().slice(0, 80) : undefined,
          topicTitle: String(item.topicTitle || 'Study Topic').trim().slice(0, 140),
          dueAt: String(item.dueAt || new Date(Date.now() + 3600_000).toISOString())
            .trim()
            .slice(0, 40),
          note: item.note ? String(item.note).trim().slice(0, 180) : undefined,
          completed: Boolean(item.completed),
          notifiedAt: item.notifiedAt ? String(item.notifiedAt).trim().slice(0, 40) : undefined,
        }))
        .filter((item) => item.id.length > 0 && item.topicTitle.length > 0)
    : [];

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    dailyStudyTime: isValidTimeHHMM(raw.dailyStudyTime)
      ? raw.dailyStudyTime.trim()
      : defaults.dailyStudyTime,
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : defaults.soundEnabled,
    browserNotifications:
      typeof raw.browserNotifications === 'boolean'
        ? raw.browserNotifications
        : defaults.browserNotifications,
    topicAlerts,
  };
}

export function formatTime12Hour(hhmm: string): string {
  if (!isValidTimeHHMM(hhmm)) return '6:00 PM';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${mStr} ${period}`;
}

export function toLocalDateTimeInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function buildQuickPresetIso(
  preset: '15m' | '1h' | 'tonight' | 'tomorrow',
  now: Date = new Date()
): string {
  const target = new Date(now.getTime());
  if (preset === '15m') {
    target.setMinutes(target.getMinutes() + 15, 0, 0);
  } else if (preset === '1h') {
    target.setHours(target.getHours() + 1, target.getMinutes(), 0, 0);
  } else if (preset === 'tonight') {
    target.setHours(19, 0, 0, 0);
    if (target.getTime() <= now.getTime() + 5 * 60_000) {
      target.setDate(target.getDate() + 1);
    }
  } else {
    target.setDate(target.getDate() + 1);
    target.setHours(18, 0, 0, 0);
  }
  return target.toISOString();
}

export function formatDueRelative(dueIso: string, now: Date = new Date()): string {
  const dueMs = Date.parse(dueIso);
  if (Number.isNaN(dueMs)) return 'Scheduled';
  const diffMin = Math.round((dueMs - now.getTime()) / 60_000);

  if (diffMin < -60) {
    const hrs = Math.round(Math.abs(diffMin) / 60);
    return `Overdue by ${hrs}h`;
  }
  if (diffMin < 0) {
    return `Overdue by ${Math.abs(diffMin)}m`;
  }
  if (diffMin === 0) {
    return 'Due right now';
  }
  if (diffMin < 60) {
    return `Due in ${diffMin}m`;
  }
  if (diffMin < 24 * 60) {
    const dueDate = new Date(dueMs);
    const sameDay = getLocalDateKey(dueDate) === getLocalDateKey(now);
    const timeLabel = dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return sameDay ? `Today at ${timeLabel}` : `Tomorrow at ${timeLabel}`;
  }

  const dueDate = new Date(dueMs);
  return dueDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function computeSmartStudyAlerts(
  profile: StudentProfile,
  now: Date = new Date()
): ActiveStudyAlert[] {
  const settings = ensureReminderSettings(profile.reminders);
  const alerts: ActiveStudyAlert[] = [];
  const nowMs = now.getTime();

  // 1. Scheduled topic completion reminders (due / overdue / upcoming within 24h)
  const pendingScheduled = settings.topicAlerts
    .filter((item) => !item.completed)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  for (const item of pendingScheduled) {
    const dueMs = Date.parse(item.dueAt);
    if (Number.isNaN(dueMs)) continue;
    const isDueOrOverdue = dueMs <= nowMs + 60_000;
    const isUpcomingSoon = dueMs > nowMs + 60_000 && dueMs <= nowMs + 24 * 60 * 60_000;

    if (isDueOrOverdue || isUpcomingSoon) {
      alerts.push({
        id: `sched-${item.id}`,
        kind: 'scheduled_topic',
        severity: isDueOrOverdue ? 'urgent' : 'upcoming',
        title: `Complete: ${item.topicTitle}`,
        message: item.note
          ? `${item.subject} · ${item.note}`
          : `${item.subject} — scheduled topic completion alert.`,
        subject: item.subject,
        moduleId: item.moduleId,
        reminderId: item.id,
        dueLabel: formatDueRelative(item.dueAt, now),
      });
    }
  }

  // 2. Daily study & streak alert if no topic completed today
  const streak = calculateStudyStreak(profile.completedDates, now);
  if (!streak.completedToday) {
    const [hStr, mStr] = settings.dailyStudyTime.split(':');
    const targetToday = new Date(now.getTime());
    targetToday.setHours(Number(hStr) || 18, Number(mStr) || 0, 0, 0);
    const pastDailyTime = nowMs >= targetToday.getTime();

    alerts.push({
      id: `daily-study-${getLocalDateKey(now)}`,
      kind: 'daily_study',
      severity: pastDailyTime ? 'urgent' : 'upcoming',
      title:
        streak.currentStreak > 0
          ? `Protect your ${streak.currentStreak}-day study streak`
          : 'Time for today’s study session',
      message: pastDailyTime
        ? `Your ${formatTime12Hour(settings.dailyStudyTime)} daily study reminder is active. Finish 1 topic (${profile.dailyMinutes}m goal) today.`
        : `Daily study reminder set for ${formatTime12Hour(settings.dailyStudyTime)} (${profile.dailyMinutes}m target).`,
      dueLabel: pastDailyTime ? 'Due today' : `At ${formatTime12Hour(settings.dailyStudyTime)}`,
    });
  }

  // 3. Today's incomplete timetable slots
  const todayDay = DAY_INDEX_TO_SLOT_DAY[now.getDay()];
  const todayPendingSlots = (profile.timetable ?? []).filter(
    (slot) => slot.day === todayDay && !slot.completed
  );
  for (const slot of todayPendingSlots.slice(0, 2)) {
    alerts.push({
      id: `slot-${slot.id}`,
      kind: 'timetable_slot',
      severity: 'upcoming',
      title: `Today’s Study Slot: ${slot.subject}`,
      message: `${slot.activity} · ${slot.timeRange} (${slot.durationMinutes} min)`,
      subject: slot.subject,
      dueLabel: slot.timeRange,
    });
  }

  // 4. In-progress topics that still need completion across subjects
  const alreadyListedModules = new Set(
    pendingScheduled.map((r) => r.moduleId).filter(Boolean)
  );
  let incompleteAdded = 0;
  for (const subject of profile.subjects) {
    const subjectPath = profile.paths[subject];
    if (!subjectPath) continue;
    const inProgress =
      subjectPath.modules.find((m) => m.status === 'in_progress') ??
      subjectPath.modules.find((m) => m.status === 'up_next');
    if (inProgress && !alreadyListedModules.has(inProgress.id)) {
      alerts.push({
        id: `topic-${subject}-${inProgress.id}`,
        kind: 'incomplete_topic',
        severity: 'info',
        title: `Finish topic: ${inProgress.title}`,
        message: `${subject} · ${inProgress.stage} (~${inProgress.estimatedMinutes} min left to master)`,
        subject,
        moduleId: inProgress.id,
        dueLabel: inProgress.status === 'in_progress' ? 'In progress' : 'Up next',
      });
      incompleteAdded += 1;
      if (incompleteAdded >= 3) break;
    }
  }

  return alerts;
}

export function playStudyAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 gentle study chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.45);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore autoplay / AudioContext restrictions cleanly
  }
}

export function getBrowserNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  'granted' | 'denied' | 'default' | 'unsupported'
> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function sendBrowserStudyNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, {
      body,
      tag: 'pathwise-study-alert',
    });
    return true;
  } catch {
    return false;
  }
}
