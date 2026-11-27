import React, { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  ActiveStudyAlert,
  StudentProfile,
  StudyReminderSettings,
  TopicReminderItem,
} from '../types/study';
import {
  MAX_TOPIC_ALERTS,
  buildQuickPresetIso,
  ensureReminderSettings,
  formatDueRelative,
  formatTime12Hour,
  getBrowserNotificationPermission,
  playStudyAlertChime,
  requestBrowserNotificationPermission,
  sendBrowserStudyNotification,
  toLocalDateTimeInputValue,
} from '../utils/studyAlerts';

interface PrefillTopicTarget {
  subject: string;
  moduleId?: string;
  topicTitle: string;
}

interface StudyAlertsPanelProps {
  profile: StudentProfile;
  activeAlerts: ActiveStudyAlert[];
  embedded?: boolean;
  prefillTopic?: PrefillTopicTarget | null;
  onClose?: () => void;
  onUpdateReminders: (next: StudyReminderSettings) => void;
  onOpenAlertTarget: (alert: ActiveStudyAlert) => void;
  onCompleteAlertTarget: (alert: ActiveStudyAlert) => void;
  onTriggerTestAlert: () => void;
}

export const StudyAlertsPanel: React.FC<StudyAlertsPanelProps> = ({
  profile,
  activeAlerts,
  embedded = false,
  prefillTopic = null,
  onClose,
  onUpdateReminders,
  onOpenAlertTarget,
  onCompleteAlertTarget,
  onTriggerTestAlert,
}) => {
  const settings = useMemo(() => ensureReminderSettings(profile.reminders), [profile.reminders]);

  const [subject, setSubject] = useState<string>(
    prefillTopic?.subject || profile.subjects[0] || 'General Study'
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string>(prefillTopic?.moduleId || '');
  const [customTopicTitle, setCustomTopicTitle] = useState<string>(prefillTopic?.topicTitle || '');
  const [dueLocalInput, setDueLocalInput] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60_000))
  );
  const [note, setNote] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [browserPerm, setBrowserPerm] = useState(() => getBrowserNotificationPermission());

  // Sync prefill target when opened from a specific topic card
  useEffect(() => {
    if (!prefillTopic) return;
    setSubject(prefillTopic.subject);
    setSelectedModuleId(prefillTopic.moduleId || '');
    setCustomTopicTitle(prefillTopic.topicTitle);
  }, [prefillTopic]);

  // Escape key closes drawer
  useEffect(() => {
    if (embedded || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [embedded, onClose]);

  const subjectModules = useMemo(() => {
    const path = profile.paths[subject];
    return path ? path.modules : [];
  }, [profile.paths, subject]);

  // Keep topic title synced when subject changes (unless prefilled)
  const handleSubjectChange = (nextSubject: string) => {
    setSubject(nextSubject);
    const mods = profile.paths[nextSubject]?.modules ?? [];
    const nextIncomplete = mods.find((m) => m.status !== 'mastered') ?? mods[0];
    if (nextIncomplete) {
      setSelectedModuleId(nextIncomplete.id);
      setCustomTopicTitle(nextIncomplete.title);
    } else {
      setSelectedModuleId('');
      setCustomTopicTitle('');
    }
  };

  const handleModuleSelect = (modId: string) => {
    setSelectedModuleId(modId);
    if (!modId) return;
    const found = subjectModules.find((m) => m.id === modId);
    if (found) {
      setCustomTopicTitle(found.title);
    }
  };

  const applyQuickPreset = (preset: '15m' | '1h' | 'tonight' | 'tomorrow') => {
    const iso = buildQuickPresetIso(preset);
    setDueLocalInput(toLocalDateTimeInputValue(new Date(iso)));
  };

  const handleAddTopicReminder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    const title = customTopicTitle.trim();
    if (!title) {
      setFormFeedback('Please pick or enter a topic to complete.');
      return;
    }

    if (settings.topicAlerts.length >= MAX_TOPIC_ALERTS) {
      setFormFeedback(`You can save up to ${MAX_TOPIC_ALERTS} topic reminders. Delete an older one first.`);
      return;
    }

    const parsedDate = new Date(dueLocalInput);
    const dueIso = Number.isNaN(parsedDate.getTime())
      ? buildQuickPresetIso('1h')
      : parsedDate.toISOString();

    const newItem: TopicReminderItem = {
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: subject || profile.subjects[0] || 'General Study',
      moduleId: selectedModuleId || undefined,
      topicTitle: title.slice(0, 140),
      dueAt: dueIso,
      note: note.trim() ? note.trim().slice(0, 180) : undefined,
      completed: false,
    };

    onUpdateReminders({
      ...settings,
      enabled: true,
      topicAlerts: [newItem, ...settings.topicAlerts].slice(0, MAX_TOPIC_ALERTS),
    });

    setNote('');
    setFormFeedback(`Alert scheduled for “${newItem.topicTitle}” (${formatDueRelative(dueIso)}).`);
  };

  const handleToggleReminderDone = (id: string) => {
    const next = settings.topicAlerts.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onUpdateReminders({ ...settings, topicAlerts: next });
  };

  const handleSnoozeReminder = (id: string) => {
    const snoozedIso = new Date(Date.now() + 15 * 60_000).toISOString();
    const next = settings.topicAlerts.map((item) =>
      item.id === id
        ? { ...item, dueAt: snoozedIso, completed: false, notifiedAt: undefined }
        : item
    );
    onUpdateReminders({ ...settings, topicAlerts: next });
  };

  const handleDeleteReminder = (id: string) => {
    onUpdateReminders({
      ...settings,
      topicAlerts: settings.topicAlerts.filter((item) => item.id !== id),
    });
  };

  const handleToggleBrowserNotifications = async () => {
    if (settings.browserNotifications && browserPerm === 'granted') {
      onUpdateReminders({ ...settings, browserNotifications: false });
      return;
    }
    const perm = await requestBrowserNotificationPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      onUpdateReminders({ ...settings, enabled: true, browserNotifications: true });
      sendBrowserStudyNotification(
        'Pathwise Study Alerts Enabled',
        `You will get timely reminders to study and complete your topics.`
      );
    } else {
      onUpdateReminders({ ...settings, browserNotifications: false });
    }
  };

  const urgentCount = activeAlerts.filter((a) => a.severity === 'urgent').length;

  const content = (
    <div className="space-y-6">
      {/* Notification & Alarm Settings Bar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
              Study Alert Preferences
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Get alerted at your daily study time ({formatTime12Hour(settings.dailyStudyTime)}) and
              whenever a topic deadline arrives.
            </p>
          </div>

          <button
            type="button"
            data-testid="send-test-alert-btn"
            onClick={() => {
              if (settings.soundEnabled) playStudyAlertChime();
              onTriggerTestAlert();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0284C7] dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/80 rounded-lg cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
            Test Alert Now
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Master Enable Toggle */}
          <button
            type="button"
            data-testid="toggle-alerts-enabled"
            onClick={() => onUpdateReminders({ ...settings, enabled: !settings.enabled })}
            aria-pressed={settings.enabled}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
              settings.enabled
                ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {settings.enabled ? (
                <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              )}
              Study Alerts
            </span>
            <span>{settings.enabled ? 'On' : 'Paused'}</span>
          </button>

          {/* Daily Study Time Picker */}
          <label className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-[#0F172A] dark:text-slate-100">
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
              Daily Time
            </span>
            <input
              type="time"
              aria-label="Daily study reminder time"
              data-testid="daily-study-time-input"
              value={settings.dailyStudyTime}
              onChange={(e) => {
                if (e.target.value) {
                  onUpdateReminders({ ...settings, dailyStudyTime: e.target.value });
                }
              }}
              className="font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-[#0F172A] dark:text-slate-100"
            />
          </label>

          {/* Alert Sound Chime Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextSound = !settings.soundEnabled;
              onUpdateReminders({ ...settings, soundEnabled: nextSound });
              if (nextSound) playStudyAlertChime();
            }}
            aria-pressed={settings.soundEnabled}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
              settings.soundEnabled
                ? 'border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 text-[#0F172A] dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              )}
              Alert Sound
            </span>
            <span>{settings.soundEnabled ? 'Chime On' : 'Muted'}</span>
          </button>

          {/* Browser Desktop Notifications */}
          <button
            type="button"
            onClick={handleToggleBrowserNotifications}
            disabled={browserPerm === 'unsupported'}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
              settings.browserNotifications && browserPerm === 'granted'
                ? 'border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 text-[#0F172A] dark:text-slate-100'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="truncate">Desktop Popups</span>
            <span className="shrink-0 text-[#0284C7] dark:text-sky-400">
              {browserPerm === 'unsupported'
                ? 'N/A'
                : browserPerm === 'denied'
                  ? 'Blocked'
                  : settings.browserNotifications && browserPerm === 'granted'
                    ? 'Active'
                    : 'Enable'}
            </span>
          </button>
        </div>
      </section>

      {/* Active & Smart Study Alerts Feed */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
            Active Study & Topic Alerts ({activeAlerts.length})
          </h2>
          {urgentCount > 0 && (
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 px-2.5 py-0.5 rounded-md">
              {urgentCount} due now
            </span>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 p-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>You are all caught up! Schedule a topic reminder below to stay ahead.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.map((alert) => {
              const isUrgent = alert.severity === 'urgent';
              return (
                <article
                  key={alert.id}
                  className={`rounded-lg border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isUrgent
                      ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30'
                      : alert.severity === 'upcoming'
                        ? 'border-sky-200 dark:border-sky-800/80 bg-sky-50/40 dark:bg-sky-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider ${
                          isUrgent ? 'text-amber-800 dark:text-amber-400' : 'text-[#0284C7] dark:text-sky-400'
                        }`}
                      >
                        {alert.kind === 'scheduled_topic'
                          ? 'Scheduled Topic'
                          : alert.kind === 'daily_study'
                            ? 'Daily Study'
                            : alert.kind === 'timetable_slot'
                              ? 'Timetable Slot'
                              : 'Complete Topic'}
                      </span>
                      {alert.dueLabel && (
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          · {alert.dueLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{alert.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{alert.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenAlertTarget(alert)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      Study
                    </button>

                    {alert.reminderId && (
                      <button
                        type="button"
                        onClick={() => handleSnoozeReminder(alert.reminderId!)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        +15m
                      </button>
                    )}

                    {(alert.reminderId || (alert.subject && alert.moduleId)) && (
                      <button
                        type="button"
                        onClick={() => onCompleteAlertTarget(alert)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Done
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Schedule a Topic Completion Alert Form */}
      <form
        onSubmit={handleAddTopicReminder}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
            Schedule a Topic Completion Alert
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pick any chapter or custom topic and choose when Pathwise should alert you to finish it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="alert-subject-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <select
              id="alert-subject-select"
              value={subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
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
            <label htmlFor="alert-module-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pick from Syllabus Topics (Optional)
            </label>
            <select
              id="alert-module-select"
              value={selectedModuleId}
              onChange={(e) => handleModuleSelect(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
            >
              <option value="">Custom topic name</option>
              {subjectModules.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.title} ({mod.status === 'mastered' ? 'Mastered' : mod.status === 'in_progress' ? 'In Progress' : 'Up Next'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="alert-topic-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Topic to Complete
            </label>
            <input
              id="alert-topic-title"
              data-testid="alert-topic-title-input"
              type="text"
              maxLength={140}
              required
              value={customTopicTitle}
              onChange={(e) => setCustomTopicTitle(e.target.value)}
              placeholder="e.g., Quadratic Equations — Exercise 4.2"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="alert-due-datetime" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Alert Date & Time
            </label>
            <input
              id="alert-due-datetime"
              type="datetime-local"
              value={dueLocalInput}
              onChange={(e) => setDueLocalInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-[#0F172A] dark:text-slate-100"
            />
          </div>
        </div>

        {/* Quick Timing Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Quick schedule:</span>
          {[
            { id: '15m' as const, label: 'In 15 min' },
            { id: '1h' as const, label: 'In 1 hour' },
            { id: 'tonight' as const, label: 'Tonight 7:00 PM' },
            { id: 'tomorrow' as const, label: 'Tomorrow 6:00 PM' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyQuickPreset(preset.id)}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label htmlFor="alert-note-input" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Completion Target Note (Optional)
            </label>
            <input
              id="alert-note-input"
              type="text"
              maxLength={180}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Finish notes + score 80% on practice quiz"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            data-testid="add-topic-alert-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Set Topic Alert
          </button>
        </div>

        {formFeedback && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            {formFeedback}
          </p>
        )}
      </form>

      {/* Saved Scheduled Topic Reminders List */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
            Your Scheduled Topic Alerts ({settings.topicAlerts.length}/{MAX_TOPIC_ALERTS})
          </h2>
        </div>

        {settings.topicAlerts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No custom topic completion alerts scheduled yet. Use the form above or click “Set Alert”
            on any Learning Path topic.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {settings.topicAlerts.map((item) => (
              <div
                key={item.id}
                className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#0284C7] dark:text-sky-400">{item.subject}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {item.completed ? 'Completed' : formatDueRelative(item.dueAt)}
                    </span>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      item.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#0F172A] dark:text-slate-100'
                    }`}
                  >
                    {item.topicTitle}
                  </p>
                  {item.note && <p className="text-xs text-slate-600 dark:text-slate-400">{item.note}</p>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleReminderDone(item.id)}
                    aria-label={item.completed ? 'Mark alert pending' : 'Mark topic reminder complete'}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                      item.completed
                        ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60'
                        : 'border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                    }`}
                  >
                    {item.completed ? 'Undo' : 'Complete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReminder(item.id)}
                    aria-label={`Delete alert for ${item.topicTitle}`}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Study Notifications and Topic Completion Alerts"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        data-testid="study-alerts-drawer"
        className="w-full max-w-2xl h-full bg-[#F8FAFC] dark:bg-[#0B1120] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400">
              <BellRing className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                Study Notifications & Topic Alerts
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Stay on schedule and complete every topic on time
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications panel"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">{content}</div>
      </div>
    </div>
  );
};
