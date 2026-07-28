import { useEffect, useRef } from "react";

interface MotionRuntimeProps {
  routeKey: string;
}

const revealSelector = [
  ".hero-copy > *",
  ".hero-shell",
  "main > .section",
  "main > section:not(.hero-section)",
  ".dashboard-main > .dashboard-topbar",
  ".dashboard-main > section",
  ".dashboard-main > .dashboard-content-grid",
  ".dashboard-content-grid > section",
  ".dashboard-auth-grid > *",
  ".public-agent-page > section",
  ".public-agent-page > div",
  ".public-agent-grid > *",
  ".site-footer",
].join(",");

export function MotionRuntime({ routeKey }: MotionRuntimeProps) {
  const progressRef = useRef<HTMLSpanElement>(null);

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

  useEffect(() => {
    const progressElement = progressRef.current;

    if (!progressElement) {
      return;
    }

    let frame = 0;

    function updateProgress() {
      frame = 0;
      const scrollRange =
        document.documentElement.scrollHeight - window.innerHeight;
      const value = scrollRange > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollRange))
        : 0;

      progressRef.current?.style.setProperty(
        "transform",
        `scaleX(${value})`,
      );
    }

    function queueProgressUpdate() {
      if (!frame) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    }

    updateProgress();
    window.addEventListener("scroll", queueProgressUpdate, { passive: true });
    window.addEventListener("resize", queueProgressUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", queueProgressUpdate);
      window.removeEventListener("resize", queueProgressUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, [routeKey]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      return;
    }

    const registered = new WeakSet<Element>();
    let revealOrder = 0;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-motion-visible");
          revealObserver.unobserve(entry.target);
        }
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      },
    );

    function registerElement(element: Element) {
      if (registered.has(element)) {
        return;
      }

      registered.add(element);
      element.classList.add("motion-reveal");
      (element as HTMLElement).style.setProperty(
        "--motion-order",
        String(revealOrder % 6),
      );
      revealOrder += 1;
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
    };
  }, [routeKey]);

  return (
    <div className="motion-runtime" aria-hidden="true">
      <span className="motion-scroll-progress" ref={progressRef} />
    </div>
  );
}
