import * as THREE from 'three';

/**
 * Procedural Guatemalan sky for the Calzado Chapín virtual tour.
 *
 * The 2048 x 1024 canvas is a 2:1 equirectangular map painted entirely at
 * runtime: an azure-to-pale vertical gradient, a warm sun glow, a sparse cloud
 * band, a horizon haze band and a set of hazy volcano silhouettes drawn with
 * their bases sitting exactly on the horizon line (y = 512).
 *
 * The texture doubles as the scene background and, through `PMREMGenerator`,
 * as the image-based lighting environment.
 */

const WIDTH = 2048;
const HEIGHT = 1024;
const HORIZON = HEIGHT / 2;

/** Deterministic sun position in canvas pixels: 0.62 width, 0.40 height. */
const SUN_X = 0.62 * WIDTH;
const SUN_Y = 0.4 * HEIGHT;

/** Sparse, fixed cloud placement so the band is stable across reloads. */
const CLOUDS: ReadonlyArray<{
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}> = [
  { x: 180, y: 360, radiusX: 150, radiusY: 26 },
  { x: 470, y: 330, radiusX: 120, radiusY: 20 },
  { x: 760, y: 400, radiusX: 170, radiusY: 30 },
  { x: 1080, y: 345, radiusX: 140, radiusY: 24 },
  { x: 1420, y: 420, radiusX: 190, radiusY: 34 },
  { x: 1780, y: 370, radiusX: 160, radiusY: 28 },
];

/**
 * Paints a cone or mound silhouette and fills it with a vertical apex-to-base
 * haze gradient. The caller controls the path.
 */
function fillSilhouette(
  ctx: CanvasRenderingContext2D,
  apexY: number,
  buildPath: (context: CanvasRenderingContext2D) => void,
  topColor = '#4F6B85',
  bottomColor = '#8FA6B8',
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

/** Creates the equirectangular sky texture used as background and IBL source. */
export function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for sky');

  // 1. Sky gradient: deep azure zenith to pale horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0.0, '#17539C');
  sky.addColorStop(0.42, '#3B82C4');
  sky.addColorStop(0.72, '#7FB2D9');
  sky.addColorStop(1.0, '#C3D8EA');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Nadir / lower half: ground haze, rarely seen thanks to maxPolarAngle.
  const ground = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT);
  ground.addColorStop(0, '#CFE0EE');
  ground.addColorStop(1, '#8FA0AE');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);

  // 3. Sun glow: additive warm bloom centred above the horizon.
  const sun = ctx.createRadialGradient(SUN_X, SUN_Y, 0, SUN_X, SUN_Y, 240);
  sun.addColorStop(0, 'rgba(255,246,224,0.40)');
  sun.addColorStop(0.45, 'rgba(255,246,224,0.12)');
  sun.addColorStop(1, 'rgba(255,246,224,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = sun;
  ctx.fillRect(SUN_X - 240, SUN_Y - 240, 480, 480);
  ctx.globalCompositeOperation = 'source-over';

  // 4. Thin cloud band: soft blurred ellipses between the zenith and horizon.
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (const cloud of CLOUDS) {
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.radiusX, cloud.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';

  // 5. Horizon haze band: dissolves distant geometry into the sky.
  const haze = ctx.createLinearGradient(0, 470, 0, 556);
  haze.addColorStop(0, 'rgba(226,235,242,0)');
  haze.addColorStop(0.5, 'rgba(226,235,242,0.38)');
  haze.addColorStop(1, 'rgba(226,235,242,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 470, WIDTH, 86);

  // 6. Volcano silhouettes, all bases sitting exactly on the horizon.
  ctx.filter = 'blur(6px)';

  // Faint far ridge behind Volcan 1.
  ctx.beginPath();
  ctx.moveTo(300, HORIZON);
  ctx.quadraticCurveTo(365, 470, 430, HORIZON);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160,178,193,0.75)';
  ctx.fill();

  // Far low ridge between the two volcanoes.
  fillSilhouette(ctx, 486, (context) => {
    context.moveTo(706, HORIZON);
    context.quadraticCurveTo(839, 486, 972, HORIZON);
  });

  // Volcan 1: tall straight-sided cone.
  fillSilhouette(ctx, 424, (context) => {
    context.moveTo(414, HORIZON);
    context.quadraticCurveTo(490, 486, 560, 424);
    context.quadraticCurveTo(630, 486, 706, HORIZON);
  });

  // Volcan 2: broader massif with a 40 px flat crater notch at the apex.
  fillSilhouette(ctx, 452, (context) => {
    context.moveTo(972, HORIZON);
    context.lineTo(1178, 452);
    context.lineTo(1218, 452);
    context.lineTo(1434, HORIZON);
  });

  ctx.filter = 'none';

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
