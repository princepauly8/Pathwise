import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTranscriptText,
  countWords,
  formatSpeechErrorMessage,
  getSpeechLocaleForLanguage,
  isSpeechRecognitionSupported,
} from './speechRecognition';

test('getSpeechLocaleForLanguage maps Pathwise study languages to BCP-47 speech locales', () => {
  assert.equal(getSpeechLocaleForLanguage('English'), 'en-IN');
  assert.equal(getSpeechLocaleForLanguage('Malayalam'), 'ml-IN');
  assert.equal(getSpeechLocaleForLanguage('Hindi'), 'hi-IN');
  assert.equal(getSpeechLocaleForLanguage('Spanish'), 'es-ES');
  assert.equal(getSpeechLocaleForLanguage('en-us'), 'en-US');
  assert.equal(getSpeechLocaleForLanguage(undefined), 'en-IN');
});

test('appendTranscriptText joins dictated phrases cleanly without double spaces or overflowing max length', () => {
  assert.equal(appendTranscriptText('', 'Newton second law is F equals ma.'), 'Newton second law is F equals ma.');
  assert.equal(
    appendTranscriptText('Summary: Force causes acceleration.', '  F = m * a  '),
    'Summary: Force causes acceleration. F = m * a'
  );
  assert.equal(
    appendTranscriptText('Summary:\n', 'Check sign conventions.'),
    'Summary:\nCheck sign conventions.'
  );
  assert.equal(appendTranscriptText('Hello', 'world', 8), 'Hello wo');
});

test('formatSpeechErrorMessage maps permission, mic, no-speech, and aborted errors cleanly', () => {
  assert.match(formatSpeechErrorMessage('not-allowed'), /Microphone permission/i);
  assert.match(formatSpeechErrorMessage('audio-capture'), /No microphone/i);
  assert.match(formatSpeechErrorMessage('no-speech'), /No speech/i);
  assert.equal(formatSpeechErrorMessage('aborted'), '');
});

test('isSpeechRecognitionSupported detects standard and webkit constructors safely', () => {
  class FakeRecognition {}
  assert.equal(isSpeechRecognitionSupported({}), false);
  assert.equal(
    isSpeechRecognitionSupported({ SpeechRecognition: FakeRecognition as never }),
    true
  );
  assert.equal(
    isSpeechRecognitionSupported({ webkitSpeechRecognition: FakeRecognition as never }),
    true
  );
});

test('countWords accurately counts dictated note words', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   \n  '), 0);
  assert.equal(countWords('Quadratic discriminant b^2 - 4ac determines roots'), 7);
});
