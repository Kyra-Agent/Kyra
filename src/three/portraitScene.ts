import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

export interface PortraitSceneOptions {
  imageUrl: string;
  /** Element whose exit from the top of the viewport drives the dispersal. */
  scrollTarget: HTMLElement;
  reducedMotion: boolean;
  coarsePointer: boolean;
  onContextLost: () => void;
}

export interface PortraitSceneHandle {
  dispose: () => void;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDotScale;
  uniform vec2 uPointer;
  uniform float uLens;
  uniform float uScan;
  uniform float uScroll;
  uniform vec2 uRippleOrigin;
  uniform float uRippleAge;
  uniform float uHeight;
  attribute float aLum;
  attribute vec3 aSpread;
  varying float vLum;
  varying float vHighlight;
  varying float vY;
  varying float vFade;

  void main() {
    vec3 p = position;

    // Pointer lens: dots near the cursor swell forward like a loupe.
    float lens = smoothstep(0.5, 0.0, distance(p.xy, uPointer)) * uLens;
    p.z += lens * 0.55;

    // Slow scan line sweeping down the portrait.
    float scanY = mix(uHeight * 0.55, -uHeight * 0.55, uScan);
    float scan = smoothstep(0.16, 0.0, abs(p.y - scanY));

    // Click ripple across the surface.
    float rippleDistance = distance(p.xy, uRippleOrigin);
    float front = uRippleAge * 3.4;
    float ripple = uRippleAge > 0.0 && uRippleAge < 1.0
      ? smoothstep(0.28, 0.0, abs(rippleDistance - front)) * (1.0 - uRippleAge)
      : 0.0;
    p.z += ripple * 0.45 + sin(uTime * 0.9 + p.y * 2.4) * 0.015;

    // Scrolling away disperses the dots into depth.
    float disperse = uScroll * uScroll;
    p += aSpread * disperse * 5.0;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    float size = (0.22 + aLum * 0.95) * (1.0 + lens * 1.1 + scan * 0.35 + ripple * 0.8);
    gl_PointSize = size * uDotScale * uPixelRatio * (6.0 / -viewPosition.z);

    vLum = aLum;
    vHighlight = clamp(lens + scan * 0.8 + ripple, 0.0, 1.0);
    vY = position.y / uHeight;
    vFade = 1.0 - disperse * 0.85;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccentA;
  uniform vec3 uAccentB;
  varying float vLum;
  varying float vHighlight;
  varying float vY;
  varying float vFade;

  void main() {
    // Crisp printed dot with a one-pixel soft edge.
    float d = length(gl_PointCoord - 0.5);
    float alpha = 1.0 - smoothstep(0.42, 0.5, d);
    if (alpha < 0.01) discard;

    vec3 accent = mix(uAccentA, uAccentB, clamp(vY + 0.5, 0.0, 1.0));
    vec3 color = mix(uInk, accent, vHighlight);
    gl_FragColor = vec4(color, alpha * (0.55 + vLum * 0.45) * vFade);
  }
`;

interface SampledPortrait {
  geometry: BufferGeometry;
  width: number;
  height: number;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Portrait image failed to load."));
    image.src = url;
  });
}

// Turns the photo into halftone dots: brightness sets dot size and depth, and
// a soft vignette drops the textured studio backdrop so the face reads clean.
function samplePortrait(image: HTMLImageElement, columns: number): SampledPortrait {
  const rows = Math.round(columns * (image.naturalHeight / image.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("2D canvas is unavailable.");
  }

  context.drawImage(image, 0, 0, columns, rows);
  const pixels = context.getImageData(0, 0, columns, rows).data;
  const width = 3;
  const height = width * (rows / columns);
  const positions: number[] = [];
  const luminance: number[] = [];
  const spread: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = (row * columns + column) * 4;
      const raw = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
      const u = column / (columns - 1);
      const v = row / (rows - 1);
      // Face sits centre-right in the source photo.
      const dx = (u - 0.6) / 0.62;
      const dy = (v - 0.42) / 0.78;
      const vignette = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const lum = Math.pow(raw, 1.25) * Math.min(1, vignette * 1.6);

      if (lum < 0.05) {
        continue;
      }

      positions.push((u - 0.5) * width, (0.5 - v) * height, lum * 0.42);
      luminance.push(lum);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      spread.push(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.abs(Math.cos(phi)) + 0.4,
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aLum", new BufferAttribute(new Float32Array(luminance), 1));
  geometry.setAttribute("aSpread", new BufferAttribute(new Float32Array(spread), 3));
  return { geometry, width, height };
}

export async function mountPortraitScene(
  container: HTMLElement,
  options: PortraitSceneOptions,
): Promise<PortraitSceneHandle> {
  const image = await loadImage(options.imageUrl);
  const portrait = samplePortrait(image, options.coarsePointer ? 84 : 132);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "hero-portrait-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 8);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uDotScale: { value: 1 },
      uPointer: { value: new Vector2(99, 99) },
      uLens: { value: 0 },
      uScan: { value: 0 },
      uScroll: { value: 0 },
      uRippleOrigin: { value: new Vector2(0, 0) },
      uRippleAge: { value: -1 },
      uHeight: { value: portrait.height },
      uInk: { value: new Color("#e8eefc") },
      uAccentA: { value: new Color("#7aa8ff") },
      uAccentB: { value: new Color("#8ef0c4") },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const points = new Points(portrait.geometry, material);
  scene.add(points);

  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const ndc = new Vector2();
  const hitPoint = new Vector3();
  const tilt = new Vector2(0, 0);
  const tiltTarget = new Vector2(0, 0);
  let lensTarget = 0;
  let rippleStartedAt = -10;
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let running = !options.reducedMotion;
  const startedAt = performance.now();

  function layout() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // Fit the portrait height (with a little air) to the canvas.
    const fitHeight = portrait.height * 1.08;
    const fitWidth = portrait.width * 1.08;
    const distanceForHeight = fitHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const distanceForWidth = distanceForHeight * (fitWidth / fitHeight) / camera.aspect;
    camera.position.z = Math.max(distanceForHeight, distanceForWidth);
    camera.updateProjectionMatrix();

    // Dot size follows the on-screen spacing of the sampling grid.
    const columns = options.coarsePointer ? 84 : 132;
    const pixelsPerUnit = height / (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360));
    material.uniforms.uDotScale.value = (portrait.width / columns) * pixelsPerUnit * camera.position.z / 6 * 0.95;
  }

  function updateScroll() {
    const rect = options.scrollTarget.getBoundingClientRect();
    // Dots stay assembled while the portrait is on screen and only scatter as
    // it leaves through the top edge.
    material.uniforms.uScroll.value = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height * 0.9, 1)));
  }

  function renderFrame(now: number) {
    const elapsed = (now - startedAt) / 1000;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uScan.value = options.reducedMotion ? 0.35 : (elapsed * 0.12) % 1.25;
    material.uniforms.uLens.value += (lensTarget - material.uniforms.uLens.value) * 0.08;

    const rippleAge = (now - rippleStartedAt) / 1500;
    material.uniforms.uRippleAge.value = rippleAge >= 0 && rippleAge < 1 ? rippleAge : -1;

    tilt.lerp(tiltTarget, 0.06);
    points.rotation.y = tilt.x * 0.32 + (options.reducedMotion ? 0 : Math.sin(elapsed * 0.25) * 0.04);
    points.rotation.x = tilt.y * 0.2;

    renderer.render(scene, camera);
  }

  function loop(now: number) {
    frame = 0;
    renderFrame(now);
    schedule();
  }

  function schedule() {
    if (running && visible && !document.hidden && !frame) {
      frame = window.requestAnimationFrame(loop);
    }
  }

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function pointerToPortrait(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hitPoint);
  }

  function handlePointerMove(event: PointerEvent) {
    const hit = pointerToPortrait(event);
    tiltTarget.set(
      Math.max(-1, Math.min(1, ndc.x)),
      Math.max(-1, Math.min(1, -ndc.y)),
    );

    if (hit) {
      material.uniforms.uPointer.value.set(hit.x, hit.y);
      lensTarget = 1;
    }
  }

  function handlePointerLeave() {
    lensTarget = 0;
    tiltTarget.set(0, 0);
  }

  function handlePointerDown(event: PointerEvent) {
    const hit = pointerToPortrait(event);

    if (hit) {
      material.uniforms.uRippleOrigin.value.set(hit.x, hit.y);
      rippleStartedAt = performance.now();
    }
  }

  function handleVisibility() {
    if (document.hidden) {
      stop();
    } else {
      schedule();
    }
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    running = false;
    stop();
    options.onContextLost();
  }

  const resizeObserver = new ResizeObserver(() => {
    layout();

    if (!running) {
      renderFrame(performance.now());
    }
  });
  resizeObserver.observe(container);

  const visibilityObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);

    if (visible) {
      schedule();
    } else {
      stop();
    }
  });
  visibilityObserver.observe(container);

  renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
  layout();
  renderFrame(performance.now());

  if (running) {
    if (!options.coarsePointer) {
      container.addEventListener("pointermove", handlePointerMove, { passive: true });
      container.addEventListener("pointerleave", handlePointerLeave);
    }

    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("scroll", updateScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    updateScroll();
    schedule();
  }

  return {
    dispose() {
      running = false;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", updateScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      portrait.geometry.dispose();
      material.dispose();
      renderer.dispose();

      // Releasing an already-lost context makes three.js warn; skip it then.
      if (!renderer.getContext().isContextLost()) {
        renderer.forceContextLoss();
      }

      renderer.domElement.remove();
    },
  };
}
