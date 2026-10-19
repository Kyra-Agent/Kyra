import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WireframeGeometry,
} from "three";
import { createGlowTexture } from "./glow";

export interface OrbitModule {
  id: string;
  label: string;
  color: string;
}

export interface ModuleOrbitOptions {
  modules: OrbitModule[];
  reducedMotion: boolean;
  onHover: (moduleId: string | null) => void;
  onContextLost: () => void;
}

export interface ModuleOrbitHandle {
  setActive: (moduleId: string | null) => void;
  dispose: () => void;
}

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
  uniform vec3 uInner;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
    gl_FragColor = vec4(mix(uInner * 0.4, uRim, fresnel), 0.3 + fresnel * 0.8);
  }
`;

const orbitRadius = 2.35;

export function mountModuleOrbitScene(
  container: HTMLElement,
  options: ModuleOrbitOptions,
): ModuleOrbitHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "module-orbit-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const labelLayer = document.createElement("div");
  labelLayer.className = "module-orbit-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  container.appendChild(labelLayer);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0.6, 8.2);
  camera.lookAt(0, 0, 0);

  const glowTexture = createGlowTexture();
  const disposables: Array<{ dispose: () => void }> = [glowTexture];

  // Core.
  const coreGeometry = new SphereGeometry(0.72, 48, 48);
  const coreMaterial = new ShaderMaterial({
    vertexShader: coreVertexShader,
    fragmentShader: coreFragmentShader,
    uniforms: {
      uInner: { value: new Color("#4b86f7") },
      uRim: { value: new Color("#cfe0ff") },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const core = new Mesh(coreGeometry, coreMaterial);
  scene.add(core);
  disposables.push(coreGeometry, coreMaterial);

  const shellSource = new IcosahedronGeometry(1.02, 1);
  const shellGeometry = new WireframeGeometry(shellSource);
  shellSource.dispose();
  const shellMaterial = new LineBasicMaterial({
    color: "#8fb6ff",
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const shell = new LineSegments(shellGeometry, shellMaterial);
  scene.add(shell);
  disposables.push(shellGeometry, shellMaterial);

  const coreHaloMaterial = new SpriteMaterial({
    map: glowTexture,
    color: "#5f8fff",
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const coreHalo = new Sprite(coreHaloMaterial);
  coreHalo.scale.setScalar(3.2);
  scene.add(coreHalo);
  disposables.push(coreHaloMaterial);

  // Tilted orbit plane carrying the module satellites.
  const orbit = new Group();
  orbit.rotation.set(1.12, 0, 0.18);
  scene.add(orbit);

  const ringGeometry = new TorusGeometry(orbitRadius, 0.008, 8, 240);
  const ringMaterial = new MeshBasicMaterial({
    color: "#7aa8ff",
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  orbit.add(new Mesh(ringGeometry, ringMaterial));
  disposables.push(ringGeometry, ringMaterial);

  const hitGeometry = new SphereGeometry(0.42, 12, 12);
  const hitMaterial = new MeshBasicMaterial({ visible: false });
  const bodyGeometry = new SphereGeometry(0.15, 24, 24);
  disposables.push(hitGeometry, hitMaterial, bodyGeometry);

  const satellites = options.modules.map((module, index) => {
    const pivot = new Group();
    const color = new Color(module.color);
    const bodyMaterial = new MeshBasicMaterial({ color });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    const glowMaterial = new SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glow = new Sprite(glowMaterial);
    glow.scale.setScalar(0.9);
    const hit = new Mesh(hitGeometry, hitMaterial);
    hit.userData.moduleId = module.id;
    pivot.add(body, glow, hit);
    orbit.add(pivot);

    const beamGeometry = new BufferGeometry();
    beamGeometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
    const beamMaterial = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const beam = new Line(beamGeometry, beamMaterial);
    scene.add(beam);

    const label = document.createElement("span");
    label.className = "module-orbit-label";
    label.textContent = module.label;
    label.style.setProperty("--label-color", module.color);
    labelLayer.appendChild(label);

    disposables.push(bodyMaterial, glowMaterial, beamGeometry, beamMaterial);

    return {
      id: module.id,
      pivot,
      glow,
      hit,
      beam,
      beamMaterial,
      label,
      baseAngle: (index / options.modules.length) * Math.PI * 2,
      scale: 1,
    };
  });

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const worldPosition = new Vector3();
  const projected = new Vector3();
  let activeId: string | null = null;
  let hoveredId: string | null = null;
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let running = !options.reducedMotion;
  let angleOffset = 0;
  let lastTime = performance.now();

  function layout() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function renderFrame(now: number) {
    const delta = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (running) {
      angleOffset += delta * 0.22;
      shell.rotation.y += delta * 0.2;
      shell.rotation.x += delta * 0.08;
    }

    for (const satellite of satellites) {
      const angle = satellite.baseAngle + angleOffset;
      satellite.pivot.position.set(
        Math.cos(angle) * orbitRadius,
        Math.sin(angle) * orbitRadius,
        0,
      );

      const highlighted = satellite.id === activeId;
      const dimmed = activeId !== null && !highlighted;
      const targetScale = highlighted ? 1.7 : 1;
      satellite.scale += (targetScale - satellite.scale) * (running ? 0.15 : 1);
      satellite.pivot.scale.setScalar(satellite.scale);
      satellite.glow.material.opacity = dimmed ? 0.35 : highlighted ? 1 : 0.8;
      satellite.beamMaterial.opacity = highlighted ? 0.9 : dimmed ? 0.08 : 0.22;

      satellite.pivot.getWorldPosition(worldPosition);
      const positions = satellite.beam.geometry.getAttribute("position") as BufferAttribute;
      positions.setXYZ(0, 0, 0, 0);
      positions.setXYZ(1, worldPosition.x, worldPosition.y, worldPosition.z);
      positions.needsUpdate = true;

      projected.copy(worldPosition).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      satellite.label.style.transform = `translate(${x.toFixed(1)}px, ${(y + 18).toFixed(1)}px) translateX(-50%)`;
      satellite.label.classList.toggle("is-active", highlighted);
      satellite.label.classList.toggle("is-dimmed", dimmed);
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

  function requestStaticFrame() {
    if (!running) {
      renderFrame(performance.now());
    }
  }

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(satellites.map((satellite) => satellite.hit), false)[0];
    const nextId = (hit?.object.userData.moduleId as string | undefined) ?? null;

    if (nextId !== hoveredId) {
      hoveredId = nextId;
      renderer.domElement.style.cursor = nextId ? "pointer" : "";
      options.onHover(nextId);
    }
  }

  function handlePointerLeave() {
    if (hoveredId !== null) {
      hoveredId = null;
      renderer.domElement.style.cursor = "";
      options.onHover(null);
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
    requestStaticFrame();
  });
  resizeObserver.observe(container);

  const visibilityObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);

    if (visible) {
      lastTime = performance.now();
      schedule();
    } else {
      stop();
    }
  });
  visibilityObserver.observe(container);

  renderer.domElement.addEventListener("pointermove", handlePointerMove, { passive: true });
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
  document.addEventListener("visibilitychange", handleVisibility);

  layout();
  renderFrame(performance.now());
  schedule();

  return {
    setActive(moduleId) {
      activeId = moduleId;
      requestStaticFrame();
    },
    dispose() {
      running = false;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      document.removeEventListener("visibilitychange", handleVisibility);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
