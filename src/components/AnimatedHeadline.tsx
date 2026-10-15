import type { CSSProperties } from "react";

interface AnimatedHeadlineProps {
  lead: string;
  accent: string;
}

function splitWords(value: string) {
  return value.split(/\s+/u).filter(Boolean);
}

export function AnimatedHeadline({ lead, accent }: AnimatedHeadlineProps) {
  const leadWords = splitWords(lead);
  const accentWords = splitWords(accent);

  return (
    <h1 className="hero-title" aria-label={`${lead} ${accent}`}>
      <span className="hero-title-line" aria-hidden="true">
        {leadWords.map((word, index) => (
          <span
            className="hero-word"
            key={`lead-${index}`}
            style={{ "--word-index": index } as CSSProperties}
          >
            {word}
          </span>
        ))}
      </span>
      <span className="hero-title-line hero-title-accent" aria-hidden="true">
        {accentWords.map((word, index) => (
          <span
            className="hero-word"
            key={`accent-${index}`}
            style={{ "--word-index": leadWords.length + index } as CSSProperties}
          >
            {word}
          </span>
        ))}
      </span>
    </h1>
  );
}
