import { useEffect, useRef, useState } from "react";
import { coreModules } from "../data/modules";
import { canRender3D, prefersReducedMotion } from "../three/capabilities";
import type { ModuleOrbitHandle } from "../three/moduleOrbitScene";
import { ModuleOrbit, moduleTones } from "./ModuleOrbit";

interface ModuleOrbit3DProps {
  activeId: string | null;
  onActivate: (moduleId: string | null) => void;
}

type SceneMode = "fallback" | "loading" | "ready";

// Three.js module orbit linked to the module roster. The SVG orbit renders
// until the scene is ready and stays when WebGL is unavailable.
export function ModuleOrbit3D({ activeId, onActivate }: ModuleOrbit3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ModuleOrbitHandle | null>(null);
  const onActivateRef = useRef(onActivate);
  const activeIdRef = useRef(activeId);
  const [mode, setMode] = useState<SceneMode>(() =>
    canRender3D() ? "loading" : "fallback"
  );
  const initialModeRef = useRef(mode);

  onActivateRef.current = onActivate;
  activeIdRef.current = activeId;

  useEffect(() => {
    const container = containerRef.current;

    if (initialModeRef.current !== "loading" || !container) {
      return;
    }

    let disposed = false;
    let observer: IntersectionObserver | null = null;

    const fallBack = () => {
      if (!disposed) {
        setMode("fallback");
      }
    };

    const load = () => {
      import("../three/moduleOrbitScene")
        .then(({ mountModuleOrbitScene }) => {
          if (disposed) {
            return;
          }

          handleRef.current = mountModuleOrbitScene(container, {
            modules: coreModules.map((module) => ({
              id: module.id,
              label: module.name,
              color: moduleTones[module.id] ?? "#7aa8ff",
            })),
            reducedMotion: prefersReducedMotion(),
            onHover: (moduleId) => onActivateRef.current(moduleId),
            onContextLost: () => {
              try {
                handleRef.current?.dispose();
              } catch {
                // The context is already gone.
              }
              handleRef.current = null;
              fallBack();
            },
          });
          handleRef.current.setActive(activeIdRef.current);
          setMode("ready");
        })
        .catch(fallBack);
    };

    // Load only when the section approaches the viewport.
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        load();
      }
    }, { rootMargin: "400px 0px" });
    observer.observe(container);

    return () => {
      disposed = true;
      observer?.disconnect();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setActive(activeId);
  }, [activeId]);

  return (
    <div className="module-orbit-3d-wrap">
      {mode !== "ready"
        ? <ModuleOrbit activeId={activeId} onActivate={onActivate} />
        : null}
      <div
        aria-hidden="true"
        className={`module-orbit-3d${mode === "ready" ? " is-ready" : ""}`}
        ref={containerRef}
      />
    </div>
  );
}
