import type {
  AptitudeQuestion,
  ClassLevelOption,
  ExampleQuestion,
  LearningModule,
  MotivationSession,
  PreviousYearPaper,
  QuizQuestion,
  StudentProfile,
  StudyGoal,
  StudyPace,
  SubjectDomain,
  SubjectPath,
  SyllabusOption,
  TimetableSlot,
} from '../types/study';

export const SYLLABUS_BOARDS: SyllabusOption[] = [
  {
    id: 'CBSE',
    label: 'CBSE',
    description: 'NCERT-aligned chapters, competency questions, and board marking scheme.',
  },
  {
    id: 'ICSE / ISC',
    label: 'ICSE / ISC',
    description: 'Detailed conceptual depth, analytical structured answers, and CISCE format.',
  },
  {
    id: 'State Board',
    label: 'State Board',
    description: 'State syllabus textbooks, blueprint weightage, and regional board papers.',
  },
  {
    id: 'IB (International Baccalaureate)',
    label: 'IB',
    description: 'Inquiry-based conceptual frameworks, criterion rubrics, and paper 1/2 styles.',
  },
  {
    id: 'IGCSE / Cambridge',
    label: 'IGCSE / Cambridge',
    description: 'Cambridge syllabus objectives, structured data analysis, and past-paper drills.',
  },
  {
    id: 'Competitive / Entrance',
    label: 'Competitive / Entrance',
    description: 'High-speed problem solving, aptitude drills, and objective exam shortcuts.',
  },
];

export const CLASS_LEVELS: ClassLevelOption[] = [
  {
    id: 'Class 6',
    label: 'Class 6',
    group: 'Middle School',
    recommendedSubjects: [
      'Mathematics',
      'General Science',
      'English Language',
      'History & Civics',
      'Geography',
      'Computer Basics',
    ],
  },
  {
    id: 'Class 7',
    label: 'Class 7',
    group: 'Middle School',
    recommendedSubjects: [
      'Mathematics',
      'General Science',
      'English Literature',
      'History & Civics',
      'Geography',
      'Computer Science',
    ],
  },
  {
    id: 'Class 8',
    label: 'Class 8',
    group: 'Middle School',
    recommendedSubjects: [
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      'English Literature',
      'History & Civics',
      'Geography',
      'Computer Science',
    ],
  },
  {
    id: 'Class 9',
    label: 'Class 9',
    group: 'High School',
    recommendedSubjects: [
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      'English Literature',
      'World History',
      'Economics',
      'Computer Science',
    ],
  },
  {
    id: 'Class 10',
    label: 'Class 10',
    group: 'High School',
    recommendedSubjects: [
      'Mathematics',
      'Physics',
      'Chemistry',
      'Biology',
      'English Literature',
      'World History',
      'Geography',
      'Economics',
      'Computer Science',
    ],
  },
  {
    id: 'Class 11',
    label: 'Class 11',
    group: 'High School',
    recommendedSubjects: [
      'Mathematics & Calculus',
      'Physics',
      'Chemistry',
      'Biology',
      'Computer Science',
      'Economics',
      'Accountancy',
      'Psychology',
      'Political Science',
      'English Core',
    ],
  },
  {
    id: 'Class 12',
    label: 'Class 12',
    group: 'High School',
    recommendedSubjects: [
      'Calculus & Linear Algebra',
      'Physics',
      'Chemistry',
      'Biology',
      'Computer Science',
      'Economics',
      'Accountancy',
      'Psychology',
      'World History',
      'English Core',
    ],
  },
  {
    id: 'Undergraduate (Year 1–2)',
    label: 'Undergraduate (Year 1–2)',
    group: 'Higher & Exam Prep',
    recommendedSubjects: [
      'Linear Algebra',
      'Data Structures & Algorithms',
      'Classical Mechanics',
      'Organic Chemistry',
      'Microeconomics',
      'Statistics & Probability',
      'Cognitive Psychology',
      'Modern Philosophy',
    ],
  },
  {
    id: 'Competitive Exam Prep',
    label: 'Competitive Exam Prep',
    group: 'Higher & Exam Prep',
    recommendedSubjects: [
      'Quantitative Aptitude',
      'Physics Mechanics & EM',
      'Physical & Organic Chemistry',
      'Biology & Genetics',
      'Logical Reasoning',
      'Reading Comprehension',
    ],
  },
];

export const STUDY_GOALS: { id: StudyGoal; label: string; description: string }[] = [
  {
    id: 'foundations',
    label: 'Build Foundations',
    description: 'Clear step-by-step intuition, core definitions, and guided practice.',
  },
  {
    id: 'exam_prep',
    label: 'Exam Readiness',
    description: 'High-yield derivations, board PYQs, short notes, and timed problem patterns.',
  },
  {
    id: 'deep_mastery',
    label: 'Deep Mastery',
    description: 'First-principles proofs, cross-topic connections, and challenge problems.',
  },
];

export const MOTIVATION_LIBRARY: MotivationSession[] = [
  {
    id: 'mot-anxiety',
    theme: 'Beat Exam Anxiety',
    subtitle: 'Calm racing thoughts and turn syllabus overwhelm into a clear checklist',
    durationMinutes: 10,
    affirmation: 'You do not need to finish the whole syllabus today—you only need to master the next 25 minutes.',
    segments: [
      {
        minuteRange: '00:00 – 03:00',
        title: 'Box Breathing & Physical Reset',
        guidance:
          'Step away from the textbook for 3 minutes. Inhale for 4 seconds, hold 4, exhale 4, hold 4. Lowering your heart rate unlocks working memory immediately.',
      },
      {
        minuteRange: '03:00 – 07:00',
        title: 'Shrink the Mountain to One Page',
        guidance:
          'Anxiety spikes when your brain tries to study 12 chapters at once. Pick exactly ONE chapter and ONE short-note list. Write down 3 formulas or dates you will lock in next.',
      },
      {
        minuteRange: '07:00 – 10:00',
        title: 'Confidence Launch',
        guidance:
          'Answer 2 easy warm-up questions first to trigger momentum. Recall that every mark is earned step by step—even partial working scores marks in board exams.',
      },
    ],
    actionPrompt: 'Open your active subject’s Short Notes tab and review 3 key rules right after this timer ends.',
  },
  {
    id: 'mot-procrastination',
    theme: 'Overcome Procrastination',
    subtitle: 'Break study inertia with a frictionless 10-minute activation routine',
    durationMinutes: 10,
    affirmation: 'Action creates motivation—not the other way around.',
    segments: [
      {
        minuteRange: '00:00 – 03:00',
        title: 'Clear the Desk & Silence Notifications',
        guidance:
          'Put your phone face down in another room or Do Not Disturb. Keep only your notebook, pen, and Pathwise open on screen.',
      },
      {
        minuteRange: '03:00 – 07:00',
        title: 'The 5-Minute Micro-Contract',
        guidance:
          'Promise yourself just 5 minutes of reading one worked example—no perfection required. Once you cross minute 5, the brain’s Zeigarnik effect naturally pulls you to finish.',
      },
      {
        minuteRange: '07:00 – 10:00',
        title: 'First Written Line',
        guidance:
          'Write the chapter title and solve the very first step of an example question on paper before this class ends so you roll smoothly into study mode.',
      },
    ],
    actionPrompt: 'Switch to Practice -> Example Questions and copy Step 1 of the first problem into your notebook.',
  },
  {
    id: 'mot-confidence',
    theme: 'Pre-Exam Confidence Boost',
    subtitle: 'Sharpen recall clarity and walk into your exam room steady and prepared',
    durationMinutes: 10,
    affirmation: 'Prepared minds stay calm under pressure because they trust their process.',
    segments: [
      {
        minuteRange: '00:00 – 03:00',
        title: 'Inventory What You Already Know',
        guidance:
          'Recall 3 topics you struggled with two months ago that now feel natural. Proof of past growth silences self-doubt faster than empty hype.',
      },
      {
        minuteRange: '03:00 – 07:00',
        title: 'Exam Room Strategy Rehearsal',
        guidance:
          'Visualize reading the question paper calmly: scan all sections in 5 minutes, lock in high-confidence questions first, and leave clean space to revisit tricky ones.',
      },
      {
        minuteRange: '07:00 – 10:00',
        title: 'High-Yield Formula Scan',
        guidance:
          'Spend the final 3 minutes flipping 5 Revision Flashcards—ending on active recall primes your memory retrieval pathways.',
      },
    ],
    actionPrompt: 'Flip 5 flashcards in Study Kit -> Revision Deck or skim one Previous Year Paper.',
  },
  {
    id: 'mot-focus',
    theme: 'Deep Focus Reset',
    subtitle: 'Rebuild attention span between study blocks without mindless scrolling',
    durationMinutes: 10,
    affirmation: 'One hour of distraction-free study beats four hours of half-focused reading.',
    segments: [
      {
        minuteRange: '00:00 – 03:00',
        title: 'Eye & Posture Recovery',
        guidance:
          'Look at an object 20 feet away for 30 seconds, roll your shoulders back, and drink a full glass of water. Mental fog is often simple dehydration and eye strain.',
      },
      {
        minuteRange: '03:00 – 07:00',
        title: 'Brain Dump Distractions',
        guidance:
          'Jot down any nagging errands or thoughts on a scrap sheet so your brain stops looping on them during your next study block.',
      },
      {
        minuteRange: '07:00 – 10:00',
        title: 'Single-Target Sprint Setup',
        guidance:
          'Pick one measurable goal for your next timetable slot (for example: complete 1 checkpoint quiz with 70%+ or finish 3 aptitude problems).',
      },
    ],
    actionPrompt: 'Check off your completed slot in the Study Time Table and start the next single-target block.',
  },
];

const STEM_KEYWORDS = [
  'math',
  'calculus',
  'algebra',
  'physics',
  'chem',
  'bio',
  'science',
  'computer',
  'data',
  'stat',
  'quant',
  'astro',
  'engineer',
  'logic',
  'geometry',
  'trigonometry',
  'genetics',
];

export function classifySubjectDomain(subject: string): SubjectDomain {
  const lower = subject.toLowerCase();
  return STEM_KEYWORDS.some((kw) => lower.includes(kw)) ? 'stem' : 'humanities';
}

export function getRecommendedSubjectsForClass(classLevel: string): string[] {
  const found = CLASS_LEVELS.find((c) => c.id === classLevel);
  return found ? found.recommendedSubjects : CLASS_LEVELS[4].recommendedSubjects;
}

export function normalizeSubjectName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export interface SetupValidationResult {
  valid: boolean;
  errors: {
    name?: string;
    classLevel?: string;
    syllabus?: string;
    subjects?: string;
  };
}

export function validateStudentSetup(input: {
  name: string;
  classLevel: string;
  syllabus?: string;
  subjects: string[];
}): SetupValidationResult {
  const errors: SetupValidationResult['errors'] = {};
  const trimmedName = input.name.trim();
  const trimmedSyllabus = (input.syllabus ?? '').trim();

  if (trimmedName.length < 2 || trimmedName.length > 80) {
    errors.name = 'Enter the student name (2 to 80 characters).';
  }
  if (!input.classLevel || !CLASS_LEVELS.some((c) => c.id === input.classLevel)) {
    errors.classLevel = 'Select a class or academic level.';
  }
  if (trimmedSyllabus.length < 2 || trimmedSyllabus.length > 60) {
    errors.syllabus = 'Select or enter your syllabus board (e.g., CBSE, ICSE, State Board).';
  }
  const uniqueSubjects = Array.from(
    new Set(input.subjects.map(normalizeSubjectName).filter(Boolean))
  );
  if (uniqueSubjects.length === 0) {
    errors.subjects = 'Choose at least one subject to build a learning path.';
  } else if (uniqueSubjects.length > 8) {
    errors.subjects = 'Select up to 8 subjects at a time to keep the weekly plan focused.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function generateStudyTimetable(
  subjects: string[],
  dailyMinutes: StudyPace
): TimetableSlot[] {
  const safeSubjects = subjects.length > 0 ? subjects : ['Mathematics', 'Physics', 'World History'];
  const days: TimetableSlot['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const activities: TimetableSlot['activity'][] = [
    'New Lesson & Notes',
    'Practice & Aptitude',
    'Short Notes & Revision',
    'PYQ Paper Drill',
  ];

  const slotsPerDay = dailyMinutes === 90 ? 2 : 1;
  const slotDuration = dailyMinutes === 90 ? 45 : dailyMinutes;
  const timeLabels =
    dailyMinutes === 90
      ? ['05:30 PM – 06:15 PM', '07:15 PM – 08:00 PM']
      : dailyMinutes === 45
      ? ['06:00 PM – 06:45 PM']
      : ['06:00 PM – 06:20 PM'];

  const slots: TimetableSlot[] = [];
  let pointer = 0;

  for (let dIdx = 0; dIdx < days.length; dIdx++) {
    const day = days[dIdx];
    for (let sIdx = 0; sIdx < slotsPerDay; sIdx++) {
      const subject = safeSubjects[pointer % safeSubjects.length];
      const activity =
        day === 'Sun'
          ? 'PYQ Paper Drill'
          : day === 'Sat'
          ? 'Short Notes & Revision'
          : activities[(dIdx + sIdx) % 3];

      slots.push({
        id: `tt-${day.toLowerCase()}-${sIdx + 1}`,
        day,
        timeRange: timeLabels[sIdx],
        subject,
        activity,
        durationMinutes: slotDuration,
        completed: dIdx === 0 && sIdx === 0,
      });
      pointer += 1;
    }
  }

  return slots;
}

export interface SubjectProgressSummary {
  totalModules: number;
  masteredCount: number;
  inProgressCount: number;
  percentComplete: number;
  totalMinutes: number;
  remainingMinutes: number;
  nextModule: LearningModule | null;
}

export function calculateSubjectProgress(path: SubjectPath | undefined): SubjectProgressSummary {
  if (!path || path.modules.length === 0) {
    return {
      totalModules: 0,
      masteredCount: 0,
      inProgressCount: 0,
      percentComplete: 0,
      totalMinutes: 0,
      remainingMinutes: 0,
      nextModule: null,
    };
  }

  const totalModules = path.modules.length;
  const masteredCount = path.modules.filter((m) => m.status === 'mastered').length;
  const inProgressCount = path.modules.filter((m) => m.status === 'in_progress').length;
  const percentComplete = Math.round((masteredCount / totalModules) * 100);
  const totalMinutes = path.modules.reduce((acc, m) => acc + m.estimatedMinutes, 0);
  const remainingMinutes = path.modules
    .filter((m) => m.status !== 'mastered')
    .reduce((acc, m) => acc + m.estimatedMinutes, 0);

  const nextModule =
    path.modules.find((m) => m.status === 'in_progress') ??
    path.modules.find((m) => m.status === 'up_next') ??
    path.modules[path.modules.length - 1];

  return {
    totalModules,
    masteredCount,
    inProgressCount,
    percentComplete,
    totalMinutes,
    remainingMinutes,
    nextModule,
  };
}

export interface OverallProgressSummary {
  subjectCount: number;
  totalModules: number;
  masteredModules: number;
  overallPercent: number;
  remainingMinutes: number;
}

export function calculateOverallProgress(
  subjects: string[],
  paths: Record<string, SubjectPath>
): OverallProgressSummary {
  let totalModules = 0;
  let masteredModules = 0;
  let remainingMinutes = 0;

  for (const subject of subjects) {
    const summary = calculateSubjectProgress(paths[subject]);
    totalModules += summary.totalModules;
    masteredModules += summary.masteredCount;
    remainingMinutes += summary.remainingMinutes;
  }

  return {
    subjectCount: subjects.length,
    totalModules,
    masteredModules,
    overallPercent: totalModules > 0 ? Math.round((masteredModules / totalModules) * 100) : 0,
    remainingMinutes,
  };
}

export function toggleModuleMastery(path: SubjectPath, moduleId: string): SubjectPath {
  const targetIndex = path.modules.findIndex((m) => m.id === moduleId);
  if (targetIndex === -1) return path;

  const target = path.modules[targetIndex];
  const nextStatus = target.status === 'mastered' ? 'in_progress' : 'mastered';

  const updatedModules: LearningModule[] = path.modules.map((m, idx) =>
    idx === targetIndex ? { ...m, status: nextStatus } : m
  );

  if (nextStatus === 'mastered' && !updatedModules.some((m) => m.status === 'in_progress')) {
    const firstUpNextIdx = updatedModules.findIndex((m) => m.status === 'up_next');
    if (firstUpNextIdx !== -1) {
      updatedModules[firstUpNextIdx] = {
        ...updatedModules[firstUpNextIdx],
        status: 'in_progress',
      };
    }
  }

  return {
    ...path,
    modules: updatedModules,
    updatedAt: new Date().toISOString(),
  };
}

export interface QuizEvaluation {
  total: number;
  correct: number;
  percentage: number;
  passed: boolean;
  missedConcepts: string[];
}

export function evaluateQuizScore(
  questions: QuizQuestion[],
  selectedAnswers: Record<string, number>
): QuizEvaluation {
  const total = questions.length;
  if (total === 0) {
    return { total: 0, correct: 0, percentage: 0, passed: false, missedConcepts: [] };
  }

  let correct = 0;
  const missedConceptsSet = new Set<string>();

  for (const q of questions) {
    if (selectedAnswers[q.id] === q.correctIndex) {
      correct += 1;
    } else if (q.conceptTag) {
      missedConceptsSet.add(q.conceptTag);
    }
  }

  const percentage = Math.round((correct / total) * 100);
  return {
    total,
    correct,
    percentage,
    passed: percentage >= 70,
    missedConcepts: Array.from(missedConceptsSet),
  };
}

export function recordQuizMastery(
  path: SubjectPath,
  moduleId: string,
  percentage: number
): SubjectPath {
  const target = path.modules.find((m) => m.id === moduleId);
  if (!target) return path;

  const bestQuizScore = Math.max(target.bestQuizScore ?? 0, percentage);
  let nextPath: SubjectPath = {
    ...path,
    modules: path.modules.map((m) =>
      m.id === moduleId ? { ...m, bestQuizScore } : m
    ),
    updatedAt: new Date().toISOString(),
  };

  if (percentage >= 70 && target.status !== 'mastered') {
    nextPath = toggleModuleMastery(nextPath, moduleId);
  }

  return nextPath;
}

export function mergeSubjectSelections(
  existingPaths: Record<string, SubjectPath>,
  selectedSubjects: string[]
): { keptPaths: Record<string, SubjectPath>; missingSubjects: string[] } {
  const keptPaths: Record<string, SubjectPath> = {};
  const missingSubjects: string[] = [];

  for (const rawSubject of selectedSubjects) {
    const subject = normalizeSubjectName(rawSubject);
    if (!subject) continue;
    if (existingPaths[subject]) {
      keptPaths[subject] = existingPaths[subject];
    } else {
      missingSubjects.push(subject);
    }
  }

  return { keptPaths, missingSubjects };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recordModuleCompletionDate(
  existingDates: string[] | undefined,
  date: Date = new Date()
): string[] {
  const validDates = (existingDates ?? []).filter((d) => DATE_KEY_PATTERN.test(d));
  const nextSet = new Set(validDates);
  nextSet.add(formatLocalDateKey(date));
  return Array.from(nextSet).sort().slice(-365);
}

export interface StudyStreakSummary {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
}

export function calculateStudyStreak(
  completedDates: string[] | undefined,
  referenceDate: Date = new Date()
): StudyStreakSummary {
  const validUnique = Array.from(
    new Set((completedDates ?? []).filter((d) => DATE_KEY_PATTERN.test(d)))
  ).sort();

  if (validUnique.length === 0) {
    return { currentStreak: 0, longestStreak: 0, completedToday: false };
  }

  const dateSet = new Set(validUnique);
  const todayKey = formatLocalDateKey(referenceDate);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const completedToday = dateSet.has(todayKey);

  // Current streak is alive if student completed at least one module today or yesterday
  let currentStreak = 0;
  let cursor = completedToday ? todayKey : dateSet.has(yesterdayKey) ? yesterdayKey : null;
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  // Compute longest historical consecutive run
  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < validUnique.length; i++) {
    if (shiftDateKey(validUnique[i - 1], 1) === validUnique[i]) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 1;
    }
  }

  return { currentStreak, longestStreak, completedToday };
}

export function getSampleExampleQuestions(subject: string, syllabus: string): ExampleQuestion[] {
  if (subject.toLowerCase().includes('phy')) {
    return [
      {
        id: 'ex-phy-1',
        question:
          'A concave mirror produces a 3 times magnified real image of an object placed 10 cm in front of it. Find the position of the image and the focal length of the mirror.',
        marks: 3,
        difficulty: 'Standard',
        steps: [
          'Assign Cartesian signs: u = −10 cm. Because the image is real and inverted, magnification m = −3.',
          'Use m = −v/u → −3 = −v / (−10) → v = −30 cm (30 cm in front of the mirror).',
          'Apply mirror equation: 1/f = 1/v + 1/u = 1/(−30) + 1/(−10) = −4/30 → f = −7.5 cm.',
        ],
        finalAnswer: 'Image at 30 cm in front of mirror (v = −30 cm); focal length f = −7.5 cm.',
        examTip: `In ${syllabus} marking schemes, 0.5 marks are awarded strictly for writing the sign convention before substituting values.`,
      },
      {
        id: 'ex-phy-2',
        question:
          'Three resistors of 2 Ω, 3 Ω, and 6 Ω are connected so that their total resistance is 4 Ω. Show the circuit arrangement mathematically.',
        marks: 3,
        difficulty: 'Challenge',
        steps: [
          'Connect the 3 Ω and 6 Ω resistors in parallel: 1/Rp = 1/3 + 1/6 = 3/6 = 1/2 → Rp = 2 Ω.',
          'Connect this parallel combination in series with the remaining 2 Ω resistor.',
          'Total resistance R_total = 2 Ω + 2 Ω = 4 Ω.',
        ],
        finalAnswer: '3 Ω and 6 Ω in parallel, connected in series with 2 Ω.',
        examTip: 'Always sketch a neat labeled circuit diagram alongside the algebraic proof.',
      },
    ];
  }

  return [
    {
      id: 'ex-math-1',
      question:
        'Find the value of k for which the quadratic equation kx(x − 2) + 6 = 0 has two equal real roots.',
      marks: 3,
      difficulty: 'Standard',
      steps: [
        'Expand to standard form: kx² − 2kx + 6 = 0, so a = k, b = −2k, c = 6 (with k ≠ 0).',
        'For equal roots, set discriminant Δ = b² − 4ac = 0 → (−2k)² − 4(k)(6) = 0.',
        'Simplify: 4k² − 24k = 0 → 4k(k − 6) = 0 → k = 0 or k = 6.',
        'Reject k = 0 because the coefficient of x² cannot be zero in a quadratic equation.',
      ],
      finalAnswer: 'k = 6',
      examTip: `Always explicitly reject k = 0—${syllabus} examiners reserve the final 0.5 mark specifically for that check.`,
    },
    {
      id: 'ex-math-2',
      question:
        'Prove that (sin θ + cosec θ)² + (cos θ + sec θ)² = 7 + tan²θ + cot²θ.',
      marks: 4,
      difficulty: 'Challenge',
      steps: [
        'Expand LHS: (sin²θ + cosec²θ + 2·sin θ·cosec θ) + (cos²θ + sec²θ + 2·cos θ·sec θ).',
        'Use reciprocal products: sin θ·cosec θ = 1 and cos θ·sec θ = 1, giving 2 + 2 = 4.',
        'Group sin²θ + cos²θ = 1, so running constant is 1 + 4 = 5.',
        'Replace cosec²θ = 1 + cot²θ and sec²θ = 1 + tan²θ → 5 + 1 + 1 + tan²θ + cot²θ = 7 + tan²θ + cot²θ = RHS.',
      ],
      finalAnswer: 'LHS = RHS (Identity proved).',
      examTip: 'State each Pythagorean identity in parentheses on the right margin for full step credit.',
    },
  ];
}

export function getSampleAptitudeQuestions(classLevel: string): AptitudeQuestion[] {
  return [
    {
      id: 'apt-1',
      category: 'Quantitative',
      question:
        'A train 150 m long passes a telegraph pole in 6 seconds. At the same speed, how long will it take to cross a 350 m bridge?',
      options: ['14 seconds', '18 seconds', '20 seconds', '24 seconds'],
      correctIndex: 2,
      shortcutMethod:
        'Speed = 150 / 6 = 25 m/s. Total distance to clear the bridge = 150 + 350 = 500 m. Time = 500 / 25 = 20 seconds.',
    },
    {
      id: 'apt-2',
      category: 'Logical Reasoning',
      question: 'Find the missing number in the sequence: 3, 8, 18, 38, 78, ?',
      options: ['148', '156', '158', '162'],
      correctIndex: 2,
      shortcutMethod:
        'Each term doubles the previous term and adds 2: (3×2)+2=8, (8×2)+2=18, ..., (78×2)+2 = 158.',
    },
    {
      id: 'apt-3',
      category: 'Pattern & Data',
      question: `If the ratio of Study Hours to Revision Hours for a ${classLevel} student is 5 : 2 and total weekly time is 14 hours, how many hours are spent on Revision?`,
      options: ['2 hours', '4 hours', '5 hours', '10 hours'],
      correctIndex: 1,
      shortcutMethod:
        'Total ratio parts = 5 + 2 = 7 parts = 14 hours → 1 part = 2 hours. Revision = 2 parts = 4 hours.',
    },
  ];
}

export function getSamplePreviousYearPaper(
  classLevel: string,
  syllabus: string,
  subject: string
): PreviousYearPaper {
  return {
    title: `${syllabus} ${classLevel} ${subject} — Board Question Paper`,
    year: '2025 Board Pattern',
    syllabus,
    classLevel,
    subject,
    durationMinutes: 60,
    maxMarks: 20,
    questions: [
      {
        number: 'Q1',
        section: 'Section A · 1 Mark Objective',
        marks: 1,
        question:
          subject.toLowerCase().includes('math')
            ? 'If one root of the quadratic equation 2x² + kx − 6 = 0 is 2, find the value of k.'
            : `State the fundamental SI unit and governing physical law taught in the first unit of ${classLevel} ${subject}.`,
        markingScheme: subject.toLowerCase().includes('math')
          ? 'Substitute x = 2: 2(4) + 2k − 6 = 0 → 2k + 2 = 0 → k = −1. (1 mark)'
          : '0.5 mark for exact definition/law statement, 0.5 mark for standard SI unit or clear example.',
      },
      {
        number: 'Q2',
        section: 'Section B · 2 Marks Short Answer',
        marks: 2,
        question:
          subject.toLowerCase().includes('math')
            ? 'Evaluate 2·tan²45° + cos²30° − sin²60° without using a calculator.'
            : `Compare two core concepts from ${subject} using one concrete real-world example.`,
        markingScheme: subject.toLowerCase().includes('math')
          ? 'Substitute exact values: 2(1)² + (√3/2)² − (√3/2)² = 2 + 3/4 − 3/4 = 2. (1 mark substitution, 1 mark final answer)'
          : '1 mark for accurate structured comparison (two distinguishing points), 1 mark for valid application example.',
      },
      {
        number: 'Q3',
        section: 'Section C · 3 Marks Structured Problem',
        marks: 3,
        question:
          subject.toLowerCase().includes('math')
            ? 'The sum of two numbers is 15. If the sum of their reciprocals is 3/10, find both numbers.'
            : `Explain a step-by-step derivation or cause-effect mechanism central to ${syllabus} ${classLevel} ${subject}.`,
        markingScheme: subject.toLowerCase().includes('math')
          ? 'Let numbers be x and (15 − x). 1/x + 1/(15 − x) = 3/10 → 15 / [x(15 − x)] = 3/10 → x² − 15x + 50 = 0 → (x − 10)(x − 5) = 0. Numbers are 5 and 10. (1 mark framing, 1 mark quadratic, 1 mark roots)'
          : '1 mark for setup/premise, 1 mark for logical intermediate steps, 1 mark for concise conclusion.',
      },
      {
        number: 'Q4',
        section: 'Section D · 5 Marks Long Analytical Question',
        marks: 5,
        question:
          subject.toLowerCase().includes('math')
            ? 'From the top of a 7 m high building, the angle of elevation of the top of a cable tower is 60° and the angle of depression of its foot is 45°. Determine the height of the tower.'
            : `Write a structured long-form analysis linking foundational theory to an applied ${syllabus} board case study in ${subject}.`,
        markingScheme: subject.toLowerCase().includes('math')
          ? 'Draw labeled right triangles (1 mark). Horizontal distance d = 7 / tan 45° = 7 m (1.5 marks). Upper tower height h = 7·tan 60° = 7√3 m (1.5 marks). Total tower height = 7(√3 + 1) m ≈ 19.12 m (1 mark).'
          : '1 mark diagram/outline, 3 marks core reasoning steps, 1 mark synthesis/final conclusion.',
      },
    ],
  };
}

export function createSampleStudentProfile(): StudentProfile {
  const now = '2026-11-24T10:00:00.000Z';

  const mathPath: SubjectPath = {
    subject: 'Mathematics',
    domain: 'stem',
    overview:
      'CBSE Class 10 algebra, trigonometry, and coordinate geometry progression calibrated for NCERT clarity and board marking-scheme mastery.',
    focusStrategy:
      'Build visual intuition for roots and trigonometric ratios before moving into multi-step board derivations and PYQs.',
    generatedByAi: false,
    updatedAt: now,
    modules: [
      {
        id: 'math-1',
        order: 1,
        stage: 'Foundations',
        title: 'Quadratic Equations & Factoring Structure',
        subtitle: 'Standard form, discriminant behavior, and zero-product reasoning',
        estimatedMinutes: 25,
        concepts: ['Standard Form ax² + bx + c = 0', 'Discriminant Δ = b² − 4ac', 'Sum & Product of Roots'],
        objectives: [
          'Classify the nature of roots instantaneously using the discriminant.',
          'Choose efficiently between factoring, completing the square, and the quadratic formula.',
          'Translate area and motion word problems into solvable quadratic equations.',
        ],
        whyItMatters:
          'Quadratic structure underpins projectile motion in Physics and optimization problems in higher calculus.',
        status: 'mastered',
        bestQuizScore: 100,
        lesson: {
          summary:
            'A quadratic equation describes a parabola whose intersections with the x-axis are its roots. The discriminant predicts root behavior before you solve.',
          concepts: [
            {
              heading: 'The Standard Quadratic Form',
              explanation:
                'Every quadratic equation in one variable can be arranged so one side equals zero. Identifying a, b, and c accurately prevents sign mistakes.',
              formulaOrKeyRule: 'ax² + bx + c = 0   (where a ≠ 0)',
            },
            {
              heading: 'Reading the Discriminant',
              explanation:
                'Before applying the full formula, evaluate Δ = b² − 4ac. Positive values give two distinct real roots; zero gives one repeated root; negative values indicate no real roots.',
              formulaOrKeyRule: 'Δ = b² − 4ac   |   x = (−b ± √Δ) / 2a',
            },
            {
              heading: 'Vieta Relations (Sum & Product)',
              explanation:
                'You can verify your roots in seconds without substituting them back: the sum of roots equals −b/a and the product equals c/a.',
              formulaOrKeyRule: 'α + β = −b / a   and   α · β = c / a',
            },
          ],
          shortNotes: [
            'Always convert to ax² + bx + c = 0 before reading a, b, and c.',
            'Δ > 0 → 2 distinct real roots; Δ = 0 → 2 equal real roots; Δ < 0 → no real roots.',
            'Quick root check: sum α + β = −b/a and product αβ = c/a.',
            'In word problems, always reject physically impossible negative lengths or times.',
          ],
          studyShortcuts: [
            {
              title: 'Perfect Square Discriminant Check',
              trick: 'If Δ = b² − 4ac is a perfect square (like 25 or 49), the quadratic splits cleanly by middle-term factoring.',
              whenToUse: 'Before wasting time guessing factor pairs on large coefficients.',
            },
            {
              title: '1-Second Sign Flip for Roots',
              trick: 'Once you find two numbers p and q with p + q = b and p·q = ac, the roots are simply −p/a and −q/a.',
              whenToUse: 'MCQ and aptitude questions where full step writing is not required.',
            },
          ],
          visualDiagram: {
            title: 'Discriminant Decision Map',
            caption: 'How Δ = b² − 4ac governs the parabola and x-axis crossings',
            centralConcept: 'Δ = b² − 4ac',
            nodes: [
              { label: 'Δ > 0 (Positive)', detail: 'Crosses x-axis twice', formula: '2 Distinct Real Roots' },
              { label: 'Δ = 0 (Zero)', detail: 'Touches x-axis at vertex', formula: 'x = −b / 2a (Equal)' },
              { label: 'Δ < 0 (Negative)', detail: 'Stays above/below x-axis', formula: 'No Real Roots' },
              { label: 'Vieta Check', detail: 'Instant answer verification', formula: 'α+β = −b/a, αβ = c/a' },
            ],
          },
          revisionCards: [
            { id: 'rc-m1-1', front: 'Condition for two equal real roots?', back: 'Discriminant Δ = b² − 4ac = 0, giving repeated root x = −b / 2a.' },
            { id: 'rc-m1-2', front: 'Sum and product of roots for ax² + bx + c = 0?', back: 'Sum = −b/a, Product = c/a.' },
            { id: 'rc-m1-3', front: 'Why must a ≠ 0 in ax² + bx + c = 0?', back: 'If a = 0, the x² term vanishes and the equation becomes linear, not quadratic.' },
          ],
          workedExample: {
            prompt: 'Solve 2x² − 7x + 3 = 0 and verify the nature of its roots.',
            steps: [
              'Identify coefficients: a = 2, b = −7, c = 3.',
              'Compute discriminant: Δ = (−7)² − 4(2)(3) = 49 − 24 = 25. Because Δ > 0 and is a perfect square, there are two distinct rational roots.',
              'Apply the formula: x = (7 ± √25) / (2 × 2) = (7 ± 5) / 4.',
              'Extract both solutions: x = 12/4 = 3 and x = 2/4 = 1/2. Check: sum = 3.5 = 7/2, product = 1.5 = 3/2.',
            ],
            takeaway: 'Checking Δ first tells you immediately if clean factoring is possible.',
          },
          recallCheck: {
            question: 'For which value of k does x² + kx + 9 = 0 have exactly one repeated real root?',
            options: ['k = 3 or −3', 'k = 6 or −6', 'k = 9 or −9', 'k = 0'],
            correctIndex: 1,
            explanation:
              'A repeated real root requires Δ = 0, so k² − 4(1)(9) = 0, giving k² = 36 and k = ±6.',
          },
        },
        quiz: [
          {
            id: 'q-m1-1',
            question: 'What does a discriminant of Δ = 0 tell you about a quadratic equation?',
            options: [
              'Two distinct irrational roots',
              'Two equal (repeated) real roots',
              'No real roots',
              'One positive and one negative root',
            ],
            correctIndex: 1,
            explanation: 'When Δ = 0, ±√Δ vanishes, leaving a single repeated real root x = −b / (2a).',
            conceptTag: 'Discriminant',
          },
          {
            id: 'q-m1-2',
            question: 'If α and β are roots of 3x² − 12x + 7 = 0, what is α + β?',
            options: ['−4', '4', '7/3', '−7/3'],
            correctIndex: 1,
            explanation: 'By Vieta relations, sum of roots = −b/a = −(−12)/3 = 4.',
            conceptTag: 'Sum & Product of Roots',
          },
          {
            id: 'q-m1-3',
            question: 'Which equation has no real roots?',
            options: [
              'x² − 5x + 6 = 0',
              'x² + 4x + 4 = 0',
              '2x² + 2x + 5 = 0',
              'x² − 9 = 0',
            ],
            correctIndex: 2,
            explanation: 'For 2x² + 2x + 5 = 0, Δ = 2² − 4(2)(5) = 4 − 40 = −36 < 0.',
            conceptTag: 'Discriminant',
          },
        ],
      },
      {
        id: 'math-2',
        order: 2,
        stage: 'Core Mechanics',
        title: 'Trigonometric Ratios & Identity Proofs',
        subtitle: 'Right-triangle ratios, exact angles, and Pythagorean identities',
        estimatedMinutes: 30,
        concepts: ['sin, cos, tan Ratios', 'Exact Values (0°–90°)', 'sin²θ + cos²θ = 1'],
        objectives: [
          'Derive exact trigonometric ratios for 30°, 45°, and 60° from geometric triangles.',
          'Transform complex expressions using the three Pythagorean identities.',
          'Solve heights-and-distances problems using angles of elevation and depression.',
        ],
        whyItMatters:
          'Trigonometry bridges geometry and algebra and is essential for vectors, waves, and optics in Class 10–12 Physics.',
        status: 'in_progress',
        lesson: {
          summary:
            'Trigonometric ratios remain constant for all similar right triangles with the same acute angle θ. Identities let you simplify expressions without needing side lengths.',
          concepts: [
            {
              heading: 'Ratios as Similarity Invariants',
              explanation:
                'Scaling a right triangle doubles every side, so ratios between sides stay identical. Opposite/Hypotenuse defines sin θ, Adjacent/Hypotenuse defines cos θ, and Opposite/Adjacent defines tan θ.',
              formulaOrKeyRule: 'sin θ = Opp / Hyp  |  cos θ = Adj / Hyp  |  tan θ = sin θ / cos θ',
            },
            {
              heading: 'The Master Pythagorean Identity',
              explanation:
                'Dividing a² + b² = c² by c² yields sin²θ + cos²θ = 1. Dividing again by cos²θ or sin²θ gives the secant and cosecant identities automatically.',
              formulaOrKeyRule: 'sin²θ + cos²θ = 1   ⇒   1 + tan²θ = sec²θ',
            },
            {
              heading: 'Proof Strategy for Exam Questions',
              explanation:
                'When stuck on an identity proof, convert the more complex side into sin θ and cos θ, combine fractions over a common denominator, and substitute 1 − cos²θ = sin²θ.',
              formulaOrKeyRule: 'Start from LHS → Rewrite in sin/cos → Factor & Simplify',
            },
          ],
          shortNotes: [
            'SOH-CAH-TOA defines sin, cos, tan strictly relative to the chosen acute angle θ.',
            '3 Master Identities: sin²θ + cos²θ = 1 | 1 + tan²θ = sec²θ | 1 + cot²θ = cosec²θ.',
            'Exact values: sin(0°, 30°, 45°, 60°, 90°) = √0/2, √1/2, √2/2, √3/2, √4/2.',
            'cos values are simply the reverse order of sin values from 0° to 90°.',
          ],
          studyShortcuts: [
            {
              title: 'The √(0,1,2,3,4)/2 Finger Table',
              trick: 'For 0°, 30°, 45°, 60°, 90°, write √0/2, √1/2, √2/2, √3/2, √4/2 to reconstruct the entire sin row in 5 seconds—never memorize randomly.',
              whenToUse: 'At the start of any CBSE/ICSE math exam on your rough sheet.',
            },
            {
              title: 'Convert Everything to sin & cos Fallback',
              trick: 'If an identity proof stalls after 30 seconds, rewrite sec, cosec, tan, and cot in terms of sin and cos and take the LCM.',
              whenToUse: '3-mark and 4-mark "Prove that" identity questions.',
            },
          ],
          visualDiagram: {
            title: 'Trigonometric Identity & Ratio Network',
            caption: 'How all six ratios derive from one unit right triangle',
            centralConcept: 'sin²θ + cos²θ = 1',
            nodes: [
              { label: 'Primary Ratios', detail: 'Triangle side invariants', formula: 'sin = O/H, cos = A/H' },
              { label: 'Quotient Link', detail: 'Connects slope to ratios', formula: 'tan θ = sin θ / cos θ' },
              { label: '÷ cos²θ Branch', detail: 'Yields secant identity', formula: '1 + tan²θ = sec²θ' },
              { label: '÷ sin²θ Branch', detail: 'Yields cosecant identity', formula: '1 + cot²θ = cosec²θ' },
            ],
          },
          revisionCards: [
            { id: 'rc-m2-1', front: 'Exact value of tan 60° and sin 30°?', back: 'tan 60° = √3 and sin 30° = 1/2.' },
            { id: 'rc-m2-2', front: 'What is sec²θ − tan²θ equal to?', back: 'Always equal to 1 (from 1 + tan²θ = sec²θ).' },
            { id: 'rc-m2-3', front: 'First move when stuck on a trig identity proof?', back: 'Rewrite all sec, cosec, tan, cot terms purely in sin θ and cos θ.' },
          ],
          workedExample: {
            prompt: 'Prove that (1 − cos²θ) · sec²θ = tan²θ for acute angle θ.',
            steps: [
              'Start with the Left-Hand Side: (1 − cos²θ) · sec²θ.',
              'Use sin²θ + cos²θ = 1 to replace (1 − cos²θ) with sin²θ.',
              'Rewrite sec²θ as 1 / cos²θ.',
              'Multiply: sin²θ · (1 / cos²θ) = sin²θ / cos²θ = tan²θ = RHS.',
            ],
            takeaway: 'Two substitutions in sin/cos resolve most Class 10 identity proofs cleanly.',
          },
          recallCheck: {
            question: 'If sin θ = 3/5 for an acute angle θ, what is the value of cos θ?',
            options: ['2/5', '4/5', '3/4', '5/4'],
            correctIndex: 1,
            explanation: 'Using sin²θ + cos²θ = 1, cos²θ = 1 − 9/25 = 16/25, so cos θ = 4/5.',
          },
        },
        quiz: [
          {
            id: 'q-m2-1',
            question: 'What is the exact value of sin²(30°) + cos²(30°)?',
            options: ['1/2', '3/4', '1', '√3/2'],
            correctIndex: 2,
            explanation: 'By the Pythagorean identity, sin²θ + cos²θ = 1 for every angle θ.',
            conceptTag: 'Pythagorean Identity',
          },
          {
            id: 'q-m2-2',
            question: 'If tan θ = 1 and θ is acute, what is θ?',
            options: ['30°', '45°', '60°', '90°'],
            correctIndex: 1,
            explanation: 'In a 45°-45°-90° isosceles right triangle, opposite and adjacent legs are equal, so tan 45° = 1.',
            conceptTag: 'Exact Angles',
          },
          {
            id: 'q-m2-3',
            question: 'Which expression is equivalent to sec²θ − tan²θ?',
            options: ['0', '1', 'sin²θ', 'cos²θ'],
            correctIndex: 1,
            explanation: 'Rearranging 1 + tan²θ = sec²θ gives sec²θ − tan²θ = 1.',
            conceptTag: 'Pythagorean Identity',
          },
        ],
      },
      {
        id: 'math-3',
        order: 3,
        stage: 'Applied Practice',
        title: 'Coordinate Geometry: Distance & Section Formula',
        subtitle: 'Mapping algebraic equations onto Cartesian plane distances and midpoints',
        estimatedMinutes: 25,
        concepts: ['Distance Formula', 'Internal Section Formula', 'Collinearity Tests'],
        objectives: [
          'Calculate distances between coordinate pairs using Pythagorean geometry.',
          'Find internal division points and midpoints of line segments.',
          'Verify whether three points form a right, isosceles, or collinear arrangement.',
        ],
        whyItMatters:
          'Coordinate geometry turns visual geometric theorems into fast algebraic calculations.',
        status: 'up_next',
      },
      {
        id: 'math-4',
        order: 4,
        stage: 'Synthesis & Mastery',
        title: 'Arithmetic Progressions & Series Modeling',
        subtitle: 'Modeling linear growth with nth-term and partial-sum formulas',
        estimatedMinutes: 30,
        concepts: ['Common Difference d', 'nth Term aₙ', 'Sum of n Terms Sₙ'],
        objectives: [
          'Determine any term in an arithmetic sequence from first term and common difference.',
          'Compute sums of finite arithmetic series using Gauss pairing.',
          'Model installment plans, seating rows, and linear savings problems.',
        ],
        whyItMatters:
          'Series intuition prepares students directly for discrete math, sequences, and financial modeling.',
        status: 'up_next',
      },
    ],
  };

  const physicsPath: SubjectPath = {
    subject: 'Physics',
    domain: 'stem',
    overview:
      'CBSE Class 10 Physics track covering ray optics, electrical circuits, and electromagnetism with sign-convention rigor.',
    focusStrategy:
      'Master diagram conventions first so algebraic formulas produce physically meaningful answers every time.',
    generatedByAi: false,
    updatedAt: now,
    modules: [
      {
        id: 'phy-1',
        order: 1,
        stage: 'Foundations',
        title: 'Light: Reflection & Spherical Mirrors',
        subtitle: 'Ray diagrams, Cartesian sign convention, and mirror magnification',
        estimatedMinutes: 25,
        concepts: ['Focal Length f = R/2', 'Mirror Formula 1/v + 1/u = 1/f', 'Magnification m = −v/u'],
        objectives: [
          'Trace principal rays for concave and convex mirrors across all object positions.',
          'Apply Cartesian sign conventions consistently without memorizing edge cases.',
          'Predict image size, orientation, and real vs. virtual nature quantitatively.',
        ],
        whyItMatters:
          'Sign-convention discipline here transfers directly to thin lenses and optical instruments.',
        status: 'in_progress',
        lesson: {
          summary:
            'Spherical mirrors bend light predictably using geometry. Treat the mirror pole as the origin (0,0) on a coordinate plane and every sign follows automatically.',
          concepts: [
            {
              heading: 'Cartesian Sign Convention',
              explanation:
                'Place the object to the left of the mirror so incident light travels left-to-right. Distances measured against incident light (to the left) are negative; distances to the right are positive.',
              formulaOrKeyRule: 'Object distance u < 0   |   Concave f < 0   |   Convex f > 0',
            },
            {
              heading: 'The Mirror Equation',
              explanation:
                'Relates object distance u, image distance v, and focal length f. Always substitute known variables with their signs before solving for the unknown.',
              formulaOrKeyRule: '1/v + 1/u = 1/f   where f = R / 2',
            },
            {
              heading: 'Magnification Tells Orientation',
              explanation:
                'A negative magnification means an inverted real image; a positive magnification means an upright virtual image.',
              formulaOrKeyRule: 'm = hᵢ / hₒ = −v / u',
            },
          ],
          shortNotes: [
            'Object distance u is ALWAYS negative in Cartesian convention.',
            'Concave mirror has negative f; convex mirror has positive f.',
            'Mirror formula has a PLUS sign: 1/v + 1/u = 1/f (unlike lenses which use minus).',
            'Negative m → Real & Inverted; Positive m → Virtual & Erect.',
          ],
          studyShortcuts: [
            {
              title: 'Pole = Origin (0,0) Rule',
              trick: 'Imagine an x-y graph centered right at the mirror pole P. Anything on the left is −x, anything upward is +y.',
              whenToUse: 'Never memorize a separate sign table for mirrors vs. lenses again.',
            },
            {
              title: 'Convex = Always VED',
              trick: 'Remember "VED" (Virtual, Erect, Diminished) for every convex mirror case regardless of object distance.',
              whenToUse: 'Instant 1-mark MCQ verification on rear-view mirror questions.',
            },
          ],
          visualDiagram: {
            title: 'Spherical Mirror Ray & Sign Map',
            caption: 'Cartesian coordinate logic centered at mirror pole P',
            centralConcept: '1/v + 1/u = 1/f',
            nodes: [
              { label: 'Left of Pole (−x)', detail: 'Object & real images', formula: 'u < 0, Concave f < 0' },
              { label: 'Right of Pole (+x)', detail: 'Virtual images behind mirror', formula: 'v > 0, Convex f > 0' },
              { label: 'Magnification m', detail: 'Sign gives orientation', formula: 'm = −v/u = hᵢ/hₒ' },
              { label: 'At Center C (u=−2f)', detail: 'Same-size real image', formula: 'v = −2f, m = −1' },
            ],
          },
          revisionCards: [
            { id: 'rc-p1-1', front: 'What is the sign of focal length f for a concave mirror?', back: 'Negative (−), because its principal focus lies in front (left) of the pole.' },
            { id: 'rc-p1-2', front: 'What does m = −2 indicate about the image?', back: 'Real, inverted, and magnified to twice the object height.' },
          ],
          workedExample: {
            prompt: 'An object is placed 30 cm in front of a concave mirror of focal length 15 cm. Find the image position and magnification.',
            steps: [
              'Assign signs: u = −30 cm, f = −15 cm (concave mirror focus lies on the left).',
              'Substitute into 1/v + 1/u = 1/f → 1/v + 1/(−30) = 1/(−15).',
              'Solve for 1/v: 1/v = −1/15 + 1/30 = −2/30 + 1/30 = −1/30 → v = −30 cm.',
              'Compute magnification: m = −v/u = −(−30)/(−30) = −1 (same size, real, inverted at the center of curvature).',
            ],
            takeaway: 'When u = −2f for a concave mirror, the image forms right back at C with m = −1.',
          },
          recallCheck: {
            question: 'A convex rear-view mirror always produces an image that is:',
            options: [
              'Real, inverted, and magnified',
              'Virtual, erect, and diminished',
              'Real, erect, and same size',
              'Virtual, inverted, and diminished',
            ],
            correctIndex: 1,
            explanation: 'Convex mirrors diverge rays, always producing a virtual, upright, diminished image with a wide field of view.',
          },
        },
        quiz: [
          {
            id: 'q-p1-1',
            question: 'What is the focal length of a concave mirror with radius of curvature 24 cm (using Cartesian signs)?',
            options: ['+12 cm', '−12 cm', '−48 cm', '+24 cm'],
            correctIndex: 1,
            explanation: 'f = R/2 = 12 cm, and a concave mirror has a negative focal length (−12 cm).',
            conceptTag: 'Sign Convention',
          },
          {
            id: 'q-p1-2',
            question: 'If magnification m = +2.5 for a spherical mirror, what does the plus sign indicate?',
            options: [
              'The image is real and inverted',
              'The image is virtual and upright',
              'The mirror must be convex',
              'The object is at infinity',
            ],
            correctIndex: 1,
            explanation: 'Positive magnification means upright (erect) orientation, which for a single mirror is always virtual.',
            conceptTag: 'Magnification',
          },
        ],
      },
      {
        id: 'phy-2',
        order: 2,
        stage: 'Core Mechanics',
        title: 'Electricity: Ohm’s Law & Circuit Networks',
        subtitle: 'Potential difference, equivalent resistance, and Joule heating',
        estimatedMinutes: 30,
        concepts: ['V = IR', 'Series vs. Parallel Resistance', 'Electrical Power P = VI'],
        objectives: [
          'Distinguish current flow from potential difference across circuit branches.',
          'Reduce mixed series-parallel resistor networks step by step.',
          'Calculate power dissipation and energy usage in kilowatt-hours.',
        ],
        whyItMatters:
          'Circuit intuition is foundational for electronics, household electrical safety, and electromagnetism.',
        status: 'up_next',
      },
      {
        id: 'phy-3',
        order: 3,
        stage: 'Applied Practice',
        title: 'Magnetic Effects of Electric Current',
        subtitle: 'Right-hand thumb rule, solenoids, and Lorentz force on conductors',
        estimatedMinutes: 25,
        concepts: ['Right-Hand Thumb Rule', 'Solenoid Field Lines', 'Fleming’s Left-Hand Rule'],
        objectives: [
          'Map magnetic field direction around straight conductors, circular loops, and solenoids.',
          'Predict force direction on a current-carrying wire inside a magnetic field.',
          'Explain the core operating principle of DC electric motors.',
        ],
        whyItMatters:
          'Unifies electricity and magnetism and explains how motors, speakers, and MRI coils work.',
        status: 'up_next',
      },
    ],
  };

  const historyPath: SubjectPath = {
    subject: 'World History',
    domain: 'humanities',
    overview:
      'Analytical CBSE Class 10 History sequence tracing nationalism, industrialization, and print culture through structured arguments.',
    focusStrategy:
      'Connect economic catalysts to political movements using cause-effect timelines rather than rote date memorization.',
    generatedByAi: false,
    updatedAt: now,
    modules: [
      {
        id: 'his-1',
        order: 1,
        stage: 'Foundations',
        title: 'The Rise of Nationalism in Europe',
        subtitle: 'From dynastic empires to modern nation-states (1789–1871)',
        estimatedMinutes: 25,
        concepts: ['French Revolution Legacy', '1848 Liberal Revolutions', 'Unification of Italy & Germany'],
        objectives: [
          'Explain how shared language, print culture, and constitutional ideals reshaped European identity.',
          'Compare the diplomatic and military strategies behind Italian and German unification.',
          'Evaluate how nationalist tensions in the Balkans destabilized European alliances.',
        ],
        whyItMatters:
          'Understanding 19th-century nation-building explains the political map and fault lines of World War I.',
        status: 'in_progress',
        lesson: {
          summary:
            'Before 1789, most of Europe was organized under multi-ethnic dynastic empires. Nationalism introduced the radical idea that sovereignty belongs to a unified citizenry.',
          concepts: [
            {
              heading: 'Catalyst: The French Revolution (1789)',
              explanation:
                'Revolutionaries replaced royal authority with collective citizenship (la patrie), standardized weights and laws, and spread civic codes across Europe via Napoleon.',
              formulaOrKeyRule: 'Dynastic Subject → Constitutional Citizen',
            },
            {
              heading: 'Cultural Romanticism & Print',
              explanation:
                'Poets, folklorists, and vernacular newspapers united regional dialects into shared national narratives, mobilizing middle-class reformers across 1830 and 1848.',
              formulaOrKeyRule: 'Shared Vernacular + Print Press → Imagined Community',
            },
            {
              heading: 'Realpolitik Unification (1860s–1871)',
              explanation:
                'Where 1848 liberals failed to unify through parliaments alone, Otto von Bismarck in Prussia and Count Cavour in Piedmont combined diplomacy, railways, and targeted wars.',
              formulaOrKeyRule: 'Economic Union (Zollverein) + Diplomacy → Nation-State',
            },
          ],
          shortNotes: [
            '1789 French Revolution introduced la patrie, le citoyen, tricolor flag, and metric uniformity.',
            '1815 Treaty of Vienna (Metternich) tried to restore conservative monarchies.',
            '1834 Zollverein customs union removed internal tariffs across 39 German states.',
            '1861 Victor Emmanuel II proclaimed king of united Italy; 1871 Kaiser William I of united Germany.',
          ],
          studyShortcuts: [
            {
              title: 'Timeline Anchor "1789 → 1815 → 1848 → 1871"',
              trick: 'Anchor every European nationalism essay to just four turning years: Spark (1789), Conservative Pushback (1815), Liberal Wave (1848), Realpolitik Nation-States (1871).',
              whenToUse: 'Structuring 5-mark long answers chronologically without blanking on dates.',
            },
          ],
          visualDiagram: {
            title: 'Arc of 19th-Century European Nationalism',
            caption: 'Four structural forces that transformed dynastic empires into nation-states',
            centralConcept: 'Rise of Nation-States',
            nodes: [
              { label: '1789 Civic Spark', detail: 'French Revolution & Napoleonic Code', formula: 'Citizenship & Law' },
              { label: '1834 Economic Glue', detail: 'Zollverein customs union & railways', formula: 'Unified Trade' },
              { label: '1848 Liberal Wave', detail: 'Frankfurt Parliament & middle-class push', formula: 'Constitutionalism' },
              { label: '1861–1871 Unification', detail: 'Cavour/Garibaldi & Bismarck Realpolitik', formula: 'Italy & Germany' },
            ],
          },
          revisionCards: [
            { id: 'rc-h1-1', front: 'What was the Zollverein (1834)?', back: 'A Prussian-led customs union that abolished tariff barriers and reduced German currencies from 30+ to 2.' },
            { id: 'rc-h1-2', front: 'Who hosted the 1815 Congress of Vienna?', back: 'Austrian Chancellor Duke Metternich.' },
          ],
          workedExample: {
            prompt: 'How did the Zollverein (1834) accelerate German political unification?',
            steps: [
              'Identify the economic problem: 39 German states maintained separate tariffs, currencies, and weights.',
              'Trace the reform: Prussia initiated the Zollverein customs union, abolishing internal tariff barriers and reducing currencies from over thirty to two.',
              'Connect to politics: Expanded railway networks bound regional merchants together, creating an economic middle class invested in a unified German state.',
            ],
            takeaway: 'Economic integration often creates the shared interests that make political unification durable.',
          },
          recallCheck: {
            question: 'What was the primary role of the Zollverein formed in 1834?',
            options: [
              'A military alliance against Britain',
              'A customs union abolishing internal trade barriers among German states',
              'A parliamentary assembly drafted in Vienna',
              'A colonial trading charter in East Asia',
            ],
            correctIndex: 1,
            explanation: 'The Zollverein eliminated internal tariffs and unified trade standards across German states, strengthening economic nationalism.',
          },
        },
        quiz: [
          {
            id: 'q-h1-1',
            question: 'Which statesman led the policy of "Blood and Iron" in Prussia to unify Germany in 1871?',
            options: ['Giuseppe Mazzini', 'Otto von Bismarck', 'Klemens von Metternich', 'Count Cavour'],
            correctIndex: 1,
            explanation: 'Prussian Chancellor Otto von Bismarck orchestrated three strategic wars and alliances culminating in the 1871 German Empire.',
            conceptTag: 'German Unification',
          },
          {
            id: 'q-h1-2',
            question: 'Why did the 1848 Frankfurt Parliament ultimately fail to unify Germany?',
            options: [
              'It lacked support from monarchs and the Prussian king rejected the crown',
              'Britain blockaded the Baltic Sea',
              'The Industrial Revolution had not yet reached Europe',
              'It was dissolved by the Treaty of Versailles',
            ],
            correctIndex: 0,
            explanation: 'King Friedrich Wilhelm IV of Prussia refused a crown offered by an elected assembly, and conservative troops dispersed the parliament.',
            conceptTag: '1848 Revolutions',
          },
        ],
      },
      {
        id: 'his-2',
        order: 2,
        stage: 'Core Mechanics',
        title: 'The Age of Industrialization & Global Trade',
        subtitle: 'Proto-industrialization, steam power, and colonial textile networks',
        estimatedMinutes: 25,
        concepts: ['Proto-Industrialization', 'Factory System', 'Colonial Trade Shifts'],
        objectives: [
          'Distinguish rural proto-industrial production from centralized factory manufacturing.',
          'Analyze why industrialists adopted steam machinery unevenly across regions.',
          'Trace how British industrialization transformed global cotton and artisan markets.',
        ],
        whyItMatters:
          'Shows how technological shifts alter labor, urbanization, and global economic inequality.',
        status: 'up_next',
      },
      {
        id: 'his-3',
        order: 3,
        stage: 'Synthesis & Mastery',
        title: 'Print Culture & the Modern Public Sphere',
        subtitle: 'From Gutenberg woodblocks to mass literacy and civic debate',
        estimatedMinutes: 25,
        concepts: ['Print Revolution', 'Reading Publics', 'Censorship & Reform'],
        objectives: [
          'Trace the spread of print technology from East Asia to Europe and colonial cities.',
          'Evaluate how inexpensive print lowered barriers to scientific and religious debate.',
          'Analyze primary-source arguments about press freedom and social reform.',
        ],
        whyItMatters:
          'Connects media technology directly to democratic movements and modern information literacy.',
        status: 'up_next',
      },
    ],
  };

  const subjects = ['Mathematics', 'Physics', 'World History'];
  const todayKey = formatLocalDateKey();

  return {
    id: 'sample-aarav-class10',
    name: 'Aarav Mehta',
    classLevel: 'Class 10',
    syllabus: 'CBSE',
    subjects,
    goal: 'exam_prep',
    dailyMinutes: 45,
    timetable: generateStudyTimetable(subjects, 45),
    completedDates: [shiftDateKey(todayKey, -2), shiftDateKey(todayKey, -1)],
    paths: {
      Mathematics: mathPath,
      Physics: physicsPath,
      'World History': historyPath,
    },
    tutorHistory: {
      Mathematics: [
        {
          id: 'welcome-math',
          role: 'tutor',
          content:
            'Welcome back, Aarav. You are on the **CBSE Class 10** track and currently studying **Trigonometric Ratios & Identity Proofs**.\n\nAsk me to walk through a tricky NCERT proof, generate study shortcuts, or drill exact trigonometric angles.',
          timestamp: now,
        },
      ],
    },
    createdAt: now,
  };
}
