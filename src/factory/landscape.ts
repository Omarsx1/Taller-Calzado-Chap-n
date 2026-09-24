import * as THREE from 'three';

/**
 * Distant ridge bands for the Calzado Chapín virtual tour.
 *
 * Two billboard planes carry painted alpha silhouettes so the exterior reads as
 * layered ridges receding into the sky haze. Each silhouette is drawn with a
 * fixed control-height profile, so the landscape is stable across reloads.
 */

interface RidgeTextureOptions {
  /** Ridge colour at the peaks (top of the silhouette). */
  peakColor: string;
  /** Haze colour at the base, where the ridge meets the horizon. */
  hazeColor: string;
  /** Deterministic peak heights sampled evenly across the canvas (0..1). */
  heights: readonly number[];
}

/** Converts a `#rrggbb` colour into an `rgba()` string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Paints a filled ridge silhouette with a transparent sky around it. */
function createRidgeTexture(options: RidgeTextureOptions): THREE.CanvasTexture {
  const width = 1024;
  const height = 256;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for ridge');

  ctx.clearRect(0, 0, width, height);

  // Deterministic profile: base on the bottom edge, peaks from fixed heights.
  const step = width / (options.heights.length - 1);
  ctx.beginPath();
  ctx.moveTo(0, height);
  options.heights.forEach((peak, index) => {
    ctx.lineTo(index * step, height - peak * height);
  });
  ctx.lineTo(width, height);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, options.peakColor);
  gradient.addColorStop(1, options.hazeColor);
  ctx.fillStyle = gradient;
  ctx.filter = 'blur(3px)';
  ctx.fill();
  ctx.filter = 'none';

  // Fade the top 40% of the silhouette into the sky so peaks dissolve away.
  const fade = ctx.createLinearGradient(0, 0, 0, height * 0.28);
  fade.addColorStop(0, hexToRgba(options.hazeColor, 0.7));
  fade.addColorStop(1, hexToRgba(options.hazeColor, 0));
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height * 0.28);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface RidgeBandOptions {
  /** Plane width in world units. */
  width: number;
  /** Plane height in world units, with its base resting at y = 0. */
  height: number;
  /** World Z position of the band. */
  z: number;
  /** Silhouette peak colour. */
  color: string;
  /** Haze colour used at the base and for the top fade. */
  hazeColor: string;
  /** Material opacity. */
  opacity: number;
  /** Deterministic peak profile. */
  heights: readonly number[];
}

/** Builds a single ridge plane facing +Z toward the camera. */
function createRidgeBand(options: RidgeBandOptions): {
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  texture: THREE.CanvasTexture;
} {
  const geometry = new THREE.PlaneGeometry(options.width, options.height);
  const texture = createRidgeTexture({
    peakColor: options.color,
    hazeColor: options.hazeColor,
    heights: options.heights,
  });

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y = 0;
  mesh.position.set(0, options.height / 2, options.z);
  mesh.renderOrder = -1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return { mesh, geometry, texture };
}

/** Builds the layered exterior ridges with their owned resources. */
export function createLandscape(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'landscape';

  const near = createRidgeBand({
    width: 260,
    height: 26,
    z: -58,
    color: '#465F78',
    hazeColor: '#AFC2D2',
    opacity: 0.88,
    heights: [
      0.16, 0.22, 0.34, 0.28, 0.4, 0.36, 0.5, 0.42, 0.55, 0.46, 0.6, 0.5, 0.42, 0.36, 0.44, 0.32,
      0.27, 0.34, 0.24, 0.18,
    ],
  });

  const far = createRidgeBand({
    width: 420,
    height: 46,
    z: -105,
    color: '#63809A',
    hazeColor: '#C2D2DF',
    opacity: 0.62,
    heights: [
      0.22, 0.3, 0.26, 0.38, 0.32, 0.46, 0.4, 0.52, 0.44, 0.56, 0.48, 0.62, 0.54, 0.46, 0.5, 0.4,
      0.34, 0.42, 0.3, 0.24,
    ],
  });

  group.add(near.mesh, far.mesh);
  group.renderOrder = -1;

  const dispose = (): void => {
    near.geometry.dispose();
    far.geometry.dispose();
    near.texture.dispose();
    far.texture.dispose();
  };

  return { group, dispose };
}
