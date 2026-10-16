import { Fragment, type CSSProperties } from "react";

interface RevealHeadingProps {
  text: string;
  as?: "h2" | "h3";
  className?: string;
  id?: string;
}

// Section heading whose words rise in sequence once MotionRuntime reveals it.
// Without motion (reduced motion, above the fold, no observer) the words are
// simply visible. The accessible name stays the full sentence.
export function RevealHeading({
  text,
  as: Tag = "h2",
  className,
  id,
}: RevealHeadingProps) {
  const words = text.split(/\s+/u).filter(Boolean);

  return (
    <Tag
      id={id}
      className={["reveal-heading", className].filter(Boolean).join(" ")}
      aria-label={text}
    >
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          <span
            aria-hidden="true"
            className="reveal-word"
            style={{ "--word-index": index } as CSSProperties}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
