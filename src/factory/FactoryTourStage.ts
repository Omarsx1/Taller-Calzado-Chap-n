import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  HOTSPOTS,
  ZONE_VIEWS,
  type CameraView,
  type HotspotDef,
  type ZoneId,
} from './factory.config';
import { HotspotLayer } from './FactoryHotspots';
import { createHall, setupLighting } from './hall';
import { createLandscape } from './landscape';
import { uvStripMat } from './materials';
import { loadShoeAssets } from './ShoeModels';
import { createSkyTexture, disposeSkyTexture } from './sky';
import { buildFactoryBranding } from './BrandingLogo';
import { loadWarehouse } from './WarehouseLoader';
import { buildWorkshopExpansion } from './WorkshopExpansion';
import { buildZones, updateWithRealShoes } from './zones';

/**
 * Bootstrap for the standalone factory tour.
 *
 * Everything lives inside `initFactoryTour()`: no globals, no `window`
 * mutation. The function is idempotent through `canvas.dataset.ready` and
 * returns a `dispose()` that tears the stage down.
 */

const NUDGE_DELAY_MS = 2500;
const FLY_DEFAULT_MS = 1000;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function initFactoryTour(): () => void {
  const canvas = document.getElementById('factory-canvas');
  const hotspotHost = document.getElementById('factory-hotspot-layer');
  const panel = document.getElementById('factory-panel');
  const panelEyebrow = document.getElementById('factory-panel-eyebrow');
  const panelTitle = document.getElementById('factory-panel-title');
  const panelBody = document.getElementById('factory-panel-body');
  const panelMeta = document.getElementById('factory-panel-meta');
  const panelClose = document.getElementById('factory-panel-close');
  const loading = document.getElementById('factory-loading');
  const zoneButtons = document.querySelectorAll<HTMLButtonElement>('.zonenav__btn[data-goto]');

  if (!(canvas instanceof HTMLCanvasElement) || !hotspotHost) {
    console.warn('[factory] required DOM nodes are missing; tour not started');
    return () => {};
  }
  if (canvas.dataset.ready === 'true') return () => {};
  canvas.dataset.ready = 'true';

  const abort = new AbortController();
  const { signal } = abort;

  /* ------------------------------------------------------- renderer + scene */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.76;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const skyTexture = createSkyTexture();
  scene.background = skyTexture;
  scene.backgroundIntensity = 1.0;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environment = pmremGenerator.fromEquirectangular(skyTexture).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.75;
  pmremGenerator.dispose();

  // Atmospheric perspective: fades the far end of the hall and the exterior ridges
  // into the sky haze. `near` stays beyond typical interior distances so the factory
  // floor is untouched.
  // Atmospheric perspective: fades the distant mountain ridges while keeping the full 93m factory crisp
  scene.fog = new THREE.Fog(0xdae6f0, 60, 420);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 450);
  camera.position.set(0.0, 3.8, 10.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.0, 1.1, 1.8);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 135; // Allows smooth scroll back to view the entire 93-meter factory and grounds
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // Can view down at building from elevated angles
  controls.screenSpacePanning = true;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.55;
  controls.update();
  camera.lookAt(controls.target);

  setupLighting(scene);

  const hall = createHall();
  scene.add(hall);

  const zones = buildZones();
  scene.add(zones.group);

  const expansion = buildWorkshopExpansion();
  scene.add(expansion.group);

  const branding = buildFactoryBranding();
  scene.add(branding);

  const landscape = createLandscape();
  scene.add(landscape.group);

  let warehouseDisposer: (() => void) | null = null;

  // Load authentic warehouse architecture, shoe models, and expansion equipment concurrently
  Promise.all([
    loadWarehouse(),
    loadShoeAssets(),
    expansion.loadModels(),
  ])
    .then(([warehouseResult, shoesReady]) => {
      if (warehouseResult) {
        scene.add(warehouseResult.group);
        warehouseDisposer = warehouseResult.dispose;
      }
      if (shoesReady) {
        updateWithRealShoes(zones.shoeSlots);
      }
      if (loading) loading.hidden = true;
    })
    .catch((err) => {
      console.error('[factory] Error loading assets:', err);
      if (loading) loading.hidden = true;
    });

  // Hotspot occluders: machine bodies, racks, and station surfaces
  const occluders: THREE.Object3D[] = [...zones.occluders, expansion.group, branding];

  /* ------------------------------------------------------------- camera fly */

  let flying = false;
  let flyStart = 0;
  let flyDuration = FLY_DEFAULT_MS;
  const fromPosition = new THREE.Vector3();
  const toPosition = new THREE.Vector3();
  const fromTarget = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  function flyTo(view: CameraView, ms = FLY_DEFAULT_MS): void {
    fromPosition.copy(camera.position);
    toPosition.set(view.position[0], view.position[1], view.position[2]);
    fromTarget.copy(controls.target);
    toTarget.set(view.target[0], view.target[1], view.target[2]);
    flyDuration = Math.max(1, ms);
    flyStart = performance.now();
    flying = true;
    controls.autoRotate = false;
  }

  function updateFly(): void {
    const t = Math.min(1, (performance.now() - flyStart) / flyDuration);
    const eased = easeInOutQuad(t);
    camera.position.lerpVectors(fromPosition, toPosition, eased);
    controls.target.lerpVectors(fromTarget, toTarget, eased);
    camera.lookAt(controls.target);
    if (t >= 1) flying = false;
  }

  /* ---------------------------------------------------------------- hotspots */

  const hotspotLayer = new HotspotLayer(hotspotHost, camera, HOTSPOTS, selectHotspot);

  function setActiveZone(zone: ZoneId | null): void {
    zoneButtons.forEach((button) => {
      if (zone && button.dataset.goto === zone) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function selectHotspot(def: HotspotDef): void {
    flyTo(def.view);
    if (panelEyebrow) panelEyebrow.textContent = def.eyebrow;
    if (panelTitle) panelTitle.textContent = def.title;
    if (panelBody) panelBody.textContent = def.body;
    if (panelMeta) panelMeta.textContent = def.meta;
    if (panel) panel.hidden = false;
    hotspotLayer.setActive(def.id);
    setActiveZone(def.zone);
  }

  panelClose?.addEventListener(
    'click',
    () => {
      if (panel) panel.hidden = true;
      hotspotLayer.setActive(null);
    },
    { signal },
  );

  zoneButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const zone = button.dataset.goto as ZoneId | undefined;
        if (!zone || !(zone in ZONE_VIEWS)) return;
        flyTo(ZONE_VIEWS[zone]);
        if (panel) panel.hidden = true;
        setActiveZone(zone);
      },
      { signal },
    );
  });

  /* --------------------------------------------------- cold-start auto-orbit */

  let nudgeTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    controls.autoRotate = true;
  }, NUDGE_DELAY_MS);

  const stopNudge = (): void => {
    controls.autoRotate = false;
    if (nudgeTimer !== undefined) {
      clearTimeout(nudgeTimer);
      nudgeTimer = undefined;
    }
  };
  canvas.addEventListener('pointerdown', stopNudge, { signal });
  canvas.addEventListener('wheel', stopNudge, { signal, passive: true });

  /* -------------------------------------------------------------- resize/dev */

  const resize = (): void => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let visible = true;
  const intersectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) visible = entry.isIntersecting;
  });
  intersectionObserver.observe(canvas);

  let pageVisible = !document.hidden;
  document.addEventListener(
    'visibilitychange',
    () => {
      pageVisible = !document.hidden;
    },
    { signal },
  );

  /* ------------------------------------------------------------ animate loop */

  const clock = new THREE.Clock();
  let animationFrame = 0;
  let firstFrameLogged = false;
  let disposed = false;

  function tick(): void {
    animationFrame = requestAnimationFrame(tick);
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    zones.rack.rotation.y += delta * 0.18;
    for (const heddle of zones.heddles) {
      heddle.mesh.position.y = heddle.baseY + Math.sin(elapsed * 1.6 + heddle.phase) * 0.04;
    }
    uvStripMat.emissiveIntensity = 1.3 + Math.sin(elapsed * 2.4) * 0.35;

    if (flying) updateFly();
    else controls.update(delta);

    hotspotLayer.update(occluders);

    if (!visible || !pageVisible) return;

    renderer.render(scene, camera);

    if (!firstFrameLogged) {
      firstFrameLogged = true;
      console.log(
        '[factory] draw calls:',
        renderer.info.render.calls,
        'triangles:',
        renderer.info.render.triangles,
      );
      if (loading) loading.hidden = true;
    }
  }
  animationFrame = requestAnimationFrame(tick);

  /* ------------------------------------------------------------------ teardown */

  return () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    if (nudgeTimer !== undefined) clearTimeout(nudgeTimer);
    abort.abort();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    hotspotLayer.dispose();
    controls.dispose();

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) item.dispose();
      } else if (material) {
        material.dispose();
      }
    });
    landscape.dispose();
    if (warehouseDisposer) warehouseDisposer();
    disposeSkyTexture(skyTexture);
    environment.dispose();
    renderer.dispose();
    delete canvas.dataset.ready;
  };
}
