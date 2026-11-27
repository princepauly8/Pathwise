import React from 'react';
import type { SubjectDomain, VisualDiagram } from '../types/study';

interface CurriculumBlueprintProps {
  classLevel: string;
  syllabus?: string;
  selectedSubjects: string[];
  dailyMinutes: number;
}

export const CurriculumBlueprint: React.FC<CurriculumBlueprintProps> = ({
  classLevel,
  syllabus = 'CBSE',
  selectedSubjects,
  dailyMinutes,
}) => {
  const previewSubjects =
    selectedSubjects.length > 0
      ? selectedSubjects.slice(0, 4)
      : ['Mathematics', 'Physics', 'World History'];

  return (
    <div className="relative w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-7 space-y-6 overflow-hidden">
      {/* Subtle geometric coordinate grid */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.4] dark:opacity-[0.25]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="pathwise-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--pw-border)" strokeWidth="0.75" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pathwise-grid)" />
      </svg>

      {/* Top Editorial Caption */}
      <div className="relative z-10 space-y-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Live Curriculum Preview <span aria-hidden="true">·</span> {classLevel}{' '}
          <span aria-hidden="true">·</span> {syllabus}
        </p>
        <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
          Every subject sequenced to your exact board & grade
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Pathwise organizes each subject into four progressive stages—Foundations, Core Mechanics,
          Applied Practice, and Synthesis—paired with notes, shortcuts, PYQs, and a weekly timetable.
        </p>
      </div>

      {/* Interactive Architectural Path Diagram */}
      <div className="relative z-10 py-2">
        <svg
          viewBox="-14 0 492 216"
          className="w-full h-auto"
          role="img"
          aria-label={`Curriculum progression diagram for ${classLevel} ${syllabus}`}
        >
          <path
            d="M 48 168 C 118 168, 128 118, 188 118 C 248 118, 258 72, 322 72 C 370 72, 394 46, 430 46"
            fill="none"
            stroke="var(--pw-border-strong)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M 48 168 C 118 168, 128 118, 188 118 C 248 118, 258 72, 322 72"
            fill="none"
            stroke="var(--pw-accent)"
            strokeWidth="2.5"
          />

          <g transform="translate(48, 168)">
            <circle r="11" fill="var(--pw-success)" />
            <path
              d="M -4 0 L -1 3 L 5 -3"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x="0"
              y="29"
              textAnchor="middle"
              fill="var(--pw-text)"
              fontSize="11"
              fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              01. Foundations
            </text>
          </g>

          <g transform="translate(188, 118)">
            <circle r="13" fill="var(--pw-surface)" stroke="var(--pw-accent)" strokeWidth="3" />
            <circle r="5" fill="var(--pw-accent)" />
            <text
              x="0"
              y="31"
              textAnchor="middle"
              fill="var(--pw-text)"
              fontSize="11"
              fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              02. Core Mechanics
            </text>
          </g>

          <g transform="translate(322, 72)">
            <circle r="11" fill="var(--pw-surface)" stroke="var(--pw-accent)" strokeWidth="2" />
            <text
              x="0"
              y="29"
              textAnchor="middle"
              fill="var(--pw-text-secondary)"
              fontSize="11"
              fontWeight="500"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              03. Applied Practice
            </text>
          </g>

          <g transform="translate(430, 46)">
            <circle r="11" fill="var(--pw-bg)" stroke="var(--pw-text-muted)" strokeWidth="2" />
            <text
              x="-6"
              y="-20"
              textAnchor="end"
              fill="var(--pw-text-muted)"
              fontSize="11"
              fontWeight="500"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              04. Mastery
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Subject Queue Preview */}
      <div className="relative z-10 border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Active track preview</span>
          <span className="font-mono tabular-nums">
            {dailyMinutes} min/day · {selectedSubjects.length || 3} subjects
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {previewSubjects.map((subject, idx) => (
            <div
              key={subject}
              className="flex items-baseline justify-between gap-3 border border-slate-200/90 dark:border-slate-800 bg-[#F8FAFC]/80 dark:bg-slate-800/60 rounded-lg px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0F172A] dark:text-slate-100 truncate">{subject}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{syllabus} track</p>
              </div>
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                0{idx + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Included in Every Track */}
      <div className="relative z-10 border-t border-slate-200 dark:border-slate-800 pt-5 space-y-2.5">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Built-in companion toolkit</p>
        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li className="flex items-baseline gap-2">
            <span className="font-mono text-[#0284C7] dark:text-sky-400 tabular-nums">01.</span>
            <span>Full notes, short notes, study shortcuts, visual diagrams & PDF Maker</span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="font-mono text-[#0284C7] dark:text-sky-400 tabular-nums">02.</span>
            <span>Quizzes, example questions, aptitude drills & Previous Year Papers</span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="font-mono text-[#0284C7] dark:text-sky-400 tabular-nums">03.</span>
            <span>Study timetable, revision flashcards, 10-min motivation classes & Buddy (AI Tutor)</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export const ConceptVisualDiagram: React.FC<{ diagram: VisualDiagram }> = ({ diagram }) => {
  const nodes = diagram.nodes.slice(0, 4);
  const positions = [
    { x: 165, y: 72 },
    { x: 555, y: 72 },
    { x: 165, y: 312 },
    { x: 555, y: 312 },
  ];

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">Photo & Visual Concept Representation</p>
        <h3 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">{diagram.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{diagram.caption}</p>
      </div>

      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950 p-4 overflow-x-auto">
        <svg
          viewBox="0 0 720 384"
          className="w-full min-w-[560px] h-auto"
          role="img"
          aria-label={`Visual concept map for ${diagram.title}`}
        >
          <defs>
            <pattern id="diagram-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="var(--pw-border-strong)" />
            </pattern>
          </defs>
          <rect width="720" height="384" rx="10" fill="url(#diagram-dots)" opacity="0.55" />

          {/* Connector lines from center to each node */}
          {nodes.map((_, idx) => {
            const pos = positions[idx];
            if (!pos) return null;
            return (
              <line
                key={`line-${idx}`}
                x1="360"
                y1="192"
                x2={pos.x}
                y2={pos.y}
                stroke="var(--pw-accent)"
                strokeOpacity="0.5"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            );
          })}

          {/* Outer conceptual nodes */}
          {nodes.map((node, idx) => {
            const pos = positions[idx];
            if (!pos) return null;
            const rectW = 248;
            const rectH = 92;
            const rx = pos.x - rectW / 2;
            const ry = pos.y - rectH / 2;

            return (
              <g key={`node-${idx}`}>
                <rect
                  x={rx}
                  y={ry}
                  width={rectW}
                  height={rectH}
                  rx="10"
                  fill="var(--pw-surface)"
                  stroke="var(--pw-border-strong)"
                  strokeWidth="1.5"
                />
                <text
                  x={rx + 14}
                  y={ry + 24}
                  fill="var(--pw-accent)"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  0{idx + 1}. {node.label.slice(0, 26)}
                </text>
                <text
                  x={rx + 14}
                  y={ry + 48}
                  fill="var(--pw-text-secondary)"
                  fontSize="12"
                  fontWeight="500"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {node.detail.slice(0, 34)}
                </text>
                {node.formula && (
                  <text
                    x={rx + 14}
                    y={ry + 73}
                    fill="var(--pw-text)"
                    fontSize="11.5"
                    fontWeight="600"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {node.formula.slice(0, 30)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Central anchor hub */}
          <rect
            x="240"
            y="154"
            width="240"
            height="76"
            rx="14"
            fill="#0F172A"
            stroke="var(--pw-accent)"
            strokeWidth="2.5"
          />
          <text
            x="360"
            y="183"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="10"
            fontWeight="600"
            letterSpacing="1.2"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            CORE PRINCIPLE
          </text>
          <text
            x="360"
            y="208"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="14"
            fontWeight="600"
            fontFamily="IBM Plex Mono, monospace"
          >
            {diagram.centralConcept.slice(0, 24)}
          </text>
        </svg>
      </div>
    </div>
  );
};

export const SubjectMotifBanner: React.FC<{ domain: SubjectDomain }> = ({ domain }) => {
  if (domain === 'stem') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 320 96"
        className="w-48 sm:w-64 h-auto text-[#0284C7]/25 dark:text-sky-400/25 shrink-0"
      >
        <line x1="12" y1="76" x2="308" y2="76" stroke="currentColor" strokeWidth="1.2" />
        <line x1="36" y1="12" x2="36" y2="86" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M 36 68 Q 92 14, 152 48 T 296 22"
          fill="none"
          stroke="var(--pw-accent)"
          strokeOpacity="0.55"
          strokeWidth="2"
        />
        <circle cx="152" cy="48" r="4" fill="var(--pw-accent)" fillOpacity="0.7" />
        <circle cx="240" cy="36" r="3.5" fill="var(--pw-success)" fillOpacity="0.7" />
        <line x1="152" y1="48" x2="152" y2="76" stroke="currentColor" strokeDasharray="3 3" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 96"
      className="w-48 sm:w-64 h-auto text-slate-400/35 dark:text-slate-500/40 shrink-0"
    >
      <path
        d="M 32 82 L 32 42 A 34 34 0 0 1 100 42 L 100 82"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M 116 82 L 116 34 A 42 42 0 0 1 200 34 L 200 82"
        fill="none"
        stroke="var(--pw-accent)"
        strokeOpacity="0.5"
        strokeWidth="1.8"
      />
      <path
        d="M 216 82 L 216 48 A 28 28 0 0 1 272 48 L 272 82"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="18" y1="82" x2="296" y2="82" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
};
