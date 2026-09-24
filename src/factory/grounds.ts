import * as THREE from 'three';
import { darkSteelMat, woodMat } from './materials';

/**
 * Site grounds for the Calzado Chapín tour: perimeter streets with curbs,
 * raised sidewalks, tactile strips, yellow center + white edge lines, zebra
 * crossings, concrete utility poles with catenary power lines, street lamps
 * (emissive heads + fake light pools) and a park ring — grass, walking paths,
 * benches and trees — filling the margins around the 93 m building.
 *
 * Streets take after classic stylized street scenes: raised sidewalks with a
 * yellow tactile band, solid yellow center line, white edge lines and power
 * lines sagging between concrete poles — all tuned to the dusk palette.
 *
 * Everything is procedural and instanced (trees, lamps, benches, poles render
 * in a handful of draw calls) and placement is deterministic (seeded PRNG).
 *
 * Layout uses the measured site: apron x -136..144 / z ±120 at y -0.015.
 * Ground decals are staggered in centimetres to avoid z-fighting (apron
 * -0.015 < grass 0.008 < streets 0.02 < paths 0.026 < lines 0.032).
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

  // Texturas PBR reales (Poly Haven, CC0) descargadas por
  // scripts/download_assets.mjs: asfalto, pasto, gravilla. Cada superficie
  // recibe su propio clon con repeat según su tamaño.
  const texLoader = new THREE.TextureLoader();

  /** Texturas enlosables (difusa SRGB + normal + rugosidad) por superficie. */
  const pbrMaterial = (base: string, rx: number, ry: number): THREE.MeshStandardMaterial => {
    const mk = (file: string, srgb: boolean) => {
      const t = track(texLoader.load(`/assets/textures/${file}`));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return track(
      new THREE.MeshStandardMaterial({
        map: mk(`${base}_diff_1k.jpg`, true),
        normalMap: mk(`${base}_nor_gl_1k.jpg`, false),
        roughnessMap: mk(`${base}_rough_1k.jpg`, false),
        roughness: 1,
        metalness: 0.02,
      }),
    );
  };

  const sidewalkMat = track(
    new THREE.MeshStandardMaterial({ color: 0xc9c4b9, roughness: 0.9 }),
  );
  const tactileMat = track(new THREE.MeshStandardMaterial({ color: 0xd9b13a, roughness: 0.8 }));
  const centerLineMat = track(new THREE.MeshStandardMaterial({ color: 0xd9a237, roughness: 0.85 }));
  const edgeLineMat = track(new THREE.MeshStandardMaterial({ color: 0xdad5c8, roughness: 0.9 }));

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

  // Perimeter streets + connectors (asphalt PBR over the concrete apron)
  groundPlane(240, 10, CENTER_X, 96, STREET_Y, pbrMaterial('asphalt_02', 80, 3.3));
  groundPlane(240, 10, CENTER_X, -96, STREET_Y, pbrMaterial('asphalt_02', 80, 3.3));
  groundPlane(10, 192, -110, -5, STREET_Y, pbrMaterial('asphalt_02', 3.3, 64));
  groundPlane(10, 192, 118, -5, STREET_Y, pbrMaterial('asphalt_02', 3.3, 64));
  groundPlane(10, 43, -71, 69.5, STREET_Y, pbrMaterial('asphalt_02', 3.3, 14.3));
  groundPlane(10, 43, 79, 69.5, STREET_Y, pbrMaterial('asphalt_02', 3.3, 14.3));
  groundPlane(10, 71, CENTER_X, -55.5, STREET_Y, pbrMaterial('asphalt_02', 3.3, 23.7));

  // Raised sidewalks (curb included in the slab) along every street
  const sidewalk = (len: number, x: number, z: number, alongZ: boolean): void => {
    const geo = track(
      alongZ ? new THREE.BoxGeometry(1.4, 0.14, len) : new THREE.BoxGeometry(len, 0.14, 1.4),
    );
    const mesh = new THREE.Mesh(geo, sidewalkMat);
    mesh.position.set(x, 0.07, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const tactile = (len: number, x: number, z: number, alongZ: boolean): void => {
    const geo = track(
      alongZ ? new THREE.BoxGeometry(0.26, 0.02, len) : new THREE.BoxGeometry(len, 0.02, 0.26),
    );
    const mesh = new THREE.Mesh(geo, tactileMat);
    mesh.position.set(x, 0.15, z);
    group.add(mesh);
  };

  // South street sidewalks (inner faces the park, outer the verge)
  sidewalk(238, CENTER_X, 90.3, false);
  tactile(236, CENTER_X, 90.875, false);
  sidewalk(238, CENTER_X, 101.7, false);
  tactile(236, CENTER_X, 101.125, false);
  // North street sidewalks
  sidewalk(238, CENTER_X, -90.3, false);
  tactile(236, CENTER_X, -90.875, false);
  sidewalk(238, CENTER_X, -102.2, false);
  tactile(236, CENTER_X, -101.625, false);
  // West + east street sidewalks
  sidewalk(190, -104.3, -5, true);
  tactile(188, -104.875, -5, true);
  sidewalk(190, -115.7, -5, true);
  tactile(188, -115.125, -5, true);
  sidewalk(190, 112.3, -5, true);
  tactile(188, 112.875, -5, true);
  sidewalk(190, 123.7, -5, true);
  tactile(188, 123.125, -5, true);

  // Solid yellow center line + white edge lines on every street.
  // `length` always runs along the street; rotY 0 = street along X.
  const centerLine = (length: number, x: number, z: number, rotY: number): void => {
    const geo = track(new THREE.PlaneGeometry(length, 0.25));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, centerLineMat);
    mesh.position.set(x, LINE_Y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  };
  const edgeLine = (length: number, x: number, z: number, rotY: number): void => {
    const geo = track(new THREE.PlaneGeometry(length, 0.15));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, edgeLineMat);
    mesh.position.set(x, LINE_Y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  };
  centerLine(236, CENTER_X, 96, 0);
  edgeLine(236, CENTER_X, 91.4, 0);
  edgeLine(236, CENTER_X, 100.6, 0);
  centerLine(236, CENTER_X, -96, 0);
  edgeLine(236, CENTER_X, -100.6, 0);
  edgeLine(236, CENTER_X, -91.4, 0);
  centerLine(188, -110, -5, Math.PI / 2);
  edgeLine(188, -114.6, -5, Math.PI / 2);
  edgeLine(188, -105.4, -5, Math.PI / 2);
  centerLine(188, 118, -5, Math.PI / 2);
  edgeLine(188, 113.4, -5, Math.PI / 2);
  edgeLine(188, 122.6, -5, Math.PI / 2);

  // Zebra crossings where the connectors meet the south street
  for (const cx of [-71, 79]) {
    for (let s = -2; s <= 2; s++) {
      groundPlane(0.5, 8.4, cx + s * 1.05, 96, LINE_Y + 0.002, edgeLineMat);
    }
  }

  // Grass: park + verge strips (disjoint rectangles tiling the apron margins)
  const grassPatch = (w: number, d: number, x: number, z: number): void => {
    // Tinte verde sobre la textura seca para leer como prado natural
    const mat = pbrMaterial('aerial_grass_rock', w / 2.2, d / 2.2);
    mat.color.set(0x9cb56e);
    groundPlane(w, d, x, z, GRASS_Y, mat);
  };
  grassPatch(216, 38, CENTER_X, 71); // south park
  grassPatch(240, 19, CENTER_X, 110); // south verge
  grassPatch(216, 67, CENTER_X, -55.5); // north lawn
  grassPatch(240, 19, CENTER_X, -110); // north verge
  grassPatch(20, 240, -126, 0); // west verge
  grassPatch(20, 240, 134, 0); // east verge

  // Walking paths through the green areas (gravel)
  groundPlane(200, 2.6, CENTER_X, 70, PATH_Y, pbrMaterial('gravel', 66, 0.9));
  groundPlane(200, 2.6, CENTER_X, -26, PATH_Y, pbrMaterial('gravel', 66, 0.9));

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

  /* --------------------------------------------- concrete utility poles */

  // Power poles along the inner sidewalks of the two main streets, staggered
  // between the street lamps, with 3 sagging wires per span.
  const powerXs: number[] = [];
  for (let x = -87; x <= 95; x += 26) powerXs.push(x);
  const poleRows: Array<{ z: number; y: number }> = [
    { z: 90.3, y: 0.14 },
    { z: -90.3, y: 0.14 },
  ];
  const utilityGeo = track(new THREE.CylinderGeometry(0.13, 0.19, 7.2, 10));
  const crossGeo = track(new THREE.BoxGeometry(0.09, 0.09, 1.5));
  const utilityMat = track(
    new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.85 }),
  );
  const utilityCount = powerXs.length * poleRows.length;
  const utilityInst = new THREE.InstancedMesh(utilityGeo, utilityMat, utilityCount);
  const crossInst = new THREE.InstancedMesh(crossGeo, utilityMat, utilityCount * 2);
  utilityInst.castShadow = true;
  let u = 0;
  for (const row of poleRows) {
    for (const px of powerXs) {
      quat.setFromEuler(euler.set(0, 0, 0));
      pos.set(px, 3.6 + row.y, row.z);
      scl.set(1, 1, 1);
      m4.compose(pos, quat, scl);
      utilityInst.setMatrixAt(u, m4);
      for (let c = 0; c < 2; c++) {
        pos.set(px, 6.55 + c * 0.55 + row.y, row.z);
        m4.compose(pos, quat, scl);
        crossInst.setMatrixAt(u * 2 + c, m4);
      }
      u += 1;
    }
  }
  utilityInst.castShadow = true;
  crossInst.castShadow = true;
  group.add(utilityInst, crossInst);

  // Catenary wires: 3 per span, sagging 0.55 m at midspan, as one LineSegments
  // per street so the whole grid costs two draw calls.
  const wireMat = track(new THREE.LineBasicMaterial({ color: 0x15171b }));
  const wireHeights = [6.5, 6.9, 7.15];
  const wireOffsets = [-0.55, 0, 0.55];
  for (const row of poleRows) {
    const points: number[] = [];
    for (let s = 0; s < powerXs.length - 1; s++) {
      const x0 = powerXs[s];
      const x1 = powerXs[s + 1];
      for (const h of wireHeights) {
        for (const off of wireOffsets) {
          const a = new THREE.Vector3(x0, h + row.y, row.z + off);
          const b = new THREE.Vector3(x1, h + row.y, row.z + off);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          mid.y -= 0.55;
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          const samples = curve.getPoints(10);
          for (let i = 0; i < samples.length - 1; i++) {
            points.push(samples[i].x, samples[i].y, samples[i].z);
            points.push(samples[i + 1].x, samples[i + 1].y, samples[i + 1].z);
          }
        }
      }
    }
    const wireGeo = track(new THREE.BufferGeometry());
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(wireGeo, wireMat));
  }

  /* ------------------------------------------------------ street signs */

  const signPostGeo = track(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8));
  const signBoardGeo = track(new THREE.BoxGeometry(1.15, 0.32, 0.05));
  const signMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e5aa8, roughness: 0.6 }),
  );
  for (const sx of [-104, 112]) {
    const post = new THREE.Mesh(signPostGeo, darkSteelMat);
    post.position.set(sx, 1.3, 89.6);
    post.castShadow = true;
    const board = new THREE.Mesh(signBoardGeo, signMat);
    board.position.set(sx, 2.5, 89.6);
    board.castShadow = true;
    group.add(post, board);
  }

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
