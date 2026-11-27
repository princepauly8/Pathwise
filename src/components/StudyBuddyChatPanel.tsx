import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CornerUpLeft,
  HelpCircle,
  Send,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react';
import type { StudentProfile } from '../types/study';
import {
  buildLiveProgressUpdate,
  countOpenQuestions,
  countProgressUpdates,
  filterBuddyMessages,
  formatChatTimestamp,
  type StudyBuddyFilter,
  type StudyBuddyMessageKind,
  type StudyBuddyReactionKey,
  type StudyRoomChatMessage,
} from '../utils/studyBuddyChat';

interface StudyBuddyChatPanelProps {
  profile: StudentProfile;
  roomCode: string;
  roomSubject: string;
  selfPeerId: string | null;
  messages: StudyRoomChatMessage[];
  typingNames: string[];
  onSendMessage: (payload: {
    kind: Exclude<StudyBuddyMessageKind, 'system'>;
    text: string;
    subjectTag?: string;
    progressPercent?: number;
    replyToId?: string;
  }) => void;
  onToggleResolveQuestion: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: StudyBuddyReactionKey) => void;
  onTypingChange: (isTyping: boolean) => void;
}

const PROGRESS_PRESETS = [25, 50, 75, 100] as const;

export const StudyBuddyChatPanel: React.FC<StudyBuddyChatPanelProps> = ({
  profile,
  roomCode,
  roomSubject,
  selfPeerId,
  messages,
  typingNames,
  onSendMessage,
  onToggleResolveQuestion,
  onToggleReaction,
  onTypingChange,
}) => {
  const [filter, setFilter] = useState<StudyBuddyFilter>('all');
  const [composeKind, setComposeKind] =
    useState<Exclude<StudyBuddyMessageKind, 'system'>>('chat');
  const [draft, setDraft] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(() => {
    const live = buildLiveProgressUpdate(profile, roomSubject);
    return live.progressPercent;
  });
  const [replyTarget, setReplyTarget] = useState<StudyRoomChatMessage | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingSentRef = useRef(false);

  const liveProgress = useMemo(
    () => buildLiveProgressUpdate(profile, roomSubject),
    [profile, roomSubject]
  );

  const openQuestionsCount = useMemo(() => countOpenQuestions(messages), [messages]);
  const progressCount = useMemo(() => countProgressUpdates(messages), [messages]);
  const visibleMessages = useMemo(
    () => filterBuddyMessages(messages, filter),
    [messages, filter]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [visibleMessages.length, filter]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingSentRef.current) {
        onTypingChange(false);
        isTypingSentRef.current = false;
      }
    };
  }, [onTypingChange]);

  const stopTypingSignal = () => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingSentRef.current) {
      isTypingSentRef.current = false;
      onTypingChange(false);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (value.trim().length > 0) {
      if (!isTypingSentRef.current) {
        isTypingSentRef.current = true;
        onTypingChange(true);
      }
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        isTypingSentRef.current = false;
        onTypingChange(false);
      }, 2400);
    } else {
      stopTypingSignal();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    onSendMessage({
      kind: composeKind,
      text: trimmed,
      subjectTag: roomSubject,
      progressPercent: composeKind === 'progress' ? progressPercent : undefined,
      replyToId: replyTarget?.id,
    });

    setDraft('');
    setReplyTarget(null);
    stopTypingSignal();
    if (composeKind !== 'chat') {
      setComposeKind('chat');
    }
  };

  const handleShareLiveProgressNow = () => {
    onSendMessage({
      kind: 'progress',
      text: liveProgress.text,
      subjectTag: liveProgress.subjectTag,
      progressPercent: liveProgress.progressPercent,
    });
    setReplyTarget(null);
    setComposeKind('chat');
  };

  const handleStartReply = (msg: StudyRoomChatMessage) => {
    setReplyTarget(msg);
    setComposeKind('chat');
    inputRef.current?.focus();
  };

  const placeholderText =
    composeKind === 'question'
      ? `Ask a ${roomSubject} question for buddies in ${roomCode}...`
      : composeKind === 'progress'
        ? 'Share a milestone (e.g., Finished Ex 4.3 · 8/10 solved)...'
        : replyTarget
          ? `Reply to ${replyTarget.senderName}...`
          : 'Message your study buddies...';

  return (
    <div
      data-testid="study-buddy-chat-panel"
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Filter Controls */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Filter study buddy chat"
          className="inline-flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
        >
          {(
            [
              { id: 'all', label: 'All' },
              {
                id: 'question',
                label: openQuestionsCount > 0 ? `Questions (${openQuestionsCount})` : 'Questions',
              },
              {
                id: 'progress',
                label: progressCount > 0 ? `Progress (${progressCount})` : 'Progress',
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`buddy-filter-${tab.id}`}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="buddy-quick-share-progress-btn"
          onClick={handleShareLiveProgressNow}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669] dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
          title="Post your live Pathwise subject progress to the room"
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Share Progress
        </button>
      </div>

      {/* Live Message Stream */}
      <div
        data-testid="study-buddy-message-list"
        className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0"
      >
        {visibleMessages.length === 0 ? (
          <div className="py-10 px-3 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {filter === 'question'
                ? 'No study questions posted yet'
                : filter === 'progress'
                  ? 'No progress updates shared yet'
                  : `Study Buddy Chat · Room ${roomCode}`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {filter === 'question'
                ? 'Switch the composer below to Question to ask a doubt—buddies can reply and mark it answered.'
                : filter === 'progress'
                  ? 'Click Share Progress above to post your real Pathwise mastery update for friends in this room.'
                  : 'Post a question, share live chapter progress updates, or swap formulas in real time with everyone in this room.'}
            </p>
          </div>
        ) : (
          visibleMessages.map((m) => {
            if (m.kind === 'system') {
              return (
                <div
                  key={m.id}
                  data-testid="buddy-msg-system"
                  className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-0.5"
                >
                  {m.text}
                </div>
              );
            }

            const isSelf = m.peerId === selfPeerId;
            const timeLabel = formatChatTimestamp(m.timestamp);
            const helpfulPeers = m.reactions?.helpful ?? [];
            const cheersPeers = m.reactions?.cheers ?? [];
            const hasHelpful = Boolean(selfPeerId && helpfulPeers.includes(selfPeerId));
            const hasCheers = Boolean(selfPeerId && cheersPeers.includes(selfPeerId));

            const kindLabel =
              m.kind === 'question'
                ? m.resolved
                  ? 'Answered Question'
                  : 'Open Question'
                : m.kind === 'progress'
                  ? 'Progress Update'
                  : null;

            const cardClass =
              m.kind === 'question'
                ? m.resolved
                  ? 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-slate-100'
                  : 'bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 text-[#0F172A] dark:text-slate-100'
                : m.kind === 'progress'
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-[#0F172A] dark:text-slate-100'
                  : isSelf
                    ? 'bg-[#0F172A] dark:bg-sky-600 text-white'
                    : 'bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-slate-100';

            return (
              <article
                key={m.id}
                data-testid={`buddy-msg-${m.kind}`}
                className={`flex flex-col ${
                  m.kind === 'chat' && isSelf ? 'items-end' : 'items-start'
                }`}
              >
                {/* Unboxed quiet metadata line */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {isSelf ? 'You' : m.senderName}
                  </span>
                  {kindLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          m.kind === 'question'
                            ? m.resolved
                              ? 'text-[#059669] dark:text-emerald-400'
                              : 'text-[#0284C7] dark:text-sky-400'
                            : 'text-[#059669] dark:text-emerald-400'
                        }`}
                      >
                        {kindLabel}
                      </span>
                    </>
                  )}
                  {m.subjectTag && m.kind !== 'chat' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{m.subjectTag}</span>
                    </>
                  )}
                  {timeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">{timeLabel}</span>
                    </>
                  )}
                </div>

                {/* Message Card */}
                <div
                  className={`rounded-lg px-3 py-2.5 text-xs leading-relaxed space-y-2 ${
                    m.kind === 'chat' ? 'max-w-[88%]' : 'w-full'
                  } ${cardClass}`}
                >
                  {m.replyToPreview && (
                    <div
                      className={`text-[11px] rounded-md px-2 py-1 border ${
                        m.kind === 'chat' && isSelf
                          ? 'bg-slate-800/80 dark:bg-sky-700/70 border-slate-700 dark:border-sky-500/60 text-slate-300 dark:text-sky-100'
                          : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-semibold">Replying to {m.replyToSender}:</span>{' '}
                      <span className="italic">{m.replyToPreview}</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap break-words">{m.text}</p>

                  {/* Progress Meter for Progress Updates */}
                  {m.kind === 'progress' && typeof m.progressPercent === 'number' && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-emerald-900 dark:text-emerald-300">
                        <span className="font-medium">Reported mastery</span>
                        <span className="font-mono font-semibold tabular-nums">
                          {m.progressPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-emerald-200/70 dark:bg-emerald-900/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#059669] dark:bg-emerald-400 transition-all duration-200"
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Question Status & Resolve Control */}
                  {m.kind === 'question' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          m.resolved ? 'text-[#059669] dark:text-emerald-400' : 'text-[#0284C7] dark:text-sky-400'
                        }`}
                      >
                        {m.resolved ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            Answered{m.resolvedBy ? ` · marked by ${m.resolvedBy}` : ''}
                          </>
                        ) : (
                          <>
                            <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            Needs help from a study buddy
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        data-testid="buddy-resolve-btn"
                        onClick={() => onToggleResolveQuestion(m.id)}
                        className="font-semibold text-[#0284C7] dark:text-sky-400 hover:text-[#0369A1] dark:hover:text-sky-300 underline underline-offset-2 whitespace-nowrap cursor-pointer"
                      >
                        {m.resolved ? 'Reopen' : 'Mark Answered'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Row: Reply + Quick Study Reactions */}
                <div className="flex items-center gap-3 mt-1 px-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    data-testid="buddy-reply-btn"
                    onClick={() => handleStartReply(m)}
                    className="inline-flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <CornerUpLeft className="w-3 h-3" aria-hidden="true" />
                    Reply
                  </button>

                  <button
                    type="button"
                    data-testid="buddy-react-helpful"
                    aria-pressed={hasHelpful}
                    onClick={() => onToggleReaction(m.id, 'helpful')}
                    className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      hasHelpful
                        ? 'text-[#0284C7] dark:text-sky-400 font-semibold'
                        : 'hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                    Helpful
                    {helpfulPeers.length > 0 && (
                      <span className="font-mono tabular-nums">({helpfulPeers.length})</span>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="buddy-react-cheers"
                    aria-pressed={hasCheers}
                    onClick={() => onToggleReaction(m.id, 'cheers')}
                    className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      hasCheers
                        ? 'text-[#059669] dark:text-emerald-400 font-semibold'
                        : 'hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    <Award className="w-3 h-3" aria-hidden="true" />
                    Cheer
                    {cheersPeers.length > 0 && (
                      <span className="font-mono tabular-nums">({cheersPeers.length})</span>
                    )}
                  </button>
                </div>
              </article>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Live Typing Indicator */}
      {typingNames.length > 0 && (
        <div
          data-testid="buddy-typing-indicator"
          className="px-3.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
        >
          {typingNames.length === 1
            ? `${typingNames[0]} is typing...`
            : `${typingNames.join(', ')} are typing...`}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-xl space-y-2"
      >
        {/* Mode Switcher: Message / Question / Progress */}
        <div className="flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Message type"
            className="inline-flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'chat', label: 'Message' },
                { id: 'question', label: 'Question' },
                { id: 'progress', label: 'Progress' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-testid={`buddy-compose-mode-${mode.id}`}
                onClick={() => {
                  setComposeKind(mode.id);
                  if (mode.id === 'progress' && !draft.trim()) {
                    setProgressPercent(liveProgress.progressPercent);
                  }
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  composeKind === mode.id
                    ? mode.id === 'question'
                      ? 'bg-[#0284C7] text-white'
                      : mode.id === 'progress'
                        ? 'bg-[#059669] text-white'
                        : 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {composeKind === 'progress' && (
            <button
              type="button"
              data-testid="buddy-prefill-progress-btn"
              onClick={() => {
                setDraft(liveProgress.text);
                setProgressPercent(liveProgress.progressPercent);
                inputRef.current?.focus();
              }}
              className="text-[11px] font-semibold text-[#0284C7] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Use Pathwise Stats
            </button>
          )}
        </div>

        {/* Progress Percentage Picker (when Progress mode is active) */}
        {composeKind === 'progress' && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1.5 text-[11px]">
            <span className="text-emerald-950 dark:text-emerald-200 font-medium whitespace-nowrap">
              Progress:{' '}
              <strong className="font-mono tabular-nums">{progressPercent}%</strong>
            </span>
            <div className="flex items-center gap-1">
              {PROGRESS_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setProgressPercent(pct)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                    progressPercent === pct
                      ? 'bg-[#059669] text-white'
                      : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reply Context Strip */}
        {replyTarget && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="truncate">
              Replying to <strong className="text-slate-800 dark:text-slate-100">{replyTarget.senderName}</strong>:{' '}
              {replyTarget.text}
            </span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancel reply"
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Text Input + Send Button */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            maxLength={500}
            data-testid="study-buddy-chat-input"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={placeholderText}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            data-testid="study-buddy-chat-send"
            aria-label={
              composeKind === 'question'
                ? 'Post study question'
                : composeKind === 'progress'
                  ? 'Share progress update'
                  : 'Send message'
            }
            className={`px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              composeKind === 'progress'
                ? 'bg-[#059669] hover:bg-emerald-700'
                : 'bg-[#0284C7] hover:bg-[#0369A1]'
            }`}
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {composeKind === 'question'
                ? 'Ask'
                : composeKind === 'progress'
                  ? 'Share'
                  : 'Send'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
