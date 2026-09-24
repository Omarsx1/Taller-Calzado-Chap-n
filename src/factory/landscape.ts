import * as THREE from 'three';

/**
 * 360° mountain horizon for the Calzado Chapín virtual tour.
 *
 * Three concentric open cylinders carry painted alpha silhouettes so the
 * exterior reads as layered ridge lines receding into golden-hour haze from
 * every orbit angle. Crests are rim-lit toward the painted sunset sun and the
 * anti-sun slopes cool toward violet; a dark ground disc closes the gap
 * between the concrete apron and the mountain bases.
 *
 * Ridge profiles sum integer-frequency triangular waves, so the texture wraps
 * the cylinder seamlessly and reloads deterministically.
 *
 * Keep `RING_SUN_U` in sync with the sun painted in `sky.ts` (u = 0.34
 * equirect): the cylinder parametrises u = atan2(x, z) / 2π, which maps the
 * same world azimuth to u ≈ 0.41.
 */

/** Sun azimuth in cylinder UV space (see module docblock). */
const RING_SUN_U = 0.41;

/** Ground centre matches the concrete apron in `WorkshopExpansion.ts`. */
const CENTER_X = 3.8;
const CENTER_Z = 0;

/** mulberry32: tiny deterministic PRNG for stable ridge profiles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..1 triangular wave with period 1 — jagged when summed across octaves. */
function tri(t: number): number {
  return 1 - Math.abs(2 * (t - Math.floor(t)) - 1);
}

/** Converts a `#rrggbb` colour into an `rgba()` string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface RingLayerOptions {
  /** Ring radius in world units. */
  radius: number;
  /** Ring height in world units (base rests at y = 0). */
  height: number;
  /** Silhouette colour at the peaks. */
  peakColor: string;
  /** Haze colour at the base, where the ridge meets the ground disc. */
  hazeColor: string;
  /** Sun-lit crest colour for the rim-light pass. */
  rimColor: string;
  /** Rim-light strength 0..1 (near rings catch more direct sun). */
  rimStrength: number;
  /** Material opacity. */
  opacity: number;
  /** Transparent-pass draw order (far rings first). */
  renderOrder: number;
  /** PRNG seed for the deterministic profile. */
  seed: number;
  /** Amplitude/frequency/sharpness octaves for the ridge profile. */
  octaves: ReadonlyArray<readonly [amplitude: number, frequency: number, sharpness: number]>;
}

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 512;

/**
 * Paints a seamless 360° ridge silhouette: filled crest with a peak-to-haze
 * vertical gradient, a sun-side rim light on the crest and a warm/cool body
 * wash across the wrap. Everything above the silhouette stays transparent.
 */
function createRingTexture(options: RingLayerOptions): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for ridge');

  const rng = mulberry32(options.seed);
  const phases = options.octaves.map(() => rng());

  // Deterministic profile: integer frequencies keep the wrap seamless. Broad
  // low-frequency swells give the massifs, while sharpened mid/high octaves
  // cut the jagged crest detail — power >1 narrows each wave into peaks so
  // the ridgelines read as mountains rather than rolling dunes.
  const heightAt = (u: number): number => {
    let h = 0.3;
    options.octaves.forEach(([amplitude, frequency, sharpness], index) => {
      h += amplitude * tri(u * frequency + phases[index]) ** sharpness;
    });
    return Math.min(0.95, Math.max(0.05, h));
  };

  // Crest polyline (base on the bottom edge).
  const step = 4;
  const crest: Array<[number, number]> = [];
  for (let x = 0; x <= TEXTURE_WIDTH; x += step) {
    crest.push([x, TEXTURE_HEIGHT - heightAt(x / TEXTURE_WIDTH) * TEXTURE_HEIGHT]);
  }

  // Filled silhouette with the peak→haze vertical gradient.
  ctx.beginPath();
  ctx.moveTo(0, TEXTURE_HEIGHT);
  for (const [x, y] of crest) ctx.lineTo(x, y);
  ctx.lineTo(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, 0, 0, TEXTURE_HEIGHT);
  body.addColorStop(0, options.peakColor);
  body.addColorStop(1, options.hazeColor);
  ctx.fillStyle = body;
  ctx.fill();

  // Melt the base into the terrain: fading the bottom of the silhouette to
  // transparent softens the straight cylinder edge against the ground disc.
  const baseFade = ctx.createLinearGradient(0, TEXTURE_HEIGHT * 0.86, 0, TEXTURE_HEIGHT);
  baseFade.addColorStop(0, 'rgba(0,0,0,0)');
  baseFade.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = baseFade;
  ctx.fillRect(0, TEXTURE_HEIGHT * 0.86, TEXTURE_WIDTH, TEXTURE_HEIGHT * 0.14);
  ctx.globalCompositeOperation = 'source-over';

  // Warm body wash on the sun side, cool violet on the anti-sun side.
  const wash = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, 0);
  wash.addColorStop(0.0, 'rgba(58,42,84,0.26)');
  wash.addColorStop(0.16, 'rgba(58,42,84,0.20)');
  wash.addColorStop(0.41, 'rgba(255,158,96,0.20)');
  wash.addColorStop(0.66, 'rgba(58,42,84,0.16)');
  wash.addColorStop(0.91, 'rgba(52,38,80,0.30)');
  wash.addColorStop(1.0, 'rgba(58,42,84,0.26)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  ctx.globalCompositeOperation = 'source-over';

  // Sun-lit crest: additive stroke whose alpha follows the cos falloff around
  // the sun azimuth, so only the sun-facing quarter of the ring glows.
  const rimAlphaAt = (u: number): number =>
    Math.max(0, Math.cos(2 * Math.PI * (u - RING_SUN_U))) ** 1.6 * 0.85;
  const rim = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, 0);
  for (let s = 0; s <= 20; s++) {
    const u = s / 20;
    rim.addColorStop(u, hexToRgba(options.rimColor, rimAlphaAt(u)));
  }

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.filter = 'blur(3px)';
  ctx.lineWidth = 4;
  ctx.strokeStyle = rim;
  ctx.globalAlpha = options.rimStrength * 0.4;
  ctx.beginPath();
  for (const [x, y] of crest) ctx.lineTo(x, y);
  ctx.stroke();

  ctx.filter = 'blur(1px)';
  ctx.lineWidth = 2;
  ctx.globalAlpha = options.rimStrength;
  ctx.beginPath();
  for (const [x, y] of crest) ctx.lineTo(x, y);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** Builds one inward-facing cylinder ring of mountains. */
function createRing(options: RingLayerOptions): {
  mesh: THREE.Mesh;
  geometry: THREE.CylinderGeometry;
  texture: THREE.CanvasTexture;
} {
  const geometry = new THREE.CylinderGeometry(
    options.radius,
    options.radius,
    options.height,
    160,
    1,
    true,
  );
  const texture = createRingTexture(options);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    fog: true,
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(CENTER_X, options.height / 2, CENTER_Z);
  mesh.renderOrder = options.renderOrder;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return { mesh, geometry, texture };
}

const RING_LAYERS: ReadonlyArray<RingLayerOptions> = [
  {
    radius: 560,
    height: 140,
    peakColor: '#8a5f82',
    hazeColor: '#e8b087',
    rimColor: '#ffd2a0',
    rimStrength: 0.5,
    opacity: 0.94,
    renderOrder: -30,
    seed: 11,
    octaves: [
      [0.13, 2, 1.2],
      [0.17, 5, 1.8],
      [0.11, 11, 2.0],
      [0.07, 23, 2.2],
      [0.04, 47, 2.4],
    ],
  },
  {
    radius: 400,
    height: 100,
    peakColor: '#5a3d66',
    hazeColor: '#c98a72',
    rimColor: '#ffc188',
    rimStrength: 0.75,
    opacity: 0.96,
    renderOrder: -20,
    seed: 23,
    octaves: [
      [0.12, 3, 1.3],
      [0.15, 7, 1.8],
      [0.1, 15, 2.1],
      [0.06, 31, 2.3],
      [0.035, 61, 2.5],
    ],
  },
  {
    radius: 300,
    height: 58,
    peakColor: '#443354',
    hazeColor: '#b08064',
    rimColor: '#ffab66',
    rimStrength: 1,
    opacity: 1,
    renderOrder: -10,
    seed: 47,
    octaves: [
      [0.1, 4, 1.4],
      [0.13, 9, 1.9],
      [0.09, 19, 2.2],
      [0.05, 41, 2.4],
      [0.03, 83, 2.6],
    ],
  },
];

/** Builds the layered mountain rings plus the surrounding terrain disc. */
export function createLandscape(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'landscape';

  const rings = RING_LAYERS.map((options) => createRing(options));
  group.add(...rings.map((ring) => ring.mesh));
  group.renderOrder = -1;

  // Terrain disc under everything: dusk earth fading into the haze, so no
  // sky-nadir seam shows between the apron edge and the mountains. Radius
  // 1200 keeps the rim beyond the fog's far plane, where it renders as pure
  // haze and the "end of the world" edge disappears from high exterior views.
  const groundGeometry = new THREE.CircleGeometry(1200, 96);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x524052,
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(CENTER_X, -0.04, CENTER_Z);
  ground.receiveShadow = true;
  group.add(ground);

  const dispose = (): void => {
    for (const ring of rings) {
      ring.geometry.dispose();
      ring.texture.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    }
    groundGeometry.dispose();
    groundMaterial.dispose();
  };

  return { group, dispose };
}
