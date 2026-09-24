import * as THREE from 'three';
import {
  createBrushedSteelNormalMap,
  createFloorNormalMap,
  createGuatemalanTextileNormalMap,
  createGuatemalanTextileTexture,
  createLastTechnicalTexture,
  createPolishedEpoxyFloorTexture,
  createRubberSoleNormalMap,
  createWoodTexture,
} from './proceduralTextures';

/**
 * Production PBR Material Registry for the Calzado Chapín virtual tour.
 *
 * Implements high-end physical materials with procedural normal maps,
 * roughness maps, and authentic Guatemalan textile patterns:
 * - Polished epoxy concrete floor with architectural bay joints and glossy reflections
 * - Handwoven Guatemalan cotton textile with thread normal mapping
 * - Anisotropic brushed steel for industrial machinery
 * - Warm honey teak wood for artisanal loom frames and workbenches
 * - Ergonomic natural vulcanized rubber for sandal soles
 * - Translucent jade bio-polymer with technical millimeter graduation for 3D lasts
 */

// Procedural textures
const floorTexture = createPolishedEpoxyFloorTexture();
const floorNormalTexture = createFloorNormalMap();
const textileTexture = createGuatemalanTextileTexture();
const textileNormalTexture = createGuatemalanTextileNormalMap();
const woodTexture = createWoodTexture();
const brushedSteelNormal = createBrushedSteelNormalMap();
const rubberNormal = createRubberSoleNormalMap();
const lastTexture = createLastTechnicalTexture();

/** High-end polished epoxy concrete floor with soft glossy reflections */
export const floorMat = new THREE.MeshStandardMaterial({
  map: floorTexture,
  normalMap: floorNormalTexture,
  normalScale: new THREE.Vector2(0.2, 0.2),
  roughness: 0.45,
  metalness: 0.08,
});
floorMat.envMapIntensity = 0.25;

/** White cleanroom perimeter walls with slight warm architectural undertone */
export const wallMat = new THREE.MeshStandardMaterial({
  color: 0xf5f3ee,
  roughness: 0.88,
  metalness: 0.02,
  side: THREE.DoubleSide,
});

/** Clean white ceiling plane */
export const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0xf7f6f2,
  roughness: 0.95,
  metalness: 0,
  side: THREE.DoubleSide,
});

/** High-grade architectural glazing for the north curtain wall */
export const glassMat = new THREE.MeshStandardMaterial({
  color: 0xd6eaf8,
  roughness: 0.04,
  metalness: 0.12,
  transparent: true,
  opacity: 0.14,
  side: THREE.DoubleSide,
  depthWrite: false,
});
glassMat.envMapIntensity = 0.35;

/** Self-lit skylight panels with warm sunlight color */
export const emissivePanelMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfff8ee,
  emissiveIntensity: 1.4,
  roughness: 0.5,
  metalness: 0,
  side: THREE.DoubleSide,
});

/** Cool clean-tech LED strip (under tables, machine base lights) */
export const ledStripMat = new THREE.MeshStandardMaterial({
  color: 0x050c18,
  emissive: 0x70c0ff,
  emissiveIntensity: 2.2,
  roughness: 0.4,
  metalness: 0,
});

/** Violet UV curing LED strip inside the vulcanizing/curing tunnel */
export const uvStripMat = new THREE.MeshStandardMaterial({
  color: 0x120a28,
  emissive: 0xa87aff,
  emissiveIntensity: 2.5,
  roughness: 0.4,
  metalness: 0,
});

/** Anisotropic brushed steel for machine frames, posts, and shafts */
export const steelMat = new THREE.MeshStandardMaterial({
  color: 0xc8d0d8,
  normalMap: brushedSteelNormal,
  normalScale: new THREE.Vector2(0.35, 0.35),
  roughness: 0.28,
  metalness: 0.92,
});

/** Darker cast-iron / anodized steel for machine bases, platens and beds */
export const darkSteelMat = new THREE.MeshStandardMaterial({
  color: 0x3d444e,
  normalMap: brushedSteelNormal,
  normalScale: new THREE.Vector2(0.25, 0.25),
  roughness: 0.42,
  metalness: 0.82,
});

/** Warm honey teak wood with organic grain and pore texture */
export const woodMat = new THREE.MeshStandardMaterial({
  map: woodTexture,
  roughness: 0.62,
  metalness: 0.02,
});

/** Authentic handwoven Guatemalan cotton textile with thread normal mapping */
export const canvasMat = new THREE.MeshStandardMaterial({
  map: textileTexture,
  normalMap: textileNormalTexture,
  normalScale: new THREE.Vector2(0.7, 0.7),
  roughness: 0.84,
  metalness: 0.0,
});

/** Raw natural cotton canvas for unworked fabric rolls */
export const rawCanvasMat = new THREE.MeshStandardMaterial({
  color: 0xeae2d2,
  normalMap: textileNormalTexture,
  normalScale: new THREE.Vector2(0.5, 0.5),
  roughness: 0.92,
  metalness: 0.0,
});

/** Bio-polymer jade for 3D ergonomic shoe lasts with technical serigraphy */
export const jadeMat = new THREE.MeshStandardMaterial({
  map: lastTexture,
  color: 0x15a686,
  roughness: 0.24,
  metalness: 0.08,
});

/** Natural vulcanized rubber with ergonomic diamond tread relief */
export const rubberMat = new THREE.MeshStandardMaterial({
  color: 0x22242a,
  normalMap: rubberNormal,
  normalScale: new THREE.Vector2(0.65, 0.65),
  roughness: 0.85,
  metalness: 0.04,
});

/** Natural honey crepe rubber for cushioned midsole layer */
export const crepeRubberMat = new THREE.MeshStandardMaterial({
  color: 0xd9b37a,
  roughness: 0.78,
  metalness: 0.02,
});

/** Emissive green industrial status button */
export const buttonGreenMat = new THREE.MeshStandardMaterial({
  color: 0x051a0e,
  emissive: 0x00ff73,
  emissiveIntensity: 2.2,
  roughness: 0.3,
  metalness: 0.1,
});

/** Emissive amber industrial warning / cycle button */
export const buttonAmberMat = new THREE.MeshStandardMaterial({
  color: 0x1c1204,
  emissive: 0xffa726,
  emissiveIntensity: 2.0,
  roughness: 0.3,
  metalness: 0.1,
});

/** Emissive red emergency stop mushroom button */
export const buttonRedMat = new THREE.MeshStandardMaterial({
  color: 0x280606,
  emissive: 0xff2a2a,
  emissiveIntensity: 2.4,
  roughness: 0.3,
  metalness: 0.1,
});

/** Biofílico interior architectural plants (Sansevieria / Ficus) */
export const plantLeafMat = new THREE.MeshStandardMaterial({
  color: 0x245532,
  roughness: 0.35,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

/** Architectural planter ceramic / basalt base */
export const planterPotMat = new THREE.MeshStandardMaterial({
  color: 0x2e333d,
  roughness: 0.82,
  metalness: 0.05,
});
