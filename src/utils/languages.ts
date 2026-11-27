export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  group: 'Indian Languages' | 'Global Languages';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // Prominent & Indian Languages (22 scheduled + English)
  { code: 'en', name: 'English', nativeName: 'English', group: 'Indian Languages' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', group: 'Indian Languages' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', group: 'Indian Languages' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', group: 'Indian Languages' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', group: 'Indian Languages' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', group: 'Indian Languages' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', group: 'Indian Languages' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', group: 'Indian Languages' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', group: 'Indian Languages' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', group: 'Indian Languages' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', group: 'Indian Languages' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', group: 'Indian Languages' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', group: 'Indian Languages' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', group: 'Indian Languages' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', group: 'Indian Languages' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', group: 'Indian Languages' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', group: 'Indian Languages' },
  { code: 'mni', name: 'Manipuri', nativeName: 'ꯃꯩꯇꯩꯂꯣꯟ', group: 'Indian Languages' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', group: 'Indian Languages' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', group: 'Indian Languages' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', group: 'Indian Languages' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', group: 'Indian Languages' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', group: 'Indian Languages' },

  // Major Global Languages
  { code: 'es', name: 'Spanish', nativeName: 'Español', group: 'Global Languages' },
  { code: 'fr', name: 'French', nativeName: 'Français', group: 'Global Languages' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', group: 'Global Languages' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', group: 'Global Languages' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', group: 'Global Languages' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', group: 'Global Languages' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文', group: 'Global Languages' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', group: 'Global Languages' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', group: 'Global Languages' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', group: 'Global Languages' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', group: 'Global Languages' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', group: 'Global Languages' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', group: 'Global Languages' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', group: 'Global Languages' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', group: 'Global Languages' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', group: 'Global Languages' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', group: 'Global Languages' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', group: 'Global Languages' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', group: 'Global Languages' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', group: 'Global Languages' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', group: 'Global Languages' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', group: 'Global Languages' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', group: 'Global Languages' },
  { code: 'tl', name: 'Filipino / Tagalog', nativeName: 'Tagalog', group: 'Global Languages' },
];

export const DEFAULT_LANGUAGE = 'English';

export function formatLanguageOption(lang: LanguageOption): string {
  return lang.name === lang.nativeName ? lang.name : `${lang.name} (${lang.nativeName})`;
}

export function getLanguageDisplayLabel(languageName?: string): string {
  const clean = (languageName ?? '').trim() || DEFAULT_LANGUAGE;
  const found = SUPPORTED_LANGUAGES.find(
    (l) => l.name.toLowerCase() === clean.toLowerCase() || l.code.toLowerCase() === clean.toLowerCase()
  );
  return found ? formatLanguageOption(found) : clean;
}

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      const segments = url.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(segments[0].toLowerCase()) &&
        /^[a-zA-Z0-9_-]{11}$/.test(segments[1])
      ) {
        return segments[1];
      }
    }
  } catch {
    // Fall through to regex fallback
  }

  const regexMatch = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  return regexMatch ? regexMatch[1] : null;
}

export interface CuratedYouTubeClassPreset {
  videoId: string;
  title: string;
  channelName: string;
  subject: string;
  topicHint: string;
}

export const CURATED_YOUTUBE_CLASSES: CuratedYouTubeClassPreset[] = [
  {
    videoId: 'PUB0TaZ7bhA',
    title: 'Trigonometry For Beginners!',
    channelName: 'The Organic Chemistry Tutor',
    subject: 'Mathematics',
    topicHint: 'Right-triangle sin, cos, tan ratios (SOH CAH TOA), Pythagorean theorem, and angle calculations',
  },
  {
    videoId: 'ZM8ECpBuQYE',
    title: 'Motion in a Straight Line: Crash Course Physics #1',
    channelName: 'CrashCourse',
    subject: 'Physics',
    topicHint: 'Position, displacement, velocity, acceleration, kinematic equations, and motion graphs',
  },
  {
    videoId: 'Yocja_N5s1I',
    title: 'The Agricultural Revolution: Crash Course World History #1',
    channelName: 'CrashCourse',
    subject: 'World History',
    topicHint: 'Foraging vs farming, domestication, early settlements, and social transformation',
  },
  {
    videoId: 'WUvTyaaNkzM',
    title: 'The essence of calculus',
    channelName: '3Blue1Brown',
    subject: 'Mathematics',
    topicHint: 'Area of a circle via concentric rings, derivatives, integrals, and the Fundamental Theorem of Calculus',
  },
];
