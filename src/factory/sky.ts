import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

/**
 * Real-sky system for the tour: an HDR equirectangular "puresky" capture
 * (Poly Haven, CC0 — golden hour with clouds, the look of the Tidewater
 * reference) used both as the scene background and as the image-based
 * lighting for every PBR material, plus a lens flare anchored to the real
 * sun position detected in the HDR.
 *
 * The sun direction is reported through `onSunDirection` so the lighting rig
 * (key light, shadows) aligns with the sky's actual sun.
 */

const HDRI_URL = '/assets/textures/golden_hour_puresky_4k.hdr'; // kloofendal 48d partly cloudy (Poly Haven, CC0) // industrial_sunset_puresky (Poly Haven, CC0)
const SUN_ANCHOR_DISTANCE = 1200;

/** Soft main glare for the lens flare. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for sun glare');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 252, 238, 1)');
  gradient.addColorStop(0.08, 'rgba(255, 240, 198, 0.9)');
  gradient.addColorStop(0.25, 'rgba(255, 205, 140, 0.32)');
  gradient.addColorStop(0.6, 'rgba(255, 180, 110, 0.07)');
  gradient.addColorStop(1, 'rgba(255, 180, 110, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Warm hexagonal lens ghost (like the hexagon artifacts in the reference). */
function makeHexTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for lens ghost');
  ctx.translate(size / 2, size / 2);
  ctx.shadowColor = 'rgba(255, 210, 150, 0.8)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * 42;
    const y = Math.sin(a) * 42;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 222, 170, 0.42)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 235, 195, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSkySystem(
  scene: THREE.Scene,
  onSunDirection: (dir: THREE.Vector3) => void,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'sky_system';
  scene.add(group);
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  let disposed = false;

  // Real sky: HDR equirectangular as background + IBL. The load is async; the
  // tour renders with the fallback background until the sky fades in.
  new RGBELoader()
    .setDataType(THREE.FloatType)
    .load(
      HDRI_URL,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;

        // Detect the sun: the brightest pixel of the upper hemisphere. The
        // sun in an HDR is orders of magnitude brighter than anything else.
        const image = texture.image as { data: Float32Array; width: number; height: number };
        const { data, width: W, height: H } = image;
        let bestLum = -1;
        let bestI = 0;
        let bestJ = 0;
        for (let j = 0; j < H / 2; j++) {
          for (let i = 0; i < W; i++) {
            const o = (j * W + i) * 4;
            const lum = data[o] * 0.2126 + data[o + 1] * 0.7152 + data[o + 2] * 0.0722;
            if (lum > bestLum) {
              bestLum = lum;
              bestI = i;
              bestJ = j;
            }
          }
        }
        const elev = Math.PI / 2 - ((bestJ + 0.5) / H) * Math.PI;
        const lon = ((bestI + 0.5) / W) * Math.PI * 2 - Math.PI;
        const sunDir = new THREE.Vector3(
          Math.cos(elev) * Math.cos(lon),
          Math.sin(elev),
          Math.cos(elev) * Math.sin(lon),
        ).normalize();
        console.log(
          '[factory] HDRI sun dir:',
          sunDir.toArray().map((n) => n.toFixed(3)).join(', '),
        );
        onSunDirection(sunDir);

        // Lens flare anchored to the real sun: main glare + hexagonal ghosts
        const glowTex = track(makeGlowTexture());
        const hexTex = track(makeHexTexture());
        const flare = new Lensflare();
        flare.addElement(
          new LensflareElement(glowTex, 520, 0, new THREE.Color(1, 0.93, 0.78)),
        );
        flare.addElement(new LensflareElement(hexTex, 70, 0.38, new THREE.Color(1, 0.82, 0.58)));
        flare.addElement(new LensflareElement(hexTex, 110, 0.55, new THREE.Color(1, 0.75, 0.5)));
        flare.addElement(new LensflareElement(hexTex, 65, 0.8, new THREE.Color(1, 0.85, 0.62)));
        flare.addElement(new LensflareElement(hexTex, 140, 1.05, new THREE.Color(1, 0.7, 0.45)));
        const anchor = new THREE.Object3D();
        anchor.position.copy(sunDir).multiplyScalar(SUN_ANCHOR_DISTANCE);
        anchor.add(flare);
        group.add(anchor);
      },
      undefined,
      (err) => console.warn('[factory] HDRI sky load failed:', err),
    );

  const dispose = (): void => {
    disposed = true;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    for (const item of disposables) item.dispose();
  };

  return { group, dispose };
}
