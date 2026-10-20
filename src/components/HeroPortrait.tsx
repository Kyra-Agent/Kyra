import { useEffect, useRef, useState } from "react";
import {
  canRender3D,
  isCoarsePointer,
  prefersReducedMotion,
} from "../three/capabilities";
import type { PortraitSceneHandle } from "../three/portraitScene";

type PortraitMode = "fallback" | "loading" | "ready";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const portraitUrl = "/brand/kyra.jpg";

// Kyra's portrait as an interactive halftone dot field. A static duotone print
// shows first and stays when WebGL is unavailable, data saving is on, or the
// GPU context is lost.
export function HeroPortrait() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PortraitMode>(() =>
    canRender3D() ? "loading" : "fallback"
  );
  const initialModeRef = useRef(mode);

  useEffect(() => {
    const container = containerRef.current;
    const figure = container?.parentElement;

    if (initialModeRef.current !== "loading" || !container || !figure) {
      return;
    }

    const idleWindow = window as IdleWindow;
    let disposed = false;
    let handle: PortraitSceneHandle | null = null;

    const fallBack = () => {
      if (!disposed) {
        setMode("fallback");
      }
    };

    const start = () => {
      import("../three/portraitScene")
        .then(({ mountPortraitScene }) =>
          mountPortraitScene(container, {
            imageUrl: portraitUrl,
            scrollTarget: figure,
            reducedMotion: prefersReducedMotion(),
            coarsePointer: isCoarsePointer(),
            onContextLost: () => {
              try {
                handle?.dispose();
              } catch {
                // The context is already gone.
              }
              handle = null;
              fallBack();
            },
          })
        )
        .then((mounted) => {
          if (disposed) {
            mounted.dispose();
            return;
          }

          handle = mounted;
          setMode("ready");
        })
        .catch(fallBack);
    };

    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(start, { timeout: 1200 })
      : window.setTimeout(start, 250);

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
    <figure className={`hero-portrait is-${mode}`}>
      <img
        alt=""
        aria-hidden="true"
        className="hero-portrait-print"
        fetchPriority="high"
        src={portraitUrl}
      />
      <div className="hero-portrait-stage" ref={containerRef} />
      <figcaption className="hero-portrait-caption">
        <span className="hero-portrait-dot" aria-hidden="true" />
        Kyra · your wallet decides
      </figcaption>
    </figure>
  );
}
