import { useEffect, useRef } from "react";

interface ConstellationNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tone: number;
  boost: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  life: number;
}

const linkDistance = 128;
const pointerReach = 170;
const maxRipples = 4;
const darkTones = ["122, 168, 255", "142, 240, 196", "178, 155, 255"];
const lightTones = ["47, 110, 230", "15, 138, 87", "107, 79, 216"];

// Decorative network of agent nodes behind the hero. It reacts to the pointer
// and to clicks, pauses when off screen or when the tab is hidden, and draws a
// single still frame for reduced motion.
export function HeroConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const context = canvas?.getContext("2d");

    if (!canvas || !host || !context) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let width = 0;
    let height = 0;
    let nodes: ConstellationNode[] = [];
    const ripples: Ripple[] = [];
    const pointer = { x: -9999, y: -9999, active: false };
    let frame = 0;
    let visible = true;

    function seed() {
      const density = finePointer ? 16000 : 26000;
      const count = Math.max(18, Math.min(finePointer ? 72 : 34, Math.round((width * height) / density)));

      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        radius: 1 + Math.random() * 1.6,
        tone: Math.floor(Math.random() * darkTones.length),
        boost: 0,
      }));
    }

    function resize() {
      const rect = host!.getBoundingClientRect();
      // Touch layouts stack a tall hero; a lower cap keeps the canvas light.
      const ratio = Math.min(window.devicePixelRatio || 1, finePointer ? 2 : 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
      draw();
    }

    function draw() {
      const tones = document.documentElement.dataset.theme === "light" ? lightTones : darkTones;
      context!.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);

          if (distance < linkDistance) {
            const strength = (1 - distance / linkDistance) * (0.16 + Math.max(a.boost, b.boost) * 0.5);
            context!.strokeStyle = `rgba(${tones[a.tone]}, ${strength.toFixed(3)})`;
            context!.lineWidth = 1;
            context!.beginPath();
            context!.moveTo(a.x, a.y);
            context!.lineTo(b.x, b.y);
            context!.stroke();
          }
        }

        if (pointer.active) {
          const distance = Math.hypot(a.x - pointer.x, a.y - pointer.y);

          if (distance < pointerReach) {
            context!.strokeStyle = `rgba(${tones[a.tone]}, ${((1 - distance / pointerReach) * 0.42).toFixed(3)})`;
            context!.beginPath();
            context!.moveTo(a.x, a.y);
            context!.lineTo(pointer.x, pointer.y);
            context!.stroke();
          }
        }
      }

      for (const node of nodes) {
        context!.fillStyle = `rgba(${tones[node.tone]}, ${(0.45 + node.boost * 0.55).toFixed(3)})`;
        context!.beginPath();
        context!.arc(node.x, node.y, node.radius + node.boost * 1.8, 0, Math.PI * 2);
        context!.fill();
      }

      for (const ripple of ripples) {
        context!.strokeStyle = `rgba(${tones[0]}, ${(ripple.life * 0.5).toFixed(3)})`;
        context!.lineWidth = 1.5;
        context!.beginPath();
        context!.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        context!.stroke();
      }
    }

    function step() {
      frame = 0;

      for (const node of nodes) {
        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;

          // Nodes lean gently away from the pointer, like a field.
          if (distance < pointerReach) {
            const push = (1 - distance / pointerReach) * 0.05;
            node.vx += (dx / distance) * push;
            node.vy += (dy / distance) * push;
          }
        }

        for (const ripple of ripples) {
          const distance = Math.hypot(node.x - ripple.x, node.y - ripple.y);

          if (Math.abs(distance - ripple.radius) < 14) {
            node.boost = 1;
          }
        }

        node.vx *= 0.985;
        node.vy *= 0.985;
        node.vx += (Math.random() - 0.5) * 0.012;
        node.vy += (Math.random() - 0.5) * 0.012;
        node.x += node.vx;
        node.y += node.vy;
        node.boost *= 0.94;

        if (node.x < -10) node.x = width + 10;
        if (node.x > width + 10) node.x = -10;
        if (node.y < -10) node.y = height + 10;
        if (node.y > height + 10) node.y = -10;
      }

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        ripples[index].radius += 4.2;
        ripples[index].life -= 0.016;

        if (ripples[index].life <= 0) {
          ripples.splice(index, 1);
        }
      }

      draw();
      schedule();
    }

    function schedule() {
      if (!reducedMotion && visible && !document.hidden && !frame) {
        frame = window.requestAnimationFrame(step);
      }
    }

    function localPoint(event: PointerEvent) {
      const rect = host!.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function handlePointerMove(event: PointerEvent) {
      const point = localPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.active = true;
    }

    function handlePointerLeave() {
      pointer.active = false;
    }

    function handlePointerDown(event: PointerEvent) {
      const point = localPoint(event);

      if (ripples.length >= maxRipples) {
        ripples.shift();
      }

      ripples.push({ ...point, radius: 4, life: 1 });
    }

    function handleVisibility() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);

      if (visible) {
        schedule();
      } else {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibilityObserver.observe(host);

    if (!reducedMotion) {
      if (finePointer) {
        host.addEventListener("pointermove", handlePointerMove, { passive: true });
        host.addEventListener("pointerleave", handlePointerLeave);
      }
      host.addEventListener("pointerdown", handlePointerDown, { passive: true });
      document.addEventListener("visibilitychange", handleVisibility);
    }

    resize();
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
      host.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <canvas aria-hidden="true" className="hero-constellation" ref={canvasRef} />;
}
