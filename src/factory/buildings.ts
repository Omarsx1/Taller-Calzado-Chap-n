import * as THREE from 'three';
import { createSignboardTexture } from './proceduralTextures';

/**
 * Support buildings for the site (white clean-tech style, matching the main
 * plant): "Bodega de Producto Terminado" (gabled warehouse, SE corner),
 * "Oficina de Gerencia" (flat-roof office by the parking) and "Sanitarios"
 * (small block at the parking's north edge).
 *
 * Positions use the measured site: apron x -136..144 / z ±120, main building
 * x -42.68..50.33 / z ±15.77, dock road z 16..48, perimeter streets clear.
 */

const WALL_WHITE = 0xf6f4ef;
const ROOF_DARK = 0x2f343b;
const DOOR_DARK = 0x3a4048;

export function createSupportBuildings(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'support_buildings';
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
  const glassMat = track(
    new THREE.MeshStandardMaterial({ color: 0x223140, roughness: 0.15, metalness: 0.6 }),
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

  const sign = (title: string, subtitle: string, accent: string, w: number, x: number, y: number, z: number): void => {
    const tex = track(createSignboardTexture(title, subtitle, accent));
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    box(w, (w * 256) / 512, 0.08, x, y, z, mat);
  };

  /* ------------------------------------------------ 1. Bodega (SE corner) */

  // Nave 20 x 24 m, muros 6 m, techo a dos aguas con cumbrera en 8.2 m
  box(20, 6, 24, 134, 3, 64, wallMat);

  const panelGeo = track(new THREE.BoxGeometry(20.6, 0.12, 12.7));
  for (const [z, rot] of [
    [70.1, 0.1815],
    [57.9, -0.1815],
  ] as const) {
    const panel = new THREE.Mesh(panelGeo, roofMat);
    panel.position.set(134, 7.1, z);
    panel.rotation.x = rot;
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);
  }

  // Aguas oeste y este del hastial (triángulos)
  const capShape = new THREE.Shape();
  capShape.moveTo(-12, 0);
  capShape.lineTo(12, 0);
  capShape.lineTo(0, 2.2);
  capShape.closePath();
  const capGeo = track(new THREE.ShapeGeometry(capShape));
  capGeo.rotateY(Math.PI / 2);
  for (const cx of [123.9, 144.1]) {
    const cap = new THREE.Mesh(capGeo, wallMat);
    cap.position.set(cx, 6, 64);
    cap.castShadow = true;
    group.add(cap);
  }

  // Dos puertas andenizadoras al norte + rótulo
  box(5, 3.9, 0.1, 130, 1.95, 51.94, doorMat);
  box(5, 3.9, 0.1, 138, 1.95, 51.94, doorMat);
  sign('Bodega', 'Producto Terminado · Calzado Chapín', '#f59e0b', 4.6, 134, 5.45, 51.9);

  /* ------------------------------------------------ 2. Oficina de Gerencia */

  // 10 x 5 m junto a la bodega (esquina SE), losa plana con pretil; puerta y
  // ventanales hacia la calle sur — nunca tapa la fachada principal
  box(10, 3.6, 5, 134, 1.8, 88, wallMat);
  box(10.8, 0.18, 5.8, 134, 3.69, 88, roofMat);
  // Ventanales hacia la calle sur
  box(1.6, 0.9, 0.06, 131.2, 2.2, 90.56, glassMat);
  box(1.6, 0.9, 0.06, 134, 2.2, 90.56, glassMat);
  box(1.6, 0.9, 0.06, 136.8, 2.2, 90.56, glassMat);
  // Puerta hacia el predio (oeste)
  box(0.06, 2.1, 0.95, 128.94, 1.05, 88, doorMat);

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
