export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface SpeechLocaleOption {
  code: string;
  label: string;
}

export const MAX_MODULE_NOTES_LENGTH = 6000;

export const SPEECH_LOCALE_OPTIONS: SpeechLocaleOption[] = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
  { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ur-IN', label: 'Urdu (اردو)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'ar-SA', label: 'Arabic (العربية)' },
  { code: 'pt-BR', label: 'Portuguese (Português)' },
  { code: 'zh-CN', label: 'Chinese (中文)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'ko-KR', label: 'Korean (한국어)' },
];

const LANGUAGE_TO_SPEECH_LOCALE: Record<string, string> = {
  english: 'en-IN',
  en: 'en-IN',
  malayalam: 'ml-IN',
  ml: 'ml-IN',
  hindi: 'hi-IN',
  hi: 'hi-IN',
  tamil: 'ta-IN',
  ta: 'ta-IN',
  telugu: 'te-IN',
  te: 'te-IN',
  kannada: 'kn-IN',
  kn: 'kn-IN',
  marathi: 'mr-IN',
  mr: 'mr-IN',
  bengali: 'bn-IN',
  bn: 'bn-IN',
  gujarati: 'gu-IN',
  gu: 'gu-IN',
  punjabi: 'pa-IN',
  pa: 'pa-IN',
  urdu: 'ur-IN',
  ur: 'ur-IN',
  odia: 'or-IN',
  or: 'or-IN',
  assamese: 'as-IN',
  as: 'as-IN',
  nepali: 'ne-NP',
  ne: 'ne-NP',
  spanish: 'es-ES',
  es: 'es-ES',
  french: 'fr-FR',
  fr: 'fr-FR',
  german: 'de-DE',
  de: 'de-DE',
  arabic: 'ar-SA',
  ar: 'ar-SA',
  portuguese: 'pt-BR',
  pt: 'pt-BR',
  russian: 'ru-RU',
  ru: 'ru-RU',
  'chinese (simplified)': 'zh-CN',
  zh: 'zh-CN',
  japanese: 'ja-JP',
  ja: 'ja-JP',
  korean: 'ko-KR',
  ko: 'ko-KR',
  italian: 'it-IT',
  it: 'it-IT',
  dutch: 'nl-NL',
  nl: 'nl-NL',
  turkish: 'tr-TR',
  tr: 'tr-TR',
  indonesian: 'id-ID',
  id: 'id-ID',
  malay: 'ms-MY',
  ms: 'ms-MY',
  thai: 'th-TH',
  th: 'th-TH',
  vietnamese: 'vi-VN',
  vi: 'vi-VN',
  swahili: 'sw-KE',
  sw: 'sw-KE',
  polish: 'pl-PL',
  pl: 'pl-PL',
  persian: 'fa-IR',
  fa: 'fa-IR',
  hebrew: 'he-IL',
  he: 'he-IL',
  greek: 'el-GR',
  el: 'el-GR',
  swedish: 'sv-SE',
  sv: 'sv-SE',
  ukrainian: 'uk-UA',
  uk: 'uk-UA',
  'filipino / tagalog': 'fil-PH',
  tl: 'fil-PH',
};

interface SpeechRecognitionWindowLike {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function getSpeechRecognitionConstructor(
  win: SpeechRecognitionWindowLike | undefined = typeof window !== 'undefined'
    ? (window as unknown as SpeechRecognitionWindowLike)
    : undefined
): SpeechRecognitionConstructor | null {
  if (!win) return null;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(
  win: SpeechRecognitionWindowLike | undefined = typeof window !== 'undefined'
    ? (window as unknown as SpeechRecognitionWindowLike)
    : undefined
): boolean {
  return getSpeechRecognitionConstructor(win) !== null;
}

export function getSpeechLocaleForLanguage(languageName?: string): string {
  const normalized = (languageName ?? '').trim().toLowerCase();
  if (!normalized) return 'en-IN';
  if (LANGUAGE_TO_SPEECH_LOCALE[normalized]) {
    return LANGUAGE_TO_SPEECH_LOCALE[normalized];
  }
  // Already a BCP-47 locale like "en-US" or "ml-IN"
  if (/^[a-z]{2,3}-[a-z]{2}$/i.test(normalized)) {
    const [lang, region] = normalized.split('-');
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }
  return 'en-IN';
}

export function appendTranscriptText(
  existing: string,
  dictated: string,
  maxLength: number = MAX_MODULE_NOTES_LENGTH
): string {
  const cleanDictated = dictated.replace(/\s+/g, ' ').trim();
  if (!cleanDictated) return existing.slice(0, maxLength);

  if (!existing) {
    return cleanDictated.slice(0, maxLength);
  }

  const endsWithWhitespace = /\s$/.test(existing);
  const separator = endsWithWhitespace ? '' : ' ';
  return `${existing}${separator}${cleanDictated}`.slice(0, maxLength);
}

export function formatSpeechErrorMessage(errorCode?: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Allow microphone access in your browser settings to dictate notes.';
    case 'audio-capture':
      return 'No microphone was detected. Connect or enable a microphone and try dictating again.';
    case 'no-speech':
      return 'No speech was detected. Speak clearly near your microphone and try again.';
    case 'network':
      return 'Speech recognition needs an internet connection in this browser. Check your connection and retry.';
    case 'aborted':
      return '';
    default:
      return 'Voice dictation could not continue. You can click Start Dictation to try again or type your notes directly.';
  }
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
