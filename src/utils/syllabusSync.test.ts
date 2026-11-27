import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_QUICK_PRESETS,
  evaluateSyllabusSyncStatus,
  mergeSyncedSubjectPaths,
} from './syllabusSync.ts';
import { createSampleStudentProfile } from './learningPath.ts';
import type { BoardSyllabusSyncRecord, SubjectPath } from '../types/study.ts';

test('BOARD_QUICK_PRESETS covers CBSE, ICSE / ISC, State Boards, IB, and IGCSE', () => {
  const ids = BOARD_QUICK_PRESETS.map((b) => b.id);
  assert.ok(ids.includes('CBSE'));
  assert.ok(ids.includes('ICSE / ISC'));
  assert.ok(ids.includes('State Board'));
  assert.ok(ids.includes('Kerala SCERT'));
  assert.ok(ids.includes('Maharashtra MSBSHSE'));
  assert.ok(ids.includes('IB (International Baccalaureate)'));
  assert.ok(ids.includes('IGCSE / Cambridge'));
});

test('mergeSyncedSubjectPaths preserves mastery on same-board refresh and resets cleanly on board switch', () => {
  const sample = createSampleStudentProfile();
  const syncedMath: SubjectPath = {
    subject: 'Mathematics',
    domain: 'stem',
    overview: 'Updated CBSE 2026-27 Mathematics curriculum.',
    focusStrategy: 'NCERT rationalized chapters with competency drills.',
    generatedByAi: true,
    updatedAt: '2026-11-26T10:00:00.000Z',
    modules: [
      {
        id: 'sync-math-1',
        order: 1,
        stage: 'Foundations',
        title: 'Quadratic Equations & Factoring Roots',
        subtitle: 'Updated discriminant & factoring applications',
        estimatedMinutes: 25,
        concepts: ['Standard Form', 'Discriminant'],
        objectives: ['Solve quadratic equations'],
        whyItMatters: 'Core CBSE algebra unit.',
        status: 'in_progress',
      },
      {
        id: 'sync-math-2',
        order: 2,
        stage: 'Core Mechanics',
        title: 'Coordinate Geometry & Section Formula',
        subtitle: 'Distance and section relations on the Cartesian plane',
        estimatedMinutes: 30,
        concepts: ['Distance Formula', 'Section Formula'],
        objectives: ['Compute distances'],
        whyItMatters: 'High-weightage board unit.',
        status: 'up_next',
      },
    ],
  };

  // Same-board refresh preserves mastered status & best quiz score on matching Quadratic module
  const sameBoardMerged = mergeSyncedSubjectPaths(sample.paths, [syncedMath], true);
  assert.equal(sameBoardMerged.Mathematics.modules[0].status, 'mastered');
  assert.equal(sameBoardMerged.Mathematics.modules[0].bestQuizScore, 100);
  // Next unmastered module is automatically promoted to in_progress
  assert.equal(sameBoardMerged.Mathematics.modules[1].status, 'in_progress');

  // Switching to a different board starts fresh on the new board syllabus
  const switchedMerged = mergeSyncedSubjectPaths(sample.paths, [syncedMath], false);
  assert.equal(switchedMerged.Mathematics.modules[0].status, 'in_progress');
  assert.equal(switchedMerged.Mathematics.modules[0].bestQuizScore, undefined);
});

test('evaluateSyllabusSyncStatus detects board changes, missing subjects, and stale syncs', () => {
  const sample = createSampleStudentProfile();
  const freshRecord: BoardSyllabusSyncRecord = {
    board: 'CBSE',
    classLevel: 'Class 10',
    academicSession: '2026-27',
    boardAuthority: 'CBSE (NCERT)',
    summary: 'Aligned with latest NCERT rationalized syllabus.',
    highlights: ['Competency-based MCQs expanded'],
    sources: [],
    groundedWithSearch: true,
    syncedAt: '2026-11-25T10:00:00.000Z',
    autoUpdateEnabled: true,
    subjectCount: 3,
  };

  const nowMs = Date.parse('2026-11-26T10:00:00.000Z');
  assert.equal(evaluateSyllabusSyncStatus(sample, freshRecord, nowMs).needsSync, false);

  const icseProfile = { ...sample, syllabus: 'ICSE / ISC' };
  const boardDiff = evaluateSyllabusSyncStatus(icseProfile, freshRecord, nowMs);
  assert.equal(boardDiff.needsSync, true);
  assert.equal(boardDiff.reason, 'board_changed');

  const staleNow = Date.parse('2026-12-10T10:00:00.000Z');
  const staleCheck = evaluateSyllabusSyncStatus(sample, freshRecord, staleNow);
  assert.equal(staleCheck.needsSync, true);
  assert.equal(staleCheck.reason, 'stale');
});
