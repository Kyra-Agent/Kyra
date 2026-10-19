import { useEffect, useRef } from "react";
import { coreModules } from "../data/modules";

interface ModuleSignalProps {
  activeId: string | null;
  onActivate: (moduleId: string | null) => void;
}

const moduleColors: Record<string, string> = {
  nira: "#7aa8ff",
  vexa: "#5fd4e8",
  astra: "#b29bff",
  nova: "#8ef0c4",
  nyx: "#f6c978",
};

// Deeper tones keep the meters legible on the light theme background.
const lightModuleColors: Record<string, string> = {
  nira: "#2f6ee6",
  vexa: "#0e8fb0",
  astra: "#6b4fd8",
  nova: "#0f8a57",
  nyx: "#9a6114",
};

const baseLevels: Record<string, number> = {
  online: 0.72,
  guard: 0.6,
  standby: 0.38,
};

const dotColumns = 4;
const dotRows = 16;

// Halftone dot-matrix meters, one per Kyra module, in the same print language
// as the hero portrait. Hovering a column highlights its module row and the
// roster drives the columns back. Decorative: the roster carries the content.
export function ModuleSignal({ activeId, onActivate }: ModuleSignalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeIdRef = useRef(activeId);
  const onActivateRef = useRef(onActivate);
  const redrawRef = useRef<() => void>(() => undefined);

  activeIdRef.current = activeId;
  onActivateRef.current = onActivate;

  useEffect(() => {
    redrawRef.current();
  }, [activeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const levels = coreModules.map((module) => baseLevels[module.status] ?? 0.5);
    let width = 1;
    let height = 1;
    let frame = 0;
    let visible = true;
    let hovered: string | null = null;
    const startedAt = performance.now();

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now());
    }

    function draw(now: number) {
      const time = (now - startedAt) / 1000;
      const active = activeIdRef.current;
      const light = document.documentElement.dataset.theme === "light";
      const palette = light ? lightModuleColors : moduleColors;
      const columnWidth = width / coreModules.length;
      const pitch = Math.min((columnWidth * 0.72) / dotColumns, (height * 0.86) / dotRows);
      const meterHeight = pitch * dotRows;
      const top = (height - meterHeight) / 2;

      context!.clearRect(0, 0, width, height);

      coreModules.forEach((module, index) => {
        const color = palette[module.id] ?? "#7aa8ff";
        const isActive = module.id === active;
        const dimmed = active !== null && !isActive;
        const wobble = reducedMotion
          ? 0
          : Math.sin(time * (1.1 + index * 0.37) + index * 1.7) * 0.12 +
            Math.sin(time * (2.3 + index * 0.21)) * 0.05;
        const target = isActive ? 1 : Math.min(0.95, Math.max(0.12, (baseLevels[module.status] ?? 0.5) + wobble));
        levels[index] += (target - levels[index]) * (reducedMotion ? 1 : 0.12);
        const litRows = levels[index] * dotRows;
        const left = index * columnWidth + (columnWidth - pitch * dotColumns) / 2;

        for (let row = 0; row < dotRows; row += 1) {
          const fromBottom = dotRows - row;
          const lit = fromBottom <= litRows;
          const edge = Math.abs(fromBottom - litRows) < 1;

          for (let column = 0; column < dotColumns; column += 1) {
            const x = left + column * pitch + pitch / 2;
            const y = top + row * pitch + pitch / 2;
            const radius = pitch * (lit ? (edge ? 0.42 : 0.34) : 0.16);

            context!.globalAlpha = lit
              ? (dimmed ? 0.3 : 0.55 + (fromBottom / dotRows) * 0.45)
              : (dimmed ? 0.08 : 0.16);
            context!.fillStyle = lit ? color : light ? "#7b889a" : "#93a3b9";
            context!.beginPath();
            context!.arc(x, y, radius, 0, Math.PI * 2);
            context!.fill();
          }
        }

      });

      context!.globalAlpha = 1;
    }

    function loop(now: number) {
      frame = 0;
      draw(now);
      schedule();
    }

    function schedule() {
      if (!reducedMotion && visible && !document.hidden && !frame) {
        frame = window.requestAnimationFrame(loop);
      }
    }

    function moduleAt(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const index = Math.floor(((event.clientX - rect.left) / Math.max(rect.width, 1)) * coreModules.length);
      return coreModules[Math.min(coreModules.length - 1, Math.max(0, index))]?.id ?? null;
    }

    function handlePointerMove(event: PointerEvent) {
      const next = moduleAt(event);

      if (next !== hovered) {
        hovered = next;
        onActivateRef.current(next);
      }
    }

    function handlePointerLeave() {
      if (hovered !== null) {
        hovered = null;
        onActivateRef.current(null);
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    }

    redrawRef.current = () => {
      if (reducedMotion) {
        draw(performance.now());
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);

      if (visible) {
        schedule();
      } else {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibilityObserver.observe(canvas);

    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    resize();
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      redrawRef.current = () => undefined;
    };
  }, []);

  return (
    <div className="module-signal" aria-hidden="true">
      <canvas className="module-signal-canvas" ref={canvasRef} />
      <div className="module-signal-labels">
        {coreModules.map((module) => (
          <span
            className={activeId === module.id ? "is-active" : activeId ? "is-dimmed" : undefined}
            key={module.id}
            style={{ color: moduleColors[module.id] }}
          >
            {module.name}
          </span>
        ))}
      </div>
    </div>
  );
}
