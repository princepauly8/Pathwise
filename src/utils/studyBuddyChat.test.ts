import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleStudentProfile } from './learningPath.ts';
import {
  buildLiveProgressUpdate,
  countOpenQuestions,
  countProgressUpdates,
  filterBuddyMessages,
  normalizeBuddyMessage,
  type StudyRoomChatMessage,
} from './studyBuddyChat.ts';

test('buildLiveProgressUpdate creates a real progress snapshot from student paths', () => {
  const profile = createSampleStudentProfile();
  const draft = buildLiveProgressUpdate(profile, 'Mathematics');
  assert.equal(draft.subjectTag, 'Mathematics');
  assert.ok(draft.progressPercent >= 0 && draft.progressPercent <= 100);
  assert.match(draft.text, /Mathematics:/);
  assert.match(draft.text, /modules mastered/);
});

test('filterBuddyMessages and counters separate open questions and progress updates accurately', () => {
  const messages: StudyRoomChatMessage[] = [
    normalizeBuddyMessage({
      id: 'm1',
      peerId: 'p1',
      senderName: 'Ananya',
      kind: 'question',
      text: 'How do we factorize x^2 - 5x + 6 quickly?',
      resolved: false,
    }),
    normalizeBuddyMessage({
      id: 'm2',
      peerId: 'p2',
      senderName: 'Rohan',
      kind: 'question',
      text: 'What is the SI unit of electric potential?',
      resolved: true,
      resolvedBy: 'Ananya',
    }),
    normalizeBuddyMessage({
      id: 'm3',
      peerId: 'p2',
      senderName: 'Rohan',
      kind: 'progress',
      text: 'Finished 3/4 chapters in Science!',
      progressPercent: 75,
    }),
    normalizeBuddyMessage({
      id: 'm4',
      peerId: 'p1',
      senderName: 'Ananya',
      kind: 'chat',
      text: 'Ready for the 25m sprint!',
    }),
  ];

  assert.equal(countOpenQuestions(messages), 1);
  assert.equal(countProgressUpdates(messages), 1);
  assert.equal(filterBuddyMessages(messages, 'all').length, 4);
  assert.equal(filterBuddyMessages(messages, 'question').length, 2);
  assert.equal(filterBuddyMessages(messages, 'progress').length, 1);
});

test('normalizeBuddyMessage clamps progressPercent and falls back cleanly on unknown kinds', () => {
  const clamped = normalizeBuddyMessage({
    id: 'm5',
    kind: 'progress',
    progressPercent: 145,
    text: 'All done!',
  });
  assert.equal(clamped.progressPercent, 100);

  const fallback = normalizeBuddyMessage({
    id: 'm6',
    kind: 'invalid_kind' as unknown as 'chat',
    text: 'Hello',
  });
  assert.equal(fallback.kind, 'chat');
});
