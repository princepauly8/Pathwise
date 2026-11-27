import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeThemePreference,
  resolveTheme,
} from './theme';

test('normalizeThemePreference accepts light, dark, and system and defaults safely', () => {
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('invalid'), 'light');
  assert.equal(normalizeThemePreference(null), 'light');
  assert.equal(normalizeThemePreference(undefined), 'light');
});

test('resolveTheme maps explicit and system preferences accurately', () => {
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});
