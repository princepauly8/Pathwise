import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIOUS_YEAR_OPTIONS,
  SIMILAR_DIFFICULTY_OPTIONS,
  buildSampleSimilarPreviousYearPaper,
  extractYearDigits,
  normalizeSimilarPaperResponse,
  sumPaperMarks,
} from './similarPaper';
import { getSamplePreviousYearPaper } from './learningPath';

test('extractYearDigits parses 4-digit exam years cleanly and falls back safely', () => {
  assert.equal(extractYearDigits('2024 Board Pattern'), '2024');
  assert.equal(extractYearDigits('Similar to 2022 Board Paper'), '2022');
  assert.equal(extractYearDigits('invalid'), PREVIOUS_YEAR_OPTIONS[0]);
  assert.equal(extractYearDigits(undefined), PREVIOUS_YEAR_OPTIONS[0]);
});

test('buildSampleSimilarPreviousYearPaper creates parallel questions with marks sum and similarity notes', () => {
  const refPaper = getSamplePreviousYearPaper('Class 10', 'CBSE', 'Mathematics');
  const similar = buildSampleSimilarPreviousYearPaper({
    classLevel: 'Class 10',
    syllabus: 'CBSE',
    subject: 'Mathematics',
    referenceYear: '2024',
    difficulty: 'challenging',
    referencePaper: refPaper,
  });

  assert.equal(similar.basedOnYear, '2024');
  assert.equal(similar.difficulty, 'challenging');
  assert.equal(similar.questions.length, 5);
  assert.equal(similar.maxMarks, sumPaperMarks(similar.questions));
  assert.equal(similar.maxMarks, 15);
  assert.ok(similar.patternNote?.includes('2024'));
  assert.equal(similar.questions[0].referenceQuestion, refPaper.questions[0].question);
  assert.notEqual(similar.questions[0].question, refPaper.questions[0].question);
  assert.ok(similar.questions[0].similarTo?.includes('2024'));
  assert.ok(similar.questions[0].conceptTested);
});

test('normalizeSimilarPaperResponse attaches fallback reference questions and computes maxMarks accurately', () => {
  const refPaper = getSamplePreviousYearPaper('Class 10', 'CBSE', 'Physics');
  const normalized = normalizeSimilarPaperResponse(
    {
      title: 'CBSE Class 10 Physics — Parallel Practice Set',
      year: 'Similar to 2023 Board Paper',
      durationMinutes: 90,
      maxMarks: 2, // intentionally lower than sum -> should auto-correct
      questions: [
        {
          number: 'Q1',
          section: 'Section A',
          marks: 1,
          question: 'State Ohm law and its SI unit of resistance.',
          markingScheme: 'V = IR at constant temperature; SI unit is ohm (Ω).',
        },
        {
          number: 'Q2',
          section: 'Section B',
          marks: 3,
          question: 'Compare series and parallel resistor combinations with one circuit advantage.',
          markingScheme: '1.5 marks differences, 1.5 marks domestic parallel advantage.',
        },
      ],
    },
    {
      classLevel: 'Class 10',
      syllabus: 'CBSE',
      subject: 'Physics',
      referenceYear: '2023',
      difficulty: 'same',
      referencePaper: refPaper,
    }
  );

  assert.equal(normalized.basedOnYear, '2023');
  assert.equal(normalized.maxMarks, 4);
  assert.equal(normalized.durationMinutes, 90);
  assert.equal(normalized.questions[0].referenceQuestion, refPaper.questions[0].question);
  assert.ok(normalized.questions[0].similarTo?.includes('2023'));
  assert.equal(SIMILAR_DIFFICULTY_OPTIONS.length, 3);
});
