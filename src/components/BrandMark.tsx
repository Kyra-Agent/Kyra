import { useEffect, useState } from "react";

const frames = [
  "K",
  "KY",
  "KYR",
  "KYRA",
  "KYRA-",
  "KYRA-A",
  "KYRA-AG",
  "KYRA-AGE",
  "KYRA-AGEN",
  "KYRA-AGENT",
];

export function BrandMark() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frame >= frames.length - 1) {
      return;
    }

    const timer = window.setTimeout(() => setFrame((value) => value + 1), 70);
    return () => window.clearTimeout(timer);
  }, [frame]);

  return (
    <span className="brand-mark" aria-label="KYRA-AGENT">
      <img className="brand-logo-image" src="/brand/kyra.jpg" alt="" aria-hidden="true" />
      <span className="brand-text">{frames[frame]}</span>
      <span className="brand-cursor">_</span>
    </span>
  );
}
