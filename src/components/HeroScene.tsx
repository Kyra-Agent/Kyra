import { useEffect, useRef, useState } from "react";
import { HeroConstellation } from "./HeroConstellation";
import {
  canRender3D,
  isCoarsePointer,
  prefersReducedMotion,
} from "../three/capabilities";
import type { HeroSceneHandle } from "../three/heroScene";

type SceneMode = "fallback" | "loading" | "ready";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

// Three.js hero backdrop. The 2D constellation shows first (and stays when
// WebGL is unavailable, data saving is on, or the GPU context is lost); the
// 3D scene loads after the page is idle so it never delays first paint.
export function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<SceneMode>(() =>
    canRender3D() ? "loading" : "fallback"
  );
  const initialModeRef = useRef(mode);

  useEffect(() => {
    const container = containerRef.current;
    const hero = container?.parentElement;

    if (initialModeRef.current !== "loading" || !container || !hero) {
      return;
    }

    const idleWindow = window as IdleWindow;
    let disposed = false;
    let handle: HeroSceneHandle | null = null;

    const fallBack = () => {
      if (!disposed) {
        setMode("fallback");
      }
    };

    const start = () => {
      import("../three/heroScene")
        .then(({ mountHeroScene }) => {
          if (disposed) {
            return;
          }

          handle = mountHeroScene(container, {
            interactionTarget: hero,
            reducedMotion: prefersReducedMotion(),
            coarsePointer: isCoarsePointer(),
            onContextLost: () => {
              try {
                handle?.dispose();
              } catch {
                // The context is already gone; nothing else to release.
              }
              handle = null;
              fallBack();
            },
          });
          setMode("ready");
        })
        .catch(fallBack);
    };

    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 350);

    return () => {
      disposed = true;

      if (idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }

      handle?.dispose();
      handle = null;
    };
  }, []);

  return (
    <>
      {mode !== "ready" ? <HeroConstellation /> : null}
      <div
        aria-hidden="true"
        className={`hero-scene${mode === "ready" ? " is-ready" : ""}`}
        ref={containerRef}
      />
    </>
  );
}
