import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = fs.existsSync(path.resolve('firestore.rules'))
  ? path.resolve('firestore.rules')
  : path.resolve('DRAFT_firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve('firebase-blueprint.json'), 'utf8'));

test('security rules enforce rules_version 2 and global default-deny catch-all', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
});

test('security rules enforce verified email ownership and block student directory listing', () => {
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /match \/students\/\{userId\}[\s\S]*allow list: if false;/);
});

test('security rules enforce validation helpers, immutability, server timestamps, and Master Gate', () => {
  assert.match(rulesText, /function isValidStudentAccount\(data, userId\)/);
  assert.match(rulesText, /function isValidSubjectPath\(data, userId, subjectKey\)/);
  assert.match(rulesText, /function isValidTutorThread\(data, userId, subjectKey\)/);
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesText, /parentStudentExists\(userId\)/);
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
});

test('security rules synchronize exact maxLength and array bounds with firebase-blueprint.json', () => {
  const studentProps = blueprint.entities.StudentAccount.properties;
  assert.ok(rulesText.includes(`data.name.size() <= ${studentProps.name.maxLength}`));
  assert.ok(rulesText.includes(`data.email.size() <= ${studentProps.email.maxLength}`));
  assert.ok(rulesText.includes(`data.classLevel.size() <= ${studentProps.classLevel.maxLength}`));
  assert.ok(rulesText.includes(`data.syllabus.size() <= ${studentProps.syllabus.maxLength}`));

  const pathProps = blueprint.entities.SubjectPathRecord.properties;
  assert.ok(rulesText.includes(`data.overview.size() <= ${pathProps.overview.maxLength}`));
  assert.ok(rulesText.includes(`data.focusStrategy.size() <= ${pathProps.focusStrategy.maxLength}`));
  assert.ok(rulesText.includes(`data.adaptationNote.size() <= ${pathProps.adaptationNote.maxLength}`));
});

test('security rules cover every Firestore collection path declared in firebase-blueprint.json', () => {
  assert.match(rulesText, /match \/students\/\{userId\}/);
  assert.match(rulesText, /match \/subjectPaths\/\{subjectKey\}/);
  assert.match(rulesText, /match \/tutorThreads\/\{subjectKey\}/);
  assert.match(rulesText, /match \/youtubeClasses\/\{classId\}/);
  assert.match(rulesText, /allow list: if isOwner\(userId\) && resource\.data\.uid == request\.auth\.uid;/);
});

test('security rules validate bounded completedDates format and action-based streak update', () => {
  assert.ok(rulesText.includes('data.completedDates.size() <= 365'));
  assert.ok(rulesText.includes("data.completedDates[0].matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')"));
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(\[\s*'completedDates',\s*'updatedAt'\s*\]\)/);
});

test('security rules validate language preference and bounded youtubeClasses records', () => {
  const studentProps = blueprint.entities.StudentAccount.properties;
  assert.ok(rulesText.includes(`data.language.size() <= ${studentProps.language.maxLength}`));
  assert.match(rulesText, /function isValidYouTubeClass\(data, userId, classId\)/);
  assert.ok(rulesText.includes('data.questions.size() <= 60'));
  assert.ok(rulesText.includes('data.keyTakeaways.size() <= 8'));
  assert.ok(rulesText.includes("data.videoId.matches('^[a-zA-Z0-9_\\\\-]{11}$')"));
});

test('security rules enforce ₹200 7-year subscription bounds, PRINCE ₹0 guard, and action-based update', () => {
  assert.match(rulesText, /function isValidSubscriptionMap\(sub\)/);
  assert.ok(rulesText.includes("'scholar_7yr_200inr'"));
  assert.ok(rulesText.includes('sub.amountInr == 200'));
  assert.ok(rulesText.includes("sub.amountInr == 0 && 'referralCode' in sub && sub.referralCode == 'PRINCE'"));
  assert.ok(rulesText.includes("sub.currency == 'INR'"));
  assert.ok(rulesText.includes('sub.durationYears == 7'));
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(\[\s*'subscription',\s*'updatedAt'\s*\]\)/);
});

test('security rules validate bounded study reminders settings and action-based update', () => {
  assert.match(rulesText, /function isValidRemindersMap\(rem\)/);
  assert.ok(rulesText.includes('rem.topicAlerts.size() <= 20'));
  assert.ok(rulesText.includes("rem.dailyStudyTime.matches('^([01][0-9]|2[0-3]):[0-5][0-9]$')"));
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(\[\s*'reminders',\s*'updatedAt'\s*\]\)/);
});



