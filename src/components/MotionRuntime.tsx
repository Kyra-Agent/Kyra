import { useEffect, useRef } from "react";

interface MotionRuntimeProps {
  routeKey: string;
}

// Reveal small, meaningful units instead of whole sections. Large blocks are
// shown immediately so long panels never leave an empty viewport while
// scrolling.
const revealSelector = [
  ".section-heading > *",
  ".stat-card",
  ".story-step",
  ".module-signal",
  ".sim-phone",
  ".sim-trace",
  ".gate-demo",
  ".security-copy > *",
  ".dashboard-header > *",
  ".template-card",
  ".action-card",
  ".module-row",
  ".security-grid > article",
  ".guarantee-marquee",
  ".faq-item",
  ".dashboard-grid > *",
  ".deploy-howto > article",
  ".wizard-panel",
  ".site-footer",
  ".dashboard-main > .dashboard-topbar",
  ".dashboard-kpi-grid > article",
  ".dashboard-content-grid > section",
  ".dashboard-auth-grid > *",
  ".public-agent-page > section",
  ".public-agent-grid > *",
].join(",");

// Surfaces that receive the pointer-tracking spotlight.
const spotlightSelector = [
  ".template-card",
  ".action-card",
  ".security-grid article",
  ".agent-card",
  ".approval-card",
  ".logs-card",
  ".deploy-howto article",
  ".dashboard-kpi-grid article",
  ".public-panel",
  ".hero-shell",
  ".official-token-card",
].join(",");

// Cards that lean toward the pointer. Kept to roomy grid cards so dense
// panels and forms never move under the cursor.
const tiltSelector = [
  ".template-card",
  ".action-card",
  ".security-grid article",
  ".story-stage-frame",
].join(",");

const maxTiltDegrees = 5;
const maxMagnetOffset = 6;
const maxStaggerSteps = 6;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MotionRuntime({ routeKey }: MotionRuntimeProps) {
  const progressRef = useRef<HTMLSpanElement>(null);

  // Route entrance.
  useEffect(() => {
    let frame = window.requestAnimationFrame(() => {
      const routeRoot = document.querySelector(
        ".dashboard-page, .public-agent-page, main",
      );

      if (!routeRoot) {
        return;
      }

      routeRoot.classList.remove("motion-route-enter");
      frame = window.requestAnimationFrame(() => {
        routeRoot.classList.add("motion-route-enter");
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [routeKey]);

  // Scroll progress and condensed header state.
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    function update() {
      frame = 0;
      const scrollRange = root.scrollHeight - window.innerHeight;
      const value = scrollRange > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollRange))
        : 0;

      progressRef.current?.style.setProperty("transform", `scaleX(${value})`);
      root.toggleAttribute("data-scrolled", window.scrollY > 12);
    }

    function queueUpdate() {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, [routeKey]);

  // Pointer glow and card spotlight. Pointer-only so touch scrolling never
  // pays for it.
  useEffect(() => {
    if (
      prefersReducedMotion() ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }

    const root = document.documentElement;
    const glow = document.querySelector<HTMLElement>(".pointer-glow-layer");
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let activeSurface: HTMLElement | null = null;
    let activeTilt: HTMLElement | null = null;
    let activeMagnet: HTMLElement | null = null;
    let pendingTarget: EventTarget | null = null;

    function releaseTilt() {
      activeTilt?.removeAttribute("data-tilt");
      activeTilt?.style.removeProperty("--tilt-x");
      activeTilt?.style.removeProperty("--tilt-y");
      activeTilt = null;
    }

    function releaseMagnet() {
      activeMagnet?.style.removeProperty("--magnet-x");
      activeMagnet?.style.removeProperty("--magnet-y");
      activeMagnet = null;
    }

    function apply() {
      frame = 0;
      // Move the glow directly; updating inherited custom properties on the
      // root would restyle the whole document on every pointer frame.
      glow?.style.setProperty(
        "transform",
        `translate3d(${pointerX}px, ${pointerY}px, 0)`,
      );

      const surface = pendingTarget instanceof Element
        ? pendingTarget.closest<HTMLElement>(spotlightSelector)
        : null;

      if (activeSurface && activeSurface !== surface) {
        activeSurface.removeAttribute("data-spotlight");
      }

      activeSurface = surface;

      if (surface) {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty("--spot-x", `${pointerX - rect.left}px`);
        surface.style.setProperty("--spot-y", `${pointerY - rect.top}px`);
        surface.setAttribute("data-spotlight", "");
      }

      const target = pendingTarget instanceof Element ? pendingTarget : null;
      const tilt = target?.closest<HTMLElement>(tiltSelector) ?? null;

      if (activeTilt && activeTilt !== tilt) {
        releaseTilt();
      }

      if (tilt) {
        const rect = tilt.getBoundingClientRect();
        const relX = (pointerX - rect.left) / Math.max(rect.width, 1);
        const relY = (pointerY - rect.top) / Math.max(rect.height, 1);
        tilt.style.setProperty(
          "--tilt-x",
          `${((0.5 - relY) * 2 * maxTiltDegrees).toFixed(2)}deg`,
        );
        tilt.style.setProperty(
          "--tilt-y",
          `${((relX - 0.5) * 2 * maxTiltDegrees).toFixed(2)}deg`,
        );
        tilt.setAttribute("data-tilt", "");
        activeTilt = tilt;
      }

      const magnet = target?.closest<HTMLElement>("[data-magnetic]") ?? null;

      if (activeMagnet && activeMagnet !== magnet) {
        releaseMagnet();
      }

      if (magnet) {
        const rect = magnet.getBoundingClientRect();
        const offsetX = pointerX - (rect.left + rect.width / 2);
        const offsetY = pointerY - (rect.top + rect.height / 2);
        const clamp = (value: number) =>
          Math.max(-maxMagnetOffset, Math.min(maxMagnetOffset, value * 0.2));
        magnet.style.setProperty("--magnet-x", `${clamp(offsetX).toFixed(1)}px`);
        magnet.style.setProperty("--magnet-y", `${clamp(offsetY).toFixed(1)}px`);
        activeMagnet = magnet;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        return;
      }

      pointerX = event.clientX;
      pointerY = event.clientY;
      pendingTarget = event.target;

      if (!frame) {
        frame = window.requestAnimationFrame(apply);
      }
    }

    function handlePointerLeave() {
      activeSurface?.removeAttribute("data-spotlight");
      activeSurface = null;
      releaseTilt();
      releaseMagnet();
    }

    root.setAttribute("data-pointer", "fine");
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      root.removeAttribute("data-pointer");
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      window.cancelAnimationFrame(frame);
      activeSurface?.removeAttribute("data-spotlight");
      releaseTilt();
      releaseMagnet();
    };
  }, []);

  // Staggered reveal for content units.
  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      return;
    }

    const registered = new WeakSet<Element>();
    const batchOrder = new WeakMap<Element, number>();
    let pendingBatch = 0;
    let batchFrame = 0;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const element = entry.target as HTMLElement;
          const order = Math.min(pendingBatch, maxStaggerSteps - 1);
          pendingBatch += 1;
          batchOrder.set(element, order);
          element.style.setProperty("--motion-order", String(order));
          element.classList.add("is-motion-visible");
          revealObserver.unobserve(element);
        }

        if (!batchFrame) {
          batchFrame = window.requestAnimationFrame(() => {
            batchFrame = 0;
            pendingBatch = 0;
          });
        }
      },
      {
        rootMargin: "0px 0px -4% 0px",
        threshold: 0,
      },
    );

    function registerElement(element: Element) {
      if (registered.has(element)) {
        return;
      }

      registered.add(element);
      const rect = element.getBoundingClientRect();

      // Tall blocks and anything already above the fold render immediately.
      if (rect.height > window.innerHeight * 0.85 || rect.bottom < 0) {
        return;
      }

      element.classList.add("motion-reveal");
      revealObserver.observe(element);
    }

    function registerWithin(root: ParentNode) {
      if (root instanceof Element && root.matches(revealSelector)) {
        registerElement(root);
      }

      root.querySelectorAll(revealSelector).forEach(registerElement);
    }

    registerWithin(document);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            registerWithin(node);
          }
        });
      }
    });

    mutationObserver.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      revealObserver.disconnect();
      window.cancelAnimationFrame(batchFrame);
      document.querySelectorAll(".motion-reveal").forEach((element) => {
        if (!batchOrder.has(element)) {
          element.classList.add("is-motion-visible");
        }
      });
    };
  }, [routeKey]);

  return (
    <div className="motion-runtime" aria-hidden="true">
      <span className="motion-scroll-progress" ref={progressRef} />
    </div>
  );
}
