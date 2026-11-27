import test from 'node:test';
import assert from 'node:assert/strict';
import type { LessonContent } from '../types/study';
import {
  TTS_RATE_OPTIONS,
  buildLessonReadAloudText,
  cleanTextForSpeech,
  isSpeechSynthesisSupported,
  pickBestVoiceForLocale,
  splitTextIntoSpeechChunks,
} from './speechSynthesis';

const SAMPLE_LESSON: LessonContent = {
  mode: 'standard',
  summary: 'Forces change the state of motion of an object via **Newton laws**.',
  concepts: [
    {
      heading: 'Inertia & First Law',
      explanation: 'An object remains at rest or uniform motion unless acted on by a net force',
      formulaOrKeyRule: 'F_net = 0 -> a = 0',
    },
    {
      heading: 'Second Law of Motion',
      explanation: 'Acceleration scales with net force and inversely with mass.',
      formulaOrKeyRule: 'F = m * a',
    },
  ],
  workedExample: {
    prompt: 'Find the acceleration of a 4 kg block pushed by a 12 N force',
    steps: ['Identify mass m = 4 kg and force F = 12 N.', 'Compute a = F / m = 12 / 4 = 3 m/s^2'],
    takeaway: 'Double the net force doubles the acceleration for constant mass.',
  },
  recallCheck: {
    question: 'What is F when m = 2 kg and a = 5 m/s^2?',
    options: ['5 N', '10 N', '2.5 N', '7 N'],
    correctIndex: 1,
    explanation: 'F = m * a = 2 * 5 = 10 N.',
  },
  shortNotes: ['F = m * a'],
  studyShortcuts: [],
  visualDiagram: {
    title: 'Force Map',
    caption: 'Diagram',
    centralConcept: 'Forces',
    nodes: [],
  },
  revisionCards: [],
};

test('cleanTextForSpeech strips markdown formatting and normalizes arrows', () => {
  const cleaned = cleanTextForSpeech('## **Newton** `F = ma` -> motion   stays clear');
  assert.equal(cleaned, 'Newton F = ma, motion stays clear');
});

test('buildLessonReadAloudText formats title, summary, concepts, rules, and worked example cleanly', () => {
  const text = buildLessonReadAloudText(
    { title: 'Laws of Motion', subtitle: 'Dynamics fundamentals' },
    SAMPLE_LESSON
  );

  assert.match(text, /^Laws of Motion\./);
  assert.match(text, /Core Summary\./);
  assert.match(text, /Newton laws\./);
  assert.match(text, /Concept 1: Inertia & First Law\./);
  assert.match(text, /Key rule: F_net = 0, a = 0\./);
  assert.match(text, /Concept 2: Second Law of Motion\./);
  assert.match(text, /Worked Example\./);
  assert.match(text, /Step 1:/);
  assert.match(text, /Step 2:/);
  assert.match(text, /Key Takeaway:/);
  assert.doesNotMatch(text, /\*\*/);
});

test('splitTextIntoSpeechChunks breaks long lesson narration cleanly without losing words', () => {
  const text = buildLessonReadAloudText(
    { title: 'Laws of Motion', subtitle: 'Dynamics fundamentals' },
    SAMPLE_LESSON
  );
  const chunks = splitTextIntoSpeechChunks(text, 120);

  assert.ok(chunks.length >= 3, 'Expected multiple sentence-aligned chunks');
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 120, `Chunk exceeded limit: ${chunk.length}`);
  }
  assert.equal(chunks.join(' '), text);
});

test('splitTextIntoSpeechChunks handles very long sentences without punctuation', () => {
  const longSentence = Array.from({ length: 30 }, (_, i) => `concept${i}`).join(' ');
  const chunks = splitTextIntoSpeechChunks(longSentence, 60);
  assert.ok(chunks.length >= 4);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 60);
  }
  assert.equal(chunks.join(' '), longSentence);
});

test('pickBestVoiceForLocale prefers exact local match then language prefix fallback', () => {
  const voices = [
    { lang: 'en-US', name: 'Cloud English US', localService: false },
    { lang: 'en-IN', name: 'Cloud English IN', localService: false },
    { lang: 'en-IN', name: 'Local English IN', localService: true },
    { lang: 'hi-IN', name: 'Hindi India', localService: true },
  ];

  const exact = pickBestVoiceForLocale(voices, 'en-IN');
  assert.equal(exact?.name, 'Local English IN');

  const prefixFallback = pickBestVoiceForLocale(voices, 'en-GB');
  assert.equal(prefixFallback?.name, 'Local English IN');

  const missing = pickBestVoiceForLocale(voices, 'ja-JP');
  assert.equal(missing, null);
});

test('isSpeechSynthesisSupported returns false safely in Node test environment and exposes standard rates', () => {
  assert.equal(isSpeechSynthesisSupported(), false);
  assert.deepEqual([...TTS_RATE_OPTIONS], [0.85, 1, 1.15, 1.3]);
});
