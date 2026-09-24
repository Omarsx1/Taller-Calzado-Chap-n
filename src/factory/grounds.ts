import * as THREE from 'three';
import { darkSteelMat, woodMat } from './materials';

/**
 * Site grounds for the Calzado Chapín tour: perimeter streets with dashed
 * center lines, street lamps (emissive heads + fake light pools) and a park
 * ring — grass, walking paths, benches and trees — that fills the empty
 * concrete margins around the 93 m building.
 *
 * Everything is procedural and instanced: trees, lamps and benches render in
 * a handful of draw calls, and placement is deterministic (seeded PRNG) so
 * the site is stable across reloads.
 *
 * Layout uses the measured site: apron x -136..144 / z ±120 at y -0.015.
 * All ground decals are staggered in centimetres above it to avoid z-fighting
 * (apron -0.015 < grass 0.008 < streets 0.02 < paths 0.026 < lines 0.032).
 */

const CENTER_X = 3.8;
const GRASS_Y = 0.008;
const STREET_Y = 0.02;
const PATH_Y = 0.026;
const LINE_Y = 0.032;
const POOL_Y = 0.03;

/** mulberry32: tiny deterministic PRNG for stable placement jitter. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mown-grass texture: green base with speckle noise. */
function makeGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for grass');
  ctx.fillStyle = '#4d5e33';
  ctx.fillRect(0, 0, 256, 256);
  const rng = mulberry32(0x6ea5);
  for (let i = 0; i < 5200; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const l = 0.24 + rng() * 0.22;
    ctx.fillStyle = `hsl(${78 + rng() * 22}, ${26 + rng() * 16}%, ${l * 100}%)`;
    ctx.fillRect(x, y, 1.6, 2.6);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Dashed center-line texture for the streets (one dash per tile). */
function makeDashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for dashes');
  ctx.clearRect(0, 0, 32, 128);
  ctx.fillStyle = 'rgba(233, 226, 210, 0.85)';
  ctx.fillRect(8, 10, 16, 62);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Warm radial pool of lamp light on the ground. */
function makePoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for light pool');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255, 205, 130, 0.55)');
  gradient.addColorStop(0.55, 'rgba(255, 190, 120, 0.22)');
  gradient.addColorStop(1, 'rgba(255, 180, 110, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface LampSpot {
  x: number;
  z: number;
  rot: number;
}

export function createGrounds(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'grounds';
  const rng = mulberry32(20260924);
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  /* ------------------------------------------------------------ surfaces */

  const asphaltMat = track(
    new THREE.MeshStandardMaterial({ color: 0x24282f, roughness: 0.95, metalness: 0.02 }),
  );
  const walkMat = track(new THREE.MeshStandardMaterial({ color: 0xb3a48d, roughness: 1 }));

  const groundPlane = (
    w: number,
    d: number,
    x: number,
    z: number,
    y: number,
    material: THREE.Material,
  ): THREE.Mesh => {
    const geo = track(new THREE.PlaneGeometry(w, d));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Perimeter streets + connectors (asphalt over the concrete apron)
  groundPlane(240, 10, CENTER_X, 96, STREET_Y, asphaltMat);
  groundPlane(240, 10, CENTER_X, -96, STREET_Y, asphaltMat);
  groundPlane(10, 192, -110, -5, STREET_Y, asphaltMat);
  groundPlane(10, 192, 118, -5, STREET_Y, asphaltMat);
  groundPlane(10, 43, -71, 69.5, STREET_Y, asphaltMat);
  groundPlane(10, 43, 79, 69.5, STREET_Y, asphaltMat);
  groundPlane(10, 71, CENTER_X, -55.5, STREET_Y, asphaltMat);

  // Dashed center lines (dash texture repeats along the street length)
  const dashTex = track(makeDashTexture());
  const dashMat = track(
    new THREE.MeshStandardMaterial({
      map: dashTex,
      transparent: true,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const dashLine = (length: number, x: number, z: number, rotY: number): void => {
    dashTex.repeat.set(1, length / 6);
    const geo = track(new THREE.PlaneGeometry(0.3, length));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, dashMat);
    mesh.position.set(x, LINE_Y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  };
  dashLine(236, CENTER_X, 96, 0);
  dashLine(236, CENTER_X, -96, 0);
  dashLine(188, -110, -5, Math.PI / 2);
  dashLine(188, 118, -5, Math.PI / 2);

  // Grass: park + verge strips (disjoint rectangles tiling the apron margins)
  const grassTex = track(makeGrassTexture());
  const grassPatch = (w: number, d: number, x: number, z: number): void => {
    const tex = grassTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / 7, d / 7);
    track(tex);
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    groundPlane(w, d, x, z, GRASS_Y, mat);
  };
  grassPatch(216, 38, CENTER_X, 71); // south park
  grassPatch(240, 19, CENTER_X, 110); // south verge
  grassPatch(216, 67, CENTER_X, -55.5); // north lawn
  grassPatch(240, 19, CENTER_X, -110); // north verge
  grassPatch(20, 240, -126, 0); // west verge
  grassPatch(20, 240, 134, 0); // east verge

  // Walking paths through the green areas
  groundPlane(200, 2.6, CENTER_X, 70, PATH_Y, walkMat);
  groundPlane(200, 2.6, CENTER_X, -26, PATH_Y, walkMat);

  /* --------------------------------------------------------------- trees */

  const treePts: Array<[number, number]> = [];
  for (let x = -96; x <= 104; x += 16) treePts.push([x, 61]);
  for (let x = -88; x <= 112; x += 16) treePts.push([x, 80]);
  for (let x = -96; x <= 104; x += 16) if (Math.abs(x - CENTER_X) > 7) treePts.push([x, -32]);
  for (let x = -88; x <= 96; x += 24) if (Math.abs(x - CENTER_X) > 7) treePts.push([x, -48]);
  for (let z = -80; z <= 80; z += 23) treePts.push([-126, z]);
  for (let z = -80; z <= 80; z += 23) treePts.push([134, z]);

  const trunkGeo = track(new THREE.CylinderGeometry(0.13, 0.2, 2.6, 6));
  const blobGeo = track(new THREE.IcosahedronGeometry(1.5, 1));
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: 1 }));
  const leafMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePts.length);
  const blobLow = new THREE.InstancedMesh(blobGeo, leafMat, treePts.length);
  const blobTop = new THREE.InstancedMesh(blobGeo, leafMat, treePts.length);
  trunks.castShadow = true;
  blobLow.castShadow = true;
  blobTop.castShadow = true;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  treePts.forEach(([x, z], i) => {
    const k = 0.85 + rng() * 0.45;
    euler.set(0, rng() * Math.PI * 2, 0);
    quat.setFromEuler(euler);
    pos.set(x, 1.3 * k, z);
    scl.set(k, k, k);
    m4.compose(pos, quat, scl);
    trunks.setMatrixAt(i, m4);
    pos.set(x + (rng() - 0.5) * 0.4, 2.95 * k, z + (rng() - 0.5) * 0.4);
    m4.compose(pos, quat, scl);
    blobLow.setMatrixAt(i, m4);
    blobLow.setColorAt(i, col.setHSL(0.24 + rng() * 0.05, 0.3, 0.2 + rng() * 0.06));
    pos.set(x + (rng() - 0.5) * 0.7, 3.95 * k, z + (rng() - 0.5) * 0.7);
    m4.compose(pos, quat, scl);
    blobTop.setMatrixAt(i, m4);
    blobTop.setColorAt(i, col.setHSL(0.23 + rng() * 0.05, 0.28, 0.18 + rng() * 0.06));
  });
  group.add(trunks, blobLow, blobTop);

  /* ----------------------------------------------------------- benches */

  const benchPts: Array<[number, number, number]> = [];
  for (let x = -84; x <= 96; x += 36) benchPts.push([x, 74.4, Math.PI]);
  for (let x = -66; x <= 78; x += 36) benchPts.push([x, -30, 0]);

  const seatGeo = track(new THREE.BoxGeometry(1.7, 0.05, 0.42));
  const backGeo = track(new THREE.BoxGeometry(1.7, 0.4, 0.05));
  const legGeo = track(new THREE.BoxGeometry(0.06, 0.46, 0.4));
  const seats = new THREE.InstancedMesh(seatGeo, woodMat, benchPts.length);
  const backs = new THREE.InstancedMesh(backGeo, woodMat, benchPts.length);
  const legs = new THREE.InstancedMesh(legGeo, darkSteelMat, benchPts.length * 2);
  seats.castShadow = true;
  backs.castShadow = true;
  legs.castShadow = true;
  benchPts.forEach(([x, z, rot], i) => {
    quat.setFromEuler(euler.set(0, rot, 0));
    pos.set(x, 0.46, z);
    scl.set(1, 1, 1);
    m4.compose(pos, quat, scl);
    seats.setMatrixAt(i, m4);
    pos.set(x, 0.76, z);
    quat.setFromEuler(euler.set(0, rot, -0.14));
    m4.compose(pos, quat, scl);
    backs.setMatrixAt(i, m4);
    for (let l = 0; l < 2; l++) {
      const side = l === 0 ? -0.72 : 0.72;
      const ox = Math.cos(rot) * side;
      const oz = -Math.sin(rot) * side;
      quat.setFromEuler(euler.set(0, rot, 0));
      pos.set(x + ox, 0.23, z + oz);
      m4.compose(pos, quat, scl);
      legs.setMatrixAt(i * 2 + l, m4);
    }
  });
  group.add(seats, backs, legs);

  /* ------------------------------------------------------- street lamps */

  const lampPts: LampSpot[] = [];
  for (let x = -100; x <= 108; x += 26) lampPts.push({ x, z: 90.5, rot: 0 });
  for (let x = -87; x <= 95; x += 26) lampPts.push({ x, z: 101.5, rot: Math.PI });
  for (let x = -100; x <= 108; x += 26) lampPts.push({ x, z: -90.5, rot: Math.PI });
  for (let x = -87; x <= 95; x += 26) lampPts.push({ x, z: -101.5, rot: 0 });
  for (let z = -84; z <= 84; z += 24) lampPts.push({ x: 123.5, z, rot: -Math.PI / 2 });
  for (let z = -84; z <= 84; z += 24) lampPts.push({ x: -115.5, z, rot: Math.PI / 2 });
  lampPts.push(
    { x: -60, z: 20, rot: Math.PI / 2 },
    { x: 68, z: 20, rot: -Math.PI / 2 },
    { x: -60, z: 44, rot: Math.PI / 2 },
    { x: 68, z: 44, rot: -Math.PI / 2 },
  );

  const poleGeo = track(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8));
  const armGeo = track(new THREE.BoxGeometry(0.07, 0.07, 1.2));
  const headGeo = track(new THREE.BoxGeometry(0.52, 0.13, 0.24));
  const poolGeo = track(new THREE.CircleGeometry(3.4, 20));
  poolGeo.rotateX(-Math.PI / 2);
  const poleMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.55, metalness: 0.55 }),
  );
  const headMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x333840,
      emissive: 0xffd9a0,
      emissiveIntensity: 2.4,
    }),
  );
  const poolTex = track(makePoolTexture());
  const poolMat = track(
    new THREE.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.5,
    }),
  );

  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPts.length);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, lampPts.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPts.length);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampPts.length);
  lampPts.forEach(({ x, z, rot }, i) => {
    quat.setFromEuler(euler.set(0, rot, 0));
    pos.set(x, 2.7, z);
    scl.set(1, 1, 1);
    m4.compose(pos, quat, scl);
    poles.setMatrixAt(i, m4);
    const ox = Math.sin(rot) * 0.45;
    const oz = Math.cos(rot) * 0.45;
    pos.set(x + ox, 5.3, z + oz);
    m4.compose(pos, quat, scl);
    arms.setMatrixAt(i, m4);
    pos.set(x + Math.sin(rot) * 0.95, 5.24, z + Math.cos(rot) * 0.95);
    m4.compose(pos, quat, scl);
    heads.setMatrixAt(i, m4);
    pos.set(x + Math.sin(rot) * 0.95, POOL_Y, z + Math.cos(rot) * 0.95);
    m4.compose(pos, quat, scl);
    pools.setMatrixAt(i, m4);
  });
  poles.castShadow = true;
  group.add(poles, arms, heads, pools);

  /* ------------------------------------------------------------- teardown */

  const dispose = (): void => {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    for (const item of disposables) item.dispose();
  };

  return { group, dispose };
}
