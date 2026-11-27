import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, Plus, X } from 'lucide-react';
import type { StudentProfile, StudyGoal, StudyPace } from '../types/study';
import {
  CLASS_LEVELS,
  STUDY_GOALS,
  SYLLABUS_BOARDS,
  getRecommendedSubjectsForClass,
  normalizeSubjectName,
  validateStudentSetup,
} from '../utils/learningPath';
import { CurriculumBlueprint } from './EditorialIllustration';
import { LanguageSelect } from './LanguageSelect';
import { STATE_BOARD_PRESETS } from '../utils/syllabusSync';

interface OnboardingStudioProps {
  defaultName?: string;
  signedInEmail?: string | null;
  existingProfiles: StudentProfile[];
  isGenerating: boolean;
  error: string | null;
  onGenerateProfile: (input: {
    name: string;
    classLevel: string;
    syllabus: string;
    language: string;
    subjects: string[];
    goal: StudyGoal;
    dailyMinutes: StudyPace;
  }) => void;
  onSelectExistingProfile: (profileId: string) => void;
  onLoadSample: () => void;
}

const PACE_OPTIONS: { minutes: StudyPace; label: string; note: string }[] = [
  { minutes: 20, label: '20 min/day', note: 'Steady habit' },
  { minutes: 45, label: '45 min/day', note: 'Balanced track' },
  { minutes: 90, label: '90 min/day', note: 'Intensive focus' },
];

export const OnboardingStudio: React.FC<OnboardingStudioProps> = ({
  defaultName = '',
  signedInEmail = null,
  existingProfiles,
  isGenerating,
  error,
  onGenerateProfile,
  onSelectExistingProfile,
  onLoadSample,
}) => {
  const [name, setName] = useState(defaultName);
  const [classLevel, setClassLevel] = useState('Class 10');
  const [syllabus, setSyllabus] = useState('CBSE');
  const [language, setLanguage] = useState('English');
  const [customSyllabus, setCustomSyllabus] = useState('');
  const [useCustomSyllabus, setUseCustomSyllabus] = useState(false);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    'Mathematics',
    'Physics',
    'World History',
  ]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [goal, setGoal] = useState<StudyGoal>('exam_prep');
  const [dailyMinutes, setDailyMinutes] = useState<StudyPace>(45);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    classLevel?: string;
    syllabus?: string;
    subjects?: string;
  }>({});

  const effectiveSyllabus = useCustomSyllabus ? customSyllabus.trim() : syllabus;
  const recommendedSubjects = getRecommendedSubjectsForClass(classLevel);
  const customSubjects = selectedSubjects.filter((s) => !recommendedSubjects.includes(s));

  const handleClassChange = (nextClass: string) => {
    setClassLevel(nextClass);
    const nextRecommended = getRecommendedSubjectsForClass(nextClass);
    const stillRelevant = selectedSubjects.filter((s) => nextRecommended.includes(s));
    if (stillRelevant.length === 0) {
      setSelectedSubjects(nextRecommended.slice(0, 2));
    } else {
      setSelectedSubjects(stillRelevant);
    }
    setValidationErrors((prev) => ({ ...prev, classLevel: undefined, subjects: undefined }));
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
    setValidationErrors((prev) => ({ ...prev, subjects: undefined }));
  };

  const handleAddCustomSubject = () => {
    const clean = normalizeSubjectName(customSubjectInput);
    if (!clean) return;
    if (!selectedSubjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSelectedSubjects((prev) => [...prev, clean]);
      setValidationErrors((prev) => ({ ...prev, subjects: undefined }));
    }
    setCustomSubjectInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateStudentSetup({
      name,
      classLevel,
      syllabus: effectiveSyllabus,
      subjects: selectedSubjects,
    });
    if (!check.valid) {
      setValidationErrors(check.errors);
      return;
    }
    setValidationErrors({});
    onGenerateProfile({
      name: name.trim(),
      classLevel,
      syllabus: effectiveSyllabus,
      language,
      subjects: selectedSubjects,
      goal,
      dailyMinutes,
    });
  };

  const classGroups = ['Middle School', 'High School', 'Higher & Exam Prep'] as const;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Student Account Creation Form */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#0284C7] dark:text-sky-400">
              {signedInEmail
                ? `Signed in as ${signedInEmail} · Complete Student Setup`
                : 'Student Account Creation · Class & Syllabus Setup'}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-100 leading-[1.12]">
              Set up your class, syllabus board, and subjects.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Tell Pathwise your class and syllabus (CBSE, ICSE, State Board, IB, IGCSE, or custom)
              so every learning path, short note, shortcut, and previous year paper matches what
              you are studying.
            </p>
          </div>

          {!signedInEmail && existingProfiles.length > 0 && (
            <section
              aria-label="Saved local profiles"
              className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                  Continue an existing local profile
                </h2>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {existingProfiles.length} saved
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {existingProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => onSelectExistingProfile(profile.id)}
                    className="px-3.5 py-2 text-sm text-[#0F172A] dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="font-medium">{profile.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {' '}
                      · {profile.classLevel} · {profile.syllabus}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 space-y-8"
          >
            {/* Step 01: Student Name, Class & Syllabus Board */}
            <section id="student-profile" className="space-y-6">
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="font-sans text-base font-semibold text-[#0F172A] dark:text-slate-100">
                  01. Student Details, Class & Syllabus
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">Calibrates chapters & exam pattern</span>
              </div>

              <div>
                <label
                  htmlFor="student-name-input"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Student Name
                </label>
                <input
                  id="student-name-input"
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (validationErrors.name) {
                      setValidationErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="e.g., Ananya Sharma"
                  autoComplete="name"
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors ${
                    validationErrors.name
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700 focus:border-[#0284C7] dark:focus:border-sky-400'
                  }`}
                />
                {validationErrors.name && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {validationErrors.name}
                  </p>
                )}
              </div>

              <div>
                <LanguageSelect
                  id="onboarding-study-language"
                  value={language}
                  onChange={setLanguage}
                  label="Preferred Study Language (English, Malayalam, Hindi & All Languages)"
                />
              </div>

              {/* Syllabus Board Selector (CBSE, ICSE, State Board, IB, IGCSE, Custom) */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Syllabus / Curriculum Board
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {SYLLABUS_BOARDS.map((board) => {
                    const active = !useCustomSyllabus && syllabus === board.id;
                    return (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => {
                          setUseCustomSyllabus(false);
                          setSyllabus(board.id);
                          setValidationErrors((prev) => ({ ...prev, syllabus: undefined }));
                        }}
                        aria-pressed={active}
                        className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0284C7]/10 dark:bg-sky-950/50 border-[#0284C7] dark:border-sky-400 text-[#0F172A] dark:text-slate-100'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{board.label}</p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                          {board.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomSyllabus((prev) => !prev);
                      setValidationErrors((prev) => ({ ...prev, syllabus: undefined }));
                    }}
                    aria-pressed={useCustomSyllabus}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap self-start ${
                      useCustomSyllabus
                        ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    Other / Specific State Board
                  </button>

                  {useCustomSyllabus && (
                    <div className="flex-1">
                      <label htmlFor="custom-syllabus-input" className="sr-only">
                        Enter your state or custom syllabus board
                      </label>
                      <input
                        id="custom-syllabus-input"
                        type="text"
                        maxLength={60}
                        value={customSyllabus}
                        onChange={(e) => {
                          setCustomSyllabus(e.target.value);
                          setValidationErrors((prev) => ({ ...prev, syllabus: undefined }));
                        }}
                        placeholder="e.g., Kerala SCERT, Maharashtra MSBSHSE, Tamil Nadu Samacheer"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                      />
                    </div>
                  )}
                </div>

                {(useCustomSyllabus || syllabus === 'State Board') && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Popular State Boards:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATE_BOARD_PRESETS.map((preset) => {
                        const active = useCustomSyllabus && customSyllabus === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setUseCustomSyllabus(true);
                              setCustomSyllabus(preset);
                              setValidationErrors((prev) => ({ ...prev, syllabus: undefined }));
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-[#0284C7]/10 dark:bg-sky-950/50 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400'
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

                {validationErrors.syllabus && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {validationErrors.syllabus}
                  </p>
                )}
              </div>

              {/* Class Level Selector */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Class / Academic Level
                </label>
                <div className="space-y-3">
                  {classGroups.map((groupName) => {
                    const options = CLASS_LEVELS.filter((c) => c.group === groupName);
                    return (
                      <div key={groupName} className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{groupName}</p>
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => {
                            const active = classLevel === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleClassChange(opt.id)}
                                aria-pressed={active}
                                className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                                  active
                                    ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-[#0F172A] dark:hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {validationErrors.classLevel && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {validationErrors.classLevel}
                  </p>
                )}
              </div>
            </section>

            {/* Step 02: Subject Selection */}
            <section id="subject-picker" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="font-sans text-base font-semibold text-[#0F172A] dark:text-slate-100">
                  02. Choose Your Subjects
                </h2>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedSubjects.length} selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {recommendedSubjects.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#0284C7]/10 dark:bg-sky-950/50 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      <span>{subject}</span>
                    </button>
                  );
                })}

                {customSubjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    aria-label={`Remove custom subject ${subject}`}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border bg-[#0284C7]/10 dark:bg-sky-950/50 text-[#0369A1] dark:text-sky-300 border-[#0284C7] dark:border-sky-400 cursor-pointer whitespace-nowrap"
                  >
                    <span>{subject}</span>
                    <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <label htmlFor="custom-subject-input" className="sr-only">
                  Add any custom subject
                </label>
                <input
                  id="custom-subject-input"
                  type="text"
                  maxLength={80}
                  value={customSubjectInput}
                  onChange={(e) => setCustomSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSubject();
                    }
                  }}
                  placeholder="Add any other subject (e.g., Astronomy, Sanskrit, Statistics)"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSubject}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[#0F172A] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add Subject
                </button>
              </div>

              {validationErrors.subjects && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {validationErrors.subjects}
                </p>
              )}
            </section>

            {/* Step 03: Goal & Daily Pace */}
            <section id="study-goal" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="font-sans text-base font-semibold text-[#0F172A] dark:text-slate-100">
                  03. Learning Goal & Study Time Table Pace
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">Auto-schedules your weekly timetable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STUDY_GOALS.map((g) => {
                  const active = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      aria-pressed={active}
                      className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#F8FAFC] dark:bg-sky-950/40 border-[#0284C7] dark:border-sky-400 ring-1 ring-[#0284C7]/20 dark:ring-sky-400/20'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{g.label}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{g.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Daily Study Time:</span>
                {PACE_OPTIONS.map((p) => {
                  const active = dailyMinutes === p.minutes;
                  return (
                    <button
                      key={p.minutes}
                      type="button"
                      onClick={() => setDailyMinutes(p.minutes)}
                      aria-pressed={active}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#0F172A] dark:bg-sky-500 text-white dark:text-slate-950 border-[#0F172A] dark:border-sky-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className="font-mono tabular-nums">{p.label}</span>
                      <span className={active ? 'text-slate-300 dark:text-slate-900' : 'text-slate-400 dark:text-slate-500'}>
                        {' '}
                        · {p.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300"
              >
                <p className="font-semibold">Unable to generate learning path</p>
                <p className="mt-0.5 text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Building Your Study Paths...
                  </>
                ) : (
                  <>
                    Create Account & Build Paths
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onLoadSample}
                disabled={isGenerating}
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                Explore Sample Student (Aarav · Class 10 CBSE)
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Sticky Live Curriculum Blueprint */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <CurriculumBlueprint
            classLevel={classLevel}
            syllabus={effectiveSyllabus || 'Selected Board'}
            selectedSubjects={selectedSubjects}
            dailyMinutes={dailyMinutes}
          />
        </div>
      </div>
    </main>
  );
};
