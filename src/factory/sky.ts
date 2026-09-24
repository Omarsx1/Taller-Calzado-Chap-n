import * as THREE from 'three';

/**
 * Procedural sunset sky for the Calzado Chapín virtual tour.
 *
 * The 2048 x 1024 canvas is a 2:1 equirectangular map painted entirely at
 * runtime: an indigo-to-gold vertical gradient, a low sun disc with layered
 * warm bloom, sun-lit stratus streaks near the horizon, violet high wisps,
 * a golden horizon haze band and faint volcano silhouettes with their bases
 * sitting exactly on the horizon line (y = 512).
 *
 * The sun placement below is the single source of truth for the outdoor
 * lighting rig in `hall.ts` (directional key light) and the rim-lit crest
 * gradient in `landscape.ts` — keep the three in sync when moving the sun.
 *
 * The texture doubles as the scene background and, through `PMREMGenerator`,
 * as the image-based lighting environment.
 */

const WIDTH = 2048;
const HEIGHT = 1024;
const HORIZON = HEIGHT / 2;

/**
 * Horizontal sun placement: u = 0.34 → equirect direction atan2(z, x) ≈
 * −57.6°, i.e. the sun hangs toward (0.52, −0.82) in world x/z — just past
 * the right edge of the default camera view, revealed on orbit.
 */
const SUN_U = 0.34;
const SUN_X = SUN_U * WIDTH;

/** Vertical sun placement: ~15° above the horizon (v = 0.583 → y = 427). */
const SUN_Y = 427;

/** Deterministic cloud placement so the bands are stable across reloads. */
const HIGH_WISPS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 220, y: 250, rx: 190, ry: 22 },
  { x: 520, y: 200, rx: 150, ry: 17 },
  { x: 840, y: 228, rx: 210, ry: 24 },
  { x: 1180, y: 188, rx: 160, ry: 19 },
  { x: 1520, y: 258, rx: 200, ry: 26 },
  { x: 1840, y: 210, rx: 150, ry: 18 },
];

/** Mid-altitude rose-grey streaks, stretched by perspective near the sun. */
const MID_STREAKS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 90, y: 396, rx: 140, ry: 11 },
  { x: 360, y: 412, rx: 190, ry: 13 },
  { x: 660, y: 390, rx: 230, ry: 15 },
  { x: 980, y: 404, rx: 270, ry: 17 },
  { x: 1300, y: 386, rx: 210, ry: 14 },
  { x: 1620, y: 410, rx: 240, ry: 15 },
  { x: 1910, y: 392, rx: 180, ry: 12 },
];

/** Low golden stratus, clustered around the sun and clear of the disc. */
const LOW_STRATUS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 560, y: 472, rx: 250, ry: 11 },
  { x: 790, y: 466, rx: 300, ry: 13 },
  { x: 890, y: 490, rx: 220, ry: 9 },
  { x: 420, y: 494, rx: 190, ry: 8 },
  { x: 1060, y: 480, rx: 260, ry: 11 },
];

/** Cool stratus on the anti-sun side, silhouetted against the gold band. */
const COOL_STRATUS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 250, y: 462, rx: 210, ry: 10 },
  { x: 1480, y: 470, rx: 230, ry: 10 },
  { x: 1800, y: 482, rx: 250, ry: 9 },
];

/** mulberry32: tiny deterministic PRNG (dither grain, silhouette jitter). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fills an ellipse path with `rgba(color, alpha)` and the current filter. */
function paintEllipse(
  ctx: CanvasRenderingContext2D,
  cloud: { x: number; y: number; rx: number; ry: number },
  color: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cloud.x, cloud.y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Paints a cone or massif silhouette and fills it with an apex-to-base haze
 * gradient. The caller controls the path; bases sit on the horizon.
 */
function fillSilhouette(
  ctx: CanvasRenderingContext2D,
  apexY: number,
  buildPath: (context: CanvasRenderingContext2D) => void,
  topColor: string,
  bottomColor: string,
): void {
  const gradient = ctx.createLinearGradient(0, apexY, 0, HORIZON);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);

  ctx.beginPath();
  buildPath(ctx);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

/** Adds a soft elliptical warm bloom around the sun using additive blending. */
function paintGlow(
  ctx: CanvasRenderingContext2D,
  radius: number,
  coreColor: string,
  midColor: string,
): void {
  const glow = ctx.createRadialGradient(SUN_X, SUN_Y, 0, SUN_X, SUN_Y, radius);
  glow.addColorStop(0, coreColor);
  glow.addColorStop(0.45, midColor);
  glow.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(SUN_X - radius, SUN_Y - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = 'source-over';
}

/** Creates the equirectangular sunset texture used as background and IBL source. */
export function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for sky');

  // 1. Sky gradient: deep indigo zenith through violet and terracotta to gold.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0.0, '#16204a');
  sky.addColorStop(0.32, '#313061');
  sky.addColorStop(0.55, '#513d70');
  sky.addColorStop(0.72, '#7c4a66');
  sky.addColorStop(0.86, '#b25b4e');
  sky.addColorStop(0.95, '#e08850');
  sky.addColorStop(1.0, '#f6b269');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Nadir / lower half: warm haze at the horizon holding on much longer
  //    before sinking into dark dusk ground — from high exterior views the
  //    band beyond the terrain edge reads as distant haze, not a dark seam
  //    (mostly hidden by the landscape ground disc and maxPolarAngle).
  const ground = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
  ground.addColorStop(0, '#d99a68');
  ground.addColorStop(0.3, '#b07a5e');
  ground.addColorStop(0.6, '#4a3a4a');
  ground.addColorStop(1, '#221a30');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);

  // 3. High violet wisps with a warm underside lit from below.
  ctx.filter = 'blur(20px)';
  for (const wisp of HIGH_WISPS) {
    paintEllipse(ctx, wisp, 'rgba(146,116,166,0.20)');
  }
  ctx.filter = 'blur(24px)';
  ctx.globalCompositeOperation = 'lighter';
  for (const wisp of HIGH_WISPS) {
    paintEllipse(
      ctx,
      { x: wisp.x, y: wisp.y + 12, rx: wisp.rx * 0.8, ry: wisp.ry * 0.7 },
      'rgba(255,150,120,0.10)',
    );
  }
  ctx.globalCompositeOperation = 'source-over';

  // 4. Mid rose-grey streaks.
  ctx.filter = 'blur(12px)';
  for (const streak of MID_STREAKS) {
    paintEllipse(ctx, streak, 'rgba(120,84,116,0.28)');
  }
  ctx.filter = 'blur(14px)';
  ctx.globalCompositeOperation = 'lighter';
  for (const streak of MID_STREAKS) {
    paintEllipse(
      ctx,
      { x: streak.x, y: streak.y + 7, rx: streak.rx * 0.85, ry: streak.ry * 0.6 },
      'rgba(255,160,110,0.15)',
    );
  }
  ctx.globalCompositeOperation = 'source-over';

  // 5. Low stratus: golden near the sun, violet-grey silhouettes elsewhere.
  ctx.filter = 'blur(10px)';
  for (const cloud of COOL_STRATUS) {
    paintEllipse(ctx, cloud, 'rgba(130,86,110,0.30)');
  }
  ctx.filter = 'blur(9px)';
  for (const cloud of LOW_STRATUS) {
    paintEllipse(ctx, cloud, 'rgba(255,186,120,0.34)');
  }
  ctx.filter = 'none';

  // 6. Sun glow: three additive blooms plus a bright low disc.
  paintGlow(ctx, 560, 'rgba(255,140,84,0.30)', 'rgba(255,140,84,0.12)');
  paintGlow(ctx, 240, 'rgba(255,178,102,0.55)', 'rgba(255,178,102,0.20)');
  paintGlow(ctx, 120, 'rgba(255,214,150,0.90)', 'rgba(255,214,150,0.30)');
  const disc = ctx.createRadialGradient(SUN_X, SUN_Y, 0, SUN_X, SUN_Y, 24);
  disc.addColorStop(0, '#fff7e2');
  disc.addColorStop(0.55, 'rgba(255,226,168,0.95)');
  disc.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = disc;
  ctx.fillRect(SUN_X - 24, SUN_Y - 24, 48, 48);

  // 7. Broad horizon glow hugging the horizon line, strongest at the sun.
  const horizonGlow = ctx.createRadialGradient(SUN_X, HORIZON + 6, 0, SUN_X, HORIZON + 6, 1000);
  horizonGlow.addColorStop(0, 'rgba(255,166,96,0.40)');
  horizonGlow.addColorStop(0.5, 'rgba(255,150,90,0.16)');
  horizonGlow.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, HORIZON - 140, WIDTH, 300);
  ctx.globalCompositeOperation = 'source-over';

  // 8. Warm haze band: dissolves the distant ridges into the sky.
  const haze = ctx.createLinearGradient(0, 462, 0, 560);
  haze.addColorStop(0, 'rgba(246,178,118,0)');
  haze.addColorStop(0.5, 'rgba(246,178,118,0.32)');
  haze.addColorStop(1, 'rgba(246,178,118,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 462, WIDTH, 98);

  // 9. Faint volcano silhouettes behind the landscape rings.
  ctx.filter = 'blur(6px)';

  // Far low ridge between the two volcanoes.
  fillSilhouette(
    ctx,
    486,
    (context) => {
      context.moveTo(706, HORIZON);
      context.quadraticCurveTo(839, 486, 972, HORIZON);
    },
    'rgba(96,62,96,0.55)',
    'rgba(206,128,100,0.75)',
  );

  // Volcan 1: tall straight-sided cone.
  fillSilhouette(
    ctx,
    424,
    (context) => {
      context.moveTo(414, HORIZON);
      context.quadraticCurveTo(490, 486, 560, 424);
      context.quadraticCurveTo(630, 486, 706, HORIZON);
    },
    'rgba(88,54,90,0.60)',
    'rgba(198,122,98,0.80)',
  );

  // Volcan 2: broader massif with a flat crater notch at the apex.
  fillSilhouette(
    ctx,
    452,
    (context) => {
      context.moveTo(972, HORIZON);
      context.lineTo(1178, 452);
      context.lineTo(1218, 452);
      context.lineTo(1434, HORIZON);
    },
    'rgba(92,58,92,0.58)',
    'rgba(202,126,100,0.78)',
  );

  ctx.filter = 'none';

  // 10. Subtle grain: breaks up gradient banding after ACES tone mapping.
  const rng = mulberry32(0x5eed);
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const dither = (rng() - 0.5) * 4;
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + dither));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + dither));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + dither));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

/** Releases the GPU resources held by a sky texture. */
export function disposeSkyTexture(texture: THREE.CanvasTexture): void {
  texture.dispose();
}
