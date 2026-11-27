import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  formatLanguageOption,
} from '../utils/languages';

interface LanguageSelectProps {
  id: string;
  value: string;
  onChange: (language: string) => void;
  compact?: boolean;
  label?: string;
}

const INDIAN_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.group === 'Indian Languages');
const GLOBAL_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.group === 'Global Languages');

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  id,
  value,
  onChange,
  compact = false,
  label,
}) => {
  const normalized = (value || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE;
  const isKnown = SUPPORTED_LANGUAGES.some(
    (l) => l.name.toLowerCase() === normalized.toLowerCase()
  );

  const [isCustomMode, setIsCustomMode] = useState(!isKnown);
  const [customDraft, setCustomDraft] = useState(isKnown ? '' : normalized);

  const selectValue = isCustomMode
    ? '__custom__'
    : SUPPORTED_LANGUAGES.find((l) => l.name.toLowerCase() === normalized.toLowerCase())?.name ??
      DEFAULT_LANGUAGE;

  const handleSelectChange = (next: string) => {
    if (next === '__custom__') {
      setIsCustomMode(true);
      if (customDraft.trim().length >= 2) {
        onChange(customDraft.trim());
      }
      return;
    }
    setIsCustomMode(false);
    onChange(next);
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 shrink-0">
        <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
        <label htmlFor={id} className="sr-only">
          Study language
        </label>
        <select
          id={id}
          value={isKnown ? selectValue : normalized}
          onChange={(e) => onChange(e.target.value)}
          title="Select study language (Malayalam, Hindi, English, and more)"
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-medium text-[#0F172A] dark:text-slate-100 max-w-[138px] cursor-pointer focus:border-[#0284C7] dark:focus:border-sky-400"
        >
          {!isKnown && <option value={normalized}>{normalized}</option>}
          <optgroup label="Indian Languages">
            {INDIAN_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>
                {formatLanguageOption(lang)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Global Languages">
            {GLOBAL_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>
                {formatLanguageOption(lang)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          id={id}
          value={selectValue}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#0284C7] dark:focus:border-sky-400"
        >
          <optgroup label="Indian Languages">
            {INDIAN_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>
                {formatLanguageOption(lang)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Global Languages">
            {GLOBAL_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>
                {formatLanguageOption(lang)}
              </option>
            ))}
          </optgroup>
          <option value="__custom__">Other / Custom Language...</option>
        </select>

        {isCustomMode && (
          <input
            type="text"
            maxLength={60}
            value={customDraft}
            onChange={(e) => {
              const next = e.target.value;
              setCustomDraft(next);
              if (next.trim().length >= 2) {
                onChange(next.trim());
              }
            }}
            placeholder="Type any language name..."
            aria-label="Custom study language"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
          />
        )}
      </div>
    </div>
  );
};
