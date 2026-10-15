const nodeCount = 14;

export function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="aurora-layer">
        <span className="aurora-blob aurora-blob-a" />
        <span className="aurora-blob aurora-blob-b" />
        <span className="aurora-blob aurora-blob-c" />
      </div>
      <div className="grid-layer" />
      <div className="pointer-glow-layer" />
      <div className="node-layer">
        {Array.from({ length: nodeCount }, (_, index) => <span key={index} />)}
      </div>
      <div className="grain-layer" />
      <div className="vignette-layer" />
    </div>
  );
}
