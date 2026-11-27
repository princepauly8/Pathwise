import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { BoardSyllabusSyncRecord, StudentProfile } from '../types/study';
import { BOARD_QUICK_PRESETS, formatSyncTimestamp } from '../utils/syllabusSync';

interface BoardSyllabusSyncBarProps {
  profile: StudentProfile;
  syncRecord: BoardSyllabusSyncRecord | null;
  autoUpdateEnabled: boolean;
  isSyncing: boolean;
  syncError: string | null;
  onQuickSwitchBoard: (nextBoard: string) => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  onSyncNow: () => void;
}

export const BoardSyllabusSyncBar: React.FC<BoardSyllabusSyncBarProps> = ({
  profile,
  syncRecord,
  autoUpdateEnabled,
  isSyncing,
  syncError,
  onQuickSwitchBoard,
  onToggleAutoUpdate,
  onSyncNow,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const highlights = Array.isArray(syncRecord?.highlights) ? syncRecord.highlights : [];
  const sources = Array.isArray(syncRecord?.sources) ? syncRecord.sources : [];
  const subjectCount = Array.isArray(profile?.subjects) ? profile.subjects.length : 0;

  const isSyncedForCurrentBoard =
    Boolean(syncRecord) &&
    (syncRecord?.board ?? '').trim().toLowerCase() === (profile?.syllabus ?? '').trim().toLowerCase() &&
    (syncRecord?.classLevel ?? '').trim().toLowerCase() ===
      (profile?.classLevel ?? '').trim().toLowerCase();

  const nationalPresets = BOARD_QUICK_PRESETS.filter(
    (b) => b.group === 'National & International'
  );
  const statePresets = BOARD_QUICK_PRESETS.filter((b) => b.group === 'State Boards');
  const isCustomCurrentBoard = !BOARD_QUICK_PRESETS.some((b) => b.id === profile.syllabus);

  return (
    <section
      aria-label="Board syllabus auto-updater"
      data-testid="board-syllabus-sync-bar"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Status & Board Metadata */}
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-[#0284C7] dark:text-sky-400">Board Syllabus Auto-Updater</span>
            <span aria-hidden="true">·</span>
            <span>{profile.classLevel}</span>
            {isSyncedForCurrentBoard && syncRecord && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {syncRecord.academicSession || 'Latest Session'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Synced {formatSyncTimestamp(syncRecord.syncedAt)}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold text-[#0F172A] dark:text-slate-100">
              {isSyncing
                ? `Updating ${profile.syllabus} syllabus across ${subjectCount} subjects...`
                : isSyncedForCurrentBoard && syncRecord
                  ? `Synced to ${syncRecord.boardAuthority || profile.syllabus}`
                  : `${profile.syllabus} Curriculum`}
            </h2>

            {isSyncedForCurrentBoard && !isSyncing && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Up to date
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            {isSyncing
              ? 'Checking official board chapters, rationalized topics, and exam weightage, then aligning every subject path automatically.'
              : isSyncedForCurrentBoard && syncRecord?.summary
                ? syncRecord.summary
                : 'Switch your board below or check for updates anytime—Pathwise automatically aligns chapters and objectives to your selected board (CBSE, ICSE, State Boards, IB, or IGCSE).'}
          </p>
        </div>

        {/* Right: Quick Board Switcher + Auto-Sync Toggle + Update Now CTA */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="quick-board-select" className="sr-only">
              Switch curriculum board
            </label>
            <select
              id="quick-board-select"
              data-testid="quick-board-select"
              value={profile.syllabus}
              disabled={isSyncing}
              onChange={(e) => {
                const next = e.target.value;
                if (next && next !== profile.syllabus) {
                  onQuickSwitchBoard(next);
                }
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100 focus:border-[#0284C7] dark:focus:border-sky-400 disabled:opacity-60 max-w-[230px]"
            >
              {isCustomCurrentBoard && (
                <option value={profile.syllabus}>{profile.syllabus} (Custom)</option>
              )}
              <optgroup label="National & International Boards">
                {nationalPresets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Indian State Boards">
                {statePresets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            type="button"
            data-testid="toggle-auto-sync-btn"
            aria-pressed={autoUpdateEnabled}
            onClick={() => onToggleAutoUpdate(!autoUpdateEnabled)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              autoUpdateEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Auto-Update: {autoUpdateEnabled ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            data-testid="sync-board-syllabus-btn"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                Updating Syllabus...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Update Syllabus Now
              </>
            )}
          </button>
        </div>
      </div>

      {syncError && (
        <div
          role="alert"
          data-testid="syllabus-sync-error"
          className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-3"
        >
          <span>{syncError}</span>
          <button
            type="button"
            onClick={onSyncNow}
            className="font-semibold text-red-900 dark:text-red-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Expandable Board Curriculum Highlights & Grounded Official Sources */}
      {isSyncedForCurrentBoard &&
        syncRecord &&
        (highlights.length > 0 || sources.length > 0) && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              data-testid="toggle-syllabus-details-btn"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 cursor-pointer"
            >
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {showDetails
                ? 'Hide curriculum update notes'
                : `View ${syncRecord.boardAuthority || profile.syllabus} update highlights${
                    sources.length > 0
                      ? ` & ${sources.length} official reference${
                          sources.length === 1 ? '' : 's'
                        }`
                      : ''
                  }`}
            </button>

            {showDetails && (
              <div
                data-testid="syllabus-sync-details"
                className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs"
              >
                {highlights.length > 0 && (
                  <div className="lg:col-span-7 space-y-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Curriculum Alignment Notes ({syncRecord.academicSession || 'Latest Session'})
                    </p>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                      {highlights.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                            {idx + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="lg:col-span-5 space-y-2">
                    <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                      <Globe className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
                      Official Board Portals
                    </p>
                    <ul className="space-y-1.5">
                      {sources.map((src, idx) => (
                        <li key={idx}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#0284C7] dark:text-sky-400 hover:underline break-all"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{src.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </section>
  );
};
