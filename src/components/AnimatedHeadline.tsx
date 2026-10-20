import { Fragment, type CSSProperties } from "react";

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
          <Fragment key={`lead-${index}`}>
            {index > 0 ? " " : null}
            <span
              className="hero-word"
              style={{ "--word-index": index } as CSSProperties}
            >
              {word}
            </span>
          </Fragment>
        ))}
      </span>
      <span className="hero-title-line hero-title-accent" aria-hidden="true">
        {accentWords.map((word, index) => (
          <Fragment key={`accent-${index}`}>
            {index > 0 ? " " : null}
            <span
              className="hero-word"
              style={{ "--word-index": leadWords.length + index } as CSSProperties}
            >
              {word}
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}
