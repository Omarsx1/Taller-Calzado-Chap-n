import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { darkSteelMat, emissivePanelMat } from './materials';
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

  // Oficina amplia construida alrededor del set amueblado
  // oficina_texture_demo.glb: 12 x 14 m con muros completos (norte, este y
  // sur con puerta y ventanales), losa plana y luz interior — el muro oeste
  // lo provee el taller. El set del GLB se apoya contra el muro norte.
  box(12, 0.1, 14, 56.4, 0.05, 0, track(
    new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }),
  ));
  box(12, 3.4, 0.15, 56.4, 1.7, -6.93, wallMat); // norte
  box(0.15, 3.4, 14, 62.33, 1.7, 0, wallMat); // este
  // Muro sur con vanos reales: ventana grande (x 51.75..58.65, y 1.1..3.0)
  // y puerta (x 58.975..60.025, y 0..2.2)
  box(1.35, 3.4, 0.15, 51.075, 1.7, 6.93, wallMat);
  box(6.9, 1.1, 0.15, 55.2, 0.55, 6.93, wallMat); // antepecho
  box(6.9, 0.4, 0.15, 55.2, 3.2, 6.93, wallMat); // dintel de la ventana
  box(0.325, 3.4, 0.15, 58.81, 1.7, 6.93, wallMat); // pilar central
  box(1.05, 1.2, 0.15, 59.5, 2.8, 6.93, wallMat); // dintel de la puerta
  box(2.375, 3.4, 0.15, 61.21, 1.7, 6.93, wallMat);
  // Ventanal grande de cristal claro: se ve el interior amueblado
  const officeGlassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xbfd8e8,
      transparent: true,
      opacity: 0.12,
      roughness: 0.04,
      metalness: 0.1,
      depthWrite: false,
    }),
  );
  // Marco de 4 tiras alrededor del vano (sin losa trasera: a través del
  // cristal se ve el interior iluminado)
  box(7.2, 0.14, 0.12, 55.2, 3.04, 7.0, doorMat); // dintel del marco
  box(7.2, 0.14, 0.12, 55.2, 1.02, 7.0, doorMat); // antepecho del marco
  box(0.12, 2.16, 0.12, 51.72, 2.05, 7.0, doorMat); // jamba oeste
  box(0.12, 2.16, 0.12, 58.68, 2.05, 7.0, doorMat); // jamba este
  box(6.6, 1.6, 0.06, 55.2, 2.05, 7.06, officeGlassMat); // cristal
  box(1.05, 2.2, 0.08, 59.5, 1.1, 7.06, doorMat); // puerta
  // Rótulo sobre la puerta: separado de ella y del techo
  sign('Oficina de Gerencia', 'Administración · Calzado Chapín', '#10b981', 1.8, 59.5, 2.85, 7.08);
  box(12.5, 0.16, 14.5, 56.4, 3.48, 0, roofMat); // losa plana
  // Panel de luz interior sobre el set del GLB
  box(2.4, 0.04, 1.2, 55, 3.3, -3, emissivePanelMat);
  // Luz real dentro de la oficina: el amueblado se ve a través del cristal
  const officeLightA = new THREE.PointLight(0xfff0da, 55, 18, 2);
  officeLightA.position.set(55, 2.9, -2.5);
  const officeLightB = new THREE.PointLight(0xfff0da, 45, 18, 2);
  officeLightB.position.set(57.5, 2.9, 3.5);
  group.add(officeLightA, officeLightB);

  // El set amueblado real dentro del casco, apoyado contra el muro norte
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
    const bbox = new THREE.Box3().setFromObject(officeInner);
    // min.z (no max) contra el muro norte: el set queda DENTRO del casco
    officeInner.position.set(50.7 - bbox.min.x, -bbox.min.y + 0.1, 1.2 - bbox.max.z);
    // Escritorio de gerencia junto a los ventanales del sur
    const desk = box(1.9, 0.06, 0.9, 56.4, 0.78, 4.6, track(
      new THREE.MeshStandardMaterial({ color: 0x8a5f3c, roughness: 0.6 }),
    ));
    desk.castShadow = true;
    box(0.6, 0.42, 0.04, 56.4, 1.05, 4.95, darkSteelMat); // monitor
    box(0.5, 0.06, 0.5, 56.4, 0.45, 3.6, darkSteelMat); // silla
    box(0.45, 0.55, 0.05, 56.4, 0.78, 3.38, darkSteelMat); // respaldo
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
