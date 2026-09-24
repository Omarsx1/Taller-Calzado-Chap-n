import * as THREE from 'three';
import {
  darkSteelMat,
  emissivePanelMat,
  ledStripMat,
  planterPotMat,
  plantLeafMat,
  steelMat,
} from './materials';

/**
 * Factory interior architectural detailing, biophilic accents, HVAC ducts and lighting rig.
 * 
 * Works in tandem with the modular PBR warehouse structure:
 * - High-bay industrial LED pendant luminaires suspended from roof trusses
 * - Galvanized spiral HVAC air ducts
 * - Biophilic Sansevieria indoor planters framing the clean-tech floor
 * - Calibrated Key / Fill / Ambient / Rim lighting rig
 */

let contactShadowTexture: THREE.CanvasTexture | null = null;

/**
 * Radial-gradient decal used by every contact shadow. The 256 x 256 canvas is
 * generated only once and shared across all shadow planes.
 */
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTexture) return contactShadowTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] 2D canvas context unavailable for contact shadows');

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
  gradient.addColorStop(0.35, 'rgba(15, 23, 42, 0.6)');
  gradient.addColorStop(0.7, 'rgba(15, 23, 42, 0.2)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  contactShadowTexture = texture;
  return texture;
}

const contactShadowMaterials = new Map<number, THREE.MeshBasicMaterial>();

function getContactShadowMaterial(opacity: number): THREE.MeshBasicMaterial {
  const cached = contactShadowMaterials.get(opacity);
  if (cached) return cached;

  const material = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    color: 0x0f172a,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  contactShadowMaterials.set(opacity, material);
  return material;
}

/**
 * Contact shadow decal. Opaque dark centre fading to fully transparent edges.
 */
export function createContactShadow(
  width: number,
  depth: number,
  opacity = 0.5,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const shadow = new THREE.Mesh(geometry, getContactShadowMaterial(opacity));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.renderOrder = 1;
  return shadow;
}

/** Thin emissive strip reused under tables and machine bases. */
export function createLedStrip(width: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, 0.04, 0.08);
  return new THREE.Mesh(geometry, ledStripMat);
}

/**
 * Golden-hour Key / Fill / Ambient lighting rig.
 *
 * The key is the low sunset sun; its azimuth/elevation match the sun painted
 * in `sky.ts` (u = 0.34, ~15° up → world direction (0.52, 0.26, -0.82)) and
 * the rim-lit crests in `landscape.ts`. It sits far along the light direction
 * so the shadow frustum spans the 93 m building and its long evening shadows.
 */
export function setupLighting(scene: THREE.Scene): { key: THREE.DirectionalLight } {
  // Golden-hour hemisphere: amber sky dome over warm dusk ground bounce
  const hemisphere = new THREE.HemisphereLight(0xff9a58, 0x463c50, 0.95);

  // Soft warm ambient fill lifts the long dusk shadows off pure black
  const ambient = new THREE.AmbientLight(0xffdcc0, 0.5);

  // Low sunset sun casting long shadows across the apron
  const key = new THREE.DirectionalLight(0xffa257, 1.8);
  key.position.set(146, 127, -230);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.left = -155;
  key.shadow.camera.right = 155;
  key.shadow.camera.top = 65;
  key.shadow.camera.bottom = -65;
  key.shadow.camera.near = 150;
  key.shadow.camera.far = 520;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.05;

  // Violet dusk fill from the anti-sun sky
  const fillCool = new THREE.DirectionalLight(0x8a8fd8, 0.42);
  fillCool.position.set(-30, 16, 10);
  fillCool.castShadow = false;

  // Warm horizon bounce wrapping the shaded facades
  const fillWarm = new THREE.DirectionalLight(0xffa06a, 0.3);
  fillWarm.position.set(12, 6, 24);
  fillWarm.castShadow = false;

  scene.add(hemisphere, ambient, key, fillCool, fillWarm);
  return { key };
}

/** Builds an architectural indoor planter with Sansevieria leaves */
function createPlanter(width = 1.6, depth = 0.45): THREE.Group {
  const group = new THREE.Group();

  // Basalt planter box
  const pot = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.55, depth),
    planterPotMat,
  );
  pot.position.y = 0.275;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  // Top soil plane
  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.06, depth - 0.06),
    darkSteelMat,
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.54;
  group.add(soil);

  // Vertical Sansevieria leaves
  const leafCount = Math.floor(width * 7);
  const leafGeo = new THREE.ConeGeometry(0.045, 0.75, 4);
  leafGeo.scale(1, 1, 0.25);

  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.Mesh(leafGeo, plantLeafMat);
    const x = -width / 2 + 0.12 + (i / (leafCount - 1)) * (width - 0.24) + (Math.random() - 0.5) * 0.04;
    const z = (Math.random() - 0.5) * (depth - 0.18);
    const h = 0.55 + Math.random() * 0.35;
    leaf.scale.set(0.9 + Math.random() * 0.3, h, 1);
    leaf.position.set(x, 0.55 + (h * 0.75) / 2, z);
    leaf.rotation.z = (Math.random() - 0.5) * 0.15;
    leaf.rotation.y = (Math.random() - 0.5) * 0.4;
    leaf.castShadow = true;
    group.add(leaf);
  }

  return group;
}

/** Builds a modern industrial LED high-bay pendant luminaire */
function createHighBayLuminaire(): THREE.Group {
  const group = new THREE.Group();

  // Suspension rod
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 1.2, 8),
    darkSteelMat,
  );
  rod.position.y = 0.6;
  group.add(rod);

  // Industrial heat-sink bell housing
  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.36, 0.22, 16),
    darkSteelMat,
  );
  bell.castShadow = true;
  group.add(bell);

  // Emissive circular LED diffuser
  const diffuser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16),
    emissivePanelMat,
  );
  diffuser.position.y = -0.11;
  group.add(diffuser);

  return group;
}

/**
 * Builds interior factory equipment: HVAC ducts, high-bay lights, and biophilic planters.
 * The architectural envelope (floor, columns, walls, roof, gates) is provided by `loadWarehouse`.
 */
export function createHall(): THREE.Group {
  const hall = new THREE.Group();
  hall.name = 'hall_interior_fixtures';

  // 1. Galvanized spiral HVAC air ducts running across the ceiling bays
  const ductPositions = [-2.8, 3.2];
  for (const z of ductPositions) {
    const ductGeo = new THREE.CylinderGeometry(0.3, 0.3, 36, 20);
    ductGeo.rotateZ(Math.PI / 2);
    const duct = new THREE.Mesh(ductGeo, steelMat);
    duct.position.set(0, 5.8, z);
    duct.castShadow = true;
    hall.add(duct);

    // Suspension hangers
    const hangerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6);
    for (let x = -16; x <= 16; x += 4) {
      const hanger = new THREE.Mesh(hangerGeo, darkSteelMat);
      hanger.position.set(x, 6.3, z);
      hall.add(hanger);
    }
  }

  // 2. High-bay LED pendant luminaires suspended above main aisles
  const luminaireXs = [-15.3, -7.65, 0, 7.65, 15.3];
  const luminaireZs = [-3.0, 0, 3.0];
  for (const x of luminaireXs) {
    for (const z of luminaireZs) {
      const luminaire = createHighBayLuminaire();
      luminaire.position.set(x, 5.6, z);
      hall.add(luminaire);
    }
  }

  // 3. Biophilic indoor planters framing the clean-tech production line
  const planterPositions: ReadonlyArray<readonly [number, number]> = [
    [-9.0, -5.6],
    [-4.5, -5.6],
    [0.0, -5.6],
    [4.5, -5.6],
    [9.0, -5.6],
    [-6.5, 5.6],
    [4.5, 5.6],
  ];
  for (const [px, pz] of planterPositions) {
    const planter = createPlanter(1.8, 0.45);
    planter.position.set(px, 0, pz);
    hall.add(planter);
  }

  return hall;
}
