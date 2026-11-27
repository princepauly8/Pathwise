import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { attachStudyRoomWebSocket } from './server/studyRooms.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBSCRIPTION_PLAN_ID = 'scholar_7yr_200inr' as const;
const SUBSCRIPTION_AMOUNT_INR = 200 as const;
const SUBSCRIPTION_AMOUNT_PAISE = 20000 as const;
const SUBSCRIPTION_DURATION_YEARS = 7 as const;
const FREE_REFERRAL_CODE = 'PRINCE' as const;
const SUBSCRIPTION_SIGNING_KEY =
  process.env.SUBSCRIPTION_SIGNING_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

function signOrderPayload(orderId: string, studentId: string): string {
  return crypto
    .createHmac('sha256', SUBSCRIPTION_SIGNING_KEY)
    .update(`${orderId}:${studentId}:${SUBSCRIPTION_PLAN_ID}:${SUBSCRIPTION_AMOUNT_INR}:${SUBSCRIPTION_DURATION_YEARS}`)
    .digest('hex');
}

function safeHexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const PRIMARY_COOLDOWN_MS = 5 * 60 * 1000;

let primaryModelCooldownUntil = 0;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.'
    ) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorInfo(err: unknown): { status: number; message: string; codeText: string } {
  const errorObj = err as {
    status?: number;
    statusCode?: number;
    code?: number;
    message?: string;
  };
  let status = errorObj?.statusCode ?? errorObj?.status ?? 500;
  let message = typeof errorObj?.message === 'string' ? errorObj.message : '';
  let codeText = '';

  // Unwrap JSON-encoded ApiError messages from @google/genai
  if (message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') status = parsed.error.code;
        if (typeof parsed.error.message === 'string' && parsed.error.message.trim()) {
          message = parsed.error.message.trim();
        }
        if (typeof parsed.error.status === 'string') {
          codeText = parsed.error.status;
        }
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  return { status, message, codeText };
}

function isRetryableGeminiError(err: unknown): boolean {
  const { status, message, codeText } = extractErrorInfo(err);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const combined = `${codeText} ${message}`.toUpperCase();
  return (
    combined.includes('UNAVAILABLE') ||
    combined.includes('RESOURCE_EXHAUSTED') ||
    combined.includes('HIGH DEMAND') ||
    combined.includes('OVERLOADED') ||
    combined.includes('ECONNRESET') ||
    combined.includes('ETIMEDOUT') ||
    combined.includes('FETCH FAILED')
  );
}

const PRIMARY_TIMEOUT_MS = 16000;
const FALLBACK_TIMEOUT_MS = 26000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`) as Error & {
        statusCode?: number;
      };
      err.statusCode = 504;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  request: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  const primaryInCooldown = Date.now() < primaryModelCooldownUntil;
  const modelSequence = primaryInCooldown
    ? [FALLBACK_MODEL, PRIMARY_MODEL]
    : [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown = null;

  for (const model of modelSequence) {
    const isPrimary = model === PRIMARY_MODEL;
    const maxAttempts = isPrimary ? 1 : 2;
    const timeoutMs = isPrimary ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            ...request,
            model,
          }),
          timeoutMs,
          `Gemini ${model}`
        );
        const text = (response.text ?? '').trim();
        if (!text) {
          const emptyErr = new Error('Model returned an empty response.') as Error & {
            statusCode?: number;
          };
          emptyErr.statusCode = 502;
          throw emptyErr;
        }
        if (isPrimary) {
          primaryModelCooldownUntil = 0;
        }
        return response;
      } catch (err) {
        lastError = err;
        const { status } = extractErrorInfo(err);
        const retryable = isRetryableGeminiError(err);

        // Stop immediately on auth or bad-request errors
        if (!retryable && status !== 404) {
          throw err;
        }

        // Put primary model on cooldown after quota/overload/timeout errors and switch immediately to fallback
        if (isPrimary && (status === 429 || status === 503 || status === 504 || status === 404)) {
          primaryModelCooldownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
          break;
        }

        // Do not immediately hammer the same model again on 404 or 429 quota exhaustion
        if (status === 404 || status === 429) {
          break;
        }

        if (attempt < maxAttempts) {
          const delayMs = 700 * attempt + Math.floor(Math.random() * 250);
          await sleep(delayMs);
        }
      }
    }
  }

  throw lastError ?? new Error('Unable to reach the Gemini AI service.');
}

function handleApiError(res: express.Response, err: unknown, fallbackMsg: string): void {
  const { status, message, codeText } = extractErrorInfo(err);
  const combined = `${codeText} ${message}`;
  console.error(`[API Error] HTTP ${status}: ${message || fallbackMsg}`);

  let userMessage = message || fallbackMsg;
  if (
    status === 403 ||
    combined.includes('PERMISSION_DENIED') ||
    combined.includes('API_KEY_INVALID')
  ) {
    userMessage =
      'Unable to authenticate with the Gemini API. Please verify your API key in Settings > Secrets.';
  } else if (status === 429 || combined.includes('RESOURCE_EXHAUSTED')) {
    userMessage =
      'The AI service is temporarily rate-limited. Please wait a few seconds and try again, or verify your quota in Settings > Secrets.';
  } else if (
    status === 503 ||
    combined.includes('UNAVAILABLE') ||
    combined.toLowerCase().includes('high demand')
  ) {
    userMessage =
      'The AI service is experiencing temporary high demand. Please try again in a few seconds.';
  } else if (status === 404 || combined.includes('NOT_FOUND')) {
    userMessage = 'The requested AI model is currently unavailable. Please try again shortly.';
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: userMessage,
  });
}

function cleanText(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function parseModelJson<T>(rawText: string | undefined, fallback: T): T {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) return fallback;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const firstBrace = unfenced.indexOf('{');
    const lastBrace = unfenced.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new SyntaxError('Model returned malformed JSON.');
  }
}

function languageInstruction(rawLanguage: unknown): string {
  const cleanLang = cleanText(rawLanguage, 60);
  if (!cleanLang || cleanLang.toLowerCase() === 'english') {
    return 'Respond in clear, natural English.';
  }
  return `Respond ENTIRELY in ${cleanLang} using its natural native script (for example, Malayalam script മലയാളം for Malayalam, Devanagari for Hindi, Tamil script for Tamil, etc.). Keep universal mathematical symbols, equations, and chemical/scientific formulas accurate and readable.`;
}

const learningPathResponseSchema = {
  type: Type.OBJECT,
  properties: {
    paths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          overview: { type: Type.STRING },
          focusStrategy: { type: Type.STRING },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                order: { type: Type.INTEGER },
                stage: { type: Type.STRING },
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
                concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                whyItMatters: { type: Type.STRING },
              },
              required: [
                'order',
                'stage',
                'title',
                'subtitle',
                'estimatedMinutes',
                'concepts',
                'objectives',
                'whyItMatters',
              ],
            },
          },
        },
        required: ['subject', 'overview', 'focusStrategy', 'modules'],
      },
    },
  },
  required: ['paths'],
};

const boardSyllabusSyncSchema = {
  type: Type.OBJECT,
  properties: {
    academicSession: { type: Type.STRING },
    boardAuthority: { type: Type.STRING },
    summary: { type: Type.STRING },
    highlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    paths: learningPathResponseSchema.properties.paths,
  },
  required: ['academicSession', 'boardAuthority', 'summary', 'highlights', 'paths'],
};

const lessonResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    concepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          explanation: { type: Type.STRING },
          formulaOrKeyRule: { type: Type.STRING },
        },
        required: ['heading', 'explanation', 'formulaOrKeyRule'],
      },
    },
    shortNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    studyShortcuts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          trick: { type: Type.STRING },
          whenToUse: { type: Type.STRING },
        },
        required: ['title', 'trick', 'whenToUse'],
      },
    },
    visualDiagram: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        caption: { type: Type.STRING },
        centralConcept: { type: Type.STRING },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              detail: { type: Type.STRING },
              formula: { type: Type.STRING },
            },
            required: ['label', 'detail', 'formula'],
          },
        },
      },
      required: ['title', 'caption', 'centralConcept', 'nodes'],
    },
    revisionCards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ['front', 'back'],
      },
    },
    workedExample: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING },
        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
        takeaway: { type: Type.STRING },
      },
      required: ['prompt', 'steps', 'takeaway'],
    },
    recallCheck: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctIndex: { type: Type.INTEGER },
        explanation: { type: Type.STRING },
      },
      required: ['question', 'options', 'correctIndex', 'explanation'],
    },
  },
  required: [
    'summary',
    'concepts',
    'shortNotes',
    'studyShortcuts',
    'visualDiagram',
    'revisionCards',
    'workedExample',
    'recallCheck',
  ],
};

const quizResponseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          conceptTag: { type: Type.STRING },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'conceptTag'],
      },
    },
  },
  required: ['questions'],
};

const exampleQuestionsSchema = {
  type: Type.OBJECT,
  properties: {
    examples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          marks: { type: Type.INTEGER },
          difficulty: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          finalAnswer: { type: Type.STRING },
          examTip: { type: Type.STRING },
        },
        required: ['question', 'marks', 'difficulty', 'steps', 'finalAnswer', 'examTip'],
      },
    },
  },
  required: ['examples'],
};

const aptitudeQuestionsSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          shortcutMethod: { type: Type.STRING },
        },
        required: ['category', 'question', 'options', 'correctIndex', 'shortcutMethod'],
      },
    },
  },
  required: ['questions'],
};

const pyqPaperSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    year: { type: Type.STRING },
    durationMinutes: { type: Type.INTEGER },
    maxMarks: { type: Type.INTEGER },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.STRING },
          section: { type: Type.STRING },
          marks: { type: Type.INTEGER },
          question: { type: Type.STRING },
          markingScheme: { type: Type.STRING },
        },
        required: ['number', 'section', 'marks', 'question', 'markingScheme'],
      },
    },
  },
  required: ['title', 'year', 'durationMinutes', 'maxMarks', 'questions'],
};

const similarPyqPaperSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    year: { type: Type.STRING },
    basedOnYear: { type: Type.STRING },
    patternNote: { type: Type.STRING },
    durationMinutes: { type: Type.INTEGER },
    maxMarks: { type: Type.INTEGER },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.STRING },
          section: { type: Type.STRING },
          marks: { type: Type.INTEGER },
          conceptTested: { type: Type.STRING },
          similarTo: { type: Type.STRING },
          referenceQuestion: { type: Type.STRING },
          question: { type: Type.STRING },
          markingScheme: { type: Type.STRING },
        },
        required: [
          'number',
          'section',
          'marks',
          'conceptTested',
          'similarTo',
          'question',
          'markingScheme',
        ],
      },
    },
  },
  required: [
    'title',
    'year',
    'basedOnYear',
    'patternNote',
    'durationMinutes',
    'maxMarks',
    'questions',
  ],
};

const motivationSchema = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    affirmation: { type: Type.STRING },
    actionPrompt: { type: Type.STRING },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          minuteRange: { type: Type.STRING },
          title: { type: Type.STRING },
          guidance: { type: Type.STRING },
        },
        required: ['minuteRange', 'title', 'guidance'],
      },
    },
  },
  required: ['theme', 'subtitle', 'affirmation', 'actionPrompt', 'segments'],
};

const youtubeClassQuizSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    keyTakeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          conceptTag: { type: Type.STRING },
          timestampHint: { type: Type.STRING },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'conceptTag'],
      },
    },
  },
  required: ['summary', 'keyTakeaways', 'questions'],
};

const VALID_STAGES = [
  'Foundations',
  'Core Mechanics',
  'Applied Practice',
  'Synthesis & Mastery',
] as const;

function normalizeStage(raw: string, index: number): (typeof VALID_STAGES)[number] {
  const matched = VALID_STAGES.find(
    (s) => s.toLowerCase() === String(raw ?? '').trim().toLowerCase()
  );
  if (matched) return matched;
  return VALID_STAGES[Math.min(index, VALID_STAGES.length - 1)];
}

async function startServer() {
  const app = express();
  app.use('/api/video/quiz', express.json({ limit: '25mb' }));
  app.use('/api/tutor', express.json({ limit: '12mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1. Generate specialized learning paths for selected class, syllabus & subjects
  app.post('/api/learning-path', async (req, res) => {
    try {
      const {
        studentName,
        classLevel,
        syllabus,
        language,
        subjects,
        goal,
        dailyMinutes,
        customNote,
      } = req.body ?? {};
      if (
        typeof classLevel !== 'string' ||
        !classLevel.trim() ||
        !Array.isArray(subjects) ||
        subjects.length === 0
      ) {
        res.status(400).json({ error: 'classLevel and at least one subject are required.' });
        return;
      }

      const cleanSubjects = subjects
        .map((s: unknown) => cleanText(s, 80))
        .filter(Boolean)
        .slice(0, 8);
      const cleanSyllabus = cleanText(syllabus || 'CBSE', 60);
      const langDirective = languageInstruction(language);

      const ai = getAiClient();
      const goalLabels: Record<string, string> = {
        foundations: 'Build strong conceptual foundations with intuitive explanations',
        exam_prep: 'Exam readiness with board marking schemes, short notes, and PYQ patterns',
        deep_mastery: 'Deep first-principles mastery with rigorous connections and challenges',
      };

      const prompt = [
        `Design a specialized, syllabus-accurate learning path for a student.`,
        `Student Name: ${cleanText(studentName || 'Student', 80)}`,
        `Class / Academic Level: ${cleanText(classLevel, 40)}`,
        `Syllabus / Curriculum Board: ${cleanSyllabus}`,
        `Subjects: ${cleanSubjects.join(', ')}`,
        `Learning Goal: ${goalLabels[String(goal)] ?? goalLabels.foundations}`,
        `Daily Study Pace: ${Number(dailyMinutes) || 45} minutes/day`,
        customNote ? `Student Adaptation Request: ${cleanText(customNote, 300)}` : '',
        '',
        'Instructions:',
        '- Return exactly one path object per subject requested, matching the exact subject names provided.',
        `- Align chapters strictly to the ${cleanSyllabus} syllabus for ${cleanText(classLevel, 40)}.`,
        '- Each subject path must have exactly 4 progressive modules, one for each stage in order: "Foundations", "Core Mechanics", "Applied Practice", "Synthesis & Mastery".',
        '- Keep the "stage" field in English ("Foundations", "Core Mechanics", "Applied Practice", "Synthesis & Mastery") and the "subject" field matching the requested subject names.',
        `- ${langDirective}`,
        '- Keep overview and focusStrategy under 220 characters each, titles crisp, concepts to 3 key items, objectives to 3 actionable bullets, and estimatedMinutes between 20 and 40.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are an expert academic curriculum designer familiar with CBSE, ICSE, State Boards, IB, and IGCSE syllabi. Output clean, accurate JSON learning paths. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: learningPathResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, { paths: [] }) as {
        paths?: Array<{
          subject: string;
          overview: string;
          focusStrategy: string;
          modules: Array<{
            order: number;
            stage: string;
            title: string;
            subtitle: string;
            estimatedMinutes: number;
            concepts: string[];
            objectives: string[];
            whyItMatters: string;
          }>;
        }>;
      };

      const rawPaths = Array.isArray(parsed.paths) ? parsed.paths : [];
      const now = new Date().toISOString();

      const normalized = rawPaths.map((p, pIdx) => ({
        subject: cleanSubjects[pIdx] ?? cleanText(p.subject, 80),
        overview: cleanText(p.overview, 580),
        focusStrategy: cleanText(p.focusStrategy, 580),
        adaptationNote: customNote ? cleanText(customNote, 280) : undefined,
        generatedByAi: true,
        updatedAt: now,
        modules: (p.modules ?? []).slice(0, 5).map((m, idx) => ({
          id: `${(cleanSubjects[pIdx] ?? p.subject).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx + 1}-${Date.now()}`,
          order: idx + 1,
          stage: normalizeStage(m.stage, idx),
          title: cleanText(m.title, 120),
          subtitle: cleanText(m.subtitle, 180),
          estimatedMinutes: Math.max(15, Math.min(60, Number(m.estimatedMinutes) || 25)),
          concepts: Array.isArray(m.concepts) ? m.concepts.slice(0, 4) : [],
          objectives: Array.isArray(m.objectives) ? m.objectives.slice(0, 4) : [],
          whyItMatters: cleanText(m.whyItMatters, 260),
          status: idx === 0 ? 'in_progress' : 'up_next',
        })),
      }));

      res.json({ paths: normalized });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate learning paths.');
    }
  });

  // Official curriculum board portal links for reference verification
  function getOfficialBoardPortals(boardName: string): Array<{ title: string; uri: string }> {
    const lower = boardName.toLowerCase();
    if (lower.includes('cbse') || lower.includes('ncert')) {
      return [
        { title: 'CBSE Academic Curriculum Portal', uri: 'https://cbseacademic.nic.in' },
        { title: 'NCERT Official Textbooks & Syllabi', uri: 'https://ncert.nic.in' },
      ];
    }
    if (lower.includes('icse') || lower.includes('isc') || lower.includes('cisce')) {
      return [{ title: 'CISCE (ICSE & ISC) Official Syllabus', uri: 'https://cisce.org' }];
    }
    if (lower.includes('kerala')) {
      return [{ title: 'SCERT Kerala Official Curriculum', uri: 'https://scert.kerala.gov.in' }];
    }
    if (lower.includes('maharashtra') || lower.includes('msbshse')) {
      return [{ title: 'Maharashtra State Board (MSBSHSE)', uri: 'https://mahahsscboard.in' }];
    }
    if (lower.includes('tamil') || lower.includes('samacheer')) {
      return [{ title: 'Tamil Nadu School Education (TNSCERT)', uri: 'https://tnschools.gov.in' }];
    }
    if (lower.includes('karnataka') || lower.includes('kseab')) {
      return [{ title: 'Karnataka KSEAB Official Portal', uri: 'https://kseab.karnataka.gov.in' }];
    }
    if (lower.includes('up board') || lower.includes('upmsp')) {
      return [{ title: 'UPMSP Official Syllabus Portal', uri: 'https://upmsp.edu.in' }];
    }
    if (lower.includes('west bengal') || lower.includes('wbbse') || lower.includes('wbchse')) {
      return [{ title: 'WBBSE Official Curriculum Portal', uri: 'https://wbbse.wb.gov.in' }];
    }
    if (lower.includes('gujarat') || lower.includes('gseb')) {
      return [{ title: 'Gujarat Secondary & Higher Secondary Board (GSEB)', uri: 'https://gseb.org' }];
    }
    if (lower.includes('ib') || lower.includes('baccalaureate')) {
      return [{ title: 'International Baccalaureate (IB) Curriculum', uri: 'https://www.ibo.org' }];
    }
    if (lower.includes('igcse') || lower.includes('cambridge')) {
      return [
        {
          title: 'Cambridge Assessment International Education',
          uri: 'https://www.cambridgeinternational.org',
        },
      ];
    }
    return [{ title: 'NCERT National Curriculum Reference', uri: 'https://ncert.nic.in' }];
  }

  // In-memory 15-minute cache to prevent redundant API calls when switching between boards
  const syllabusSyncCache = new Map<
    string,
    { expiresAt: number; payload: Record<string, unknown> }
  >();
  const SYLLABUS_CACHE_TTL_MS = 15 * 60 * 1000;

  // 1b. Auto-Update Syllabus to Latest Official Board Curriculum (CBSE, ICSE, State Boards, IB, IGCSE)
  app.post('/api/syllabus/auto-update', async (req, res) => {
    try {
      const {
        studentName,
        classLevel,
        syllabus,
        language,
        subjects,
        goal,
        dailyMinutes,
      } = req.body ?? {};

      if (
        !classLevel ||
        !syllabus ||
        !Array.isArray(subjects) ||
        subjects.length === 0
      ) {
        res
          .status(400)
          .json({ error: 'classLevel, syllabus board, and at least one subject are required.' });
        return;
      }

      const cleanSubjects = subjects
        .map((s: unknown) => cleanText(s, 80))
        .filter(Boolean)
        .slice(0, 8);
      const cleanBoard = cleanText(syllabus, 60);
      const cleanClass = cleanText(classLevel, 40);
      const cleanStudent = cleanText(studentName || 'Student', 80);
      const cleanLang = cleanText(language || 'English', 60) || 'English';
      const cleanGoal = cleanText(goal || 'exam_prep', 40) || 'exam_prep';
      const langDirective = languageInstruction(cleanLang);
      const currentYear = new Date().getFullYear();
      const sessionHint = `${currentYear}-${String((currentYear + 1) % 100).padStart(2, '0')}`;

      const cacheKey = [
        cleanBoard.toLowerCase(),
        cleanClass.toLowerCase(),
        cleanLang.toLowerCase(),
        cleanGoal.toLowerCase(),
        cleanSubjects.map((s) => s.toLowerCase()).join('|'),
      ].join('::');

      const cached = syllabusSyncCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({
          ...cached.payload,
          syncedAt: new Date().toISOString(),
        });
        return;
      }

      const ai = getAiClient();
      const sources = getOfficialBoardPortals(cleanBoard);

      const goalLabels: Record<string, string> = {
        foundations: 'Build strong conceptual foundations with intuitive explanations',
        exam_prep: 'Exam readiness with board marking schemes, short notes, and PYQ patterns',
        deep_mastery: 'Deep first-principles mastery with rigorous connections and challenges',
      };

      // Single streamlined structured Gemini call to conserve API quota and deliver fast board syncs
      const synthesisPrompt = [
        `Auto-update a student's complete syllabus and learning paths to match the official curriculum for their selected board.`,
        `Student: ${cleanStudent}`,
        `Board: ${cleanBoard}`,
        `Class Level: ${cleanClass}`,
        `Academic Session: ${sessionHint}`,
        `Subjects: ${cleanSubjects.join(', ')}`,
        `Learning Goal: ${goalLabels[cleanGoal] ?? goalLabels.exam_prep}`,
        `Daily Study Pace: ${Number(dailyMinutes) || 45} min/day`,
        '',
        'Instructions:',
        `- academicSession: "${sessionHint}" (or the exact active session string for ${cleanBoard}).`,
        '- boardAuthority: exact official board/textbook authority name (e.g., "CBSE · NCERT", "CISCE · ICSE", "Kerala SCERT", "Maharashtra MSBSHSE").',
        '- summary: 1-2 crisp sentences explaining how the curriculum was aligned to this board.',
        '- highlights: 3 to 5 concise bullet strings describing exact board syllabus alignment, key chapters, rationalized/updated topics, or exam marking scheme highlights.',
        '- paths: return exactly one path object per requested subject, matching the exact subject names provided.',
        `- Align every module title, concept, and objective strictly to the official ${cleanBoard} ${cleanClass} syllabus.`,
        '- Each subject path must have exactly 4 progressive modules in stage order: "Foundations", "Core Mechanics", "Applied Practice", "Synthesis & Mastery".',
        '- Keep the "stage" field in English ("Foundations", "Core Mechanics", "Applied Practice", "Synthesis & Mastery") and the "subject" field matching the requested subject names.',
        `- ${langDirective}`,
        '- Keep overview and focusStrategy under 220 characters each, concepts to 3 items, objectives to 3 bullets, estimatedMinutes between 20 and 40.',
      ].join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: synthesisPrompt,
        config: {
          systemInstruction: `You are an official curriculum synchronization specialist for CBSE, ICSE/ISC, Indian State Boards (SCERT/MSBSHSE/TNSCERT/KSEAB/UPMSP), IB, and IGCSE. Output accurate, up-to-date structured JSON syllabi. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: boardSyllabusSyncSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, {}) as {
        academicSession?: string;
        boardAuthority?: string;
        summary?: string;
        highlights?: string[];
        paths?: Array<{
          subject: string;
          overview: string;
          focusStrategy: string;
          modules: Array<{
            order: number;
            stage: string;
            title: string;
            subtitle: string;
            estimatedMinutes: number;
            concepts: string[];
            objectives: string[];
            whyItMatters: string;
          }>;
        }>;
      };

      const now = new Date().toISOString();
      const academicSession = cleanText(parsed.academicSession || sessionHint, 40);
      const boardAuthority = cleanText(parsed.boardAuthority || cleanBoard, 80);
      const summary = cleanText(
        parsed.summary ||
          `Updated all subjects to match the latest ${cleanBoard} ${cleanClass} syllabus.`,
        360
      );
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights.map((h) => cleanText(h, 200)).filter(Boolean).slice(0, 5)
        : [];

      const rawPaths = Array.isArray(parsed.paths) ? parsed.paths : [];
      const syncTag = cleanText(`Synced to ${boardAuthority} (${academicSession})`, 280);

      const normalizedPaths = rawPaths.map((p, pIdx) => ({
        subject: cleanSubjects[pIdx] ?? cleanText(p.subject, 80),
        overview: cleanText(p.overview, 580),
        focusStrategy: cleanText(p.focusStrategy, 580),
        adaptationNote: syncTag,
        generatedByAi: true,
        updatedAt: now,
        modules: (p.modules ?? []).slice(0, 5).map((m, idx) => ({
          id: `${(cleanSubjects[pIdx] ?? p.subject)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')}-${idx + 1}-${Date.now()}`,
          order: idx + 1,
          stage: normalizeStage(m.stage, idx),
          title: cleanText(m.title, 120),
          subtitle: cleanText(m.subtitle, 180),
          estimatedMinutes: Math.max(15, Math.min(60, Number(m.estimatedMinutes) || 25)),
          concepts: Array.isArray(m.concepts) ? m.concepts.slice(0, 4) : [],
          objectives: Array.isArray(m.objectives) ? m.objectives.slice(0, 4) : [],
          whyItMatters: cleanText(m.whyItMatters, 260),
          status: idx === 0 ? 'in_progress' : 'up_next',
        })),
      }));

      const payload = {
        academicSession,
        boardAuthority,
        summary,
        highlights,
        sources,
        groundedWithSearch: false,
        syncedAt: now,
        paths: normalizedPaths,
      };

      if (syllabusSyncCache.size >= 40) {
        const oldestKey = syllabusSyncCache.keys().next().value;
        if (oldestKey) syllabusSyncCache.delete(oldestKey);
      }
      syllabusSyncCache.set(cacheKey, {
        expiresAt: Date.now() + SYLLABUS_CACHE_TTL_MS,
        payload,
      });

      res.json(payload);
    } catch (err) {
      handleApiError(res, err, 'Failed to auto-update syllabus for your board.');
    }
  });

  // 2. Generate full Study Kit (Notes, Short Notes, Shortcuts, Visual Diagram, Revision Cards, Worked Example, Recall Check)
  app.post('/api/lesson', async (req, res) => {
    try {
      const {
        classLevel,
        syllabus,
        language,
        subject,
        moduleTitle,
        stage,
        objectives,
        goal,
        mode,
      } = req.body ?? {};
      if (!classLevel || !subject || !moduleTitle) {
        res.status(400).json({ error: 'classLevel, subject, and moduleTitle are required.' });
        return;
      }

      const ai = getAiClient();
      const langDirective = languageInstruction(language);
      const modeInstructions: Record<string, string> = {
        standard: 'Clear, structured academic notes aligned to the board syllabus.',
        simpler:
          'Explain using everyday analogies, simpler vocabulary, and gentle intuitive steps for a first-time learner.',
        real_world:
          'Anchor every concept, diagram node, and worked example in real-world engineering, science, or daily-life cases.',
      };

      const prompt = [
        `Create a complete Study Kit for:`,
        `Syllabus Board: ${cleanText(syllabus || 'CBSE', 60)}`,
        `Class Level: ${cleanText(classLevel, 40)}`,
        `Subject: ${cleanText(subject, 80)}`,
        `Module: ${cleanText(moduleTitle, 120)} (Stage: ${cleanText(stage || 'Core Mechanics', 40)})`,
        `Goal: ${cleanText(goal || 'exam_prep', 40)}`,
        Array.isArray(objectives) && objectives.length
          ? `Learning Objectives:\n- ${objectives.slice(0, 4).join('\n- ')}`
          : '',
        `Mode: ${modeInstructions[String(mode)] ?? modeInstructions.standard}`,
        '',
        'Instructions:',
        `- ${langDirective}`,
        '- summary: 2 crisp sentences.',
        '- concepts: exactly 3 structured concept cards with concise explanation and a key formula/rule.',
        '- shortNotes: 4 ultra-crisp 1-line exam-night revision bullets.',
        '- studyShortcuts: 2 memorable mnemonics or speed-solving shortcuts with whenToUse.',
        '- visualDiagram: 1 conceptual diagram with centralConcept and exactly 4 labeled nodes (label, short detail, formula/tag) for visual/photo-style representation.',
        '- revisionCards: 3 active-recall Q&A flashcards (front question, back concise answer).',
        '- workedExample: 1 board-style worked example with 3-4 steps and 1-sentence takeaway.',
        '- recallCheck: 1 multiple-choice check with 4 options and correctIndex (0..3).',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are a master educator who writes crisp, exam-ready notes, memory shortcuts, visual concept maps, and revision cards. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: lessonResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const lesson = parseModelJson<Record<string, unknown>>(response.text, {});
      lesson.mode = mode === 'simpler' || mode === 'real_world' ? mode : 'standard';
      if (Array.isArray(lesson.revisionCards)) {
        lesson.revisionCards = lesson.revisionCards.map(
          (c: { front: string; back: string }, idx: number) => ({
            id: `rc-ai-${Date.now()}-${idx}`,
            front: c.front,
            back: c.back,
          })
        );
      }
      res.json({ lesson });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate study kit lesson.');
    }
  });

  // 2b. Summarize Current StudyKit Lesson & Student Notes via Buddy (AI Tutor)
  const notesSummaryResponseSchema = {
    type: Type.OBJECT,
    properties: {
      headline: {
        type: Type.STRING,
        description: 'Single crisp takeaway sentence capturing the core idea of the notes.',
      },
      conciseSummary: {
        type: Type.STRING,
        description: 'A cohesive 2 to 3 sentence concise summary of the lesson notes and student notes.',
      },
      keyPoints: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '3 to 4 brief, exam-ready bullet points.',
      },
      nextStepTip: {
        type: Type.STRING,
        description: 'One short, encouraging study tip from Buddy tailored to the notes or doubts.',
      },
    },
    required: ['headline', 'conciseSummary', 'keyPoints', 'nextStepTip'],
  };

  app.post('/api/notes/summarize', async (req, res) => {
    try {
      const {
        studentName,
        classLevel,
        syllabus,
        language,
        subject,
        moduleTitle,
        moduleSubtitle,
        concepts,
        lessonSummary,
        lessonConcepts,
        studentNotes,
      } = req.body ?? {};

      const cleanModuleTitle = cleanText(moduleTitle, 140);
      const cleanSubject = cleanText(subject, 80);
      if (!cleanModuleTitle || !cleanSubject) {
        res.status(400).json({ error: 'Subject and module title are required to summarize notes.' });
        return;
      }

      const cleanName = cleanText(studentName, 60) || 'Student';
      const cleanClass = cleanText(classLevel, 40) || 'Class 10';
      const cleanBoard = cleanText(syllabus, 60) || 'CBSE';
      const cleanSubtitle = cleanText(moduleSubtitle, 200);
      const cleanStudentNotes = cleanText(studentNotes, 6000);
      const cleanLessonSummary = cleanText(lessonSummary, 1600);

      const safeConceptNames = Array.isArray(concepts)
        ? concepts.slice(0, 8).map((c) => cleanText(c, 120)).filter(Boolean)
        : [];

      const safeLessonConcepts = Array.isArray(lessonConcepts)
        ? lessonConcepts
            .slice(0, 6)
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const rec = item as {
                heading?: unknown;
                explanation?: unknown;
                formulaOrKeyRule?: unknown;
              };
              const heading = cleanText(rec.heading, 120);
              const explanation = cleanText(rec.explanation, 500);
              const rule = cleanText(rec.formulaOrKeyRule, 200);
              if (!heading && !explanation) return null;
              return `- ${heading}: ${explanation}${rule ? ` [Rule/Formula: ${rule}]` : ''}`;
            })
            .filter((line): line is string => Boolean(line))
        : [];

      const hasPersonalNotes = cleanStudentNotes.length > 0;
      const ai = getAiClient();
      const langDirective = languageInstruction(language);

      const promptLines = [
        `Student: ${cleanName} (${cleanClass}, ${cleanBoard} syllabus).`,
        `Subject: ${cleanSubject}`,
        `Current Module: ${cleanModuleTitle}${cleanSubtitle ? ` — ${cleanSubtitle}` : ''}`,
        safeConceptNames.length > 0 ? `Module Key Topics: ${safeConceptNames.join(', ')}` : '',
        cleanLessonSummary ? `Lesson Core Summary:\n${cleanLessonSummary}` : '',
        safeLessonConcepts.length > 0
          ? `Lesson Notes Breakdown:\n${safeLessonConcepts.join('\n')}`
          : '',
        hasPersonalNotes
          ? `Student's Personal Notes & Reflections:\n"""\n${cleanStudentNotes}\n"""`
          : 'Student has not added personal reflections yet — summarize the current lesson notes concisely.',
        '',
        'Task: Produce a crisp, high-yield concise summary directly below the student notes:',
        '1. headline: 1 clear sentence stating the main idea.',
        '2. conciseSummary: 2 to 3 tight, easy-to-scan sentences synthesizing the lesson notes and (if present) the student’s personal notes.',
        '3. keyPoints: 3 to 4 short bullet points covering essential rules, formulas, or facts to remember.',
        '4. nextStepTip: 1 brief Buddy tutor tip (if the student noted a doubt or question, address or guide it; otherwise suggest a fast recall check).',
        langDirective,
      ].filter(Boolean);

      const response = await generateContentWithRetry(ai, {
        contents: promptLines.join('\n'),
        config: {
          systemInstruction:
            'You are Buddy, Pathwise’s concise, encouraging AI study tutor. Synthesize lesson notes and student reflections into crystal-clear, exam-ready summaries without filler or fluff. Always return valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: notesSummaryResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson<{
        headline?: string;
        conciseSummary?: string;
        keyPoints?: string[];
        nextStepTip?: string;
      }>(response.text, {});

      const conciseSummary = cleanText(parsed.conciseSummary, 1000);
      if (!conciseSummary) {
        res.status(502).json({ error: 'Buddy could not generate a summary right now. Please try again.' });
        return;
      }

      const keyPoints = Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints
            .map((p) => cleanText(p, 240))
            .filter(Boolean)
            .slice(0, 5)
        : [];

      res.json({
        headline: cleanText(parsed.headline, 220) || `${cleanModuleTitle} — Key Takeaway`,
        conciseSummary,
        keyPoints,
        nextStepTip:
          cleanText(parsed.nextStepTip, 260) ||
          'Close your notes for 30 seconds and recite the main formula or concept from memory.',
        basedOnPersonalNotes: hasPersonalNotes,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to summarize lesson notes with Buddy.');
    }
  });

  // 3. Generate syllabus-calibrated Practice Quiz
  app.post('/api/quiz', async (req, res) => {
    try {
      const { classLevel, syllabus, language, subject, moduleTitle, concepts, count } =
        req.body ?? {};
      if (!classLevel || !subject || !moduleTitle) {
        res.status(400).json({ error: 'classLevel, subject, and moduleTitle are required.' });
        return;
      }

      const questionCount = Math.max(3, Math.min(6, Number(count) || 4));
      const ai = getAiClient();
      const langDirective = languageInstruction(language);

      const prompt = [
        `Generate ${questionCount} multiple-choice practice questions calibrated to:`,
        `Syllabus Board: ${cleanText(syllabus || 'CBSE', 60)}`,
        `Class Level: ${cleanText(classLevel, 40)}`,
        `Subject: ${cleanText(subject, 80)}`,
        `Module: ${cleanText(moduleTitle, 120)}`,
        Array.isArray(concepts) && concepts.length ? `Focus Concepts: ${concepts.join(', ')}` : '',
        '',
        'Instructions:',
        `- ${langDirective}`,
        '- Each question must have exactly 4 plausible, unambiguous options and correctIndex (0..3).',
        '- Provide a concise 1-2 sentence explanation and a short 2-3 word conceptTag.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are an academic exam author writing accurate, fair, syllabus-calibrated practice questions. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: quizResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, { questions: [] }) as {
        questions?: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
          conceptTag: string;
        }>;
      };

      const questions = (parsed.questions ?? []).map((q, idx) => ({
        id: `ai-q-${Date.now()}-${idx}`,
        question: q.question,
        options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
        correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
        explanation: q.explanation,
        conceptTag: q.conceptTag || 'Core Concept',
      }));

      res.json({ questions });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate practice quiz.');
    }
  });

  // 4. Generate Practice Packs: Example Questions, Aptitude Questions, or Previous Year Question Paper
  app.post('/api/practice-pack', async (req, res) => {
    try {
      const {
        mode,
        classLevel,
        syllabus,
        language,
        subject,
        moduleTitle,
        referenceYear,
        difficulty,
        referencePaper,
      } = req.body ?? {};
      if (!mode || !classLevel || !subject) {
        res.status(400).json({ error: 'mode, classLevel, and subject are required.' });
        return;
      }

      const ai = getAiClient();
      const cleanBoard = cleanText(syllabus || 'CBSE', 60);
      const cleanClass = cleanText(classLevel, 40);
      const cleanSub = cleanText(subject, 80);
      const cleanMod = cleanText(moduleTitle || subject, 120);
      const cleanYearMatch = cleanText(referenceYear || '2025', 20).match(/\b(20\d{2})\b/);
      const cleanYear = cleanYearMatch ? cleanYearMatch[1] : '2025';
      const langDirective = languageInstruction(language);

      if (mode === 'examples') {
        const response = await generateContentWithRetry(ai, {
          contents: `Create 3 solved board-style Example Questions for ${cleanBoard} ${cleanClass} ${cleanSub} focusing on "${cleanMod}". Include marks (2 to 5), difficulty ("Easy", "Standard", or "Challenge"), clear step-by-step solutions, finalAnswer, and a crisp examTip. ${langDirective}`,
          config: {
            systemInstruction: `You are a senior board examiner authoring step-by-step solved example questions. ${langDirective}`,
            responseMimeType: 'application/json',
            responseSchema: exampleQuestionsSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const parsed = parseModelJson<{ examples?: Array<Record<string, unknown>> }>(
          response.text,
          { examples: [] }
        );
        const examples = (parsed.examples ?? []).map((ex: Record<string, unknown>, idx: number) => ({
          id: `ai-ex-${Date.now()}-${idx}`,
          ...ex,
        }));
        res.json({ examples });
        return;
      }

      if (mode === 'aptitude') {
        const response = await generateContentWithRetry(ai, {
          contents: `Generate 4 Aptitude Type Questions calibrated for a ${cleanClass} (${cleanBoard}) student studying ${cleanSub}. Mix Quantitative, Logical Reasoning, and Pattern & Data categories. Each must have 4 options, correctIndex (0..3), and a concise shortcutMethod for solving fast. ${langDirective}`,
          config: {
            systemInstruction: `You are an aptitude & Olympiad trainer creating crisp analytical MCQs with fast solving shortcuts. ${langDirective}`,
            responseMimeType: 'application/json',
            responseSchema: aptitudeQuestionsSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const parsed = parseModelJson<{ questions?: Array<Record<string, unknown>> }>(
          response.text,
          { questions: [] }
        );
        const questions = (parsed.questions ?? []).map((q: Record<string, unknown>, idx: number) => ({
          id: `ai-apt-${Date.now()}-${idx}`,
          ...q,
        }));
        res.json({ questions });
        return;
      }

      if (mode === 'pyq') {
        const response = await generateContentWithRetry(ai, {
          contents: `Generate a realistic ${cleanYear} Previous Year Question Paper model set modeled on ${cleanBoard} ${cleanClass} ${cleanSub} board exams (focusing on "${cleanMod}" and key syllabus topics). Include 4 structured questions across Section A (1 Mark), Section B (2 Marks), Section C (3 Marks), and Section D (5 Marks), each with an official markingScheme answer. ${langDirective}`,
          config: {
            systemInstruction: `You are a board curriculum specialist writing authentic Previous Year Question Paper practice sets with step-marked official marking schemes. ${langDirective}`,
            responseMimeType: 'application/json',
            responseSchema: pyqPaperSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const paper = parseModelJson<Record<string, unknown>>(response.text, {});
        paper.syllabus = cleanBoard;
        paper.classLevel = cleanClass;
        paper.subject = cleanSub;
        res.json({ paper });
        return;
      }

      if (mode === 'similar_pyq') {
        const cleanDifficulty =
          difficulty === 'challenging' || difficulty === 'revision' ? difficulty : 'same';
        const difficultyGuidance =
          cleanDifficulty === 'challenging'
            ? 'Make each parallel question slightly more challenging (higher-order application / multi-step twist) while preserving the exact section marks and syllabus concept.'
            : cleanDifficulty === 'revision'
              ? 'Focus on high-frequency board exam patterns ideal for timed revision while keeping the exact mark weightage.'
              : 'Match the exact difficulty level, phrasing style, and mark weightage of the reference previous year board paper.';

        const rawRefQuestions = Array.isArray(referencePaper?.questions)
          ? referencePaper.questions.slice(0, 6)
          : [];
        const referenceBlueprint =
          rawRefQuestions.length > 0
            ? rawRefQuestions
                .map(
                  (q: Record<string, unknown>, idx: number) =>
                    `${cleanText(q.number || `Q${idx + 1}`, 12)} | ${cleanText(q.section || `Section ${String.fromCharCode(65 + idx)}`, 60)} | ${Number(q.marks) || 2} Marks | Original: ${cleanText(q.question, 320)}`
                )
                .join('\n')
            : '';

        const promptLines = [
          `Create a SIMILAR QUESTION PAPER modeled closely on the ${cleanYear} ${cleanBoard} ${cleanClass} ${cleanSub} board exam (focusing on "${cleanMod}" and core syllabus chapters).`,
          difficultyGuidance,
          referenceBlueprint
            ? `Mirror the EXACT section structure, question count, mark distribution, and tested concepts of this ${cleanYear} reference paper — write BRAND-NEW isomorphic parallel questions (different numbers, new scenarios, fresh phrasing — never copy verbatim):\n${referenceBlueprint}`
            : `Include 5 structured questions mirroring the ${cleanYear} ${cleanBoard} blueprint: Q1 Section A (1 Mark Objective), Q2 Section B (2 Marks Short Answer), Q3 Section C (3 Marks Structured Problem), Q4 Section D (5 Marks Long Analytical), and Q5 Section E (4 Marks Case-Based Study).`,
          `For every question provide:`,
          `- conceptTested: short syllabus concept label`,
          `- similarTo: 1 concise line explaining how it mirrors the ${cleanYear} board question pattern`,
          `- referenceQuestion: the corresponding ${cleanYear} reference board question prompt for comparison`,
          `- question: the fresh parallel question to practice`,
          `- markingScheme: step-by-step board marking scheme with mark splits`,
          `Set basedOnYear to "${cleanYear}" and patternNote to a crisp 1-sentence summary of the ${cleanYear} blueprint mirrored.`,
          langDirective,
        ];

        const response = await generateContentWithRetry(ai, {
          contents: promptLines.join('\n\n'),
          config: {
            systemInstruction: `You are a senior ${cleanBoard} board paper setter creating authentic parallel practice papers modeled directly on previous year question papers with exact mark-split marking schemes. ${langDirective}`,
            responseMimeType: 'application/json',
            responseSchema: similarPyqPaperSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        const paper = parseModelJson<Record<string, unknown>>(response.text, {});
        paper.syllabus = cleanBoard;
        paper.classLevel = cleanClass;
        paper.subject = cleanSub;
        paper.basedOnYear = cleanYear;
        paper.difficulty = cleanDifficulty;
        res.json({ paper });
        return;
      }

      res.status(400).json({ error: 'Unsupported practice pack mode.' });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate practice pack.');
    }
  });

  // 5. Generate Personalized 10-Minute Motivation Class
  app.post('/api/motivation', async (req, res) => {
    try {
      const { studentName, classLevel, syllabus, language, subject, theme } = req.body ?? {};
      const ai = getAiClient();
      const langDirective = languageInstruction(language);
      const prompt = [
        `Design a practical, grounded 10-minute Motivation & Focus Class for ${cleanText(studentName || 'a student', 80)}.`,
        `Class: ${cleanText(classLevel || 'Class 10', 40)} | Syllabus: ${cleanText(syllabus || 'CBSE', 60)} | Next Subject: ${cleanText(subject || 'Studies', 80)}`,
        `Chosen Motivation Theme: ${cleanText(theme || 'Beat Exam Anxiety', 80)}`,
        langDirective,
        'Return exactly 3 segments covering "00:00 – 03:00", "03:00 – 07:00", and "07:00 – 10:00", plus a short affirmation and a concrete immediate actionPrompt. Avoid cheesy clichés; keep tone calm, warm, and mentor-like.',
      ].join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are a calm academic coach who designs realistic, encouraging 10-minute study focus sessions for students. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: motivationSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const session = parseModelJson<Record<string, unknown>>(response.text, {});
      session.id = `ai-mot-${Date.now()}`;
      session.durationMinutes = 10;
      res.json({ session });
    } catch (err) {
      handleApiError(res, err, 'Failed to personalize 10-minute motivation class.');
    }
  });

  // 6. Context-aware Multimodal Socratic AI Study Tutor Chatbot (Text + Camera Photo + Voice Mic)
  app.post('/api/tutor', express.json({ limit: '12mb' }), async (req, res) => {
    try {
      const {
        studentName,
        classLevel,
        syllabus,
        language,
        subject,
        moduleTitle,
        goal,
        history,
        message,
        image,
        audio,
      } = req.body ?? {};

      const cleanMessage = typeof message === 'string' ? cleanText(message, 1200) : '';

      const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const ALLOWED_AUDIO_MIMES = new Set([
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
        'audio/mpeg',
        'audio/aac',
        'audio/x-m4a',
      ]);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      let hasImage = false;
      let hasAudio = false;

      if (image && typeof image === 'object') {
        const mime = cleanText((image as { mimeType?: unknown }).mimeType, 40)
          .toLowerCase()
          .split(';')[0]
          .trim();
        const rawData =
          typeof (image as { data?: unknown }).data === 'string'
            ? (image as { data: string }).data.trim()
            : '';
        if (!ALLOWED_IMAGE_MIMES.has(mime)) {
          res.status(400).json({ error: 'Unsupported image format. Please use JPEG, PNG, or WebP.' });
          return;
        }
        if (!rawData || rawData.length > 8_000_000) {
          res.status(400).json({ error: 'Photo is too large. Please capture a clearer, smaller photo.' });
          return;
        }
        parts.push({ inlineData: { mimeType: mime, data: rawData } });
        hasImage = true;
      }

      if (audio && typeof audio === 'object') {
        const mime = cleanText((audio as { mimeType?: unknown }).mimeType, 60)
          .toLowerCase()
          .split(';')[0]
          .trim();
        const rawData =
          typeof (audio as { data?: unknown }).data === 'string'
            ? (audio as { data: string }).data.trim()
            : '';
        if (!ALLOWED_AUDIO_MIMES.has(mime)) {
          res.status(400).json({ error: 'Unsupported audio format from microphone.' });
          return;
        }
        if (!rawData || rawData.length > 10_000_000) {
          res.status(400).json({ error: 'Voice recording is too long. Please keep it under 90 seconds.' });
          return;
        }
        parts.push({ inlineData: { mimeType: mime, data: rawData } });
        hasAudio = true;
      }

      if (!cleanMessage && !hasImage && !hasAudio) {
        res.status(400).json({ error: 'Please type a question, capture a photo, or record your voice.' });
        return;
      }

      const ai = getAiClient();
      const langDirective = languageInstruction(language);
      const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
      const transcript = recentHistory
        .map((m: { role?: string; content?: string }) =>
          `${m.role === 'student' ? 'Student' : 'Tutor'}: ${cleanText(m.content, 600)}`
        )
        .join('\n');

      const fallbackInstruction =
        hasImage && hasAudio
          ? 'The student shared a photo and asked a spoken question in the attached audio. Listen carefully to the audio, inspect the photo, and answer step by step.'
          : hasImage
            ? 'The student shared a photo of a study problem, diagram, or notes. Read the photo carefully, check any visible attempt, and explain the solution step by step.'
            : 'The student asked a spoken study question in the attached audio. Listen carefully and answer clearly.';

      const promptText = [
        transcript ? `Recent conversation:\n${transcript}\n` : '',
        cleanMessage ? `Student asks: ${cleanMessage}` : fallbackInstruction,
        hasImage && cleanMessage
          ? 'Use the attached photo together with the student’s typed question.'
          : '',
        hasAudio && cleanMessage
          ? 'Use the attached voice recording together with the student’s typed question.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      parts.push({ text: promptText });

      const response = await generateContentWithRetry(ai, {
        contents: hasImage || hasAudio ? { parts } : promptText,
        config: {
          systemInstruction: [
            `You are Buddy, Pathwise’s calm, friendly, insightful AI study tutor helping ${cleanText(studentName || 'a student', 80)} in ${cleanText(classLevel || 'Class 10', 40)} following the ${cleanText(syllabus || 'CBSE', 60)} syllabus. If asked your name, warmly introduce yourself as Buddy.`,
            `Active Subject: ${cleanText(subject || 'General Studies', 80)}.`,
            moduleTitle ? `Current Module: ${cleanText(moduleTitle, 120)}.` : '',
            `Learning Goal: ${cleanText(goal || 'exam_prep', 40)}.`,
            langDirective,
            'Teaching style:',
            '- Calibrate depth, terminology, and exam tips strictly to the student’s class and syllabus board.',
            '- When a photo of a problem, handwriting, or textbook diagram is attached, read every detail accurately and guide the student step by step.',
            '- When a voice recording is attached, understand the student’s spoken doubt in whatever language they speak and respond clearly in their selected study language.',
            '- Keep answers structured, concise (under 240 words unless solving a multi-step problem), and easy to scan.',
            '- Write formulas in clean, plain readable math notation using Unicode symbols (like sin 30° = 1/2, √3/2, x², θ, Δ, π) instead of raw LaTeX dollar-sign markup.',
            '- End with one brief guiding check-in question so the student actively practices the idea.',
          ]
            .filter(Boolean)
            .join('\n'),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = (response.text ?? '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Buddy returned an empty reply. Please try again.' });
        return;
      }

      res.json({ reply });
    } catch (err) {
      handleApiError(res, err, 'Failed to get response from Buddy.');
    }
  });

  // 7. Fetch real YouTube video title & channel via YouTube oEmbed
  app.get('/api/youtube/metadata', async (req, res) => {
    try {
      const videoId = cleanText(req.query.videoId, 20);
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        res.status(400).json({ error: 'Invalid YouTube video ID.' });
        return;
      }

      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!oembedRes.ok) {
        res.json({
          videoId,
          url: watchUrl,
          title: '',
          channelName: 'YouTube',
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
        return;
      }

      const data = (await oembedRes.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      res.json({
        videoId,
        url: watchUrl,
        title: cleanText(data.title || '', 200),
        channelName: cleanText(data.author_name || 'YouTube', 120),
        thumbnailUrl:
          cleanText(data.thumbnail_url || '', 300) ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    } catch {
      const videoId = cleanText(req.query.videoId, 20);
      res.json({
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: '',
        channelName: 'YouTube',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  });

  // 7b. Search real playable YouTube educational class videos (no link pasting needed)
  app.get('/api/youtube/search', async (req, res) => {
    try {
      const q = cleanText(req.query.q, 140);
      const classLevel = cleanText(req.query.classLevel, 40);
      const syllabus = cleanText(req.query.syllabus, 60);
      const subject = cleanText(req.query.subject, 80);
      const language = cleanText(req.query.language, 60);

      const queryParts: string[] = [];
      if (q) {
        queryParts.push(q);
      } else {
        if (classLevel) queryParts.push(classLevel);
        if (subject) queryParts.push(subject);
        if (syllabus && syllabus.toLowerCase() !== 'general') {
          if (syllabus.toLowerCase().includes('state') && language.toLowerCase() === 'malayalam') {
            queryParts.push('Kerala Syllabus');
          } else {
            queryParts.push(syllabus);
          }
        }
        queryParts.push('class lecture');
      }

      if (language && language.toLowerCase() !== 'english') {
        if (!queryParts.join(' ').toLowerCase().includes(language.toLowerCase())) {
          queryParts.push(language);
        }
      }

      const searchQuery = queryParts.join(' ').trim() || 'Class 10 Mathematics lecture';
      const ytRes = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(9000),
        }
      );

      if (!ytRes.ok) {
        res.status(502).json({ error: 'Unable to fetch YouTube classes right now. Please try again.' });
        return;
      }

      const html = await ytRes.text();
      const marker = 'var ytInitialData = ';
      const start = html.indexOf(marker);
      const end = start >= 0 ? html.indexOf(';</script>', start) : -1;

      const videos: Array<{
        videoId: string;
        title: string;
        channelName: string;
        duration: string;
        thumbnailUrl: string;
        snippet: string;
      }> = [];
      const seen = new Set<string>();

      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(html.slice(start + marker.length, end)) as unknown;

          const walk = (node: unknown) => {
            if (!node || typeof node !== 'object' || videos.length >= 8) return;
            const record = node as Record<string, unknown>;
            if (record.videoRenderer && typeof record.videoRenderer === 'object') {
              const v = record.videoRenderer as {
                videoId?: string;
                title?: { runs?: Array<{ text?: string }> };
                ownerText?: { runs?: Array<{ text?: string }> };
                lengthText?: { simpleText?: string };
                detailedMetadataSnippets?: Array<{
                  snippetText?: { runs?: Array<{ text?: string }> };
                }>;
              };
              const videoId = v.videoId ?? '';
              if (/^[a-zA-Z0-9_-]{11}$/.test(videoId) && !seen.has(videoId)) {
                const duration = cleanText(v.lengthText?.simpleText ?? '', 20);
                const title = cleanText(
                  (v.title?.runs ?? []).map((r) => r.text ?? '').join(''),
                  200
                );
                if (title && duration) {
                  const channelName =
                    cleanText((v.ownerText?.runs ?? []).map((r) => r.text ?? '').join(''), 120) ||
                    'YouTube';
                  const snippet = cleanText(
                    (v.detailedMetadataSnippets?.[0]?.snippetText?.runs ?? [])
                      .map((r) => r.text ?? '')
                      .join(''),
                    260
                  );
                  seen.add(videoId);
                  videos.push({
                    videoId,
                    title,
                    channelName,
                    duration,
                    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    snippet,
                  });
                }
              }
              return;
            }

            if (Array.isArray(node)) {
              for (const item of node) {
                walk(item);
                if (videos.length >= 8) break;
              }
            } else {
              for (const val of Object.values(record)) {
                walk(val);
                if (videos.length >= 8) break;
              }
            }
          };

          walk(parsed);
        } catch {
          // Ignore malformed JSON
        }
      }

      res.json({ query: searchQuery, videos });
    } catch (err) {
      handleApiError(res, err, 'Unable to search YouTube classes right now.');
    }
  });

  // Helper to fetch real short description context from a YouTube video watch page (non-blocking)
  async function fetchYouTubeVideoDescription(videoId: string): Promise<string> {
    try {
      const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (!watchRes.ok) return '';
      const html = await watchRes.text();
      const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (!descMatch?.[1]) return '';
      const decoded = JSON.parse(`"${descMatch[1]}"`) as string;
      return cleanText(decoded.replace(/https?:\/\/\S+/g, ' '), 900);
    } catch {
      return '';
    }
  }

  // 8. Generate Class Summary & Quiz Questions from a YouTube Class in Any Selected Language
  app.post('/api/youtube/quiz', async (req, res) => {
    try {
      const {
        videoId,
        url,
        title,
        channelName,
        classLevel,
        syllabus,
        subject,
        language,
        notes,
        count,
        existingQuestions,
      } = req.body ?? {};

      const cleanVideoId = cleanText(videoId, 20);
      if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanVideoId)) {
        res.status(400).json({ error: 'A valid YouTube class video is required.' });
        return;
      }

      const questionCount = Math.max(3, Math.min(8, Number(count) || 5));
      const cleanTitle = cleanText(title, 200);
      const cleanChannel = cleanText(channelName || 'YouTube', 120);
      const cleanClass = cleanText(classLevel || 'Class 10', 40);
      const cleanBoard = cleanText(syllabus || 'CBSE', 60);
      const cleanSubject = cleanText(subject || 'General Studies', 80);
      const cleanNotes = cleanText(notes, 2000);
      const cleanUrl = cleanText(url || `https://www.youtube.com/watch?v=${cleanVideoId}`, 300);
      const langDirective = languageInstruction(language);

      const videoDescription = await fetchYouTubeVideoDescription(cleanVideoId);

      const priorList = Array.isArray(existingQuestions)
        ? existingQuestions
            .map((q: unknown) => cleanText(q, 180))
            .filter(Boolean)
            .slice(0, 15)
        : [];

      const ai = getAiClient();
      const prompt = [
        `Create a study summary and ${questionCount} multiple-choice quiz questions directly based on this YouTube study class:`,
        `YouTube URL: ${cleanUrl}`,
        cleanTitle ? `Class Video Title: ${cleanTitle}` : '',
        `Channel / Educator: ${cleanChannel}`,
        `Student Class: ${cleanClass} | Syllabus: ${cleanBoard} | Subject: ${cleanSubject}`,
        videoDescription ? `Video Description & Chapters:\n${videoDescription}` : '',
        cleanNotes ? `Additional Class Topics Covered:\n${cleanNotes}` : '',
        priorList.length > 0
          ? `Do NOT repeat or paraphrase these already-asked questions:\n- ${priorList.join('\n- ')}`
          : '',
        '',
        'Instructions:',
        `- ${langDirective}`,
        '- summary: 2-3 clear sentences explaining what this YouTube class teaches.',
        '- keyTakeaways: exactly 4 concise key takeaways from the class.',
        `- questions: exactly ${questionCount} well-crafted multiple-choice questions that test understanding of the concepts taught in this YouTube class.`,
        '- Each question must have exactly 4 clear, distinct options, correctIndex (0..3), a helpful 1-2 sentence explanation, a short conceptTag, and a short timestampHint (like "Concept Intro", "Core Formula", "Worked Example", or "Exam Tip").',
        '- Use clean Unicode math symbols (sin 30°, √3/2, x², Δ, π) instead of raw LaTeX.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are an expert educator who turns YouTube study classes into accurate, syllabus-calibrated quiz questions and study summaries. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: youtubeClassQuizSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, {}) as {
        summary?: string;
        keyTakeaways?: string[];
        questions?: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
          conceptTag: string;
          timestampHint?: string;
        }>;
      };

      const questions = (parsed.questions ?? []).map((q, idx) => ({
        id: `yt-q-${Date.now()}-${idx}`,
        question: cleanText(q.question, 400),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => cleanText(o, 220)) : [],
        correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
        explanation: cleanText(q.explanation, 500),
        conceptTag: cleanText(q.conceptTag || 'Class Concept', 60),
        timestampHint: q.timestampHint ? cleanText(q.timestampHint, 40) : undefined,
        addedBy: 'ai' as const,
      }));

      res.json({
        summary: cleanText(parsed.summary || '', 1100),
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.slice(0, 8).map((t) => cleanText(t, 220)).filter(Boolean)
          : [],
        questions,
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate quiz questions from the YouTube class.');
    }
  });

  // 9. Generate Class Summary & Quiz Questions Directly from an Uploaded Class Video File
  app.post('/api/video/quiz', async (req, res) => {
    try {
      const {
        title,
        classLevel,
        syllabus,
        subject,
        language,
        count,
        existingQuestions,
        frames,
        inlineVideo,
      } = req.body ?? {};

      const cleanTitle = cleanText(title, 200) || 'Uploaded Class Video';
      const cleanClass = cleanText(classLevel || 'Class 10', 40);
      const cleanBoard = cleanText(syllabus || 'CBSE', 60);
      const cleanSubject = cleanText(subject || 'General Studies', 80);
      const questionCount = Math.max(3, Math.min(8, Number(count) || 5));
      const langDirective = languageInstruction(language);

      const priorList = Array.isArray(existingQuestions)
        ? existingQuestions
            .map((q: unknown) => cleanText(q, 180))
            .filter(Boolean)
            .slice(0, 15)
        : [];

      const mediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

      if (
        inlineVideo &&
        typeof inlineVideo.mimeType === 'string' &&
        inlineVideo.mimeType.startsWith('video/') &&
        typeof inlineVideo.data === 'string' &&
        inlineVideo.data.length > 0 &&
        inlineVideo.data.length <= 16_000_000
      ) {
        mediaParts.push({
          inlineData: {
            mimeType: inlineVideo.mimeType,
            data: inlineVideo.data,
          },
        });
      } else if (Array.isArray(frames)) {
        for (const frame of frames.slice(0, 6)) {
          if (typeof frame === 'string' && frame.length > 0 && frame.length <= 2_500_000) {
            mediaParts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: frame,
              },
            });
          }
        }
      }

      if (mediaParts.length === 0) {
        res.status(400).json({ error: 'Please upload a valid class video file.' });
        return;
      }

      const ai = getAiClient();
      const prompt = [
        `Analyze the attached class video content directly and create a study summary plus ${questionCount} multiple-choice quiz questions based on what is taught in the video:`,
        `Video Title: ${cleanTitle}`,
        `Student Class: ${cleanClass} | Syllabus: ${cleanBoard} | Subject: ${cleanSubject}`,
        priorList.length > 0
          ? `Do NOT repeat or paraphrase these already-asked questions:\n- ${priorList.join('\n- ')}`
          : '',
        '',
        'Instructions:',
        `- ${langDirective}`,
        '- Base the summary, key takeaways, and quiz questions directly on the actual boards, slides, formulas, speech, or concepts visible/heard in the uploaded video.',
        '- summary: 2-3 clear sentences explaining what the class video teaches.',
        '- keyTakeaways: exactly 4 concise key takeaways from the video.',
        `- questions: exactly ${questionCount} well-crafted multiple-choice questions with 4 options, correctIndex (0..3), explanation, conceptTag, and timestampHint.`,
        '- Use clean Unicode math symbols (sin 30°, √3/2, x², Δ, π) instead of raw LaTeX.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: {
          parts: [...mediaParts, { text: prompt }],
        },
        config: {
          systemInstruction: `You are an expert educator who watches student class videos and creates accurate, syllabus-calibrated quiz questions and summaries. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: youtubeClassQuizSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, {}) as {
        summary?: string;
        keyTakeaways?: string[];
        questions?: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
          conceptTag: string;
          timestampHint?: string;
        }>;
      };

      const questions = (parsed.questions ?? []).map((q, idx) => ({
        id: `vid-q-${Date.now()}-${idx}`,
        question: cleanText(q.question, 400),
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => cleanText(o, 220)) : [],
        correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
        explanation: cleanText(q.explanation, 500),
        conceptTag: cleanText(q.conceptTag || 'Video Concept', 60),
        timestampHint: q.timestampHint ? cleanText(q.timestampHint, 40) : undefined,
        addedBy: 'ai' as const,
      }));

      res.json({
        summary: cleanText(parsed.summary || '', 1100),
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.slice(0, 8).map((t) => cleanText(t, 220)).filter(Boolean)
          : [],
        questions,
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate quiz questions from the uploaded video.');
    }
  });

  // 9a. AI Exam Crash Revision Pack Generator
  const crashRevisionSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      examStrategy: { type: Type.STRING },
      sprintBlocks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            blockNumber: { type: Type.INTEGER },
            minutes: { type: Type.INTEGER },
            title: { type: Type.STRING },
            focusAction: { type: Type.STRING },
          },
          required: ['blockNumber', 'minutes', 'title', 'focusAction'],
        },
      },
      highYieldTopics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            weightage: { type: Type.STRING, enum: ['Must-Know', 'High', 'Quick Win'] },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            examTrigger: { type: Type.STRING },
          },
          required: ['topic', 'weightage', 'keyPoints', 'examTrigger'],
        },
      },
      formulaCheatSheet: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            expression: { type: Type.STRING },
            quickMemoryTip: { type: Type.STRING },
          },
          required: ['label', 'expression', 'quickMemoryTip'],
        },
      },
      commonMistakes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            trap: { type: Type.STRING },
            fix: { type: Type.STRING },
          },
          required: ['trap', 'fix'],
        },
      },
      rapidFireQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            marks: { type: Type.INTEGER },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            answerKey: { type: Type.STRING },
            markingPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['question', 'marks', 'options', 'correctIndex', 'answerKey', 'markingPoints'],
        },
      },
    },
    required: [
      'title',
      'examStrategy',
      'sprintBlocks',
      'highYieldTopics',
      'formulaCheatSheet',
      'commonMistakes',
      'rapidFireQuestions',
    ],
  };

  app.post('/api/crash-revision', async (req, res) => {
    try {
      const { classLevel, syllabus, language, subject, timeBudgetMinutes, topics, customFocus } =
        req.body ?? {};

      const cleanClass = cleanText(classLevel, 50) || 'Class 10';
      const cleanBoard = cleanText(syllabus, 60) || 'CBSE';
      const cleanSubject = cleanText(subject, 80);
      const cleanLang = cleanText(language, 60) || 'English';
      const langDirective = languageInstruction(cleanLang);
      const cleanFocus = cleanText(customFocus, 240);

      if (!cleanSubject) {
        res.status(400).json({ error: 'Please select a subject for Exam Crash Revision.' });
        return;
      }

      const allowedBudgets = [30, 60, 120, 180];
      const rawBudget = Number(timeBudgetMinutes);
      const budget = allowedBudgets.includes(rawBudget) ? rawBudget : 60;

      const selectedTopics = Array.isArray(topics)
        ? topics
            .map((t: unknown) => cleanText(t, 120))
            .filter(Boolean)
            .slice(0, 8)
        : [];

      const ai = getAiClient();
      const prompt = [
        `Build a high-impact Exam Crash Revision Pack for a ${cleanClass} (${cleanBoard} syllabus) student preparing for ${cleanSubject}.`,
        `Available Revision Time Budget: ${budget} minutes.`,
        selectedTopics.length > 0
          ? `Priority Chapters / Topics: ${selectedTopics.join(', ')}`
          : `Cover the highest-weightage exam chapters for ${cleanClass} ${cleanBoard} ${cleanSubject}.`,
        cleanFocus ? `Student's Weak Areas / Special Focus: ${cleanFocus}` : '',
        '',
        'Strict Requirements:',
        `- ${langDirective}`,
        '- title: A sharp, motivating title for this crash revision sheet.',
        '- examStrategy: 2-3 concise sentences on scoring maximum marks quickly in this subject.',
        `- sprintBlocks: 4 sequential timed blocks whose minutes add up to exactly ${budget} minutes (e.g., Core Formulas, High-Weightage Concepts, Rapid-Fire Drill, Final Mistake Scan).`,
        '- highYieldTopics: 5 exam-priority topics with weightage ("Must-Know", "High", or "Quick Win"), 3-4 ultra-concise bullet keyPoints each, and examTrigger (how exam questions typically ask about it).',
        '- formulaCheatSheet: 6-8 essential formulas, definitions, laws, or key dates/facts with expression and a 1-line quickMemoryTip.',
        '- commonMistakes: 4 classic exam traps where students lose marks and the exact fix.',
        '- rapidFireQuestions: 6 exam-focused questions (mix of 1, 2, 3, and 5 mark weights) each with 4 MCQ options, correctIndex (0..3), concise answerKey, and 2-3 crisp markingPoints.',
        '- Use clean Unicode symbols (x², √, π, Δ, °, →, ≤, ≥) instead of raw LaTeX delimiters.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await generateContentWithRetry(ai, {
        contents: prompt,
        config: {
          systemInstruction: `You are an elite exam-prep coach creating ultra-clear, high-yield last-minute crash revision packs tailored to the student's board syllabus. ${langDirective}`,
          responseMimeType: 'application/json',
          responseSchema: crashRevisionSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = parseModelJson(response.text, {}) as {
        title?: string;
        examStrategy?: string;
        sprintBlocks?: Array<{
          blockNumber: number;
          minutes: number;
          title: string;
          focusAction: string;
        }>;
        highYieldTopics?: Array<{
          topic: string;
          weightage: 'Must-Know' | 'High' | 'Quick Win';
          keyPoints: string[];
          examTrigger: string;
        }>;
        formulaCheatSheet?: Array<{
          label: string;
          expression: string;
          quickMemoryTip: string;
        }>;
        commonMistakes?: Array<{ trap: string; fix: string }>;
        rapidFireQuestions?: Array<{
          question: string;
          marks: number;
          options: string[];
          correctIndex: number;
          answerKey: string;
          markingPoints: string[];
        }>;
      };

      const pack = {
        id: `crash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        subject: cleanSubject,
        syllabus: cleanBoard,
        classLevel: cleanClass,
        language: cleanLang,
        timeBudgetMinutes: budget,
        title: cleanText(
          parsed.title || `${cleanSubject} — ${budget}-Min Exam Crash Revision`,
          160
        ),
        examStrategy: cleanText(parsed.examStrategy || '', 600),
        sprintBlocks: Array.isArray(parsed.sprintBlocks)
          ? parsed.sprintBlocks.slice(0, 6).map((b, idx) => ({
              blockNumber: idx + 1,
              minutes: Math.max(5, Math.min(90, Math.round(Number(b.minutes) || 15))),
              title: cleanText(b.title, 100),
              focusAction: cleanText(b.focusAction, 240),
            }))
          : [],
        highYieldTopics: Array.isArray(parsed.highYieldTopics)
          ? parsed.highYieldTopics.slice(0, 8).map((t, idx) => ({
              id: `hyt-${idx + 1}`,
              topic: cleanText(t.topic, 120),
              weightage:
                t.weightage === 'Must-Know' || t.weightage === 'Quick Win' ? t.weightage : 'High',
              keyPoints: Array.isArray(t.keyPoints)
                ? t.keyPoints.slice(0, 5).map((kp) => cleanText(kp, 220)).filter(Boolean)
                : [],
              examTrigger: cleanText(t.examTrigger, 200),
            }))
          : [],
        formulaCheatSheet: Array.isArray(parsed.formulaCheatSheet)
          ? parsed.formulaCheatSheet.slice(0, 10).map((f) => ({
              label: cleanText(f.label, 90),
              expression: cleanText(f.expression, 220),
              quickMemoryTip: cleanText(f.quickMemoryTip, 180),
            }))
          : [],
        commonMistakes: Array.isArray(parsed.commonMistakes)
          ? parsed.commonMistakes.slice(0, 6).map((m) => ({
              trap: cleanText(m.trap, 200),
              fix: cleanText(m.fix, 220),
            }))
          : [],
        rapidFireQuestions: Array.isArray(parsed.rapidFireQuestions)
          ? parsed.rapidFireQuestions.slice(0, 8).map((q, idx) => ({
              id: `rfq-${idx + 1}`,
              question: cleanText(q.question, 360),
              marks: Math.max(1, Math.min(10, Math.round(Number(q.marks) || 2))),
              options: Array.isArray(q.options)
                ? q.options.slice(0, 4).map((o) => cleanText(o, 220))
                : [],
              correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
              answerKey: cleanText(q.answerKey, 400),
              markingPoints: Array.isArray(q.markingPoints)
                ? q.markingPoints.slice(0, 4).map((mp) => cleanText(mp, 200)).filter(Boolean)
                : [],
            }))
          : [],
        createdAt: new Date().toISOString(),
      };

      res.json({ pack });
    } catch (err) {
      handleApiError(res, err, 'Failed to generate Exam Crash Revision pack.');
    }
  });

  function getRazorpayCredentials(): { keyId: string; keySecret: string } | null {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    if (!keyId || !keySecret) {
      return null;
    }
    return { keyId, keySecret };
  }

  function formatRazorpayMethodLabel(methodRaw: unknown): string {
    const normalized = typeof methodRaw === 'string' ? methodRaw.trim().toLowerCase() : '';
    switch (normalized) {
      case 'upi':
        return 'Razorpay (UPI)';
      case 'card':
        return 'Razorpay (Card)';
      case 'netbanking':
        return 'Razorpay (Net Banking)';
      case 'wallet':
        return 'Razorpay (Wallet)';
      case 'emi':
        return 'Razorpay (EMI)';
      case 'paylater':
        return 'Razorpay (Pay Later)';
      default:
        return 'Razorpay';
    }
  }

  // 9b. Razorpay Subscription Configuration Status (never exposes RAZORPAY_KEY_SECRET)
  app.get('/api/subscription/config', (_req, res) => {
    const creds = getRazorpayCredentials();
    res.json({
      provider: 'razorpay',
      configured: Boolean(creds),
      planId: SUBSCRIPTION_PLAN_ID,
      amountInr: SUBSCRIPTION_AMOUNT_INR,
      amountPaise: SUBSCRIPTION_AMOUNT_PAISE,
      currency: 'INR',
      durationYears: SUBSCRIPTION_DURATION_YEARS,
    });
  });

  // 10. Razorpay Subscription Order Creation (₹200 INR for 7 Years)
  app.post('/api/subscription/create-order', async (req, res) => {
    try {
      const studentId = cleanText(req.body?.studentId, 128);
      const studentName = cleanText(req.body?.studentName, 80) || 'Student';
      if (!studentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(studentId)) {
        res.status(400).json({ error: 'A valid student account ID is required.' });
        return;
      }

      const creds = getRazorpayCredentials();
      if (!creds) {
        res.status(503).json({
          error:
            'Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings > Secrets.',
          code: 'RAZORPAY_NOT_CONFIGURED',
        });
        return;
      }

      const authHeader = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
      // Razorpay enforces a 40-character maximum on receipt IDs
      const receipt = `pw_${studentId.slice(0, 14)}_${Date.now()}`.slice(0, 40);

      const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: SUBSCRIPTION_AMOUNT_PAISE,
          currency: 'INR',
          receipt,
          notes: {
            planId: SUBSCRIPTION_PLAN_ID,
            durationYears: String(SUBSCRIPTION_DURATION_YEARS),
            studentId,
            studentName,
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!rpRes.ok) {
        const rpErr = (await rpRes.json().catch(() => ({}))) as {
          error?: { description?: string };
        };
        const detail =
          typeof rpErr?.error?.description === 'string' && rpErr.error.description.trim()
            ? rpErr.error.description.trim()
            : 'Unable to initialize Razorpay order right now.';
        res.status(502).json({ error: detail });
        return;
      }

      const rpOrder = (await rpRes.json()) as { id?: string; amount?: number; currency?: string };
      const orderId = cleanText(rpOrder.id, 80);
      if (
        !orderId ||
        !/^order_[a-zA-Z0-9]{6,40}$/.test(orderId) ||
        (typeof rpOrder.amount === 'number' && rpOrder.amount !== SUBSCRIPTION_AMOUNT_PAISE)
      ) {
        res.status(502).json({ error: `Razorpay did not return a valid ₹${SUBSCRIPTION_AMOUNT_INR} order.` });
        return;
      }

      res.json({
        orderId,
        orderToken: signOrderPayload(orderId, studentId),
        razorpayKeyId: creds.keyId,
        planId: SUBSCRIPTION_PLAN_ID,
        amountInr: SUBSCRIPTION_AMOUNT_INR,
        amountPaise: SUBSCRIPTION_AMOUNT_PAISE,
        currency: 'INR',
        durationYears: SUBSCRIPTION_DURATION_YEARS,
        mode: 'razorpay',
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to create Razorpay subscription order.');
    }
  });

  // 11. Verify Razorpay Payment Signature & Issue 7-Year Scholar Pass Receipt (Server-Authoritative)
  app.post('/api/subscription/verify-payment', async (req, res) => {
    try {
      const creds = getRazorpayCredentials();
      if (!creds) {
        res.status(503).json({
          error:
            'Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings > Secrets.',
          code: 'RAZORPAY_NOT_CONFIGURED',
        });
        return;
      }

      const orderId = cleanText(req.body?.orderId, 80);
      const orderToken = cleanText(req.body?.orderToken, 128);
      const studentId = cleanText(req.body?.studentId, 128);
      const razorpayPaymentId = cleanText(req.body?.razorpayPaymentId, 80);
      const razorpaySignature = cleanText(req.body?.razorpaySignature, 128).toLowerCase();

      if (
        !orderId ||
        !/^order_[a-zA-Z0-9]{6,40}$/.test(orderId) ||
        !orderToken ||
        !studentId ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(studentId)
      ) {
        res.status(400).json({ error: 'Invalid subscription order details.' });
        return;
      }

      if (
        !razorpayPaymentId ||
        !/^pay_[a-zA-Z0-9]{6,40}$/.test(razorpayPaymentId) ||
        !razorpaySignature ||
        !/^[a-f0-9]{64}$/.test(razorpaySignature)
      ) {
        res.status(400).json({ error: 'Missing or invalid Razorpay payment signature.' });
        return;
      }

      const expectedToken = signOrderPayload(orderId, studentId);
      if (!safeHexEqual(orderToken, expectedToken)) {
        res.status(403).json({ error: 'Order verification failed. Please restart checkout.' });
        return;
      }

      const expectedRpSig = crypto
        .createHmac('sha256', creds.keySecret)
        .update(`${orderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (!safeHexEqual(razorpaySignature, expectedRpSig)) {
        res.status(403).json({ error: 'Razorpay payment signature verification failed.' });
        return;
      }

      // Confirm payment status, order binding, currency, and exact ₹200 amount directly with Razorpay
      const authHeader = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
      const paymentRes = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!paymentRes.ok) {
        res.status(502).json({ error: 'Unable to confirm payment status with Razorpay.' });
        return;
      }

      const paymentData = (await paymentRes.json()) as {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        method?: string;
      };

      const validStatus = paymentData.status === 'captured' || paymentData.status === 'authorized';
      if (
        paymentData.id !== razorpayPaymentId ||
        paymentData.order_id !== orderId ||
        paymentData.amount !== SUBSCRIPTION_AMOUNT_PAISE ||
        paymentData.currency !== 'INR' ||
        !validStatus
      ) {
        res.status(403).json({
          error: 'Razorpay payment amount or status could not be confirmed.',
        });
        return;
      }

      const methodLabel = formatRazorpayMethodLabel(paymentData.method);
      const subscribedAtDate = new Date();
      const expiresAtDate = new Date(subscribedAtDate.getTime());
      expiresAtDate.setFullYear(expiresAtDate.getFullYear() + SUBSCRIPTION_DURATION_YEARS);

      const receiptId = `PW-7YR-${razorpayPaymentId.slice(-10).toUpperCase()}`;

      res.json({
        receiptId,
        planId: SUBSCRIPTION_PLAN_ID,
        amountInr: SUBSCRIPTION_AMOUNT_INR,
        currency: 'INR',
        durationYears: SUBSCRIPTION_DURATION_YEARS,
        subscribedAt: subscribedAtDate.toISOString(),
        expiresAt: expiresAtDate.toISOString(),
        paymentMethod: methodLabel,
        razorpayPaymentId,
        mode: 'razorpay',
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to verify Razorpay subscription payment.');
    }
  });

  // 11b. Redeem Referral / Discount Code (PRINCE -> ₹0.00 instant 7-Year Scholar Pass)
  app.post('/api/subscription/redeem-code', (req, res) => {
    try {
      const studentId = cleanText(req.body?.studentId, 128);
      const rawCode = cleanText(req.body?.code, 32).toUpperCase();

      if (!studentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(studentId)) {
        res.status(400).json({ error: 'A valid student account ID is required.' });
        return;
      }

      if (!rawCode) {
        res.status(400).json({ error: 'Please enter a referral or discount code.' });
        return;
      }

      if (rawCode !== FREE_REFERRAL_CODE) {
        res.status(400).json({
          error: 'Invalid referral or discount code. Please check the code and try again.',
        });
        return;
      }

      const subscribedAtDate = new Date();
      const expiresAtDate = new Date(subscribedAtDate.getTime());
      expiresAtDate.setFullYear(expiresAtDate.getFullYear() + SUBSCRIPTION_DURATION_YEARS);

      const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      const receiptId = `PW-7YR-${FREE_REFERRAL_CODE}-${suffix}`;

      res.json({
        receiptId,
        planId: SUBSCRIPTION_PLAN_ID,
        amountInr: 0,
        currency: 'INR',
        durationYears: SUBSCRIPTION_DURATION_YEARS,
        subscribedAt: subscribedAtDate.toISOString(),
        expiresAt: expiresAtDate.toISOString(),
        paymentMethod: `Referral Code (${FREE_REFERRAL_CODE})`,
        referralCode: FREE_REFERRAL_CODE,
        mode: 'referral',
      });
    } catch (err) {
      handleApiError(res, err, 'Failed to redeem referral or discount code.');
    }
  });

  const httpServer = http.createServer(app);
  attachStudyRoomWebSocket(httpServer, app);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Pathwise server running on http://localhost:${PORT}`);
  });
}

startServer();
