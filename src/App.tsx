/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { AiTutor } from './components/AiTutor';
import { AuthGate } from './components/AuthGate';
import { CombineStudyRoom } from './components/CombineStudyRoom';
import { ConfettiCelebration } from './components/ConfettiCelebration';
import { LearningPathWorkspace } from './components/LearningPathWorkspace';
import { OnboardingStudio } from './components/OnboardingStudio';
import { PlannerMotivation } from './components/PlannerMotivation';
import { PracticeStudio } from './components/PracticeStudio';
import { PremiumFeatureGate } from './components/PremiumFeatureGate';
import { ProfileModal } from './components/ProfileModal';
import { RevisionHub } from './components/RevisionHub';
import { StudyAlertsPanel } from './components/StudyAlertsPanel';
import { StudyAlertToast } from './components/StudyAlertToast';
import { StudyKit } from './components/StudyKit';
import { SubscriptionModal } from './components/SubscriptionModal';
import { TopBar } from './components/TopBar';
import { YouTubeClassStudio } from './components/YouTubeClassStudio';
import type {
  ActiveStudyAlert,
  BoardSyllabusSyncRecord,
  LearningModule,
  StudentProfile,
  StudentSubscription,
  StudyGoal,
  StudyPace,
  StudyReminderSettings,
  SubjectPath,
  ThemePreference,
  TimetableSlot,
  TopicReminderItem,
  TutorMediaPayload,
  TutorMessage,
  WorkspaceView,
  YouTubeClassItem,
} from './types/study';
import {
  askTutorApi,
  autoUpdateBoardSyllabusApi,
  generateLearningPathsApi,
  generateLessonApi,
  generateQuizApi,
} from './utils/api';
import {
  createOrUpdateStudentAccountDoc,
  deleteYouTubeClassDoc,
  loadStudentWorkspaceFromFirestore,
  saveStudentCompletedDatesDoc,
  saveStudentLanguageDoc,
  saveStudentRemindersDoc,
  saveStudentSubscriptionDoc,
  saveStudentThemeDoc,
  saveStudentTimetableDoc,
  saveSubjectPathDoc,
  saveTutorThreadDoc,
  saveYouTubeClassDoc,
} from './utils/firestoreSync';
import {
  detectMilestoneCelebration,
  evaluateStudentAchievements,
  type CelebrationPayload,
} from './utils/achievements';
import { DEFAULT_LANGUAGE } from './utils/languages';
import {
  calculateStudyStreak,
  createSampleStudentProfile,
  generateStudyTimetable,
  mergeSubjectSelections,
  recordModuleCompletionDate,
  recordQuizMastery,
  toggleModuleMastery,
} from './utils/learningPath';
import {
  loadActiveStudentId,
  loadStudentProfiles,
  saveActiveStudentId,
  saveStudentProfiles,
} from './utils/storage';
import {
  computeSmartStudyAlerts,
  ensureReminderSettings,
  formatDueRelative,
  getLocalDateKey,
  playStudyAlertChime,
  sendBrowserStudyNotification,
} from './utils/studyAlerts';
import {
  canAccessWorkspaceView,
  createInitialTrialSubscription,
  ensureStudentSubscription,
  getSubscriptionState,
} from './utils/subscription';
import {
  evaluateSyllabusSyncStatus,
  loadAutoSyncEnabled,
  loadSyllabusSyncRecord,
  mergeSyncedSubjectPaths,
  saveAutoSyncEnabled,
  saveSyllabusSyncRecord,
} from './utils/syllabusSync';
import {
  applyThemeToDocument,
  loadThemePreference,
  normalizeThemePreference,
  saveThemePreference,
  subscribeToSystemTheme,
  type ResolvedTheme,
} from './utils/theme';

function hydrateProfiles(raw: StudentProfile[]): StudentProfile[] {
  return raw.map((p) => ({
    ...p,
    syllabus: p.syllabus || 'CBSE',
    language: p.language || DEFAULT_LANGUAGE,
    timetable:
      p.timetable && p.timetable.length > 0
        ? p.timetable
        : generateStudyTimetable(p.subjects, p.dailyMinutes),
    completedDates: Array.isArray(p.completedDates) ? p.completedDates : [],
    youtubeClasses: Array.isArray(p.youtubeClasses) ? p.youtubeClasses : [],
    subscription: ensureStudentSubscription(p.subscription, p.createdAt),
    reminders: ensureReminderSettings(p.reminders),
  }));
}

function initLocalState(): {
  profiles: StudentProfile[];
  activeId: string | null;
  guestMode: boolean;
} {
  const storedProfiles = hydrateProfiles(loadStudentProfiles());
  const storedActiveId = loadActiveStudentId();

  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';

  if (autostart) {
    if (storedProfiles.length > 0) {
      const validActive =
        storedProfiles.find((p) => p.id === storedActiveId)?.id ?? storedProfiles[0].id;
      return { profiles: storedProfiles, activeId: validActive, guestMode: true };
    }
    const sample = createSampleStudentProfile();
    return { profiles: [sample], activeId: sample.id, guestMode: true };
  }

  return { profiles: storedProfiles, activeId: null, guestMode: false };
}

export default function App() {
  const initial = initLocalState();

  // Firebase authentication & cloud profile state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(initial.guestMode);
  const [isLoadingCloudProfile, setIsLoadingCloudProfile] = useState<boolean>(false);
  const [cloudProfile, setCloudProfile] = useState<StudentProfile | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Guest / local mode state
  const [guestMode, setGuestMode] = useState<boolean>(initial.guestMode);
  const [profiles, setProfiles] = useState<StudentProfile[]>(initial.profiles);
  const [activeLocalId, setActiveLocalId] = useState<string | null>(initial.activeId);

  // Detect optional friend room invite link (?room=PW4829)
  const [inviteRoomCode] = useState<string>(() => {
    const raw = new URLSearchParams(window.location.search).get('room') || '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  });

  // Theme preference state (persisted in localStorage & student profile/Firestore)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    applyThemeToDocument(loadThemePreference())
  );

  // Workspace navigation state
  const [activeView, setActiveView] = useState<WorkspaceView>(() =>
    inviteRoomCode.length >= 4 ? 'combine' : 'paths'
  );
  const activeProfile: StudentProfile | null = firebaseUser
    ? cloudProfile
    : guestMode
    ? profiles.find((p) => p.id === activeLocalId) ?? null
    : null;

  const [activeSubject, setActiveSubject] = useState<string>(
    activeProfile?.subjects[0] ?? 'Mathematics'
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [alertPrefillTopic, setAlertPrefillTopic] = useState<{
    subject: string;
    moduleId?: string;
    topicTitle: string;
  } | null>(null);
  const [liveToastAlert, setLiveToastAlert] = useState<ActiveStudyAlert | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [alertClockTick, setAlertClockTick] = useState<number>(() => Date.now());
  const firedAlertIdsRef = useRef<Set<string>>(new Set());
  const milestoneSnapshotRef = useRef<{
    profileId: string;
    streak: number;
    completedToday: boolean;
    unlockedBadgeIds: string[];
  } | null>(null);

  // Async loading & error states
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const [adaptingSubject, setAdaptingSubject] = useState<string | null>(null);
  const [adaptError, setAdaptError] = useState<string | null>(null);

  const [syllabusSyncRecord, setSyllabusSyncRecord] = useState<BoardSyllabusSyncRecord | null>(
    null
  );
  const [autoUpdateSyllabusEnabled, setAutoUpdateSyllabusEnabled] = useState<boolean>(true);
  const [isSyncingBoardSyllabus, setIsSyncingBoardSyllabus] = useState<boolean>(false);
  const [syllabusSyncError, setSyllabusSyncError] = useState<string | null>(null);
  const syllabusSyncReqIdRef = useRef<number>(0);
  const autoCheckedKeyRef = useRef<string>('');

  const [isLoadingLesson, setIsLoadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [failedTutorRequest, setFailedTutorRequest] = useState<{
    subject: string;
    message: string;
    moduleTitle?: string;
    media?: TutorMediaPayload;
  } | null>(null);

  // Subscribe to Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);

      if (user) {
        setGuestMode(false);
        setIsLoadingCloudProfile(true);
        try {
          const loaded = await loadStudentWorkspaceFromFirestore(user.uid);
          if (loaded) {
            const hydrated: StudentProfile = {
              ...loaded,
              syllabus: loaded.syllabus || 'CBSE',
              language: loaded.language || DEFAULT_LANGUAGE,
              timetable:
                loaded.timetable && loaded.timetable.length > 0
                  ? loaded.timetable
                  : generateStudyTimetable(loaded.subjects, loaded.dailyMinutes),
              completedDates: Array.isArray(loaded.completedDates) ? loaded.completedDates : [],
              youtubeClasses: Array.isArray(loaded.youtubeClasses) ? loaded.youtubeClasses : [],
              subscription: ensureStudentSubscription(loaded.subscription, loaded.createdAt),
            };
            setCloudProfile(hydrated);
            if (hydrated.theme) {
              setThemePreference(normalizeThemePreference(hydrated.theme));
            }
            const firstSub = hydrated.subjects[0] ?? 'Mathematics';
            setActiveSubject(firstSub);
            setSelectedModuleId(
              hydrated.paths[firstSub]?.modules.find((m) => m.status === 'in_progress')?.id ??
                hydrated.paths[firstSub]?.modules[0]?.id ??
                null
            );
            setActiveView(inviteRoomCode.length >= 4 ? 'combine' : 'paths');
          } else {
            setCloudProfile(null);
          }
        } catch (err) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Unable to load your saved student profile right now.'
          );
          setCloudProfile(null);
        } finally {
          setIsLoadingCloudProfile(false);
          setAuthReady(true);
        }
      } else {
        setCloudProfile(null);
        setIsLoadingCloudProfile(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Apply & persist theme preference to document root CSS variables and Tailwind dark class
  useEffect(() => {
    saveThemePreference(themePreference);
    setResolvedTheme(applyThemeToDocument(themePreference));
    if (themePreference !== 'system') return;
    return subscribeToSystemTheme(() => {
      setResolvedTheme(applyThemeToDocument('system'));
    });
  }, [themePreference]);

  // Sync guest local profiles to localStorage
  useEffect(() => {
    saveStudentProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    saveActiveStudentId(activeLocalId);
  }, [activeLocalId]);

  // Always land cleanly at the top when switching workspace views or student profiles
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeView, activeProfile?.id, guestMode, firebaseUser?.uid]);

  // Keep activeSubject valid whenever activeProfile changes
  useEffect(() => {
    if (!activeProfile) return;
    if (!activeProfile.subjects.includes(activeSubject)) {
      const firstSubject = activeProfile.subjects[0] ?? '';
      setActiveSubject(firstSubject);
      const firstMod =
        activeProfile.paths[firstSubject]?.modules.find((m) => m.status === 'in_progress')?.id ??
        activeProfile.paths[firstSubject]?.modules[0]?.id ??
        null;
      setSelectedModuleId(firstMod);
    }
  }, [activeProfile, activeSubject]);

  // Detect newly earned streak milestones or achievement badges and fire confetti
  useEffect(() => {
    if (!activeProfile) {
      milestoneSnapshotRef.current = null;
      return;
    }

    const streak = calculateStudyStreak(activeProfile.completedDates);
    const badges = evaluateStudentAchievements(activeProfile);
    const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
    const prev = milestoneSnapshotRef.current;

    if (!prev || prev.profileId !== activeProfile.id) {
      milestoneSnapshotRef.current = {
        profileId: activeProfile.id,
        streak: streak.currentStreak,
        completedToday: streak.completedToday,
        unlockedBadgeIds: unlockedIds,
      };
      return;
    }

    const detected = detectMilestoneCelebration({
      previousStreak: prev.streak,
      nextStreak: streak.currentStreak,
      previousCompletedToday: prev.completedToday,
      nextCompletedToday: streak.completedToday,
      previousUnlockedBadgeIds: prev.unlockedBadgeIds,
      nextBadges: badges,
    });

    milestoneSnapshotRef.current = {
      profileId: activeProfile.id,
      streak: streak.currentStreak,
      completedToday: streak.completedToday,
      unlockedBadgeIds: unlockedIds,
    };

    if (detected) {
      setCelebration(detected);
    }
  }, [activeProfile]);

  // Load cached board syllabus sync metadata whenever active student changes
  useEffect(() => {
    if (!activeProfile) {
      setSyllabusSyncRecord(null);
      setSyllabusSyncError(null);
      return;
    }
    const enabled = loadAutoSyncEnabled(activeProfile.id);
    const cached = loadSyllabusSyncRecord(activeProfile.id);
    setAutoUpdateSyllabusEnabled(enabled);
    setSyllabusSyncRecord(cached);
    setSyllabusSyncError(null);
  }, [activeProfile?.id]);

  // Auto-sync syllabus when enabled and board/class changed, subjects are missing paths, or sync is >7d old
  useEffect(() => {
    if (!activeProfile || !autoUpdateSyllabusEnabled || isSyncingBoardSyllabus) return;
    const cached = loadSyllabusSyncRecord(activeProfile.id);
    const status = evaluateSyllabusSyncStatus(activeProfile, cached);
    if (!status.needsSync) return;

    const dedupeKey = `${activeProfile.id}|${activeProfile.syllabus}|${activeProfile.classLevel}|${activeProfile.subjects.join(',')}|${status.reason}`;
    if (autoCheckedKeyRef.current === dedupeKey) return;
    autoCheckedKeyRef.current = dedupeKey;

    const preserveMastery = status.reason === 'stale' || status.reason === 'missing_subjects';
    void runBoardSyllabusSync(activeProfile, {
      subjectsOverride:
        status.reason === 'missing_subjects' ? status.missingSubjects : undefined,
      preserveMastery,
    });
  }, [
    activeProfile?.id,
    activeProfile?.syllabus,
    activeProfile?.classLevel,
    activeProfile?.subjects.join('|'),
    autoUpdateSyllabusEnabled,
  ]);

  const updateActiveProfile = (updater: (profile: StudentProfile) => StudentProfile) => {
    if (firebaseUser) {
      setCloudProfile((prev) => (prev ? updater(prev) : prev));
      return;
    }
    if (!activeLocalId) return;
    setProfiles((prev) => prev.map((p) => (p.id === activeLocalId ? updater(p) : p)));
  };

  const persistPathIfAuthenticated = (subjectPath: SubjectPath) => {
    if (!firebaseUser) return;
    saveSubjectPathDoc(firebaseUser.uid, subjectPath).catch((err) => {
      console.error('Failed to sync subject path:', err);
      setSyncNotice('Changes are active locally; cloud sync will retry on next update.');
    });
  };

  const persistCompletedDatesIfAuthenticated = (completedDates: string[]) => {
    if (!firebaseUser) return;
    saveStudentCompletedDatesDoc(firebaseUser.uid, completedDates).catch((err) => {
      console.error('Failed to sync study streak:', err);
    });
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    setSyncNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsProfileModalOpen(false);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before finishing. Try again when ready.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Your browser blocked the Google sign-in popup. Allow popups for this page and try again.'
        );
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to complete Google sign-in right now.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setIsProfileModalOpen(false);
    setSyncNotice(null);
    try {
      await signOut(auth);
      setCloudProfile(null);
      setGuestMode(false);
      setActiveLocalId(null);
      setActiveView('paths');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to sign out cleanly.');
    }
  };

  const handleLoadSample = () => {
    setOnboardingError(null);
    setAuthError(null);
    setGuestMode(true);

    const existingSample = profiles.find((p) => p.id === 'sample-aarav-class10');
    if (existingSample) {
      setActiveLocalId(existingSample.id);
      setActiveSubject(existingSample.subjects[0] ?? 'Mathematics');
      setSelectedModuleId(
        existingSample.paths[existingSample.subjects[0]]?.modules[1]?.id ?? null
      );
      setActiveView('paths');
      return;
    }

    const sample = createSampleStudentProfile();
    setProfiles((prev) => [sample, ...prev]);
    setActiveLocalId(sample.id);
    setActiveSubject(sample.subjects[0]);
    setSelectedModuleId(sample.paths[sample.subjects[0]]?.modules[1]?.id ?? null);
    setActiveView('paths');
  };

  const handleGenerateProfile = async (input: {
    name: string;
    classLevel: string;
    syllabus: string;
    language: string;
    subjects: string[];
    goal: StudyGoal;
    dailyMinutes: StudyPace;
  }) => {
    setIsGeneratingProfile(true);
    setOnboardingError(null);
    setSyncNotice(null);
    try {
      const selectedLanguage = input.language || DEFAULT_LANGUAGE;
      const generatedPaths = await generateLearningPathsApi({
        studentName: input.name,
        classLevel: input.classLevel,
        syllabus: input.syllabus,
        language: selectedLanguage,
        subjects: input.subjects,
        goal: input.goal,
        dailyMinutes: input.dailyMinutes,
      });

      const pathsRecord: Record<string, SubjectPath> = {};
      for (const path of generatedPaths) {
        pathsRecord[path.subject] = path;
      }

      const initialTimetable = generateStudyTimetable(input.subjects, input.dailyMinutes);
      const initialCreatedAt = new Date().toISOString();
      const initialSubscription = createInitialTrialSubscription(initialCreatedAt);

      if (firebaseUser) {
        const newCloudProfile: StudentProfile = {
          id: firebaseUser.uid,
          name: input.name,
          email: firebaseUser.email ?? undefined,
          classLevel: input.classLevel,
          syllabus: input.syllabus,
          language: selectedLanguage,
          theme: themePreference,
          subjects: input.subjects,
          goal: input.goal,
          dailyMinutes: input.dailyMinutes,
          timetable: initialTimetable,
          completedDates: [],
          youtubeClasses: [],
          subscription: initialSubscription,
          paths: pathsRecord,
          tutorHistory: {},
          createdAt: initialCreatedAt,
        };

        await createOrUpdateStudentAccountDoc(firebaseUser.uid, firebaseUser.email ?? '', {
          name: input.name,
          classLevel: input.classLevel,
          syllabus: input.syllabus,
          language: selectedLanguage,
          theme: themePreference,
          subjects: input.subjects,
          goal: input.goal,
          dailyMinutes: input.dailyMinutes,
          timetable: initialTimetable,
          completedDates: [],
          subscription: initialSubscription,
        });

        await Promise.all(
          Object.values(pathsRecord).map((path) => saveSubjectPathDoc(firebaseUser.uid, path))
        );

        setCloudProfile(newCloudProfile);
        setActiveSubject(newCloudProfile.subjects[0]);
        setSelectedModuleId(pathsRecord[newCloudProfile.subjects[0]]?.modules[0]?.id ?? null);
        setActiveView('paths');
      } else {
        const newProfile: StudentProfile = {
          id: `student-${Date.now()}`,
          name: input.name,
          classLevel: input.classLevel,
          syllabus: input.syllabus,
          language: selectedLanguage,
          theme: themePreference,
          subjects: input.subjects,
          goal: input.goal,
          dailyMinutes: input.dailyMinutes,
          timetable: initialTimetable,
          completedDates: [],
          youtubeClasses: [],
          subscription: initialSubscription,
          paths: pathsRecord,
          tutorHistory: {},
          createdAt: initialCreatedAt,
        };

        setGuestMode(true);
        setProfiles((prev) => [newProfile, ...prev]);
        setActiveLocalId(newProfile.id);
        setActiveSubject(newProfile.subjects[0]);
        setSelectedModuleId(pathsRecord[newProfile.subjects[0]]?.modules[0]?.id ?? null);
        setActiveView('paths');
      }
    } catch (err) {
      setOnboardingError(
        err instanceof Error ? err.message : 'Unable to generate learning paths.'
      );
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleSelectExistingProfile = (profileId: string) => {
    const found = profiles.find((p) => p.id === profileId);
    if (!found) return;
    setGuestMode(true);
    setActiveLocalId(found.id);
    if (found.theme) {
      setThemePreference(normalizeThemePreference(found.theme));
    }
    const firstSub = found.subjects[0] ?? '';
    setActiveSubject(firstSub);
    setSelectedModuleId(found.paths[firstSub]?.modules[0]?.id ?? null);
    setActiveView('paths');
  };

  const handleSelectSubject = (subject: string) => {
    setActiveSubject(subject);
    setAdaptError(null);
    setLessonError(null);
    setQuizError(null);
    setTutorError(null);
    setFailedTutorRequest(null);
    const nextMod =
      activeProfile?.paths[subject]?.modules.find((m) => m.status === 'in_progress')?.id ??
      activeProfile?.paths[subject]?.modules[0]?.id ??
      null;
    setSelectedModuleId(nextMod);
  };

  const handleToggleMastery = (subject: string, moduleId: string) => {
    if (!activeProfile) return;
    const targetPath = activeProfile.paths[subject];
    if (!targetPath) return;
    const prevStatus = targetPath.modules.find((m) => m.id === moduleId)?.status;
    const nextPath = toggleModuleMastery(targetPath, moduleId);
    const newlyMastered = prevStatus !== 'mastered';
    const nextCompletedDates = newlyMastered
      ? recordModuleCompletionDate(activeProfile.completedDates)
      : activeProfile.completedDates ?? [];

    updateActiveProfile((p) => ({
      ...p,
      completedDates: nextCompletedDates,
      paths: {
        ...p.paths,
        [subject]: nextPath,
      },
    }));
    persistPathIfAuthenticated(nextPath);
    if (newlyMastered) {
      persistCompletedDatesIfAuthenticated(nextCompletedDates);
    }
  };

  const handleSaveModuleNotes = (subject: string, moduleId: string, rawNotes: string) => {
    if (!activeProfile) return;
    const targetPath = activeProfile.paths[subject];
    if (!targetPath) return;

    const clampedNotes = rawNotes.slice(0, 6000);
    const nowIso = new Date().toISOString();
    let changed = false;

    const nextModules = targetPath.modules.map((mod) => {
      if (mod.id !== moduleId) return mod;
      if ((mod.studentNotes ?? '') === clampedNotes) return mod;
      changed = true;
      return {
        ...mod,
        studentNotes: clampedNotes,
        studentNotesUpdatedAt: nowIso,
      };
    });

    if (!changed) return;

    const nextPath: SubjectPath = {
      ...targetPath,
      modules: nextModules,
      updatedAt: nowIso,
    };

    updateActiveProfile((p) => ({
      ...p,
      paths: {
        ...p.paths,
        [subject]: nextPath,
      },
    }));
    persistPathIfAuthenticated(nextPath);
  };

  const handleAdaptOrGeneratePath = async (subject: string, note?: string) => {
    if (!activeProfile) return;
    setAdaptingSubject(subject);
    setAdaptError(null);
    try {
      const [generated] = await generateLearningPathsApi({
        studentName: activeProfile.name,
        classLevel: activeProfile.classLevel,
        syllabus: activeProfile.syllabus,
        language: activeProfile.language,
        subjects: [subject],
        goal: activeProfile.goal,
        dailyMinutes: activeProfile.dailyMinutes,
        customNote: note,
      });

      if (generated) {
        updateActiveProfile((p) => ({
          ...p,
          paths: {
            ...p.paths,
            [subject]: generated,
          },
        }));
        setSelectedModuleId(generated.modules[0]?.id ?? null);
        persistPathIfAuthenticated(generated);
      }
    } catch (err) {
      setAdaptError(err instanceof Error ? err.message : `Failed to update ${subject} path.`);
    } finally {
      setAdaptingSubject(null);
    }
  };

  const runBoardSyllabusSync = async (
    targetProfile: StudentProfile,
    options: { subjectsOverride?: string[]; preserveMastery: boolean }
  ) => {
    const subjectsToSync =
      options.subjectsOverride && options.subjectsOverride.length > 0
        ? options.subjectsOverride
        : targetProfile.subjects;
    if (subjectsToSync.length === 0) return;

    const reqId = ++syllabusSyncReqIdRef.current;
    setIsSyncingBoardSyllabus(true);
    setSyllabusSyncError(null);

    try {
      const result = await autoUpdateBoardSyllabusApi({
        studentName: targetProfile.name,
        classLevel: targetProfile.classLevel,
        syllabus: targetProfile.syllabus,
        language: targetProfile.language,
        subjects: subjectsToSync,
        goal: targetProfile.goal,
        dailyMinutes: targetProfile.dailyMinutes,
      });

      if (reqId !== syllabusSyncReqIdRef.current) return;

      const mergedPartial = mergeSyncedSubjectPaths(
        targetProfile.paths,
        result.paths,
        options.preserveMastery
      );

      updateActiveProfile((p) => {
        const nextPaths = {
          ...(options.subjectsOverride ? p.paths : {}),
          ...mergedPartial,
        };
        return {
          ...p,
          paths: nextPaths,
        };
      });

      Object.values(mergedPartial).forEach((path) => {
        persistPathIfAuthenticated(path);
      });

      const firstSubject = targetProfile.subjects[0] ?? '';
      const activePathAfter = mergedPartial[activeSubject] ?? mergedPartial[firstSubject];
      if (activePathAfter?.modules[0]) {
        const nextMod =
          activePathAfter.modules.find((m) => m.status === 'in_progress') ??
          activePathAfter.modules[0];
        setSelectedModuleId(nextMod.id);
      }

      const record: BoardSyllabusSyncRecord = {
        board: targetProfile.syllabus,
        classLevel: targetProfile.classLevel,
        academicSession: result.academicSession || 'Latest Session',
        boardAuthority: result.boardAuthority || targetProfile.syllabus,
        summary: result.summary || '',
        highlights: Array.isArray(result.highlights) ? result.highlights : [],
        sources: Array.isArray(result.sources) ? result.sources : [],
        groundedWithSearch: Boolean(result.groundedWithSearch),
        syncedAt: result.syncedAt || new Date().toISOString(),
        autoUpdateEnabled: loadAutoSyncEnabled(targetProfile.id),
        subjectCount: targetProfile.subjects.length,
      };
      saveSyllabusSyncRecord(targetProfile.id, record);
      setSyllabusSyncRecord(record);
    } catch (err) {
      if (reqId !== syllabusSyncReqIdRef.current) return;
      setSyllabusSyncError(
        err instanceof Error
          ? err.message
          : `Unable to auto-update syllabus for ${targetProfile.syllabus}.`
      );
    } finally {
      if (reqId === syllabusSyncReqIdRef.current) {
        setIsSyncingBoardSyllabus(false);
      }
    }
  };

  const handleToggleAutoUpdateSyllabus = (enabled: boolean) => {
    setAutoUpdateSyllabusEnabled(enabled);
    if (!activeProfile) return;
    saveAutoSyncEnabled(activeProfile.id, enabled);
    if (syllabusSyncRecord) {
      const updated = { ...syllabusSyncRecord, autoUpdateEnabled: enabled };
      saveSyllabusSyncRecord(activeProfile.id, updated);
      setSyllabusSyncRecord(updated);
    }
  };

  const handleQuickSwitchBoard = (nextBoard: string) => {
    if (!activeProfile) return;
    const cleanBoard = nextBoard.trim().slice(0, 60);
    if (!cleanBoard || cleanBoard === activeProfile.syllabus) return;

    const updatedProfile: StudentProfile = {
      ...activeProfile,
      syllabus: cleanBoard,
    };

    updateActiveProfile((p) => ({
      ...p,
      syllabus: cleanBoard,
    }));

    if (firebaseUser) {
      createOrUpdateStudentAccountDoc(firebaseUser.uid, firebaseUser.email ?? '', {
        name: updatedProfile.name,
        classLevel: updatedProfile.classLevel,
        syllabus: cleanBoard,
        language: updatedProfile.language || DEFAULT_LANGUAGE,
        subjects: updatedProfile.subjects,
        goal: updatedProfile.goal,
        dailyMinutes: updatedProfile.dailyMinutes,
        timetable: updatedProfile.timetable,
      }).catch((err) => {
        console.error('Failed to sync switched syllabus board:', err);
      });
    }

    autoCheckedKeyRef.current = `${updatedProfile.id}|${cleanBoard}|${updatedProfile.classLevel}|${updatedProfile.subjects.join(',')}|board_changed`;
    void runBoardSyllabusSync(updatedProfile, { preserveMastery: false });
  };

  const handleSyncBoardSyllabusNow = () => {
    if (!activeProfile || isSyncingBoardSyllabus) return;
    const sameBoard =
      !syllabusSyncRecord ||
      (syllabusSyncRecord.board ?? '').trim().toLowerCase() ===
        (activeProfile.syllabus ?? '').trim().toLowerCase();
    void runBoardSyllabusSync(activeProfile, { preserveMastery: sameBoard });
  };

  const handleGenerateLesson = async (
    subject: string,
    module: LearningModule,
    mode: 'standard' | 'simpler' | 'real_world'
  ) => {
    if (!activeProfile) return;
    setIsLoadingLesson(true);
    setLessonError(null);
    try {
      const lesson = await generateLessonApi({
        classLevel: activeProfile.classLevel,
        syllabus: activeProfile.syllabus,
        language: activeProfile.language,
        subject,
        moduleTitle: module.title,
        stage: module.stage,
        objectives: module.objectives,
        goal: activeProfile.goal,
        mode,
      });

      const currentPath = activeProfile.paths[subject];
      if (currentPath) {
        const updatedPath: SubjectPath = {
          ...currentPath,
          modules: currentPath.modules.map((m) => (m.id === module.id ? { ...m, lesson } : m)),
          updatedAt: new Date().toISOString(),
        };
        updateActiveProfile((p) => ({
          ...p,
          paths: {
            ...p.paths,
            [subject]: updatedPath,
          },
        }));
        persistPathIfAuthenticated(updatedPath);
      }
    } catch (err) {
      setLessonError(err instanceof Error ? err.message : 'Unable to generate tailored study kit.');
    } finally {
      setIsLoadingLesson(false);
    }
  };

  const handleGenerateQuiz = async (subject: string, module: LearningModule) => {
    if (!activeProfile) return;
    setIsGeneratingQuiz(true);
    setQuizError(null);
    try {
      const questions = await generateQuizApi({
        classLevel: activeProfile.classLevel,
        syllabus: activeProfile.syllabus,
        language: activeProfile.language,
        subject,
        moduleTitle: module.title,
        concepts: module.concepts,
        count: 50,
      });

      const currentPath = activeProfile.paths[subject];
      if (currentPath) {
        const updatedPath: SubjectPath = {
          ...currentPath,
          modules: currentPath.modules.map((m) =>
            m.id === module.id ? { ...m, quiz: questions } : m
          ),
          updatedAt: new Date().toISOString(),
        };
        updateActiveProfile((p) => ({
          ...p,
          paths: {
            ...p.paths,
            [subject]: updatedPath,
          },
        }));
        persistPathIfAuthenticated(updatedPath);
      }
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Unable to generate quiz.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleRecordQuizScore = (subject: string, moduleId: string, percentage: number) => {
    if (!activeProfile) return;
    const currentPath = activeProfile.paths[subject];
    if (!currentPath) return;
    const updatedPath = recordQuizMastery(currentPath, moduleId, percentage);
    const passedModule = percentage >= 70;
    const nextCompletedDates = passedModule
      ? recordModuleCompletionDate(activeProfile.completedDates)
      : activeProfile.completedDates ?? [];

    updateActiveProfile((p) => ({
      ...p,
      completedDates: nextCompletedDates,
      paths: {
        ...p.paths,
        [subject]: updatedPath,
      },
    }));
    persistPathIfAuthenticated(updatedPath);
    if (passedModule) {
      persistCompletedDatesIfAuthenticated(nextCompletedDates);
    }
  };

  const handleLogDailyStudyGoal = () => {
    if (!activeProfile) return;
    const nextCompletedDates = recordModuleCompletionDate(activeProfile.completedDates);
    updateActiveProfile((p) => ({
      ...p,
      completedDates: nextCompletedDates,
    }));
    persistCompletedDatesIfAuthenticated(nextCompletedDates);
  };

  const handleUpdateTimetable = (slots: TimetableSlot[]) => {
    const prevCompletedCount = (activeProfile?.timetable ?? []).filter((s) => s.completed).length;
    const nextCompletedCount = slots.filter((s) => s.completed).length;
    const justCompletedSlot = nextCompletedCount > prevCompletedCount;
    const nextCompletedDates =
      justCompletedSlot && activeProfile
        ? recordModuleCompletionDate(activeProfile.completedDates)
        : activeProfile?.completedDates ?? [];

    updateActiveProfile((p) => ({
      ...p,
      timetable: slots,
      completedDates: justCompletedSlot ? nextCompletedDates : p.completedDates,
    }));
    if (firebaseUser) {
      saveStudentTimetableDoc(firebaseUser.uid, slots).catch((err) => {
        console.error('Failed to sync timetable:', err);
      });
      if (justCompletedSlot) {
        persistCompletedDatesIfAuthenticated(nextCompletedDates);
      }
    }
  };

  const handleSendTutorMessage = async (
    subject: string,
    message: string,
    moduleTitle?: string,
    isRetry = false,
    media?: TutorMediaPayload
  ) => {
    if (!activeProfile) return;
    const subCheck = getSubscriptionState(activeProfile.subscription, activeProfile.createdAt);
    if (!canAccessWorkspaceView('tutor', subCheck)) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    setTutorError(null);
    setFailedTutorRequest(null);

    const trimmedMsg = message.trim();
    const displayContent =
      trimmedMsg ||
      (media?.image && media?.audio
        ? 'Shared a photo and a voice question'
        : media?.image
          ? 'Shared a photo for help'
          : 'Asked a voice question');

    const existingHistory = activeProfile.tutorHistory[subject] ?? [];
    let historyBeforeQuestion = existingHistory;
    let withStudent = existingHistory;

    if (
      isRetry &&
      existingHistory.length > 0 &&
      existingHistory[existingHistory.length - 1].role === 'student'
    ) {
      historyBeforeQuestion = existingHistory.slice(0, -1);
      withStudent = existingHistory;
    } else {
      const studentMsg: TutorMessage = {
        id: `msg-s-${Date.now()}`,
        role: 'student',
        content: displayContent,
        timestamp: new Date().toISOString(),
        imagePreviewUrl: media?.image?.previewUrl,
        hasImage: Boolean(media?.image),
        hasAudio: Boolean(media?.audio),
        audioDurationSec: media?.audio?.durationSec,
      };
      withStudent = [...existingHistory, studentMsg];

      updateActiveProfile((p) => ({
        ...p,
        tutorHistory: {
          ...p.tutorHistory,
          [subject]: withStudent,
        },
      }));
    }

    setIsTutorThinking(true);
    try {
      const reply = await askTutorApi({
        studentName: activeProfile.name,
        classLevel: activeProfile.classLevel,
        syllabus: activeProfile.syllabus,
        language: activeProfile.language,
        subject,
        moduleTitle,
        goal: activeProfile.goal,
        history: historyBeforeQuestion.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        message: trimmedMsg,
        image: media?.image
          ? { mimeType: media.image.mimeType, data: media.image.data }
          : undefined,
        audio: media?.audio
          ? { mimeType: media.audio.mimeType, data: media.audio.data }
          : undefined,
      });

      const tutorMsg: TutorMessage = {
        id: `msg-t-${Date.now()}`,
        role: 'tutor',
        content: reply,
        timestamp: new Date().toISOString(),
      };

      const fullThread = [...withStudent, tutorMsg];

      updateActiveProfile((p) => ({
        ...p,
        tutorHistory: {
          ...p.tutorHistory,
          [subject]: fullThread,
        },
      }));

      if (firebaseUser) {
        saveTutorThreadDoc(firebaseUser.uid, subject, fullThread).catch((err) => {
          console.error('Failed to sync tutor thread:', err);
        });
      }
    } catch (err) {
      setFailedTutorRequest({ subject, message: trimmedMsg, moduleTitle, media });
      setTutorError(err instanceof Error ? err.message : 'Unable to reach Buddy right now.');
    } finally {
      setIsTutorThinking(false);
    }
  };

  const handleRetryTutorMessage = () => {
    if (!failedTutorRequest || isTutorThinking) return;
    handleSendTutorMessage(
      failedTutorRequest.subject,
      failedTutorRequest.message,
      failedTutorRequest.moduleTitle,
      true,
      failedTutorRequest.media
    );
  };

  const handleChangeLanguage = (language: string) => {
    const cleanLang = language.trim() || DEFAULT_LANGUAGE;
    updateActiveProfile((p) => ({
      ...p,
      language: cleanLang,
    }));
    if (firebaseUser && cloudProfile) {
      saveStudentLanguageDoc(firebaseUser.uid, cleanLang).catch((err) => {
        console.error('Failed to sync language preference:', err);
      });
    }
  };

  const handleChangeTheme = (nextTheme: ThemePreference) => {
    const normalized = normalizeThemePreference(nextTheme);
    setThemePreference(normalized);
    if (activeProfile) {
      updateActiveProfile((p) => ({
        ...p,
        theme: normalized,
      }));
    }
    if (firebaseUser && cloudProfile) {
      saveStudentThemeDoc(firebaseUser.uid, normalized).catch((err) => {
        console.error('Failed to sync theme preference:', err);
      });
    }
  };

  const handleToggleTheme = () => {
    handleChangeTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleSaveYouTubeClass = (item: YouTubeClassItem) => {
    updateActiveProfile((p) => {
      const existing = p.youtubeClasses ?? [];
      const idx = existing.findIndex((c) => c.id === item.id);
      const nextList =
        idx >= 0
          ? existing.map((c) => (c.id === item.id ? item : c))
          : [item, ...existing].slice(0, 20);
      return {
        ...p,
        youtubeClasses: nextList,
      };
    });

    if (firebaseUser) {
      saveYouTubeClassDoc(firebaseUser.uid, item).catch((err) => {
        console.error('Failed to sync YouTube class:', err);
      });
    }
  };

  const handleDeleteYouTubeClass = (classId: string) => {
    updateActiveProfile((p) => ({
      ...p,
      youtubeClasses: (p.youtubeClasses ?? []).filter((c) => c.id !== classId),
    }));
    if (firebaseUser) {
      deleteYouTubeClassDoc(firebaseUser.uid, classId).catch((err) => {
        console.error('Failed to delete YouTube class:', err);
      });
    }
  };

  const handleCompleteYouTubeQuiz = (classId: string, percentage: number) => {
    if (!activeProfile) return;
    const existingClass = (activeProfile.youtubeClasses ?? []).find((c) => c.id === classId);
    if (!existingClass) return;

    const updatedClass: YouTubeClassItem = {
      ...existingClass,
      bestQuizScore: Math.max(existingClass.bestQuizScore ?? 0, percentage),
      updatedAt: new Date().toISOString(),
    };
    const passed = percentage >= 70;
    const nextCompletedDates = passed
      ? recordModuleCompletionDate(activeProfile.completedDates)
      : activeProfile.completedDates ?? [];

    updateActiveProfile((p) => ({
      ...p,
      completedDates: nextCompletedDates,
      youtubeClasses: (p.youtubeClasses ?? []).map((c) => (c.id === classId ? updatedClass : c)),
    }));

    if (firebaseUser) {
      saveYouTubeClassDoc(firebaseUser.uid, updatedClass).catch((err) => {
        console.error('Failed to sync YouTube quiz score:', err);
      });
      if (passed) {
        persistCompletedDatesIfAuthenticated(nextCompletedDates);
      }
    }
  };

  const handleUpdateProfileSettings = (updates: {
    name: string;
    classLevel: string;
    syllabus: string;
    language: string;
    theme: ThemePreference;
    subjects: string[];
    goal: StudyGoal;
    dailyMinutes: StudyPace;
  }) => {
    if (!activeProfile) return;
    const nextTheme = normalizeThemePreference(updates.theme);
    setThemePreference(nextTheme);

    const curriculumChanged =
      updates.classLevel !== activeProfile.classLevel ||
      updates.syllabus !== activeProfile.syllabus;

    const { keptPaths, missingSubjects } = mergeSubjectSelections(
      curriculumChanged ? {} : activeProfile.paths,
      updates.subjects
    );

    const nextTimetable =
      updates.dailyMinutes !== activeProfile.dailyMinutes ||
      updates.subjects.join('|') !== activeProfile.subjects.join('|')
        ? generateStudyTimetable(updates.subjects, updates.dailyMinutes)
        : activeProfile.timetable;

    const updatedProfile: StudentProfile = {
      ...activeProfile,
      name: updates.name,
      classLevel: updates.classLevel,
      syllabus: updates.syllabus,
      language: updates.language || DEFAULT_LANGUAGE,
      theme: nextTheme,
      subjects: updates.subjects,
      goal: updates.goal,
      dailyMinutes: updates.dailyMinutes,
      timetable: nextTimetable,
      paths: curriculumChanged ? activeProfile.paths : keptPaths,
    };

    updateActiveProfile((p) => ({
      ...p,
      name: updates.name,
      classLevel: updates.classLevel,
      syllabus: updates.syllabus,
      language: updates.language || DEFAULT_LANGUAGE,
      theme: nextTheme,
      subjects: updates.subjects,
      goal: updates.goal,
      dailyMinutes: updates.dailyMinutes,
      timetable: nextTimetable,
      paths: curriculumChanged ? p.paths : keptPaths,
    }));

    if (firebaseUser) {
      createOrUpdateStudentAccountDoc(firebaseUser.uid, firebaseUser.email ?? '', {
        name: updates.name,
        classLevel: updates.classLevel,
        syllabus: updates.syllabus,
        language: updates.language || DEFAULT_LANGUAGE,
        theme: nextTheme,
        subjects: updates.subjects,
        goal: updates.goal,
        dailyMinutes: updates.dailyMinutes,
        timetable: nextTimetable,
      }).catch((err) => {
        console.error('Failed to sync account settings:', err);
      });
    }

    if (!updates.subjects.includes(activeSubject)) {
      setActiveSubject(updates.subjects[0] ?? '');
      setSelectedModuleId(null);
    }

    if (curriculumChanged) {
      autoCheckedKeyRef.current = `${updatedProfile.id}|${updatedProfile.syllabus}|${updatedProfile.classLevel}|${updatedProfile.subjects.join(',')}|board_changed`;
      void runBoardSyllabusSync(updatedProfile, { preserveMastery: false });
    } else if (missingSubjects.length > 0 && autoUpdateSyllabusEnabled) {
      autoCheckedKeyRef.current = `${updatedProfile.id}|${updatedProfile.syllabus}|${updatedProfile.classLevel}|${updatedProfile.subjects.join(',')}|missing_subjects`;
      void runBoardSyllabusSync(updatedProfile, {
        subjectsOverride: missingSubjects,
        preserveMastery: true,
      });
    }
  };

  const handleSubscriptionActivated = (subscription: StudentSubscription) => {
    updateActiveProfile((p) => ({
      ...p,
      subscription,
    }));
    if (firebaseUser) {
      saveStudentSubscriptionDoc(firebaseUser.uid, subscription).catch((err) => {
        console.error('Failed to sync subscription:', err);
      });
    }
  };

  const handleUpdateReminders = (reminders: StudyReminderSettings) => {
    const safe = ensureReminderSettings(reminders);
    updateActiveProfile((p) => ({
      ...p,
      reminders: safe,
    }));
    if (firebaseUser) {
      saveStudentRemindersDoc(firebaseUser.uid, safe).catch((err) => {
        console.error('Failed to sync study reminders:', err);
      });
    }
  };

  const activeStudyAlerts = useMemo(() => {
    if (!activeProfile) return [];
    return computeSmartStudyAlerts(activeProfile, new Date(alertClockTick));
  }, [activeProfile, alertClockTick]);

  const urgentStudyAlertCount = useMemo(
    () => activeStudyAlerts.filter((a) => a.severity === 'urgent').length,
    [activeStudyAlerts]
  );

  // Background 15-second alert scheduler for due topic reminders and daily study time
  useEffect(() => {
    if (!activeProfile) return;

    const evaluateAlerts = () => {
      const now = new Date();
      setAlertClockTick(now.getTime());

      const settings = ensureReminderSettings(activeProfile.reminders);
      if (!settings.enabled) return;

      // 1. Check scheduled topic completion reminders that have just come due
      const dueItem = settings.topicAlerts.find((item) => {
        if (item.completed || item.notifiedAt) return false;
        const dueMs = Date.parse(item.dueAt);
        if (Number.isNaN(dueMs)) return false;
        return dueMs <= now.getTime() && !firedAlertIdsRef.current.has(item.id);
      });

      if (dueItem) {
        firedAlertIdsRef.current.add(dueItem.id);
        const toast: ActiveStudyAlert = {
          id: `live-${dueItem.id}`,
          kind: 'scheduled_topic',
          severity: 'urgent',
          title: `Complete: ${dueItem.topicTitle}`,
          message: dueItem.note
            ? `${dueItem.subject} · ${dueItem.note}`
            : `Your scheduled completion time for ${dueItem.subject} is here.`,
          subject: dueItem.subject,
          moduleId: dueItem.moduleId,
          reminderId: dueItem.id,
          dueLabel: formatDueRelative(dueItem.dueAt, now),
        };
        setLiveToastAlert(toast);
        if (settings.soundEnabled) playStudyAlertChime();
        if (settings.browserNotifications) {
          sendBrowserStudyNotification(toast.title, toast.message);
        }

        const marked: StudyReminderSettings = {
          ...settings,
          topicAlerts: settings.topicAlerts.map((r) =>
            r.id === dueItem.id ? { ...r, notifiedAt: now.toISOString() } : r
          ),
        };
        handleUpdateReminders(marked);
        return;
      }

      // 2. Check daily study time alert once per calendar day
      const streak = calculateStudyStreak(activeProfile.completedDates, now);
      if (!streak.completedToday) {
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`;
        const todayKey = getLocalDateKey(now);
        const storageKey = `pathwise_daily_alert_${activeProfile.id}_${todayKey}`;
        let alreadyFiredToday = false;
        try {
          alreadyFiredToday = window.localStorage.getItem(storageKey) === '1';
        } catch {
          alreadyFiredToday = false;
        }

        if (currentHHMM === settings.dailyStudyTime && !alreadyFiredToday) {
          try {
            window.localStorage.setItem(storageKey, '1');
          } catch {
            // Ignore storage errors
          }
          const toast: ActiveStudyAlert = {
            id: `daily-live-${todayKey}`,
            kind: 'daily_study',
            severity: 'urgent',
            title:
              streak.currentStreak > 0
                ? `Study Time — Protect your ${streak.currentStreak}-day streak`
                : 'Daily Study Time Has Arrived',
            message: `Start your ${activeProfile.dailyMinutes}-minute session and complete a topic today.`,
            dueLabel: 'Now',
          };
          setLiveToastAlert(toast);
          if (settings.soundEnabled) playStudyAlertChime();
          if (settings.browserNotifications) {
            sendBrowserStudyNotification(toast.title, toast.message);
          }
        }
      }
    };

    evaluateAlerts();
    const interval = window.setInterval(evaluateAlerts, 15_000);
    return () => window.clearInterval(interval);
  }, [activeProfile]);

  const handleOpenAlertTarget = (alert: ActiveStudyAlert) => {
    setIsAlertsDrawerOpen(false);
    setLiveToastAlert(null);

    if (alert.kind === 'timetable_slot') {
      setActiveView('planner');
      return;
    }

    if (alert.subject && activeProfile?.subjects.includes(alert.subject)) {
      setActiveSubject(alert.subject);
      if (alert.moduleId) {
        setSelectedModuleId(alert.moduleId);
        setLessonError(null);
        setActiveView('study');
        return;
      }
      const nextMod = activeProfile.paths[alert.subject]?.modules.find(
        (m) => m.status !== 'mastered'
      );
      if (nextMod) {
        setSelectedModuleId(nextMod.id);
        setLessonError(null);
        setActiveView('study');
        return;
      }
    }

    setActiveView('paths');
  };

  const handleCompleteAlertTarget = (alert: ActiveStudyAlert) => {
    if (!activeProfile) return;

    if (alert.reminderId) {
      const settings = ensureReminderSettings(activeProfile.reminders);
      handleUpdateReminders({
        ...settings,
        topicAlerts: settings.topicAlerts.map((item) =>
          item.id === alert.reminderId ? { ...item, completed: true } : item
        ),
      });
    }

    if (alert.subject && alert.moduleId) {
      const mod = activeProfile.paths[alert.subject]?.modules.find(
        (m) => m.id === alert.moduleId
      );
      if (mod && mod.status !== 'mastered') {
        handleToggleMastery(alert.subject, alert.moduleId);
      }
    }

    setLiveToastAlert(null);
  };

  const handleSnoozeReminderFromToast = (reminderId: string) => {
    if (!activeProfile) return;
    const settings = ensureReminderSettings(activeProfile.reminders);
    const snoozedIso = new Date(Date.now() + 15 * 60_000).toISOString();
    firedAlertIdsRef.current.delete(reminderId);
    handleUpdateReminders({
      ...settings,
      topicAlerts: settings.topicAlerts.map((item) =>
        item.id === reminderId
          ? { ...item, dueAt: snoozedIso, completed: false, notifiedAt: undefined }
          : item
      ),
    });
    setLiveToastAlert(null);
  };

  const handleTriggerTestAlert = () => {
    if (!activeProfile) return;
    const firstSubject = activeSubject || activeProfile.subjects[0] || 'Mathematics';
    const nextMod =
      activeProfile.paths[firstSubject]?.modules.find((m) => m.status !== 'mastered') ??
      activeProfile.paths[firstSubject]?.modules[0];

    const toast: ActiveStudyAlert = {
      id: `test-${Date.now()}`,
      kind: 'test_alert',
      severity: 'urgent',
      title: nextMod ? `Time to complete: ${nextMod.title}` : 'Time to start your study session',
      message: nextMod
        ? `${firstSubject} · Estimated ${nextMod.estimatedMinutes} min left to master this topic.`
        : `Your Pathwise study alerts and topic reminders are active.`,
      subject: firstSubject,
      moduleId: nextMod?.id,
      dueLabel: 'Just now',
    };
    setLiveToastAlert(toast);

    const settings = ensureReminderSettings(activeProfile.reminders);
    if (settings.browserNotifications) {
      sendBrowserStudyNotification(toast.title, toast.message);
    }
  };

  const handleScheduleTopicAlertFromPath = (subject: string, module: LearningModule) => {
    setAlertPrefillTopic({
      subject,
      moduleId: module.id,
      topicTitle: module.title,
    });
    setIsAlertsDrawerOpen(true);
  };

  const handleSchedule147Alerts = (newAlerts: TopicReminderItem[]) => {
    if (!activeProfile || newAlerts.length === 0) return;
    const current = ensureReminderSettings(activeProfile.reminders);
    const existingIds = new Set(current.topicAlerts.map((a) => a.id));
    const uniqueToAdd = newAlerts.filter((a) => !existingIds.has(a.id));
    if (uniqueToAdd.length === 0) return;
    handleUpdateReminders({
      ...current,
      enabled: true,
      topicAlerts: [...uniqueToAdd, ...current.topicAlerts].slice(0, 20),
    });
  };

  const showAuthGate = !firebaseUser && !guestMode;
  const showOnboarding = (Boolean(firebaseUser) && !cloudProfile) || (guestMode && !activeProfile);
  const activeSubState = activeProfile
    ? getSubscriptionState(activeProfile.subscription, activeProfile.createdAt)
    : null;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[var(--pw-bg)] text-[var(--pw-text)] transition-colors duration-200">
      <TopBar
        activeProfile={activeProfile}
        activeView={activeView}
        isAuthenticated={Boolean(firebaseUser)}
        isAuthScreen={showAuthGate}
        alertCount={activeStudyAlerts.length}
        urgentAlertCount={urgentStudyAlertCount}
        resolvedTheme={resolvedTheme}
        onToggleTheme={handleToggleTheme}
        onSelectView={setActiveView}
        onChangeLanguage={handleChangeLanguage}
        onOpenAlerts={() => {
          setAlertPrefillTopic(null);
          setIsAlertsDrawerOpen(true);
        }}
        onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onLoadSample={handleLoadSample}
        onOpenAuth={() => {
          setGuestMode(false);
          setActiveLocalId(null);
        }}
      />

      {syncNotice && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/80 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-200">
          {syncNotice}
        </div>
      )}

      <div className="flex-1">
        {!authReady || isLoadingCloudProfile ? (
          <main className="max-w-3xl mx-auto px-4 py-24 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#0284C7] dark:text-sky-400 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {isLoadingCloudProfile
                ? 'Loading your private study workspace...'
                : 'Checking student session...'}
            </p>
          </main>
        ) : showAuthGate ? (
          <AuthGate
            isSigningIn={isSigningIn}
            authError={authError}
            onGoogleSignIn={handleGoogleSignIn}
            onContinueGuestSample={handleLoadSample}
          />
        ) : showOnboarding ? (
          <OnboardingStudio
            defaultName={firebaseUser?.displayName ?? ''}
            signedInEmail={firebaseUser?.email ?? null}
            existingProfiles={profiles}
            isGenerating={isGeneratingProfile}
            error={onboardingError}
            onGenerateProfile={handleGenerateProfile}
            onSelectExistingProfile={handleSelectExistingProfile}
            onLoadSample={handleLoadSample}
          />
        ) : activeProfile && activeView === 'paths' ? (
          <LearningPathWorkspace
            profile={activeProfile}
            activeSubject={activeSubject}
            selectedModuleId={selectedModuleId}
            adaptingSubject={adaptingSubject}
            adaptError={adaptError}
            onSelectSubject={handleSelectSubject}
            onSelectModule={setSelectedModuleId}
            onOpenStudyDesk={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setLessonError(null);
              setActiveView('study');
            }}
            onOpenQuiz={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setQuizError(null);
              setActiveView('practice');
            }}
            onToggleMastery={handleToggleMastery}
            onAdaptSubjectPath={(subject, note) => handleAdaptOrGeneratePath(subject, note)}
            onGenerateMissingPath={(subject) => handleAdaptOrGeneratePath(subject)}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
            onScheduleTopicAlert={handleScheduleTopicAlertFromPath}
            onLogDailyStudyGoal={handleLogDailyStudyGoal}
            onTriggerCelebration={(payload) => setCelebration(payload)}
            syllabusSyncRecord={syllabusSyncRecord}
            autoUpdateSyllabusEnabled={autoUpdateSyllabusEnabled}
            isSyncingBoardSyllabus={isSyncingBoardSyllabus}
            syllabusSyncError={syllabusSyncError}
            onQuickSwitchBoard={handleQuickSwitchBoard}
            onToggleAutoUpdateSyllabus={handleToggleAutoUpdateSyllabus}
            onSyncBoardSyllabusNow={handleSyncBoardSyllabusNow}
          />
        ) : activeProfile && activeView === 'study' ? (
          <StudyKit
            profile={activeProfile}
            activeSubject={activeSubject}
            activeModuleId={selectedModuleId}
            isLoadingLesson={isLoadingLesson}
            lessonError={lessonError}
            onSelectSubjectAndModule={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setLessonError(null);
            }}
            onGenerateLesson={handleGenerateLesson}
            onToggleMastery={handleToggleMastery}
            onSaveModuleNotes={handleSaveModuleNotes}
            onGoToPractice={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setActiveView('practice');
            }}
            onGoToTutor={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setActiveView('tutor');
            }}
            onBackToPaths={() => setActiveView('paths')}
          />
        ) : activeProfile && activeView === 'revision' ? (
          <RevisionHub
            profile={activeProfile}
            activeSubject={activeSubject}
            onSelectSubject={handleSelectSubject}
            onOpenStudyDesk={(subject, moduleId) => {
              setActiveSubject(subject);
              if (moduleId) setSelectedModuleId(moduleId);
              setLessonError(null);
              setActiveView('study');
            }}
            onOpenPractice={(subject, moduleId) => {
              setActiveSubject(subject);
              if (moduleId) setSelectedModuleId(moduleId);
              setQuizError(null);
              setActiveView('practice');
            }}
            onSchedule147Alerts={handleSchedule147Alerts}
          />
        ) : activeProfile && activeView === 'youtube' ? (
          <YouTubeClassStudio
            profile={activeProfile}
            activeSubject={activeSubject}
            onChangeLanguage={handleChangeLanguage}
            onSaveYouTubeClass={handleSaveYouTubeClass}
            onDeleteYouTubeClass={handleDeleteYouTubeClass}
            onCompleteYouTubeQuiz={handleCompleteYouTubeQuiz}
          />
        ) : activeProfile && activeView === 'combine' ? (
          activeSubState && !canAccessWorkspaceView('combine', activeSubState) ? (
            <PremiumFeatureGate
              feature="combine"
              trialEndDateLabel={activeSubState.trialEndDateLabel}
              onUnlockPremium={() => setIsSubscriptionModalOpen(true)}
              onBackToPaths={() => setActiveView('paths')}
            />
          ) : (
            <CombineStudyRoom
              profile={activeProfile}
              activeSubject={activeSubject}
              initialRoomCode={inviteRoomCode}
            />
          )
        ) : activeProfile && activeView === 'practice' ? (
          <PracticeStudio
            profile={activeProfile}
            activeSubject={activeSubject}
            activeModuleId={selectedModuleId}
            isGeneratingQuiz={isGeneratingQuiz}
            quizError={quizError}
            onSelectSubjectAndModule={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setQuizError(null);
            }}
            onGenerateQuiz={handleGenerateQuiz}
            onRecordScore={handleRecordQuizScore}
            onOpenStudyKit={(subject, moduleId) => {
              setActiveSubject(subject);
              setSelectedModuleId(moduleId);
              setActiveView('study');
            }}
          />
        ) : activeProfile && activeView === 'planner' ? (
          <PlannerMotivation
            profile={activeProfile}
            activeSubject={activeSubject}
            activeAlerts={activeStudyAlerts}
            onUpdateTimetable={handleUpdateTimetable}
            onUpdateReminders={handleUpdateReminders}
            onOpenAlertTarget={handleOpenAlertTarget}
            onCompleteAlertTarget={handleCompleteAlertTarget}
            onTriggerTestAlert={handleTriggerTestAlert}
          />
        ) : activeProfile ? (
          activeSubState && !canAccessWorkspaceView('tutor', activeSubState) ? (
            <PremiumFeatureGate
              feature="tutor"
              trialEndDateLabel={activeSubState.trialEndDateLabel}
              onUnlockPremium={() => setIsSubscriptionModalOpen(true)}
              onBackToPaths={() => setActiveView('paths')}
            />
          ) : (
            <AiTutor
              profile={activeProfile}
              activeSubject={activeSubject}
              activeModuleId={selectedModuleId}
              isThinking={isTutorThinking}
              tutorError={tutorError}
              canRetry={Boolean(failedTutorRequest && failedTutorRequest.subject === activeSubject)}
              onSelectSubject={handleSelectSubject}
              onSendMessage={(subject, message, moduleTitle, media) =>
                handleSendTutorMessage(subject, message, moduleTitle, false, media)
              }
              onRetryLastMessage={handleRetryTutorMessage}
            />
          )
        ) : null}
      </div>

      <footer className="border-t border-[var(--pw-border)] bg-[var(--pw-surface)] mt-12 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Pathwise · Personalized AI Study Companion</span>
          <span>
            {firebaseUser
              ? `Signed in securely as ${firebaseUser.email}`
              : 'Guest preview mode · Sign in with Google to sync privately across devices.'}
          </span>
        </div>
      </footer>

      {isProfileModalOpen && activeProfile && (
        <ProfileModal
          profiles={profiles}
          activeProfile={activeProfile}
          isAuthenticated={Boolean(firebaseUser)}
          authEmail={firebaseUser?.email ?? null}
          themePreference={themePreference}
          onChangeTheme={handleChangeTheme}
          onClose={() => setIsProfileModalOpen(false)}
          onUpdateActiveProfile={handleUpdateProfileSettings}
          onSwitchProfile={handleSelectExistingProfile}
          onCreateNewStudent={() => {
            setIsProfileModalOpen(false);
            setGuestMode(true);
            setActiveLocalId(null);
            setOnboardingError(null);
          }}
          onSignOut={handleSignOut}
          onSignInToSync={handleGoogleSignIn}
          onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
        />
      )}

      {activeProfile && isSubscriptionModalOpen && (
        <SubscriptionModal
          profile={activeProfile}
          locked={false}
          onClose={() => setIsSubscriptionModalOpen(false)}
          onSignOut={firebaseUser ? handleSignOut : undefined}
          onActivated={handleSubscriptionActivated}
        />
      )}

      {activeProfile && isAlertsDrawerOpen && (
        <StudyAlertsPanel
          profile={activeProfile}
          activeAlerts={activeStudyAlerts}
          prefillTopic={alertPrefillTopic}
          onClose={() => {
            setIsAlertsDrawerOpen(false);
            setAlertPrefillTopic(null);
          }}
          onUpdateReminders={handleUpdateReminders}
          onOpenAlertTarget={handleOpenAlertTarget}
          onCompleteAlertTarget={handleCompleteAlertTarget}
          onTriggerTestAlert={handleTriggerTestAlert}
        />
      )}

      {activeProfile && liveToastAlert && (
        <StudyAlertToast
          alert={liveToastAlert}
          onDismiss={() => setLiveToastAlert(null)}
          onOpenTopic={handleOpenAlertTarget}
          onSnooze={handleSnoozeReminderFromToast}
          onMarkDone={handleCompleteAlertTarget}
        />
      )}

      <ConfettiCelebration
        celebration={celebration}
        onDismiss={() => setCelebration(null)}
      />
    </div>
  );
}
