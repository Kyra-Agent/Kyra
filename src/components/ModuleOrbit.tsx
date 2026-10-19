import type { CSSProperties } from "react";
import { coreModules } from "../data/modules";

interface ModuleOrbitProps {
  activeId: string | null;
  onActivate: (moduleId: string | null) => void;
}

const center = 200;
const nodeRadius = 150;
const coreRadius = 54;
export const moduleTones: Record<string, string> = {
  nira: "#7aa8ff",
  vexa: "#5fd4e8",
  astra: "#b29bff",
  nova: "#8ef0c4",
  nyx: "#f6c978",
};

function pointOnOrbit(index: number, radius: number) {
  const angle = (-90 + index * (360 / coreModules.length)) * (Math.PI / 180);
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

// Decorative module map. The module list beside it carries the same
// information for assistive technology, so the SVG is hidden from it.
export function ModuleOrbit({ activeId, onActivate }: ModuleOrbitProps) {
  return (
    <div className="module-orbit" aria-hidden="true">
      <svg viewBox="0 0 400 400" role="presentation">
        <defs>
          <radialGradient id="orbit-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7aa8ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7aa8ff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="orbit-core-clip">
            <circle cx={center} cy={center} r={coreRadius - 8} />
          </clipPath>
        </defs>

        <circle className="orbit-glow" cx={center} cy={center} r="120" fill="url(#orbit-core-glow)" />
        <circle className="orbit-ring orbit-ring-outer" cx={center} cy={center} r="182" />
        <circle className="orbit-ring orbit-ring-mid" cx={center} cy={center} r={nodeRadius} />
        <circle className="orbit-ring orbit-ring-inner" cx={center} cy={center} r="100" />

        {coreModules.map((module, index) => {
          const start = pointOnOrbit(index, coreRadius + 4);
          const end = pointOnOrbit(index, nodeRadius - 28);
          const tone = moduleTones[module.id] ?? "#7aa8ff";

          return (
            <line
              key={`beam-${module.id}`}
              className={`orbit-beam${activeId === module.id ? " is-active" : ""}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              style={{ "--tone": tone, "--beam-index": index } as CSSProperties}
            />
          );
        })}

        <g className="orbit-core">
          <circle cx={center} cy={center} r={coreRadius} className="orbit-core-ring" />
          <image
            href="/brand/kyra.jpg"
            x={center - coreRadius + 8}
            y={center - coreRadius + 8}
            width={(coreRadius - 8) * 2}
            height={(coreRadius - 8) * 2}
            clipPath="url(#orbit-core-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>

        {coreModules.map((module, index) => {
          const point = pointOnOrbit(index, nodeRadius);
          const tone = moduleTones[module.id] ?? "#7aa8ff";
          const active = activeId === module.id;

          return (
            <g
              key={module.id}
              className={`orbit-node${active ? " is-active" : ""}`}
              style={{ "--tone": tone, "--node-index": index } as CSSProperties}
              transform={`translate(${point.x} ${point.y})`}
              onPointerEnter={() => onActivate(module.id)}
              onPointerLeave={() => onActivate(null)}
            >
              <circle className="orbit-node-pulse" r="30" />
              <circle className="orbit-node-body" r="27" />
              <text className="orbit-node-code" y="-2">{module.name.split("-")[0]}</text>
              <text className="orbit-node-index" y="12">{module.name.split("-")[1]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
