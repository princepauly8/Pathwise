import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  StudentProfile,
  StudentSubscription,
  StudyReminderSettings,
  SubjectPath,
  ThemePreference,
  TimetableSlot,
  TutorMessage,
  YouTubeClassItem,
} from '../types/study';
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PLAN_ID,
  SUBSCRIPTION_PRICE_INR,
  ensureStudentSubscription,
} from './subscription';
import { ensureReminderSettings } from './studyAlerts';

export function toSubjectKey(subject: string): string {
  const slug = subject
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || 'subject';
}

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeSubjects(subjects: string[]): string[] {
  return Array.from(
    new Set(subjects.map((s) => clampString(s, 80)).filter(Boolean))
  ).slice(0, 8);
}

function sanitizeSubscriptionForFirestore(
  raw: StudentSubscription | undefined,
  fallbackCreatedAt?: string
): Record<string, unknown> {
  const safe = ensureStudentSubscription(raw, fallbackCreatedAt);
  const status =
    safe.status === 'active' || safe.status === 'expired' || safe.status === 'trial'
      ? safe.status
      : 'trial';

  const cleanReferral = safe.referralCode
    ? clampString(safe.referralCode, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '')
    : '';

  const validAmount =
    safe.amountInr === 0 && cleanReferral === 'PRINCE'
      ? 0
      : safe.amountInr === 100 && safe.status === 'active'
        ? 100
        : SUBSCRIPTION_PRICE_INR;

  const planId =
    safe.planId === 'scholar_7yr_100inr' && safe.status === 'active'
      ? 'scholar_7yr_100inr'
      : SUBSCRIPTION_PLAN_ID;

  const payload: Record<string, unknown> = {
    planId,
    status,
    trialStartedAt: clampString(safe.trialStartedAt, 40),
    trialEndsAt: clampString(safe.trialEndsAt, 40),
    amountInr: validAmount,
    currency: SUBSCRIPTION_CURRENCY,
    durationYears: SUBSCRIPTION_DURATION_YEARS,
  };

  if (safe.subscribedAt) {
    payload.subscribedAt = clampString(safe.subscribedAt, 40);
  }
  if (safe.expiresAt) {
    payload.expiresAt = clampString(safe.expiresAt, 40);
  }
  if (safe.paymentMethod) {
    const cleanMethod = clampString(safe.paymentMethod, 40);
    if (cleanMethod.length >= 2) payload.paymentMethod = cleanMethod;
  }
  if (safe.receiptId) {
    const cleanReceipt = clampString(safe.receiptId, 80);
    if (cleanReceipt.length >= 4) payload.receiptId = cleanReceipt;
  }
  if (cleanReferral.length >= 2) {
    payload.referralCode = cleanReferral;
  }

  return payload;
}

function sanitizeTimetable(slots: TimetableSlot[] | undefined): TimetableSlot[] {
  if (!Array.isArray(slots)) return [];
  return slots.slice(0, 28).map((s) => ({
    id: clampString(s.id, 64),
    day: s.day,
    timeRange: clampString(s.timeRange, 40),
    subject: clampString(s.subject, 80),
    activity: s.activity,
    durationMinutes: Math.max(10, Math.min(180, Math.round(Number(s.durationMinutes) || 30))),
    completed: Boolean(s.completed),
  }));
}

function sanitizeCompletedDates(dates: string[] | undefined): string[] {
  if (!Array.isArray(dates)) return [];
  const valid = dates
    .map((d) => clampString(d, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return Array.from(new Set(valid)).sort().slice(-365);
}

function sanitizeRemindersForFirestore(
  raw: StudyReminderSettings | undefined
): StudyReminderSettings {
  const safe = ensureReminderSettings(raw);
  return {
    enabled: Boolean(safe.enabled),
    dailyStudyTime: safe.dailyStudyTime,
    soundEnabled: Boolean(safe.soundEnabled),
    browserNotifications: Boolean(safe.browserNotifications),
    topicAlerts: safe.topicAlerts.slice(0, 20).map((item) => {
      const clean: StudyReminderSettings['topicAlerts'][number] = {
        id: clampString(item.id, 64),
        subject: clampString(item.subject, 80) || 'General Study',
        topicTitle: clampString(item.topicTitle, 140) || 'Study Topic',
        dueAt: clampString(item.dueAt, 40),
        completed: Boolean(item.completed),
      };
      if (item.moduleId) clean.moduleId = clampString(item.moduleId, 80);
      if (item.note) clean.note = clampString(item.note, 180);
      if (item.notifiedAt) clean.notifiedAt = clampString(item.notifiedAt, 40);
      return clean;
    }),
  };
}

export async function loadStudentWorkspaceFromFirestore(
  uid: string
): Promise<StudentProfile | null> {
  const studentPath = `students/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'students', uid));
    if (!snap.exists()) return null;

    const data = snap.data();

    const pathsRef = collection(db, 'students', uid, 'subjectPaths');
    const pathsQuery = query(pathsRef, where('uid', '==', uid));
    const pathsSnap = await getDocs(pathsQuery);

    const paths: Record<string, SubjectPath> = {};
    pathsSnap.forEach((docSnap) => {
      const p = docSnap.data();
      if (typeof p.subject === 'string') {
        paths[p.subject] = {
          subject: p.subject,
          domain: p.domain === 'humanities' ? 'humanities' : 'stem',
          overview: String(p.overview ?? ''),
          focusStrategy: String(p.focusStrategy ?? ''),
          adaptationNote: p.adaptationNote ? String(p.adaptationNote) : undefined,
          generatedByAi: Boolean(p.generatedByAi),
          modules: Array.isArray(p.modules) ? p.modules : [],
          updatedAt: new Date().toISOString(),
        };
      }
    });

    const threadsRef = collection(db, 'students', uid, 'tutorThreads');
    const threadsQuery = query(threadsRef, where('uid', '==', uid));
    const threadsSnap = await getDocs(threadsQuery);

    const tutorHistory: Record<string, TutorMessage[]> = {};
    threadsSnap.forEach((docSnap) => {
      const t = docSnap.data();
      if (typeof t.subject === 'string' && Array.isArray(t.messages)) {
        tutorHistory[t.subject] = t.messages;
      }
    });

    const ytRef = collection(db, 'students', uid, 'youtubeClasses');
    const ytQuery = query(ytRef, where('uid', '==', uid));
    const ytSnap = await getDocs(ytQuery);

    const youtubeClasses: YouTubeClassItem[] = [];
    ytSnap.forEach((docSnap) => {
      const y = docSnap.data();
      if (typeof y.videoId === 'string' && typeof y.title === 'string') {
        youtubeClasses.push({
          id: String(y.classId ?? docSnap.id),
          videoId: y.videoId,
          url: String(y.url ?? `https://www.youtube.com/watch?v=${y.videoId}`),
          title: y.title,
          channelName: String(y.channelName ?? 'YouTube'),
          subject: String(y.subject ?? 'General Studies'),
          language: String(y.language ?? 'English'),
          summary: String(y.summary ?? ''),
          keyTakeaways: Array.isArray(y.keyTakeaways) ? y.keyTakeaways : [],
          questions: Array.isArray(y.questions) ? y.questions : [],
          bestQuizScore: typeof y.bestQuizScore === 'number' ? y.bestQuizScore : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const createdAtIso =
      data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString();

    const loadedSubscription = ensureStudentSubscription(
      data.subscription && typeof data.subscription === 'object'
        ? (data.subscription as StudentSubscription)
        : undefined,
      createdAtIso
    );

    return {
      id: uid,
      name: String(data.name ?? 'Student'),
      email: typeof data.email === 'string' ? data.email : undefined,
      classLevel: String(data.classLevel ?? 'Class 10'),
      syllabus: String(data.syllabus ?? 'CBSE'),
      language: typeof data.language === 'string' && data.language.trim() ? data.language : 'English',
      theme:
        data.theme === 'light' || data.theme === 'dark' || data.theme === 'system'
          ? (data.theme as ThemePreference)
          : undefined,
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      goal: data.goal ?? 'exam_prep',
      dailyMinutes: data.dailyMinutes ?? 45,
      timetable: Array.isArray(data.timetable) ? data.timetable : undefined,
      completedDates: sanitizeCompletedDates(data.completedDates),
      youtubeClasses,
      subscription: loadedSubscription,
      reminders: ensureReminderSettings(
        data.reminders && typeof data.reminders === 'object'
          ? (data.reminders as StudyReminderSettings)
          : undefined
      ),
      paths,
      tutorHistory,
      createdAt: createdAtIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, studentPath);
  }
}

export async function createOrUpdateStudentAccountDoc(
  uid: string,
  email: string,
  profile: {
    name: string;
    classLevel: string;
    syllabus: string;
    language?: string;
    theme?: ThemePreference;
    subjects: string[];
    goal: StudentProfile['goal'];
    dailyMinutes: StudentProfile['dailyMinutes'];
    timetable?: TimetableSlot[];
    completedDates?: string[];
    subscription?: StudentSubscription;
    reminders?: StudyReminderSettings;
  }
): Promise<void> {
  const path = `students/${uid}`;
  const docRef = doc(db, 'students', uid);
  const subjects = sanitizeSubjects(profile.subjects);
  const language = clampString(profile.language || 'English', 60) || 'English';
  const theme: ThemePreference | undefined =
    profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'system'
      ? profile.theme
      : undefined;

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      const createPayload: Record<string, unknown> = {
        uid,
        name: clampString(profile.name, 80),
        email: clampString(email, 160),
        classLevel: clampString(profile.classLevel, 40),
        syllabus: clampString(profile.syllabus, 60),
        language,
        subjects,
        goal: profile.goal,
        dailyMinutes: profile.dailyMinutes,
        timetable: sanitizeTimetable(profile.timetable),
        completedDates: sanitizeCompletedDates(profile.completedDates),
        subscription: sanitizeSubscriptionForFirestore(profile.subscription),
        reminders: sanitizeRemindersForFirestore(profile.reminders),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (theme) {
        createPayload.theme = theme;
      }
      await setDoc(docRef, createPayload);
    } else {
      const updatePayload: Record<string, unknown> = {
        name: clampString(profile.name, 80),
        classLevel: clampString(profile.classLevel, 40),
        syllabus: clampString(profile.syllabus, 60),
        language,
        subjects,
        goal: profile.goal,
        dailyMinutes: profile.dailyMinutes,
        updatedAt: serverTimestamp(),
      };
      if (theme) {
        updatePayload.theme = theme;
      }
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveStudentThemeDoc(
  uid: string,
  theme: ThemePreference
): Promise<void> {
  const path = `students/${uid}`;
  const safeTheme: ThemePreference =
    theme === 'dark' || theme === 'system' ? theme : 'light';
  try {
    await updateDoc(doc(db, 'students', uid), {
      theme: safeTheme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStudentLanguageDoc(uid: string, language: string): Promise<void> {
  const path = `students/${uid}`;
  const cleanLang = clampString(language || 'English', 60);
  if (cleanLang.length < 2) return;
  try {
    await updateDoc(doc(db, 'students', uid), {
      language: cleanLang,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStudentTimetableDoc(
  uid: string,
  timetable: TimetableSlot[]
): Promise<void> {
  const path = `students/${uid}`;
  try {
    await updateDoc(doc(db, 'students', uid), {
      timetable: sanitizeTimetable(timetable),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStudentCompletedDatesDoc(
  uid: string,
  completedDates: string[]
): Promise<void> {
  const path = `students/${uid}`;
  try {
    await updateDoc(doc(db, 'students', uid), {
      completedDates: sanitizeCompletedDates(completedDates),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStudentSubscriptionDoc(
  uid: string,
  subscription: StudentSubscription
): Promise<void> {
  const path = `students/${uid}`;
  try {
    await updateDoc(doc(db, 'students', uid), {
      subscription: sanitizeSubscriptionForFirestore(subscription),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStudentRemindersDoc(
  uid: string,
  reminders: StudyReminderSettings
): Promise<void> {
  const path = `students/${uid}`;
  try {
    await updateDoc(doc(db, 'students', uid), {
      reminders: sanitizeRemindersForFirestore(reminders),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSubjectPathDoc(
  uid: string,
  subjectPath: SubjectPath
): Promise<void> {
  const subjectKey = toSubjectKey(subjectPath.subject);
  const path = `students/${uid}/subjectPaths/${subjectKey}`;
  const docRef = doc(db, 'students', uid, 'subjectPaths', subjectKey);

  // Strip undefined properties recursively and clamp personal notes for Firestore compatibility
  const cleanModules = JSON.parse(
    JSON.stringify(
      subjectPath.modules.slice(0, 8).map((mod) => ({
        ...mod,
        ...(typeof mod.studentNotes === 'string'
          ? { studentNotes: mod.studentNotes.slice(0, 6000) }
          : {}),
        ...(typeof mod.studentNotesUpdatedAt === 'string'
          ? { studentNotesUpdatedAt: clampString(mod.studentNotesUpdatedAt, 40) }
          : {}),
      }))
    )
  );

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        subjectKey,
        subject: clampString(subjectPath.subject, 80),
        domain: subjectPath.domain === 'humanities' ? 'humanities' : 'stem',
        overview: clampString(subjectPath.overview, 600),
        focusStrategy: clampString(subjectPath.focusStrategy, 600),
        generatedByAi: Boolean(subjectPath.generatedByAi),
        modules: cleanModules,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (subjectPath.adaptationNote) {
        payload.adaptationNote = clampString(subjectPath.adaptationNote, 300);
      }
      await setDoc(docRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        subject: clampString(subjectPath.subject, 80),
        domain: subjectPath.domain === 'humanities' ? 'humanities' : 'stem',
        overview: clampString(subjectPath.overview, 600),
        focusStrategy: clampString(subjectPath.focusStrategy, 600),
        adaptationNote: clampString(subjectPath.adaptationNote ?? '', 300),
        generatedByAi: Boolean(subjectPath.generatedByAi),
        modules: cleanModules,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveTutorThreadDoc(
  uid: string,
  subject: string,
  messages: TutorMessage[]
): Promise<void> {
  const subjectKey = toSubjectKey(subject);
  const path = `students/${uid}/tutorThreads/${subjectKey}`;
  const docRef = doc(db, 'students', uid, 'tutorThreads', subjectKey);
  const boundedMessages = messages.slice(-40).map((m) => ({
    id: clampString(m.id, 80),
    role: m.role === 'student' ? 'student' : 'tutor',
    content: clampString(m.content, 4000),
    timestamp: clampString(m.timestamp, 40),
  }));

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid,
        subjectKey,
        subject: clampString(subject, 80),
        messages: boundedMessages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        messages: boundedMessages,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveYouTubeClassDoc(uid: string, item: YouTubeClassItem): Promise<void> {
  if (item.sourceType === 'upload' || !/^[a-zA-Z0-9_-]{11}$/.test(item.videoId)) {
    return;
  }
  const classId = toSubjectKey(item.id || `yt-${item.videoId}`);
  const path = `students/${uid}/youtubeClasses/${classId}`;
  const docRef = doc(db, 'students', uid, 'youtubeClasses', classId);

  const cleanTakeaways = (item.keyTakeaways ?? [])
    .map((t) => clampString(t, 240))
    .filter(Boolean)
    .slice(0, 8);
  const cleanQuestions = JSON.parse(JSON.stringify((item.questions ?? []).slice(0, 60)));
  const cleanScore =
    typeof item.bestQuizScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(item.bestQuizScore)))
      : undefined;

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        classId,
        videoId: clampString(item.videoId, 11),
        url: clampString(item.url || `https://www.youtube.com/watch?v=${item.videoId}`, 300),
        title: clampString(item.title || 'YouTube Study Class', 200),
        channelName: clampString(item.channelName || 'YouTube', 120),
        subject: clampString(item.subject || 'General Studies', 80),
        language: clampString(item.language || 'English', 60) || 'English',
        summary: clampString(item.summary || '', 1200),
        keyTakeaways: cleanTakeaways,
        questions: cleanQuestions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanScore !== undefined) {
        payload.bestQuizScore = cleanScore;
      }
      await setDoc(docRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        title: clampString(item.title || 'YouTube Study Class', 200),
        channelName: clampString(item.channelName || 'YouTube', 120),
        subject: clampString(item.subject || 'General Studies', 80),
        language: clampString(item.language || 'English', 60) || 'English',
        summary: clampString(item.summary || '', 1200),
        keyTakeaways: cleanTakeaways,
        questions: cleanQuestions,
        updatedAt: serverTimestamp(),
      };
      if (cleanScore !== undefined) {
        updatePayload.bestQuizScore = cleanScore;
      }
      await updateDoc(docRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteYouTubeClassDoc(uid: string, classIdRaw: string): Promise<void> {
  const classId = toSubjectKey(classIdRaw);
  const path = `students/${uid}/youtubeClasses/${classId}`;
  try {
    await deleteDoc(doc(db, 'students', uid, 'youtubeClasses', classId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
