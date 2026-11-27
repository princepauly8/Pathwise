import React from 'react';
import { BellRing, BookOpen, CheckCircle2, Clock, X } from 'lucide-react';
import type { ActiveStudyAlert } from '../types/study';

interface StudyAlertToastProps {
  alert: ActiveStudyAlert;
  onDismiss: () => void;
  onOpenTopic: (alert: ActiveStudyAlert) => void;
  onSnooze?: (reminderId: string) => void;
  onMarkDone?: (alert: ActiveStudyAlert) => void;
}

export const StudyAlertToast: React.FC<StudyAlertToastProps> = ({
  alert,
  onDismiss,
  onOpenTopic,
  onSnooze,
  onMarkDone,
}) => {
  const isUrgent = alert.severity === 'urgent';

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="study-alert-toast"
      className={`fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border shadow-xl bg-white dark:bg-slate-900 p-4 space-y-3 transition-all ${
        isUrgent
          ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-900/50'
          : 'border-sky-200 dark:border-sky-800 ring-1 ring-sky-100 dark:ring-sky-900/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isUrgent
                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                : 'bg-sky-100 dark:bg-sky-900/50 text-[#0284C7] dark:text-sky-300'
            }`}
          >
            <BellRing className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isUrgent ? 'text-amber-700 dark:text-amber-400' : 'text-[#0284C7] dark:text-sky-400'
                }`}
              >
                {alert.kind === 'daily_study'
                  ? 'Daily Study Reminder'
                  : alert.kind === 'test_alert'
                    ? 'Study Alert Active'
                    : 'Topic Completion Alert'}
              </span>
              {alert.dueLabel && (
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{alert.dueLabel}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">{alert.title}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{alert.message}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss study alert"
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenTopic(alert)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          Study Now
        </button>

        {alert.reminderId && onSnooze && (
          <button
            type="button"
            onClick={() => onSnooze(alert.reminderId!)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Snooze 15m
          </button>
        )}

        {(alert.reminderId || (alert.subject && alert.moduleId)) && onMarkDone && (
          <button
            type="button"
            onClick={() => onMarkDone(alert)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Mark Done
          </button>
        )}
      </div>
    </div>
  );
};
