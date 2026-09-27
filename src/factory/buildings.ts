import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSignboardTexture } from './proceduralTextures';

/**
 * Support buildings attached to the sides of the main plant (white clean-tech
 * style): "Bodega" (18 x 24 m warehouse annexed to the west end), "Oficina de
 * Gerencia" (glass-walled office with furnished interior, annexed to the east
 * end) and "Sanitarios" (small block by the loading apron).
 *
 * Positions use the measured site: main building x -42.68..50.33 / z ±15.77.
 */

const WALL_WHITE = 0xf6f4ef;
const ROOF_DARK = 0x2f343b;
const DOOR_DARK = 0x3a4048;

export function createSupportBuildings(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'support_buildings';
  let disposed = false;
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const wallMat = track(new THREE.MeshStandardMaterial({ color: WALL_WHITE, roughness: 0.85 }));
  const roofMat = track(
    new THREE.MeshStandardMaterial({ color: ROOF_DARK, roughness: 0.7, metalness: 0.3 }),
  );
  const doorMat = track(
    new THREE.MeshStandardMaterial({ color: DOOR_DARK, roughness: 0.6, metalness: 0.3 }),
  );
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const sign = (
    title: string,
    subtitle: string,
    accent: string,
    w: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    const tex = track(createSignboardTexture(title, subtitle, accent));
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    box(w, (w * 256) / 512, 0.08, x, y, z, mat);
  };

  /* ---------------------------------------- 1. Bodega (costado oeste) */

  // Nave anexa al costado oeste del taller: 18 x 24 m, muros 6 m, cumbrera
  // 8.2 m, dos puertas andenizadoras hacia el sur (franja peatonal)
  box(18, 6, 24, -51.7, 3, 0, wallMat);

  const panelGeo = track(new THREE.BoxGeometry(18.6, 0.12, 12.7));
  for (const [z, rot] of [
    [6.1, 0.1815],
    [-6.1, -0.1815],
  ] as const) {
    const panel = new THREE.Mesh(panelGeo, roofMat);
    panel.position.set(-51.7, 7.1, z);
    panel.rotation.x = rot;
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);
  }

  // Aguas oeste y este del hastial
  const capShape = new THREE.Shape();
  capShape.moveTo(-12, 0);
  capShape.lineTo(12, 0);
  capShape.lineTo(0, 2.2);
  capShape.closePath();
  const capGeo = track(new THREE.ShapeGeometry(capShape));
  capGeo.rotateY(Math.PI / 2);
  for (const cx of [-60.8, -42.6]) {
    const cap = new THREE.Mesh(capGeo, wallMat);
    cap.position.set(cx, 6, 0);
    cap.castShadow = true;
    group.add(cap);
  }

  // Dos puertas andenizadoras al sur + rótulo
  box(5, 3.9, 0.1, -55.7, 1.95, 12.06, doorMat);
  box(5, 3.9, 0.1, -47.7, 1.95, 12.06, doorMat);
  sign('Bodega', 'Producto Terminado · Calzado Chapín', '#f59e0b', 4.6, -51.7, 5.45, 12.1);

  /* --------------------------------- 2. Oficina de Gerencia (costado este) */

  // Modelo real oficina_texture_demo.glb (Poly Haven-style scan, CC0) anexado
  // al muro este del taller, normalizado a ~3.2 m de alto. Al modelo le
  // faltan techo y pared norte: se agregan aquí en blanco clean tech.
  const officeLoader = new GLTFLoader();
  const officeInner = new THREE.Group();
  group.add(officeInner);
  officeLoader.load('/oficina_texture_demo.glb', (gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const bbox0 = new THREE.Box3().setFromObject(model);
    const size0 = new THREE.Vector3();
    bbox0.getSize(size0);
    const s = 3.2 / (size0.y || 1);
    model.scale.setScalar(s);
    officeInner.add(model);
    // Reposicionar: oeste contra el muro este del taller, centrado en z
    const bbox = new THREE.Box3().setFromObject(officeInner);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    officeInner.position.set(50.45 - bbox.min.x, -bbox.min.y, -(bbox.min.z + size.z / 2));
    // Techo que le falta
    const roof = box(size.x + 0.25, 0.16, size.z + 0.25, 50.45 + size.x / 2, 3.28, 0, roofMat);
    roof.castShadow = true;
    // Pared norte que le falta
    box(size.x, 3.25, 0.12, 50.45 + size.x / 2, 1.625, -(size.z / 2) - 0.06, wallMat);
  }, undefined, () => console.warn('[factory] oficina_texture_demo.glb no cargó'));

  /* ------------------------------------------------------------ 3. Sanitarios */

  // Bloque 4 x 3 m al borde norte del andén, extremo oeste (lejos del portón
  // central y de la vista de fachada)
  box(4, 3, 3, -54, 1.5, 17.75, wallMat);
  box(4.5, 0.14, 3.5, -54, 3.07, 17.75, roofMat);
  box(0.9, 2, 0.05, -53.4, 1, 19.28, doorMat);
  box(0.7, 0.4, 0.3, -54, 2.6, 16.4, doorMat);

  const dispose = (): void => {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    for (const item of disposables) item.dispose();
  };

  return { group, dispose };
}
