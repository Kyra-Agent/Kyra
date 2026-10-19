import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
  WireframeGeometry,
} from "three";
import { createGlowTexture } from "./glow";

export interface HeroSceneOptions {
  /** Element that receives pointer and click interaction (the hero section). */
  interactionTarget: HTMLElement;
  reducedMotion: boolean;
  coarsePointer: boolean;
  onContextLost: () => void;
}

export interface HeroSceneHandle {
  dispose: () => void;
}

const palette = ["#7aa8ff", "#8ef0c4", "#b29bff", "#f6c978", "#5fd4e8"].map(
  (hex) => new Color(hex),
);

const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPulse;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * world;
    float twinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0);
    float radius = length(position.xz);
    float front = uPulse * 8.0;
    float wave = uPulse > 0.0
      ? smoothstep(0.9, 0.0, abs(radius - front)) * (1.0 - uPulse)
      : 0.0;
    vColor = mix(aColor, vec3(1.0), wave * 0.6);
    vAlpha = twinkle * (0.5 + wave * 1.4);
    gl_PointSize = aSize * uPixelRatio * (1.0 + wave * 1.6) * (105.0 / -viewPosition.z);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const particleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, distanceToCenter) * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const coreVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const coreFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uInner;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.3 + vNormal.y * 6.0);
    vec3 color = mix(uInner * (0.35 + shimmer * 0.15), uRim, fresnel);
    gl_FragColor = vec4(color, 0.25 + fresnel * 0.85);
  }
`;

function createParticles(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const arms = 4;

  for (let index = 0; index < count; index += 1) {
    const radius = 1.5 + Math.pow(Math.random(), 0.8) * 6.2;
    const arm = (index % arms) / arms * Math.PI * 2;
    const spin = radius * 0.42;
    const scatter = (1 - radius / 8) * 0.9 + 0.25;
    const angle = arm + spin + (Math.random() - 0.5) * scatter;

    positions[index * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5;
    positions[index * 3 + 1] = (Math.random() - 0.5) * (0.35 + radius * 0.06);
    positions[index * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5;

    const tone = palette[index % palette.length].clone().lerp(
      palette[(index + 1) % palette.length],
      Math.random() * 0.5,
    );
    colors[index * 3] = tone.r;
    colors[index * 3 + 1] = tone.g;
    colors[index * 3 + 2] = tone.b;
    sizes[index] = 0.7 + Math.random() * 1.5;
    seeds[index] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  return geometry;
}

export function mountHeroScene(
  container: HTMLElement,
  options: HeroSceneOptions,
): HeroSceneHandle {
  const renderer = new WebGLRenderer({
    antialias: !options.coarsePointer,
    alpha: true,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, options.coarsePointer ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "hero-scene-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 1.6, 10.5);
  camera.lookAt(0, 0, 0);

  const system = new Group();
  system.rotation.x = 0.42;
  scene.add(system);

  const glowTexture = createGlowTexture();
  const disposables: Array<{ dispose: () => void }> = [glowTexture];

  // Galaxy of agent particles.
  const particleGeometry = createParticles(options.coarsePointer ? 1400 : 3200);
  const particleMaterial = new ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uPulse: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const particles = new Points(particleGeometry, particleMaterial);
  system.add(particles);
  disposables.push(particleGeometry, particleMaterial);

  // Glowing Kyra core.
  const core = new Group();
  system.add(core);

  const coreGeometry = new SphereGeometry(0.92, 64, 64);
  const coreMaterial = new ShaderMaterial({
    vertexShader: coreVertexShader,
    fragmentShader: coreFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: new Color("#4b86f7") },
      uRim: { value: new Color("#c7d9ff") },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  core.add(new Mesh(coreGeometry, coreMaterial));
  disposables.push(coreGeometry, coreMaterial);

  const shellSource = new IcosahedronGeometry(1.32, 1);
  const shellGeometry = new WireframeGeometry(shellSource);
  shellSource.dispose();
  const shellMaterial = new LineBasicMaterial({
    color: "#8fb6ff",
    transparent: true,
    opacity: 0.32,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const shell = new LineSegments(shellGeometry, shellMaterial);
  core.add(shell);
  disposables.push(shellGeometry, shellMaterial);

  const haloMaterial = new SpriteMaterial({
    map: glowTexture,
    color: "#6f9dff",
    transparent: true,
    opacity: 0.75,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const halo = new Sprite(haloMaterial);
  halo.scale.setScalar(5.4);
  core.add(halo);
  disposables.push(haloMaterial);

  // Orbit rings with a satellite riding each one.
  const ringSpecs = [
    { radius: 1.95, tilt: [1.2, 0.2, 0], color: "#8ef0c4", speed: 0.5 },
    { radius: 2.45, tilt: [1.45, -0.5, 0.4], color: "#b29bff", speed: -0.34 },
    { radius: 2.95, tilt: [1.05, 0.7, -0.3], color: "#f6c978", speed: 0.24 },
  ];
  const rings = ringSpecs.map((spec) => {
    const pivot = new Group();
    pivot.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    const geometry = new TorusGeometry(spec.radius, 0.007, 8, 220);
    const material = new MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    pivot.add(new Mesh(geometry, material));

    const satelliteMaterial = new SpriteMaterial({
      map: glowTexture,
      color: spec.color,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const satellite = new Sprite(satelliteMaterial);
    satellite.scale.setScalar(0.42);
    pivot.add(satellite);
    core.add(pivot);
    disposables.push(geometry, material, satelliteMaterial);
    return { pivot, satellite, spec, angle: Math.random() * Math.PI * 2 };
  });

  // Interaction state.
  const pointer = new Vector2(0, 0);
  const pointerTarget = new Vector2(0, 0);
  let pulseStartedAt = -10;
  let scrollProgress = 0;
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let running = false;
  const startedAt = performance.now();

  function layout() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Desktop keeps the core beside the copy; stacked layouts lift it up.
    const wide = width / height > 1.2;
    // On wide layouts the core hides behind the glass console and its rings
    // swing around the console edges.
    // Stacked layouts put the console below the copy, so the core sits low,
    // behind the console, and the copy area above stays clear.
    system.position.set(wide ? 3.05 : 0.5, wide ? -0.15 : -1.8, 0);
    system.scale.setScalar(wide ? 1.6 : 0.85);
  }

  function updateScroll() {
    const rect = options.interactionTarget.getBoundingClientRect();
    scrollProgress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
  }

  function renderFrame(now: number) {
    const elapsed = (now - startedAt) / 1000;
    particleMaterial.uniforms.uTime.value = elapsed;
    coreMaterial.uniforms.uTime.value = elapsed;

    const pulseAge = (now - pulseStartedAt) / 1600;
    particleMaterial.uniforms.uPulse.value = pulseAge >= 0 && pulseAge < 1 ? pulseAge : 0;

    pointer.lerp(pointerTarget, 0.05);
    system.rotation.y = elapsed * 0.05 + pointer.x * 0.35 + scrollProgress * 0.9;
    system.rotation.x = 0.42 + pointer.y * 0.18 - scrollProgress * 0.25;
    camera.position.z = 10.5 + scrollProgress * 2.5;

    shell.rotation.y = elapsed * 0.18;
    shell.rotation.x = elapsed * 0.07;
    const breathe = 1 + Math.sin(elapsed * 1.6) * 0.04 + (pulseAge >= 0 && pulseAge < 1 ? (1 - pulseAge) * 0.18 : 0);
    core.scale.setScalar(breathe);

    for (const ring of rings) {
      ring.angle += ring.spec.speed * 0.016;
      ring.satellite.position.set(
        Math.cos(ring.angle) * ring.spec.radius,
        Math.sin(ring.angle) * ring.spec.radius,
        0,
      );
    }

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

  function handlePointerMove(event: PointerEvent) {
    const rect = options.interactionTarget.getBoundingClientRect();
    pointerTarget.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1,
    );
  }

  function handlePointerLeave() {
    pointerTarget.set(0, 0);
  }

  function handlePointerDown() {
    pulseStartedAt = performance.now();
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

  if (options.reducedMotion) {
    renderFrame(startedAt + 4000);
  } else {
    running = true;

    if (!options.coarsePointer) {
      options.interactionTarget.addEventListener("pointermove", handlePointerMove, { passive: true });
      options.interactionTarget.addEventListener("pointerleave", handlePointerLeave);
    }

    options.interactionTarget.addEventListener("pointerdown", handlePointerDown, { passive: true });
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
      options.interactionTarget.removeEventListener("pointermove", handlePointerMove);
      options.interactionTarget.removeEventListener("pointerleave", handlePointerLeave);
      options.interactionTarget.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", updateScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
