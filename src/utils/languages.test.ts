import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_YOUTUBE_CLASSES,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  extractYouTubeVideoId,
  formatLanguageOption,
  getLanguageDisplayLabel,
} from './languages';

test('SUPPORTED_LANGUAGES includes Malayalam and comprehensive Indian + Global languages', () => {
  assert.ok(SUPPORTED_LANGUAGES.length >= 45, `Expected >=45 languages, got ${SUPPORTED_LANGUAGES.length}`);

  const malayalam = SUPPORTED_LANGUAGES.find((l) => l.name === 'Malayalam');
  assert.ok(malayalam, 'Malayalam must be in SUPPORTED_LANGUAGES');
  assert.equal(malayalam.code, 'ml');
  assert.equal(malayalam.nativeName, 'മലയാളം');
  assert.equal(formatLanguageOption(malayalam), 'Malayalam (മലയാളം)');

  for (const required of ['English', 'Malayalam', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Spanish', 'Arabic', 'Japanese']) {
    assert.ok(
      SUPPORTED_LANGUAGES.some((l) => l.name === required),
      `Expected ${required} to be included in SUPPORTED_LANGUAGES`
    );
  }

  assert.equal(getLanguageDisplayLabel('ml'), 'Malayalam (മലയാളം)');
  assert.equal(getLanguageDisplayLabel('Malayalam'), 'Malayalam (മലയാളം)');
  assert.equal(getLanguageDisplayLabel(''), DEFAULT_LANGUAGE);
  assert.equal(getLanguageDisplayLabel('Tulu'), 'Tulu');
});

test('extractYouTubeVideoId parses standard, short, embed, shorts, live, and bare YouTube IDs', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=PUB0TaZ7bhA'), 'PUB0TaZ7bhA');
  assert.equal(extractYouTubeVideoId('https://youtu.be/ZM8ECpBuQYE?t=42'), 'ZM8ECpBuQYE');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/Yocja_N5s1I'), 'Yocja_N5s1I');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/embed/WUvTyaaNkzM'), 'WUvTyaaNkzM');
  assert.equal(extractYouTubeVideoId('https://m.youtube.com/live/PUB0TaZ7bhA'), 'PUB0TaZ7bhA');
  assert.equal(extractYouTubeVideoId('youtube.com/watch?v=PUB0TaZ7bhA&list=PL123'), 'PUB0TaZ7bhA');
  assert.equal(extractYouTubeVideoId('PUB0TaZ7bhA'), 'PUB0TaZ7bhA');

  assert.equal(extractYouTubeVideoId(''), null);
  assert.equal(extractYouTubeVideoId('https://example.com/video'), null);
  assert.equal(extractYouTubeVideoId('too-short'), null);
});

test('CURATED_YOUTUBE_CLASSES contains valid 11-char video IDs', () => {
  assert.ok(CURATED_YOUTUBE_CLASSES.length >= 4);
  for (const item of CURATED_YOUTUBE_CLASSES) {
    assert.match(item.videoId, /^[a-zA-Z0-9_-]{11}$/);
    assert.ok(item.title.trim().length > 0);
    assert.ok(item.channelName.trim().length > 0);
  }
});
