import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  build147AlertsForItem,
  create147Item,
  get147StageStatus,
  getDue147Reviews,
  toggle147Stage,
} from './revision147';

test('create147Item calculates exact Day 1, Day 4 (+3 days), and Day 7 (+6 days) dates', () => {
  const item = create147Item({
    subject: 'Physics',
    topicTitle: 'Ray Optics & Optical Instruments',
    startDate: '2026-11-26',
  });

  assert.equal(item.day1Date, '2026-11-26');
  assert.equal(item.day4Date, '2026-11-29');
  assert.equal(item.day7Date, '2026-12-02');
  assert.equal(item.day1Done, false);
  assert.equal(item.day4Done, false);
  assert.equal(item.day7Done, false);
  assert.equal(addDaysToDateKey('2026-11-26', 3), '2026-11-29');
});

test('get147StageStatus and getDue147Reviews prioritize overdue and due-today reviews', () => {
  const item = create147Item({
    subject: 'Mathematics',
    topicTitle: 'Quadratic Equations',
    startDate: '2026-11-20',
    day1Done: true,
  });
  // day1Date=2026-11-20 (done), day4Date=2026-11-23 (overdue on Nov 26), day7Date=2026-11-26 (due today)
  assert.equal(get147StageStatus(item.day1Date, item.day1Done, '2026-11-26'), 'done');
  assert.equal(get147StageStatus(item.day4Date, item.day4Done, '2026-11-26'), 'overdue');
  assert.equal(get147StageStatus(item.day7Date, item.day7Done, '2026-11-26'), 'due_today');

  const due = getDue147Reviews([item], '2026-11-26');
  assert.equal(due.length, 2);
  assert.equal(due[0].stage, 4);
  assert.equal(due[0].status, 'overdue');
  assert.equal(due[1].stage, 7);
  assert.equal(due[1].status, 'due_today');

  const afterCompleteDay4 = toggle147Stage(item, 4);
  assert.equal(afterCompleteDay4.day4Done, true);
  assert.equal(getDue147Reviews([afterCompleteDay4], '2026-11-26').length, 1);
});

test('build147AlertsForItem creates Day 4 and Day 7 scheduled study alerts', () => {
  const item = create147Item({
    subject: 'Chemistry',
    topicTitle: 'Electrochemistry',
    startDate: '2026-11-26',
    day1Done: true,
  });

  const alerts = build147AlertsForItem(item, '19:30');
  assert.equal(alerts.length, 2);
  assert.ok(alerts[0].topicTitle.includes('Day 4'));
  assert.ok(alerts[1].topicTitle.includes('Day 7'));
  assert.equal(alerts[0].subject, 'Chemistry');
  assert.ok(!Number.isNaN(Date.parse(alerts[0].dueAt)));
  assert.ok(!Number.isNaN(Date.parse(alerts[1].dueAt)));
});
