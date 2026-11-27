import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ActiveStudyAlert,
  MotivationSession,
  StudentProfile,
  StudyReminderSettings,
  TimetableSlot,
} from '../types/study';
import { generateMotivationClassApi } from '../utils/api';
import { generateStudyTimetable, MOTIVATION_LIBRARY } from '../utils/learningPath';
import { StudyAlertsPanel } from './StudyAlertsPanel';

type PlannerTab = 'timetable' | 'alerts' | 'motivation';

interface PlannerMotivationProps {
  profile: StudentProfile;
  activeSubject: string;
  activeAlerts: ActiveStudyAlert[];
  onUpdateTimetable: (slots: TimetableSlot[]) => void;
  onUpdateReminders: (reminders: StudyReminderSettings) => void;
  onOpenAlertTarget: (alert: ActiveStudyAlert) => void;
  onCompleteAlertTarget: (alert: ActiveStudyAlert) => void;
  onTriggerTestAlert: () => void;
}

const DAYS: TimetableSlot['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ACTIVITIES: TimetableSlot['activity'][] = [
  'New Lesson & Notes',
  'Practice & Aptitude',
  'Short Notes & Revision',
  'PYQ Paper Drill',
];

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PlannerMotivation: React.FC<PlannerMotivationProps> = ({
  profile,
  activeSubject,
  activeAlerts,
  onUpdateTimetable,
  onUpdateReminders,
  onOpenAlertTarget,
  onCompleteAlertTarget,
  onTriggerTestAlert,
}) => {
  const [activeTab, setActiveTab] = useState<PlannerTab>('timetable');

  // Timetable state derived from profile
  const timetable = useMemo(
    () =>
      profile.timetable && profile.timetable.length > 0
        ? profile.timetable
        : generateStudyTimetable(profile.subjects, profile.dailyMinutes),
    [profile.timetable, profile.subjects, profile.dailyMinutes]
  );

  // Add slot form state
  const [newDay, setNewDay] = useState<TimetableSlot['day']>('Mon');
  const [newTime, setNewTime] = useState('07:30 PM – 08:00 PM');
  const [newSubject, setNewSubject] = useState(profile.subjects[0] ?? activeSubject);
  const [newActivity, setNewActivity] = useState<TimetableSlot['activity']>('New Lesson & Notes');
  const [newDuration, setNewDuration] = useState<number>(30);

  // 10-Min Motivation Class state
  const [selectedSessionId, setSelectedSessionId] = useState<string>(MOTIVATION_LIBRARY[0].id);
  const [customSession, setCustomSession] = useState<MotivationSession | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isPersonalizing, setIsPersonalizing] = useState<boolean>(false);
  const [motivationError, setMotivationError] = useState<string | null>(null);

  const activeSession: MotivationSession = useMemo(() => {
    if (customSession && customSession.id === selectedSessionId) {
      return customSession;
    }
    return MOTIVATION_LIBRARY.find((s) => s.id === selectedSessionId) ?? MOTIVATION_LIBRARY[0];
  }, [customSession, selectedSessionId]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTimerRunning]);

  const elapsedSeconds = 600 - secondsLeft;
  const activeSegmentIndex = elapsedSeconds < 180 ? 0 : elapsedSeconds < 420 ? 1 : 2;

  const completedSlots = timetable.filter((s) => s.completed).length;
  const completionPct =
    timetable.length > 0 ? Math.round((completedSlots / timetable.length) * 100) : 0;

  const handleToggleSlot = (slotId: string) => {
    const next = timetable.map((slot) =>
      slot.id === slotId ? { ...slot, completed: !slot.completed } : slot
    );
    onUpdateTimetable(next);
  };

  const handleDeleteSlot = (slotId: string) => {
    onUpdateTimetable(timetable.filter((s) => s.id !== slotId));
  };

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTime = newTime.trim() || '06:00 PM – 06:30 PM';
    const nextSlot: TimetableSlot = {
      id: `tt-custom-${Date.now()}`,
      day: newDay,
      timeRange: cleanTime,
      subject: newSubject || profile.subjects[0] || 'General Study',
      activity: newActivity,
      durationMinutes: Math.max(10, Math.min(180, Number(newDuration) || 30)),
      completed: false,
    };
    onUpdateTimetable([...timetable, nextSlot]);
  };

  const handleRegenerateTimetable = () => {
    onUpdateTimetable(generateStudyTimetable(profile.subjects, profile.dailyMinutes));
  };

  const handleSelectMotivationTheme = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSecondsLeft(600);
    setIsTimerRunning(false);
    setMotivationError(null);
  };

  const handlePersonalizeMotivation = async () => {
    setIsPersonalizing(true);
    setMotivationError(null);
    try {
      const personalized = await generateMotivationClassApi({
        studentName: profile.name,
        classLevel: profile.classLevel,
        syllabus: profile.syllabus,
        language: profile.language,
        subject: activeSubject,
        theme: activeSession.theme,
      });
      setCustomSession(personalized);
      setSelectedSessionId(personalized.id);
      setSecondsLeft(600);
      setIsTimerRunning(false);
    } catch (err) {
      setMotivationError(
        err instanceof Error ? err.message : 'Unable to personalize motivation session.'
      );
    } finally {
      setIsPersonalizing(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {profile.dailyMinutes} min/day plan
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
            Study Time Table & 10-Min Motivation
          </h1>
        </div>

        {/* Sub-tab Switcher */}
        <div role="tablist" aria-label="Planner sections" className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timetable'}
            onClick={() => setActiveTab('timetable')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'timetable'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
            Study Time Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'alerts'}
            onClick={() => setActiveTab('alerts')}
            data-testid="planner-alerts-tab"
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'alerts'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <BellRing className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
            Study Alerts
            {activeAlerts.length > 0 && (
              <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-[#0284C7] dark:text-sky-300">
                {activeAlerts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'motivation'}
            onClick={() => setActiveTab('motivation')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'motivation'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
            10-Min Motivation Class
          </button>
        </div>
      </div>

      {/* TAB 1: WEEKLY STUDY TIME TABLE */}
      {activeTab === 'timetable' && (
        <section aria-label="Weekly study time table" className="space-y-6">
          {/* Progress Bar & Regenerate Control */}
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-[#0F172A] dark:text-slate-100">Weekly Schedule Progress</span>
                <span className="font-mono tabular-nums text-[#0284C7] dark:text-sky-400 font-semibold">
                  {completedSlots} / {timetable.length} slots ({completionPct}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0284C7] dark:bg-sky-500 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${Math.max(0.02, completionPct / 100)})` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRegenerateTimetable}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Regenerate Balanced Timetable
            </button>
          </div>

          {/* 7-Day Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS.map((day) => {
              const daySlots = timetable.filter((s) => s.day === day);
              return (
                <div
                  key={day}
                  className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <h2 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">{day}</h2>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {daySlots.reduce((acc, s) => acc + s.durationMinutes, 0)} min
                    </span>
                  </div>

                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 py-2">Rest day / open revision slot.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            slot.completed
                              ? 'bg-[#059669]/5 dark:bg-emerald-950/30 border-[#059669]/30 dark:border-emerald-800/80'
                              : 'bg-[#F8FAFC] dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSlot(slot.id)}
                              className="flex items-start gap-2.5 text-left flex-1 cursor-pointer"
                            >
                              {slot.completed ? (
                                <CheckCircle2
                                  className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Circle
                                  className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-semibold ${
                                    slot.completed
                                      ? 'line-through text-slate-500 dark:text-slate-400'
                                      : 'text-[#0F172A] dark:text-slate-100'
                                  }`}
                                >
                                  {slot.subject}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{slot.activity}</p>
                                <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {slot.timeRange} · {slot.durationMinutes}m
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(slot.id)}
                              aria-label={`Remove ${slot.subject} slot on ${slot.day}`}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Custom Timetable Slot */}
          <form
            onSubmit={handleAddSlot}
            className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Add Custom Study Slot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label htmlFor="slot-day" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Day
                </label>
                <select
                  id="slot-day"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value as TimetableSlot['day'])}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="slot-subject" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Subject
                </label>
                <select
                  id="slot-subject"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
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
                <label htmlFor="slot-activity" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Focus Activity
                </label>
                <select
                  id="slot-activity"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value as TimetableSlot['activity'])}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
                >
                  {ACTIVITIES.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="slot-time" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Time Window
                </label>
                <input
                  id="slot-time"
                  type="text"
                  maxLength={40}
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="w-20">
                  <label htmlFor="slot-mins" className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Min
                  </label>
                  <input
                    id="slot-mins"
                    type="number"
                    min={10}
                    max={180}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-mono text-[#0F172A] dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: STUDY ALERTS & TOPIC COMPLETION REMINDERS */}
      {activeTab === 'alerts' && (
        <section aria-label="Study notifications and topic completion alerts">
          <StudyAlertsPanel
            embedded
            profile={profile}
            activeAlerts={activeAlerts}
            onUpdateReminders={onUpdateReminders}
            onOpenAlertTarget={onOpenAlertTarget}
            onCompleteAlertTarget={onCompleteAlertTarget}
            onTriggerTestAlert={onTriggerTestAlert}
          />
        </section>
      )}

      {/* TAB 3: OPTIONAL 10-MINUTE MOTIVATION CLASSES */}
      {activeTab === 'motivation' && (
        <section aria-label="Optional 10-minute motivation classes" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MOTIVATION_LIBRARY.map((session) => {
              const isSelected = activeSession.theme === session.theme;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSelectMotivationTheme(session.id)}
                  aria-pressed={isSelected}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-[#0284C7] dark:border-sky-500 ring-1 ring-[#0284C7]/20 dark:ring-sky-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <p className="font-mono text-[11px] font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
                    10 MIN CHOICE
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-[#0F172A] dark:text-slate-100">{session.theme}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{session.subtitle}</p>
                </button>
              );
            })}
          </div>

          {motivationError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
              <span>{motivationError}</span>
            </div>
          )}

          {/* Active 10-Minute Guided Session Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Timer & Action Card */}
            <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-6">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
                  Optional Guided Reset · {activeSession.durationMinutes} Minutes
                </p>
                <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                  {activeSession.theme}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeSession.subtitle}
                </p>
              </div>

              {/* Countdown Clock */}
              <div className="rounded-xl bg-[#0F172A] dark:border dark:border-slate-700 text-white p-6 text-center space-y-4">
                <p className="text-xs font-medium text-slate-400">
                  {secondsLeft === 0
                    ? '10-Minute Session Complete'
                    : isTimerRunning
                    ? `Active Chapter 0${activeSegmentIndex + 1} of 3`
                    : 'Ready whenever you choose'}
                </p>
                <p
                  aria-live="polite"
                  className="font-mono text-5xl font-semibold tracking-tight tabular-nums"
                >
                  {formatCountdown(secondsLeft)}
                </p>
                <div className="flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsTimerRunning((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause className="w-4 h-4" aria-hidden="true" />
                        Pause Class
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" aria-hidden="true" />
                        {secondsLeft < 600 && secondsLeft > 0 ? 'Resume' : 'Start 10-Min Class'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setSecondsLeft(600);
                    }}
                    aria-label="Reset 10 minute timer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Reset
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Focus Anchor</p>
                <p className="font-display text-base italic text-[#0F172A] dark:text-slate-100">
                  “{activeSession.affirmation}”
                </p>
              </div>

              <button
                type="button"
                disabled={isPersonalizing}
                onClick={handlePersonalizeMotivation}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {isPersonalizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Personalizing for {profile.classLevel} {profile.syllabus}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                    Personalize for {profile.name.split(' ')[0]}’s {activeSubject} Exam
                  </>
                )}
              </button>
            </div>

            {/* Right 3 Timed Chapters */}
            <div className="lg:col-span-7 space-y-4">
              {activeSession.segments.map((seg, idx) => {
                const isCurrent = isTimerRunning && idx === activeSegmentIndex;
                return (
                  <article
                    key={idx}
                    className={`border rounded-xl p-6 space-y-2 transition-colors ${
                      isCurrent
                        ? 'bg-white dark:bg-slate-900 border-[#0284C7] dark:border-sky-500 ring-1 ring-[#0284C7]/25 dark:ring-sky-500/25'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-[#0284C7] dark:text-sky-400 tabular-nums">
                        {seg.minuteRange}
                      </span>
                      {isCurrent && (
                        <span className="text-xs font-semibold text-[#0284C7] dark:text-sky-400">Current Step</span>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                      {seg.title}
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{seg.guidance}</p>
                  </article>
                );
              })}

              <div className="border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-xl p-5 space-y-1">
                <p className="text-xs font-semibold text-[#059669] dark:text-emerald-400">Immediate Next Step (Minute 10)</p>
                <p className="text-sm text-[#0F172A] dark:text-slate-100 leading-relaxed">
                  {activeSession.actionPrompt}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
