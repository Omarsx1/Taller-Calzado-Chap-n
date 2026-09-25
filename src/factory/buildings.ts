import * as THREE from 'three';
import { darkSteelMat, woodMat } from './materials';
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
  // Vidrio más transparente para la oficina: se ve el interior amueblado
  const officeGlassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xbfd8e8,
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    }),
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

  // Anexo de vidrio en el costado este del taller (muro este en x = 50.33):
  // 8 x 14 m con interior amueblado visible a través del vidrio
  box(7.6, 0.12, 13.6, 54.2, 0.06, 0, track(
    new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }),
  ));
  // Pared norte sólida
  box(8, 3.6, 0.15, 54.2, 1.8, -6.93, wallMat);
  // Muros de vidrio sur y este
  box(7.7, 3.2, 0.06, 54.2, 2.0, 6.95, officeGlassMat);
  box(0.06, 3.2, 13.8, 58.35, 2.0, 0, officeGlassMat);
  // Columnas blancas
  for (const [cx, cz] of [
    [50.55, -6.9],
    [50.55, 6.9],
    [58.35, -6.9],
    [58.35, 6.9],
  ] as const) {
    box(0.15, 3.6, 0.15, cx, 1.8, cz, wallMat);
  }
  // Losa plana
  box(8.8, 0.18, 14.8, 54.2, 3.69, 0, roofMat);
  // Puerta de vidrio al sur
  box(0.95, 2.1, 0.06, 52.2, 1.05, 6.93, doorMat);

  // Interior amueblado (visible a través del vidrio)
  box(2.2, 0.9, 0.5, 52.4, 0.55, -5.9, woodMat); // gabinete contra el muro norte
  box(1.9, 0.06, 0.9, 55.3, 0.78, 2.6, woodMat); // escritorio
  box(0.55, 0.4, 0.04, 55.3, 1.05, 2.95, darkSteelMat); // monitor
  box(0.5, 0.06, 0.5, 55.3, 0.45, 1.6, darkSteelMat); // silla 1
  box(0.45, 0.55, 0.05, 55.3, 0.75, 1.35, darkSteelMat); // respaldo silla 1
  box(0.5, 0.06, 0.5, 53.9, 0.45, 1.6, darkSteelMat); // silla 2
  box(0.45, 0.55, 0.05, 53.9, 0.75, 1.35, darkSteelMat); // respaldo silla 2

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
