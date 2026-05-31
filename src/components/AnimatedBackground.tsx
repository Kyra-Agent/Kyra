import type { CSSProperties } from "react";

const nodeCount = 12;
const signals = ["BASE", "MCP", "NIRA", "NYX", "TX", "APPROVE", "KYRA"];

export function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="grid-layer" />
      <div className="signal-layer">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="data-stream-layer">
        {signals.map((signal, index) => (
          <span key={signal} style={{ "--stream-index": index } as CSSProperties}>
            {signal}
          </span>
        ))}
      </div>
      <div className="scanline-layer" />
      <div className="node-layer">
        {Array.from({ length: nodeCount }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
