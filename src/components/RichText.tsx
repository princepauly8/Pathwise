import React from 'react';

interface RichTextProps {
  text: string;
  className?: string;
}

function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[#0F172A] dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="font-mono text-[0.9em] bg-slate-100 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 px-1.5 py-0.5 rounded"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{token}</React.Fragment>;
  });
}

export const RichText: React.FC<RichTextProps> = ({ text, className = '' }) => {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 ${className}`}>
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
          return (
            <h4
              key={`blk-${bIdx}`}
              className="font-semibold text-[#0F172A] dark:text-slate-100 text-[15px] pt-1"
            >
              {renderInline(lines[0].replace(/^#{1,4}\s+/, ''), `h-${bIdx}`)}
            </h4>
          );
        }

        const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l));
        const isNumberList = lines.every((l) => /^\d+[.)]\s+/.test(l));

        if (isBulletList) {
          return (
            <ul key={`blk-${bIdx}`} className="space-y-1.5 pl-5 list-disc marker:text-slate-400 dark:marker:text-slate-500">
              {lines.map((line, lIdx) => (
                <li key={`li-${bIdx}-${lIdx}`}>
                  {renderInline(line.replace(/^[-*•]\s+/, ''), `ul-${bIdx}-${lIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (isNumberList) {
          return (
            <ol key={`blk-${bIdx}`} className="space-y-1.5 pl-5 list-decimal marker:text-slate-500 dark:marker:text-slate-400 marker:font-mono">
              {lines.map((line, lIdx) => (
                <li key={`ol-${bIdx}-${lIdx}`}>
                  {renderInline(line.replace(/^\d+[.)]\s+/, ''), `ol-${bIdx}-${lIdx}`)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`blk-${bIdx}`}>
            {lines.map((line, lIdx) => {
              const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
              return (
                <React.Fragment key={`p-${bIdx}-${lIdx}`}>
                  {lIdx > 0 && <br />}
                  {headingMatch ? (
                    <strong className="font-semibold text-[#0F172A] dark:text-slate-100">
                      {renderInline(headingMatch[1], `ph-${bIdx}-${lIdx}`)}
                    </strong>
                  ) : (
                    renderInline(line, `p-${bIdx}-${lIdx}`)
                  )}
                </React.Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
};
