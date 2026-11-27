import type {
  PreviousYearPaper,
  PreviousYearQuestion,
  SimilarPaperDifficulty,
} from '../types/study';

export const PREVIOUS_YEAR_OPTIONS = ['2025', '2024', '2023', '2022', '2021'] as const;
export type PreviousYearOption = (typeof PREVIOUS_YEAR_OPTIONS)[number];

export const SIMILAR_DIFFICULTY_OPTIONS: ReadonlyArray<{
  id: SimilarPaperDifficulty;
  label: string;
  description: string;
}> = [
  {
    id: 'same',
    label: 'Exact Board Match',
    description: 'Matches the exact difficulty and mark scheme of the reference previous year paper.',
  },
  {
    id: 'challenging',
    label: 'Slightly Harder',
    description: 'Keeps the same syllabus topics with higher-order application twists.',
  },
  {
    id: 'revision',
    label: 'Quick Revision',
    description: 'Focuses on high-frequency board patterns ideal for timed revision.',
  },
];

export function extractYearDigits(rawYear: string | undefined): string {
  if (!rawYear) return PREVIOUS_YEAR_OPTIONS[0];
  const match = rawYear.match(/\b(20\d{2})\b/);
  return match ? match[1] : PREVIOUS_YEAR_OPTIONS[0];
}

export function sumPaperMarks(questions: ReadonlyArray<Pick<PreviousYearQuestion, 'marks'>>): number {
  return questions.reduce(
    (sum, q) => sum + (Number.isFinite(q.marks) && q.marks > 0 ? Math.round(q.marks) : 0),
    0
  );
}

/**
 * Generates an instant, authentic subject-aware Similar Question Paper modeled on a previous year
 * board exam blueprint, with fresh isomorphic questions and reference-question comparison.
 */
export function buildSampleSimilarPreviousYearPaper(params: {
  classLevel: string;
  syllabus: string;
  subject: string;
  referenceYear: string;
  difficulty?: SimilarPaperDifficulty;
  referencePaper?: PreviousYearPaper;
}): PreviousYearPaper {
  const {
    classLevel,
    syllabus,
    subject,
    referenceYear,
    difficulty = 'same',
    referencePaper,
  } = params;

  const year = extractYearDigits(referenceYear);
  const lowerSub = subject.toLowerCase();
  const isMath = lowerSub.includes('math');
  const isScience =
    lowerSub.includes('physics') ||
    lowerSub.includes('chem') ||
    lowerSub.includes('bio') ||
    lowerSub.includes('science');

  const refQuestions = referencePaper?.questions ?? [];

  const questions: PreviousYearQuestion[] = isMath
    ? [
        {
          number: 'Q1',
          section: 'Section A · 1 Mark Objective',
          marks: 1,
          conceptTested: 'Quadratic Roots & Coefficient Solving',
          similarTo: `Parallel to ${year} Q1 — same root-substitution method with new coefficients`,
          referenceQuestion:
            refQuestions[0]?.question ??
            `(${year} Board) If one root of the quadratic equation 2x² + kx − 6 = 0 is 2, find the value of k.`,
          question:
            'If one root of the quadratic equation 3x² − kx − 8 = 0 is 4, find the value of k.',
          markingScheme:
            'Substitute x = 4 into 3x² − kx − 8 = 0: 3(16) − 4k − 8 = 0 → 40 − 4k = 0 → k = 10. (0.5 mark substitution, 0.5 mark final value)',
        },
        {
          number: 'Q2',
          section: 'Section B · 2 Marks Short Answer',
          marks: 2,
          conceptTested: 'Standard Trigonometric Ratios',
          similarTo: `Parallel to ${year} Q2 — evaluates exact standard angles without a calculator`,
          referenceQuestion:
            refQuestions[1]?.question ??
            `(${year} Board) Evaluate 2·tan²45° + cos²30° − sin²60° without using a calculator.`,
          question:
            'Evaluate 3·sin²60° + 2·tan²45° − cos²30° without using a calculator.',
          markingScheme:
            'Substitute exact values: 3(√3/2)² + 2(1)² − (√3/2)² = 3(3/4) + 2 − 3/4 = 9/4 − 3/4 + 2 = 6/4 + 2 = 3.5 (or 7/2). (1 mark exact ratios, 1 mark simplification)',
        },
        {
          number: 'Q3',
          section: 'Section C · 3 Marks Structured Problem',
          marks: 3,
          conceptTested: 'Quadratic Modeling from Reciprocal Sums',
          similarTo: `Parallel to ${year} Q3 — reciprocal word problem leading to factorable quadratic`,
          referenceQuestion:
            refQuestions[2]?.question ??
            `(${year} Board) The sum of two numbers is 15. If the sum of their reciprocals is 3/10, find both numbers.`,
          question:
            'The sum of two natural numbers is 16. If the sum of their reciprocals is 1/3, find both numbers.',
          markingScheme:
            'Let the numbers be x and (16 − x). 1/x + 1/(16 − x) = 1/3 → 16 / [x(16 − x)] = 1/3 → x² − 16x + 48 = 0 → (x − 12)(x − 4) = 0. Numbers are 4 and 12. (1 mark equation setup, 1 mark quadratic form, 1 mark roots)',
        },
        {
          number: 'Q4',
          section: 'Section D · 5 Marks Long Analytical Question',
          marks: 5,
          conceptTested: 'Heights & Distances (Angle of Elevation & Depression)',
          similarTo: `Parallel to ${year} Q4 — two-triangle elevation & depression geometry`,
          referenceQuestion:
            refQuestions[3]?.question ??
            `(${year} Board) From the top of a 7 m high building, the angle of elevation of the top of a cable tower is 60° and the angle of depression of its foot is 45°. Determine the height of the tower.`,
          question:
            'From the top of a 10 m high lighthouse, the angle of elevation of the top of a signal mast on a cliff is 60° and the angle of depression of its base is 45°. Find the total height of the mast above sea level.',
          markingScheme:
            'Labeled right-triangle diagram (1 mark). Horizontal distance d = 10 / tan 45° = 10 m (1.5 marks). Height above lighthouse h = 10·tan 60° = 10√3 m (1.5 marks). Total height = 10(√3 + 1) m ≈ 27.32 m (1 mark).',
        },
        {
          number: 'Q5',
          section: 'Section E · 4 Marks Case-Based Study',
          marks: 4,
          conceptTested: 'Arithmetic Progression Application',
          similarTo: `Parallel to ${year} Case Study — multi-part real-life sequence calculation`,
          referenceQuestion:
            refQuestions[4]?.question ??
            `(${year} Board) Case study applying linear progression to auditorium seating rows and total capacity.`,
          question:
            'A school library arranges study desks in rows such that the 1st row has 8 desks, the 2nd row has 11 desks, the 3rd row has 14 desks, and so on. (a) How many desks are in the 12th row? [2 Marks] (b) Find the total number of desks across the first 10 rows. [2 Marks]',
          markingScheme:
            'Identify AP with a = 8, d = 3 (0.5 mark). (a) a₁₂ = 8 + 11(3) = 41 desks (1.5 marks). (b) S₁₀ = (10/2)[2(8) + 9(3)] = 5(16 + 27) = 215 desks (2 marks).',
        },
      ]
    : isScience
      ? [
          {
            number: 'Q1',
            section: 'Section A · 1 Mark Objective',
            marks: 1,
            conceptTested: 'Fundamental Laws & SI Units',
            similarTo: `Parallel to ${year} Q1 — tests core law statement and dimensional unit`,
            referenceQuestion:
              refQuestions[0]?.question ??
              `(${year} Board) State the fundamental SI unit and governing physical law taught in the first unit of ${classLevel} ${subject}.`,
            question: `Define the primary conserved quantity or governing principle introduced in Unit 1 of ${classLevel} ${subject} and state its SI unit.`,
            markingScheme:
              '0.5 mark for precise scientific definition/conservation statement; 0.5 mark for exact SI unit and symbol.',
          },
          {
            number: 'Q2',
            section: 'Section B · 2 Marks Short Answer',
            marks: 2,
            conceptTested: 'Structured Comparison & Application',
            similarTo: `Parallel to ${year} Q2 — two-point distinction with practical illustration`,
            referenceQuestion:
              refQuestions[1]?.question ??
              `(${year} Board) Compare two core concepts from ${subject} using one concrete real-world example.`,
            question: `Differentiate between two closely related phenomena or processes in ${syllabus} ${classLevel} ${subject} in tabular form, and cite one everyday observation.`,
            markingScheme:
              '1 mark for two accurate contrasting points in structured format; 1 mark for relevant real-world observation.',
          },
          {
            number: 'Q3',
            section: 'Section C · 3 Marks Structured Problem',
            marks: 3,
            conceptTested: 'Mechanism & Stepwise Reasoning',
            similarTo: `Parallel to ${year} Q3 — cause-effect derivation with labeled steps`,
            referenceQuestion:
              refQuestions[2]?.question ??
              `(${year} Board) Explain a step-by-step derivation or cause-effect mechanism central to ${syllabus} ${classLevel} ${subject}.`,
            question: `Explain the stepwise mechanism behind a high-weightage reaction, circuit, or biological pathway in ${classLevel} ${subject}, noting one factor that alters its rate.`,
            markingScheme:
              '1 mark for starting conditions/setup; 1 mark for logical sequence or balanced equation/formula; 1 mark for explaining the controlling factor.',
          },
          {
            number: 'Q4',
            section: 'Section D · 5 Marks Long Analytical Question',
            marks: 5,
            conceptTested: 'Experimental Design & Synthesis',
            similarTo: `Parallel to ${year} Q4 — diagram-backed board long answer`,
            referenceQuestion:
              refQuestions[3]?.question ??
              `(${year} Board) Write a structured long-form analysis linking foundational theory to an applied ${syllabus} board case study in ${subject}.`,
            question: `With the help of a neat labeled schematic, explain how a core ${subject} principle is verified experimentally in the ${syllabus} ${classLevel} curriculum, and state two precautions to minimize error.`,
            markingScheme:
              '1.5 marks for clean labeled schematic/setup; 2.5 marks for procedure and theoretical justification; 1 mark for two valid precautions.',
          },
          {
            number: 'Q5',
            section: 'Section E · 4 Marks Case-Based Study',
            marks: 4,
            conceptTested: 'Data Interpretation & Inference',
            similarTo: `Parallel to ${year} Case Study — applied laboratory observation analysis`,
            referenceQuestion:
              refQuestions[4]?.question ??
              `(${year} Board) Case-based question interpreting experimental readings and identifying anomalies.`,
            question: `During a ${classLevel} ${subject} lab trial, a student records an unexpected shift in output when doubling the primary input variable. (a) Identify the governing relationship [2 Marks]. (b) Predict the corrected reading and justify your reasoning [2 Marks].`,
            markingScheme:
              '(a) 2 marks for naming the proportionality/law and variables accurately. (b) 2 marks for quantitative or directional prediction supported by theory.',
          },
        ]
      : [
          {
            number: 'Q1',
            section: 'Section A · 1 Mark Objective',
            marks: 1,
            conceptTested: 'Key Terminology & Conceptual Recall',
            similarTo: `Parallel to ${year} Q1 — single-concept precision question`,
            referenceQuestion:
              refQuestions[0]?.question ??
              `(${year} Board) State a foundational definition or turning point from the opening unit of ${classLevel} ${subject}.`,
            question: `Identify one foundational principle, term, or landmark event from Unit 1 of ${syllabus} ${classLevel} ${subject} and state its immediate significance.`,
            markingScheme:
              '0.5 mark for exact identification; 0.5 mark for concise statement of significance.',
          },
          {
            number: 'Q2',
            section: 'Section B · 2 Marks Short Answer',
            marks: 2,
            conceptTested: 'Comparative Analysis',
            similarTo: `Parallel to ${year} Q2 — concise two-point comparison`,
            referenceQuestion:
              refQuestions[1]?.question ??
              `(${year} Board) Compare two core concepts from ${subject} using one concrete real-world example.`,
            question: `Contrast two central themes or frameworks from ${classLevel} ${subject} and support your distinction with one curriculum example.`,
            markingScheme:
              '1 mark for two clear contrasting points; 1 mark for an accurate syllabus-aligned example.',
          },
          {
            number: 'Q3',
            section: 'Section C · 3 Marks Structured Problem',
            marks: 3,
            conceptTested: 'Cause-and-Effect Evaluation',
            similarTo: `Parallel to ${year} Q3 — three-point structured explanation`,
            referenceQuestion:
              refQuestions[2]?.question ??
              `(${year} Board) Explain a step-by-step derivation or cause-effect mechanism central to ${syllabus} ${classLevel} ${subject}.`,
            question: `Analyze three key factors that shaped a major outcome or principle in ${syllabus} ${classLevel} ${subject}.`,
            markingScheme:
              '1 mark per distinct, well-explained factor with clear linkage to the outcome (3 × 1 = 3 marks).',
          },
          {
            number: 'Q4',
            section: 'Section D · 5 Marks Long Analytical Question',
            marks: 5,
            conceptTested: 'Long-Form Critical Synthesis',
            similarTo: `Parallel to ${year} Q4 — structured 5-mark board essay/analysis`,
            referenceQuestion:
              refQuestions[3]?.question ??
              `(${year} Board) Write a structured long-form analysis linking foundational theory to an applied ${syllabus} board case study in ${subject}.`,
            question: `Evaluate how foundational theory in ${classLevel} ${subject} applies to a contemporary case study in the ${syllabus} syllabus. Organize your response with an introduction, three analytical points, and a conclusion.`,
            markingScheme:
              '1 mark for focused framing/introduction; 3 marks for three substantiated analytical points; 1 mark for balanced conclusion.',
          },
          {
            number: 'Q5',
            section: 'Section E · 4 Marks Source / Case-Based Study',
            marks: 4,
            conceptTested: 'Source Interpretation & Application',
            similarTo: `Parallel to ${year} Case Study — evidence-backed sub-questions`,
            referenceQuestion:
              refQuestions[4]?.question ??
              `(${year} Board) Source-based case question requiring textual or contextual inference.`,
            question: `Consider a primary excerpt or scenario from ${classLevel} ${subject}: (a) Identify the underlying issue illustrated [2 Marks]. (b) Suggest two evidence-backed implications relevant to the ${syllabus} exam [2 Marks].`,
            markingScheme:
              '(a) 2 marks for accurate diagnosis grounded in syllabus terms. (b) 2 marks for two concrete, reasoned implications.',
          },
        ];

  const totalMarks = sumPaperMarks(questions);
  const difficultyLabel =
    SIMILAR_DIFFICULTY_OPTIONS.find((opt) => opt.id === difficulty)?.label ?? 'Exact Board Match';

  return {
    title: `${syllabus} ${classLevel} ${subject} — Similar Practice Paper (${year} Pattern)`,
    year: `Similar to ${year} Board Paper`,
    basedOnYear: year,
    basedOnTitle:
      referencePaper?.title ?? `${syllabus} ${classLevel} ${subject} — ${year} Board Question Paper`,
    difficulty,
    patternNote: `Mirrors the ${year} ${syllabus} ${classLevel} ${subject} section structure and mark distribution (${difficultyLabel}) with fresh parallel questions.`,
    syllabus,
    classLevel,
    subject,
    durationMinutes: referencePaper?.durationMinutes ?? 60,
    maxMarks: totalMarks,
    questions,
  };
}

/**
 * Safely normalizes an AI-generated similar paper response, guaranteeing clean defaults,
 * exact marks total fallback, and reference-question comparison links.
 */
export function normalizeSimilarPaperResponse(
  raw: Partial<PreviousYearPaper> | null | undefined,
  context: {
    classLevel: string;
    syllabus: string;
    subject: string;
    referenceYear: string;
    difficulty: SimilarPaperDifficulty;
    referencePaper?: PreviousYearPaper;
  }
): PreviousYearPaper {
  const year = extractYearDigits(context.referenceYear);
  const refQuestions = context.referencePaper?.questions ?? [];

  const rawQuestions = Array.isArray(raw?.questions) ? raw.questions : [];
  const normalizedQuestions: PreviousYearQuestion[] = rawQuestions
    .filter((q): q is PreviousYearQuestion => Boolean(q && typeof q.question === 'string' && q.question.trim()))
    .map((q, idx) => {
      const refQ = refQuestions[idx];
      const marks =
        typeof q.marks === 'number' && Number.isFinite(q.marks) && q.marks > 0
          ? Math.round(q.marks)
          : refQ?.marks ?? 2;
      return {
        number: q.number?.trim() || `Q${idx + 1}`,
        section: q.section?.trim() || refQ?.section || `Section ${String.fromCharCode(65 + idx)}`,
        marks,
        question: q.question.trim(),
        markingScheme:
          q.markingScheme?.trim() ||
          'Award step marks for formula/setup, intermediate working, and accurate final answer.',
        conceptTested: q.conceptTested?.trim() || undefined,
        similarTo:
          q.similarTo?.trim() ||
          `Parallel to ${year} ${refQ?.number ?? `Q${idx + 1}`} (${marks} ${marks === 1 ? 'Mark' : 'Marks'})`,
        referenceQuestion: q.referenceQuestion?.trim() || refQ?.question || undefined,
      };
    });

  if (normalizedQuestions.length === 0) {
    return buildSampleSimilarPreviousYearPaper(context);
  }

  const computedMarks = sumPaperMarks(normalizedQuestions);
  const maxMarks =
    typeof raw?.maxMarks === 'number' && raw.maxMarks >= computedMarks
      ? Math.round(raw.maxMarks)
      : computedMarks;

  return {
    title:
      raw?.title?.trim() ||
      `${context.syllabus} ${context.classLevel} ${context.subject} — Similar Practice Paper (${year} Pattern)`,
    year: raw?.year?.trim() || `Similar to ${year} Board Paper`,
    basedOnYear: extractYearDigits(raw?.basedOnYear || year),
    basedOnTitle:
      context.referencePaper?.title ??
      `${context.syllabus} ${context.classLevel} ${context.subject} — ${year} Board Paper`,
    difficulty: context.difficulty,
    patternNote:
      raw?.patternNote?.trim() ||
      `Mirrors the ${year} ${context.syllabus} ${context.classLevel} ${context.subject} blueprint with fresh parallel questions.`,
    syllabus: context.syllabus,
    classLevel: context.classLevel,
    subject: context.subject,
    durationMinutes:
      typeof raw?.durationMinutes === 'number' && raw.durationMinutes >= 15
        ? Math.round(raw.durationMinutes)
        : 60,
    maxMarks,
    questions: normalizedQuestions,
  };
}
