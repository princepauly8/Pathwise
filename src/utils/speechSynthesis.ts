import type { LearningModule, LessonContent } from '../types/study';

export const TTS_RATE_OPTIONS = [0.85, 1, 1.15, 1.3] as const;
export type TtsRateOption = (typeof TTS_RATE_OPTIONS)[number];

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Normalizes markdown, arrows, and formatting symbols so spoken narration sounds natural.
 */
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\s*(?:->|=>|→)\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ensures a text segment ends with sentence punctuation for natural speech pacing.
 */
function ensureSentenceEnd(text: string): string {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return '';
  return /[.!?।]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

/**
 * Assembles the generated StudyKit lesson content into clean plain text for text-to-speech playback.
 */
export function buildLessonReadAloudText(
  module: Pick<LearningModule, 'title' | 'subtitle'>,
  lesson: LessonContent
): string {
  const sections: string[] = [];

  const title = cleanTextForSpeech(module.title);
  if (title) {
    sections.push(ensureSentenceEnd(title));
  }

  const summary = ensureSentenceEnd(lesson.summary);
  if (summary) {
    sections.push(`Core Summary. ${summary}`);
  }

  if (Array.isArray(lesson.concepts)) {
    lesson.concepts.forEach((concept, idx) => {
      const heading = cleanTextForSpeech(concept.heading);
      const explanation = ensureSentenceEnd(concept.explanation);
      const formula = concept.formulaOrKeyRule
        ? `Key rule: ${ensureSentenceEnd(concept.formulaOrKeyRule)}`
        : '';
      const parts = [
        heading ? `Concept ${idx + 1}: ${ensureSentenceEnd(heading)}` : '',
        explanation,
        formula,
      ].filter(Boolean);
      if (parts.length > 0) {
        sections.push(parts.join(' '));
      }
    });
  }

  if (lesson.workedExample) {
    const prompt = ensureSentenceEnd(lesson.workedExample.prompt);
    const steps = (lesson.workedExample.steps ?? [])
      .map((step, idx) => {
        const cleanedStep = ensureSentenceEnd(step);
        return cleanedStep ? `Step ${idx + 1}: ${cleanedStep}` : '';
      })
      .filter(Boolean)
      .join(' ');
    const takeaway = ensureSentenceEnd(lesson.workedExample.takeaway);

    const exampleParts = [
      prompt ? `Worked Example. ${prompt}` : '',
      steps,
      takeaway ? `Key Takeaway: ${takeaway}` : '',
    ].filter(Boolean);

    if (exampleParts.length > 0) {
      sections.push(exampleParts.join(' '));
    }
  }

  return sections.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Splits long narration text into sentence-aligned chunks so browser speechSynthesis engines
 * (especially Chromium's ~15-second utterance limit) read entire lessons reliably without cutting off.
 */
export function splitTextIntoSpeechChunks(text: string, maxChunkLen = 220): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const limit = Math.max(40, maxChunkLen);
  const rawSentences = normalized
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
  };

  for (const sentence of rawSentences) {
    if (sentence.length > limit) {
      pushCurrent();
      const words = sentence.split(/\s+/);
      let piece = '';
      for (const word of words) {
        if (!piece) {
          piece = word;
        } else if (piece.length + 1 + word.length <= limit) {
          piece = `${piece} ${word}`;
        } else {
          chunks.push(piece);
          piece = word;
        }
      }
      if (piece) {
        chunks.push(piece);
      }
      continue;
    }

    if (!current) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= limit) {
      current = `${current} ${sentence}`;
    } else {
      pushCurrent();
      current = sentence;
    }
  }

  pushCurrent();
  return chunks;
}

export interface SpeechVoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
}

/**
 * Picks the best matching SpeechSynthesisVoice for a BCP-47 locale (e.g. 'en-IN', 'ml-IN', 'hi-IN').
 */
export function pickBestVoiceForLocale<T extends SpeechVoiceLike>(
  voices: readonly T[],
  locale: string
): T | null {
  if (!voices.length || !locale.trim()) return null;

  const normalizedLocale = locale.trim().toLowerCase().replace(/_/g, '-');
  const primaryLang = normalizedLocale.split('-')[0];

  const exactMatches = voices.filter(
    (v) => v.lang.trim().toLowerCase().replace(/_/g, '-') === normalizedLocale
  );
  if (exactMatches.length > 0) {
    return exactMatches.find((v) => v.localService) ?? exactMatches[0];
  }

  const prefixMatches = voices.filter((v) => {
    const vLang = v.lang.trim().toLowerCase().replace(/_/g, '-');
    return vLang === primaryLang || vLang.startsWith(`${primaryLang}-`);
  });
  if (prefixMatches.length > 0) {
    return prefixMatches.find((v) => v.localService) ?? prefixMatches[0];
  }

  return null;
}
