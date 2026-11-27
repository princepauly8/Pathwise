import React, { useState } from 'react';
import { Check, LogIn, LogOut, Monitor, Moon, Plus, ShieldCheck, Sparkles, Sun, UserPlus, X } from 'lucide-react';
import type { StudentProfile, StudyGoal, StudyPace, ThemePreference } from '../types/study';
import {
  CLASS_LEVELS,
  STUDY_GOALS,
  SYLLABUS_BOARDS,
  getRecommendedSubjectsForClass,
  normalizeSubjectName,
  validateStudentSetup,
} from '../utils/learningPath';
import { DEFAULT_LANGUAGE } from '../utils/languages';
import {
  SUBSCRIPTION_DURATION_YEARS,
  SUBSCRIPTION_PRICE_INR,
  formatInrAmount,
  getSubscriptionState,
} from '../utils/subscription';
import { STATE_BOARD_PRESETS } from '../utils/syllabusSync';
import { LanguageSelect } from './LanguageSelect';

interface ProfileModalProps {
  profiles: StudentProfile[];
  activeProfile: StudentProfile;
  isAuthenticated: boolean;
  authEmail: string | null;
  themePreference: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
  onClose: () => void;
  onUpdateActiveProfile: (updates: {
    name: string;
    classLevel: string;
    syllabus: string;
    language: string;
    theme: ThemePreference;
    subjects: string[];
    goal: StudyGoal;
    dailyMinutes: StudyPace;
  }) => void;
  onSwitchProfile: (profileId: string) => void;
  onCreateNewStudent: () => void;
  onSignOut: () => void;
  onSignInToSync: () => void;
  onOpenSubscription: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profiles,
  activeProfile,
  isAuthenticated,
  authEmail,
  themePreference,
  onChangeTheme,
  onClose,
  onUpdateActiveProfile,
  onSwitchProfile,
  onCreateNewStudent,
  onSignOut,
  onSignInToSync,
  onOpenSubscription,
}) => {
  const [name, setName] = useState(activeProfile.name);
  const [classLevel, setClassLevel] = useState(activeProfile.classLevel);
  const isKnownBoard = SYLLABUS_BOARDS.some((b) => b.id === activeProfile.syllabus);
  const [syllabus, setSyllabus] = useState(isKnownBoard ? activeProfile.syllabus : 'Custom');
  const [customSyllabus, setCustomSyllabus] = useState(isKnownBoard ? '' : activeProfile.syllabus);
  const [language, setLanguage] = useState(activeProfile.language || DEFAULT_LANGUAGE);
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(themePreference);

  const [subjects, setSubjects] = useState<string[]>(activeProfile.subjects);
  const [customSubject, setCustomSubject] = useState('');
  const [goal, setGoal] = useState<StudyGoal>(activeProfile.goal);
  const [dailyMinutes, setDailyMinutes] = useState<StudyPace>(activeProfile.dailyMinutes);
  const [errors, setErrors] = useState<{
    name?: string;
    classLevel?: string;
    syllabus?: string;
    subjects?: string;
  }>({});

  const effectiveSyllabus = syllabus === 'Custom' ? customSyllabus.trim() : syllabus;
  const recommendedSubjects = getRecommendedSubjectsForClass(classLevel);
  const customSelected = subjects.filter((s) => !recommendedSubjects.includes(s));

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
    setErrors((prev) => ({ ...prev, subjects: undefined }));
  };

  const handleAddCustom = () => {
    const clean = normalizeSubjectName(customSubject);
    if (!clean) return;
    if (!subjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSubjects((prev) => [...prev, clean]);
      setErrors((prev) => ({ ...prev, subjects: undefined }));
    }
    setCustomSubject('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateStudentSetup({
      name,
      classLevel,
      syllabus: effectiveSyllabus,
      subjects,
    });
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    onUpdateActiveProfile({
      name: name.trim(),
      classLevel,
      syllabus: effectiveSyllabus,
      language,
      theme: selectedTheme,
      subjects,
      goal,
      dailyMinutes,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg my-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="profile-modal-title"
              className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100"
            >
              Student Account, Class & Syllabus
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your verified login session, appearance theme, class level, syllabus board, and subjects.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile settings"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Account Authentication Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isAuthenticated ? 'text-[#059669] dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                  {isAuthenticated ? 'Verified Account Signed In' : 'Guest Preview Mode'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isAuthenticated
                    ? `${authEmail} · Synced privately to Firestore`
                    : 'Sign in with Google to save your class, syllabus, and progress securely across devices.'}
                </p>
              </div>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInToSync}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                Sign In with Google
              </button>
            )}
          </div>

          {/* Appearance / Theme Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                Interface Appearance
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose light, dark, or system theme. Saved automatically to your settings.
              </p>
            </div>
            <div
              role="group"
              aria-label="Theme preference"
              className="inline-flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0"
            >
              {(
                [
                  { id: 'light', label: 'Light', Icon: Sun },
                  { id: 'dark', label: 'Dark', Icon: Moon },
                  { id: 'system', label: 'System', Icon: Monitor },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = selectedTheme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`settings-theme-${id}`}
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedTheme(id);
                      onChangeTheme(id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subscription Plan Status Bar */}
          {(() => {
            const subState = getSubscriptionState(activeProfile.subscription, activeProfile.createdAt);
            const paidLabel = formatInrAmount(subState.subscription.amountInr);
            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#0284C7] dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                      {subState.isActivePass
                        ? `${SUBSCRIPTION_DURATION_YEARS}-Year Scholar Pass Active (${paidLabel}${
                            subState.subscription.referralCode
                              ? ` · Code ${subState.subscription.referralCode}`
                              : ' Paid'
                          })`
                        : subState.isExpired
                          ? 'Combine Study & Buddy AI Trial Ended'
                          : `Premium for Combine Study & Buddy AI (₹${SUBSCRIPTION_PRICE_INR} / ${SUBSCRIPTION_DURATION_YEARS} Yrs)`}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {subState.isActivePass
                        ? `Combine Study & Buddy AI unlocked until ${subState.passExpiryDateLabel}${subState.subscription.receiptId ? ` · Receipt ${subState.subscription.receiptId}` : ''}`
                        : `Unlock Combine Study & Buddy AI for ${SUBSCRIPTION_DURATION_YEARS} years (₹${SUBSCRIPTION_PRICE_INR} one-time or referral code). Other tools stay free.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="profile-open-subscription-btn"
                  onClick={() => {
                    onClose();
                    onOpenSubscription();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  {subState.isActivePass
                    ? 'View Pass Receipt'
                    : `Unlock ₹${SUBSCRIPTION_PRICE_INR} / ${SUBSCRIPTION_DURATION_YEARS} Yrs`}
                </button>
              </div>
            );
          })()}

          {/* Local Profile Switcher (Guest mode) */}
          {!isAuthenticated && (
            <div className="space-y-2.5 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Local Student Profiles</span>
                <button
                  type="button"
                  onClick={onCreateNewStudent}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add Another Student
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => {
                  const isCurrent = p.id === activeProfile.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent) {
                          onSwitchProfile(p.id);
                          onClose();
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                          : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {p.name} · {p.classLevel} · {p.syllabus}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-student-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Student Name
                </label>
                <input
                  id="edit-student-name"
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label
                  htmlFor="edit-class-level"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Class / Academic Level
                </label>
                <select
                  id="edit-class-level"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                >
                  {CLASS_LEVELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.group})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-syllabus-board"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Syllabus / Curriculum Board
                </label>
                <select
                  id="edit-syllabus-board"
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                >
                  {SYLLABUS_BOARDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                  <option value="Custom">Other / Specific State Board</option>
                </select>
                {errors.syllabus && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.syllabus}</p>}
              </div>

              {syllabus === 'Custom' && (
                <div>
                  <label
                    htmlFor="edit-custom-syllabus"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Specific State / Custom Board Name
                  </label>
                  <input
                    id="edit-custom-syllabus"
                    type="text"
                    maxLength={60}
                    value={customSyllabus}
                    onChange={(e) => setCustomSyllabus(e.target.value)}
                    placeholder="e.g., Kerala SCERT, Maharashtra MSBSHSE"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                  />
                </div>
              )}
            </div>

            {(syllabus === 'State Board' || syllabus === 'Custom') && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Quick-pick a State Board (auto-updates chapters to your state syllabus):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATE_BOARD_PRESETS.map((preset) => {
                    const active = effectiveSyllabus === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setSyllabus('Custom');
                          setCustomSyllabus(preset);
                          setErrors((prev) => ({ ...prev, syllabus: undefined }));
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#0284C7]/10 dark:bg-sky-500/20 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Changing your board or class level automatically syncs and updates all subject
              learning paths to the latest official syllabus.
            </p>

            <LanguageSelect
              id="edit-study-language"
              value={language}
              onChange={setLanguage}
              label="Preferred Study Language (English, Malayalam, Hindi & All Languages)"
            />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Selected Subjects</span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {subjects.length} active
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {recommendedSubjects.map((sub) => {
                  const active = subjects.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleSubject(sub)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#0284C7]/10 dark:bg-sky-500/20 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" aria-hidden="true" />}
                      {sub}
                    </button>
                  );
                })}

                {customSelected.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubject(sub)}
                    aria-label={`Remove subject ${sub}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-[#0284C7]/10 dark:bg-sky-500/20 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400 cursor-pointer whitespace-nowrap"
                  >
                    {sub}
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <label htmlFor="modal-custom-subject" className="sr-only">
                  Add custom subject
                </label>
                <input
                  id="modal-custom-subject"
                  type="text"
                  maxLength={80}
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                  placeholder="Add custom subject..."
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>

              {errors.subjects && <p className="text-xs text-red-600 dark:text-red-400">{errors.subjects}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-study-goal"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Study Goal
                </label>
                <select
                  id="edit-study-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as StudyGoal)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                >
                  {STUDY_GOALS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-daily-pace"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Daily Study Pace
                </label>
                <select
                  id="edit-daily-pace"
                  value={dailyMinutes}
                  onChange={(e) => setDailyMinutes(Number(e.target.value) as StudyPace)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100"
                >
                  <option value={20}>20 min/day (Steady habit)</option>
                  <option value={45}>45 min/day (Balanced track)</option>
                  <option value={90}>90 min/day (Intensive focus)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
