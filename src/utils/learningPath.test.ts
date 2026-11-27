import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVATION_LIBRARY,
  SYLLABUS_BOARDS,
  calculateOverallProgress,
  calculateStudyStreak,
  calculateSubjectProgress,
  classifySubjectDomain,
  createSampleStudentProfile,
  evaluateQuizScore,
  generateStudyTimetable,
  getRecommendedSubjectsForClass,
  mergeSubjectSelections,
  recordModuleCompletionDate,
  recordQuizMastery,
  toggleModuleMastery,
  validateStudentSetup,
} from './learningPath';

test('getRecommendedSubjectsForClass returns tailored subjects per grade', () => {
  const class6 = getRecommendedSubjectsForClass('Class 6');
  const class12 = getRecommendedSubjectsForClass('Class 12');

  assert.ok(class6.includes('General Science'));
  assert.ok(class12.includes('Calculus & Linear Algebra'));
  assert.notDeepEqual(class6, class12);
});

test('SYLLABUS_BOARDS includes CBSE, ICSE / ISC, and State Board', () => {
  const ids = SYLLABUS_BOARDS.map((b) => b.id);
  assert.ok(ids.includes('CBSE'));
  assert.ok(ids.includes('ICSE / ISC'));
  assert.ok(ids.includes('State Board'));
});

test('classifySubjectDomain distinguishes STEM from humanities subjects', () => {
  assert.equal(classifySubjectDomain('Physics'), 'stem');
  assert.equal(classifySubjectDomain('Calculus & Linear Algebra'), 'stem');
  assert.equal(classifySubjectDomain('World History'), 'humanities');
  assert.equal(classifySubjectDomain('English Literature'), 'humanities');
});

test('validateStudentSetup enforces required name, valid class, syllabus board, and 1..8 subjects', () => {
  const emptyResult = validateStudentSetup({ name: ' ', classLevel: '', syllabus: '', subjects: [] });
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.errors.name);
  assert.ok(emptyResult.errors.classLevel);
  assert.ok(emptyResult.errors.syllabus);
  assert.ok(emptyResult.errors.subjects);

  const validResult = validateStudentSetup({
    name: 'Maya Patel',
    classLevel: 'Class 11',
    syllabus: 'CBSE',
    subjects: ['Physics', 'Economics'],
  });
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.errors, {});

  const tooMany = validateStudentSetup({
    name: 'Maya',
    classLevel: 'Class 11',
    syllabus: 'ICSE / ISC',
    subjects: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  });
  assert.equal(tooMany.valid, false);
  assert.ok(tooMany.errors.subjects);
});

test('generateStudyTimetable creates balanced weekly slots matching pace', () => {
  const slots45 = generateStudyTimetable(['Mathematics', 'Physics'], 45);
  assert.equal(slots45.length, 7);
  assert.equal(slots45[0].durationMinutes, 45);
  assert.equal(slots45[6].activity, 'PYQ Paper Drill');

  const slots90 = generateStudyTimetable(['Mathematics', 'Physics', 'Chemistry'], 90);
  assert.equal(slots90.length, 14);
  assert.equal(slots90[0].durationMinutes, 45);
});

test('MOTIVATION_LIBRARY provides structured 10-minute sessions', () => {
  assert.ok(MOTIVATION_LIBRARY.length >= 4);
  for (const session of MOTIVATION_LIBRARY) {
    assert.equal(session.durationMinutes, 10);
    assert.equal(session.segments.length, 3);
  }
});

test('calculateSubjectProgress and calculateOverallProgress compute accurate percentages', () => {
  const profile = createSampleStudentProfile();
  assert.equal(profile.syllabus, 'CBSE');
  const mathSummary = calculateSubjectProgress(profile.paths.Mathematics);

  assert.equal(mathSummary.totalModules, 4);
  assert.equal(mathSummary.masteredCount, 1);
  assert.equal(mathSummary.percentComplete, 25);
  assert.equal(mathSummary.nextModule?.id, 'math-2');

  const overall = calculateOverallProgress(profile.subjects, profile.paths);
  assert.equal(overall.subjectCount, 3);
  assert.equal(overall.totalModules, 10);
  assert.equal(overall.masteredModules, 1);
  assert.equal(overall.overallPercent, 10);
});

test('toggleModuleMastery marks a module mastered and advances next up_next module', () => {
  const profile = createSampleStudentProfile();
  const updated = toggleModuleMastery(profile.paths.Mathematics, 'math-2');

  assert.equal(updated.modules[1].status, 'mastered');
  assert.equal(updated.modules[2].status, 'in_progress');
  assert.equal(calculateSubjectProgress(updated).percentComplete, 50);

  const reverted = toggleModuleMastery(updated, 'math-2');
  assert.equal(reverted.modules[1].status, 'in_progress');
});

test('evaluateQuizScore calculates pass threshold at 70% and collects missed concepts', () => {
  const profile = createSampleStudentProfile();
  const questions = profile.paths.Mathematics.modules[1].quiz!;

  const passedEval = evaluateQuizScore(questions, {
    'q-m2-1': 2,
    'q-m2-2': 1,
    'q-m2-3': 1,
  });
  assert.equal(passedEval.correct, 3);
  assert.equal(passedEval.percentage, 100);
  assert.equal(passedEval.passed, true);
  assert.deepEqual(passedEval.missedConcepts, []);

  const failedEval = evaluateQuizScore(questions, {
    'q-m2-1': 0,
    'q-m2-2': 1,
    'q-m2-3': 0,
  });
  assert.equal(failedEval.correct, 1);
  assert.equal(failedEval.percentage, 33);
  assert.equal(failedEval.passed, false);
  assert.deepEqual(failedEval.missedConcepts, ['Pythagorean Identity']);
});

test('recordQuizMastery records best score and promotes module when score >= 70', () => {
  const profile = createSampleStudentProfile();
  const afterLow = recordQuizMastery(profile.paths.Physics, 'phy-1', 50);
  assert.equal(afterLow.modules[0].bestQuizScore, 50);
  assert.equal(afterLow.modules[0].status, 'in_progress');

  const afterPass = recordQuizMastery(afterLow, 'phy-1', 85);
  assert.equal(afterPass.modules[0].bestQuizScore, 85);
  assert.equal(afterPass.modules[0].status, 'mastered');
  assert.equal(afterPass.modules[1].status, 'in_progress');
});

test('mergeSubjectSelections preserves existing subject paths and identifies newly added subjects', () => {
  const profile = createSampleStudentProfile();
  const { keptPaths, missingSubjects } = mergeSubjectSelections(profile.paths, [
    'Mathematics',
    'Biology',
    '  Astronomy  ',
  ]);

  assert.deepEqual(Object.keys(keptPaths), ['Mathematics']);
  assert.deepEqual(missingSubjects, ['Biology', 'Astronomy']);
});

test('calculateStudyStreak counts consecutive days ending today or yesterday and resets after a gap', () => {
  const refDate = new Date(2026, 10, 25, 12, 0, 0); // 2026-11-25 local

  assert.deepEqual(calculateStudyStreak([], refDate), {
    currentStreak: 0,
    longestStreak: 0,
    completedToday: false,
  });

  // Active streak ending yesterday (still alive today)
  assert.deepEqual(
    calculateStudyStreak(['2026-11-23', '2026-11-24'], refDate),
    { currentStreak: 2, longestStreak: 2, completedToday: false }
  );

  // Extending streak by completing today
  const afterToday = recordModuleCompletionDate(['2026-11-23', '2026-11-24'], refDate);
  assert.deepEqual(afterToday, ['2026-11-23', '2026-11-24', '2026-11-25']);
  assert.deepEqual(calculateStudyStreak(afterToday, refDate), {
    currentStreak: 3,
    longestStreak: 3,
    completedToday: true,
  });

  // Completing multiple modules on the same day does not inflate streak
  const afterDuplicate = recordModuleCompletionDate(afterToday, refDate);
  assert.deepEqual(afterDuplicate, afterToday);

  // Missing yesterday resets current streak to 0 while preserving longestStreak
  assert.deepEqual(
    calculateStudyStreak(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'], refDate),
    { currentStreak: 0, longestStreak: 4, completedToday: false }
  );

  // Cross-month consecutive boundary
  const dec1 = new Date(2026, 11, 1, 9, 0, 0); // 2026-12-01
  assert.deepEqual(
    calculateStudyStreak(['2026-11-29', '2026-11-30', '2026-12-01'], dec1),
    { currentStreak: 3, longestStreak: 3, completedToday: true }
  );
});

