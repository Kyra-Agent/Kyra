// Decides whether the optional WebGL scenes may load. Anything uncertain
// returns false so the lighter 2D/SVG versions stay in place.

interface NetworkInformationLike {
  saveData?: boolean;
}

let webglSupport: boolean | null = null;

function supportsWebGL() {
  if (webglSupport !== null) {
    return webglSupport;
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }

  return webglSupport;
}

export function canRender3D() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection;

  if (connection?.saveData) {
    return false;
  }

  return supportsWebGL();
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isCoarsePointer() {
  return typeof window !== "undefined" &&
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
