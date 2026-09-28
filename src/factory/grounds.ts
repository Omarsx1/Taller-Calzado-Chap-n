import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { darkSteelMat } from './materials';

/**
 * Site grounds for the Calzado Chapín tour: perimeter streets with curbs,
 * raised sidewalks, tactile strips, yellow center + white edge lines, zebra
 * crossings, concrete utility poles with catenary power lines, street lamps
 * (lamp.glb GLB streetlights + fake light pools) and a park ring — grass,
 * walking paths, benches and trees — filling the margins around the 93 m building.
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

  // Grass: park + verge strips (disjoint rectangles tiling the apron margins).
  // Textura procedural multi-tono y seamless — sin franjas ni parches grises.
  const makeGrassTexture = (rx: number, ry: number): THREE.CanvasTexture => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[factory] 2D canvas context unavailable for grass');
    ctx.fillStyle = '#4f6034';
    ctx.fillRect(0, 0, size, size);
    const grng = mulberry32(0x6ea5);
    for (let i = 0; i < 6200; i++) {
      const x = grng() * size;
      const y = grng() * size;
      const l = 0.22 + grng() * 0.24;
      ctx.fillStyle = `hsl(${76 + grng() * 24}, ${28 + grng() * 18}%, ${l * 100}%)`;
      ctx.fillRect(x, y, 1.7, 2.8);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    return tex;
  };
  const grassPatch = (w: number, d: number, x: number, z: number): void => {
    groundPlane(w, d, x, z, GRASS_Y, track(
      new THREE.MeshStandardMaterial({ map: track(makeGrassTexture(w / 2.5, d / 2.5)), roughness: 1 }),
    ));
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

  // Árboles reales: arbol_1_lod.glb (decimado con meshoptimizer a ~77K
  // triángulos) instanciado por partes — cada malla del modelo comparte
  // geometría y material entre los 61 árboles (unos 17 draw calls en total).
  let disposed = false;
  const treeM = new THREE.Matrix4();
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  const treePts: Array<[number, number]> = [];
  for (let x = -96; x <= 104; x += 16) treePts.push([x, 61]);
  for (let x = -88; x <= 112; x += 16) treePts.push([x, 80]);
  for (let x = -96; x <= 104; x += 16) if (Math.abs(x - CENTER_X) > 7) treePts.push([x, -32]);
  for (let x = -88; x <= 96; x += 24) if (Math.abs(x - CENTER_X) > 7) treePts.push([x, -48]);
  for (let z = -80; z <= 80; z += 23) treePts.push([-126, z]);
  for (let z = -80; z <= 80; z += 23) treePts.push([134, z]);

  const treeLoader = new GLTFLoader();
  const treeAnchor = new THREE.Group();
  treeAnchor.name = 'arboles';
  group.add(treeAnchor);
  treeLoader.load('/assets/3d/arbol_1_lod.glb', (gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bbox0 = new THREE.Box3().setFromObject(model);
    const size0 = new THREE.Vector3();
    bbox0.getSize(size0);
    const baseScale = 7.5 / (size0.y || 1); // altura objetivo ~7.5 m
    const baseY = -bbox0.min.y; // base del tronco (unidades nativas)

    const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4 }> = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        parts.push({ geo: m.geometry, mat: m.material as THREE.Material, local: m.matrixWorld.clone() });
      }
    });

    const instanced = parts.map((part) => {
      const inst = new THREE.InstancedMesh(part.geo, part.mat, treePts.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      treeAnchor.add(inst);
      track(part.geo);
      track(part.mat);
      return inst;
    });

    treePts.forEach(([x, z], i) => {
      const k = 0.85 + rng() * 0.45;
      quat.setFromEuler(euler.set(0, rng() * Math.PI * 2, 0));
      pos.set(x, baseY * baseScale * k, z);
      scl.set(baseScale * k, baseScale * k, baseScale * k);
      treeM.compose(pos, quat, scl);
      parts.forEach((part, p) => {
        m4.multiplyMatrices(treeM, part.local);
        instanced[p].setMatrixAt(i, m4);
      });
    });
  }, undefined, () => console.warn('[factory] arbol_1_lod.glb no cargó'));

  /* ----------------------------------------------------------- benches */

  // Bancas reales de parque (banco.glb) instanciadas a lo largo de los senderos
  const benchPts: Array<[number, number, number]> = [];
  // Sendero sur del parque (z = 70.0)
  for (let x = -88; x <= 96; x += 28) benchPts.push([x, 73.6, Math.PI / 2]); // Mirando al norte
  for (let x = -74; x <= 82; x += 28) benchPts.push([x, 66.4, -Math.PI / 2]); // Mirando al sur

  // Sendero norte (z = -26.0)
  for (let x = -72; x <= 78; x += 30) benchPts.push([x, -29.6, -Math.PI / 2]); // Mirando al sur
  for (let x = -56; x <= 62; x += 30) benchPts.push([x, -22.4, Math.PI / 2]); // Mirando al norte

  // Plazas laterales
  benchPts.push([-22, 17.0, Math.PI / 2]);
  benchPts.push([22, 17.0, -Math.PI / 2]);

  const benchLoader = new GLTFLoader();
  const benchAnchor = new THREE.Group();
  benchAnchor.name = 'instanced_park_benches';
  group.add(benchAnchor);

  benchLoader.load(
    '/banco.glb',
    (gltf) => {
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);

      const meshes: THREE.Mesh[] = [];
      const fullBb = new THREE.Box3();

      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.name !== 'Object_8' && m.geometry) {
          meshes.push(m);
          const bb = new THREE.Box3().setFromObject(m);
          fullBb.union(bb);
        }
      });

      const size = new THREE.Vector3();
      fullBb.getSize(size);
      const center = new THREE.Vector3();
      fullBb.getCenter(center);
      const s = 1.9 / Math.max(size.z, size.x);

      meshes.forEach((m) => {
        const geo = track(m.geometry.clone().applyMatrix4(m.matrixWorld));
        geo.translate(-center.x, -fullBb.min.y, -center.z);
        geo.scale(s, s, s);

        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
        track(mat);
        const inst = new THREE.InstancedMesh(geo, mat, benchPts.length);
        inst.castShadow = true;
        inst.receiveShadow = true;

        benchPts.forEach(([x, z, rot], i) => {
          quat.setFromEuler(euler.set(0, rot, 0));
          pos.set(x, 0, z);
          scl.set(1, 1, 1);
          m4.compose(pos, quat, scl);
          inst.setMatrixAt(i, m4);
        });
        inst.instanceMatrix.needsUpdate = true;
        benchAnchor.add(inst);
      });
    },
    undefined,
    () => console.warn('[factory] banco.glb no cargó'),
  );

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

  const poolGeo = track(new THREE.CircleGeometry(3.4, 20));
  poolGeo.rotateX(-Math.PI / 2);
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
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampPts.length);

  // Farolas reales (lamp.glb — poste tipo Medellín, 4.29 m nativos): una
  // InstancedMesh por material del modelo. El GLB tiene el eje del poste
  // desplazado del origen y cuelga a 0.37 del suelo (medido con
  // .artifacts/probe_lamp.mjs), así que se recentra antes de instanciar.
  // El brazo nativo apunta a ≈(+x, -z): LAMP_YAW0 lo lleva a +Z para que `rot`
  // siga orientando el brazo hacia la calle como antes.
  const LAMP_H = 5.4; // alto objetivo, equivalente al poste procedural
  const LAMP_YAW0 = Math.PI + Math.atan2(0.44, 0.31); // arm (+0.44,-0.31) -> +Z
  const lampLoader = new GLTFLoader();
  lampLoader.load('/lamp.glb', (gltf) => {
    if (disposed) return;
    gltf.scene.updateMatrixWorld(true);
    const byMat = new Map<string, { geos: THREE.BufferGeometry[]; mat: THREE.Material }>();
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      // El export trae emissiveFactor [1,1,1] sin mapa: brillaría entero. Apagado.
      if (mat?.emissive) mat.emissiveIntensity = 0;
      const key = mat?.name || 'lamp';
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const entry = byMat.get(key) ?? { geos: [], mat };
      entry.geos.push(geo);
      byMat.set(key, entry);
    });
    const bb = new THREE.Box3().setFromObject(gltf.scene);
    const k = LAMP_H / (bb.max.y - bb.min.y || 1);
    for (const { geos, mat } of byMat.values()) {
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      merged.translate(-2.472, -bb.min.y, -0.768); // eje del poste al origen, base a y=0
      track(merged);
      track(mat);
      const inst = new THREE.InstancedMesh(merged, mat, lampPts.length);
      inst.castShadow = true;
      lampPts.forEach(({ x, z, rot }, i) => {
        quat.setFromEuler(euler.set(0, rot + LAMP_YAW0, 0));
        m4.compose(pos.set(x, 0, z), quat, scl.set(k, k, k));
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }
    // Pools de luz bajo el brazo de cada farola
    lampPts.forEach(({ x, z, rot }, i) => {
      quat.setFromEuler(euler.set(0, 0, 0));
      m4.compose(
        pos.set(x + Math.sin(rot) * 0.95, POOL_Y, z + Math.cos(rot) * 0.95),
        quat,
        scl.set(1, 1, 1),
      );
      pools.setMatrixAt(i, m4);
    });
    pools.instanceMatrix.needsUpdate = true;
  }, undefined, () => console.warn('[factory] lamp.glb no cargó'));
  group.add(pools);

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
    disposed = true;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    for (const item of disposables) item.dispose();
  };

  return { group, dispose };
}
