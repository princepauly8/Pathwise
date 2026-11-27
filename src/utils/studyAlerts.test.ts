import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuickPresetIso,
  computeSmartStudyAlerts,
  createDefaultReminderSettings,
  ensureReminderSettings,
  formatDueRelative,
  formatTime12Hour,
} from './studyAlerts';
import { createSampleStudentProfile } from './learningPath';

test('ensureReminderSettings normalizes defaults, invalid time, and max 20 alerts bound', () => {
  const defaults = createDefaultReminderSettings();
  assert.equal(defaults.enabled, true);
  assert.equal(defaults.dailyStudyTime, '18:00');
  assert.equal(defaults.topicAlerts.length, 0);

  const manyAlerts = Array.from({ length: 25 }, (_, i) => ({
    id: `rem-${i}`,
    subject: 'Physics',
    topicTitle: `Topic ${i}`,
    dueAt: new Date().toISOString(),
    completed: false,
  }));

  const normalized = ensureReminderSettings({
    dailyStudyTime: '99:99',
    topicAlerts: manyAlerts,
  });
  assert.equal(normalized.dailyStudyTime, '18:00');
  assert.equal(normalized.topicAlerts.length, 20);
});

test('computeSmartStudyAlerts surfaces due scheduled topic alerts, daily streak alert, and incomplete topics', () => {
  const sample = createSampleStudentProfile();
  const now = new Date('2026-11-25T19:00:00');

  sample.completedDates = [];
  sample.reminders = {
    enabled: true,
    dailyStudyTime: '18:00',
    soundEnabled: true,
    browserNotifications: false,
    topicAlerts: [
      {
        id: 'rem-overdue',
        subject: 'Mathematics',
        moduleId: sample.paths['Mathematics']?.modules[0]?.id,
        topicTitle: 'Quadratic Equations',
        dueAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
        note: 'Finish 5 practice questions',
        completed: false,
      },
      {
        id: 'rem-done',
        subject: 'Physics',
        topicTitle: 'Already Completed Topic',
        dueAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
        completed: true,
      },
    ],
  };

  const alerts = computeSmartStudyAlerts(sample, now);
  const scheduled = alerts.find((a) => a.reminderId === 'rem-overdue');
  assert.ok(scheduled, 'Expected overdue scheduled topic alert');
  assert.equal(scheduled.severity, 'urgent');
  assert.ok(scheduled.dueLabel?.includes('Overdue'));

  const doneAlert = alerts.find((a) => a.reminderId === 'rem-done');
  assert.equal(doneAlert, undefined, 'Completed reminder should not appear in active alerts');

  const daily = alerts.find((a) => a.kind === 'daily_study');
  assert.ok(daily, 'Expected daily study alert when nothing completed today');
  assert.equal(daily.severity, 'urgent');

  const incompleteTopics = alerts.filter((a) => a.kind === 'incomplete_topic');
  assert.ok(incompleteTopics.length > 0, 'Expected incomplete topic completion alerts');
});

test('buildQuickPresetIso and format helpers return clean human-readable schedules', () => {
  const now = new Date('2026-11-25T14:00:00.000Z');
  const in15 = buildQuickPresetIso('15m', now);
  assert.equal(formatDueRelative(in15, now), 'Due in 15m');
  assert.equal(formatTime12Hour('18:30'), '6:30 PM');
  assert.equal(formatTime12Hour('07:05'), '7:05 AM');
});
