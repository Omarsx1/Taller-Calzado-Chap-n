import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loader and manager for the authentic 3D chancla models (ShoesL.glb / ShoesR.glb).
 *
 * Automatically centers, scales from millimeters to meters (~27cm adult shoe length),
 * orients upright (sole resting flat at Y = 0), and applies production-grade
 * PBR materials for Calzado Chapín (vulcanized plantation rubber and jade bio-polymer).
 */

let leftGeometryTemplate: THREE.BufferGeometry | null = null;
let rightGeometryTemplate: THREE.BufferGeometry | null = null;

/** Default natural vulcanized plantation rubber material */
export const defaultShoeMaterial = new THREE.MeshStandardMaterial({
  color: 0x24262c,
  roughness: 0.52,
  metalness: 0.08,
});

/** Signature Guatemalan Jade bio-polymer edition material */
export const jadeShoeMaterial = new THREE.MeshStandardMaterial({
  color: 0x0fa889,
  roughness: 0.38,
  metalness: 0.12,
});

/** Warm Terracotta edition material */
export const terracottaShoeMaterial = new THREE.MeshStandardMaterial({
  color: 0x9e382b,
  roughness: 0.55,
  metalness: 0.05,
});

function processGeometry(gltfMesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = gltfMesh.geometry.clone();
  gltfMesh.position.set(0, 0, 0);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/** Preloads both ShoesL.glb and ShoesR.glb models from public directory */
export async function loadShoeAssets(): Promise<boolean> {
  if (leftGeometryTemplate && rightGeometryTemplate) return true;

  const loader = new GLTFLoader();

  const loadOne = (url: string): Promise<THREE.Group> => {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      );
    });
  };

  try {
    const [sceneL, sceneR] = await Promise.all([
      loadOne('/ShoesL.glb'),
      loadOne('/ShoesR.glb'),
    ]);

    let meshL: THREE.Mesh | null = null;
    let meshR: THREE.Mesh | null = null;

    sceneL.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !meshL) meshL = child as THREE.Mesh;
    });

    sceneR.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !meshR) meshR = child as THREE.Mesh;
    });

    if (meshL && meshR) {
      leftGeometryTemplate = processGeometry(meshL);
      rightGeometryTemplate = processGeometry(meshR);
      console.log('[factory] Successfully loaded authentic 3D chancla models: ShoesL.glb and ShoesR.glb');
      return true;
    }
  } catch (error) {
    console.warn('[factory] Could not load .glb shoe models, falling back to procedural meshes:', error);
  }

  return false;
}

/**
 * Creates an instance of a single shoe (Left or Right) using the real .glb geometry.
 * Sits flat with sole on ground (Y = 0), pointing forward along Z.
 */
export function createShoeMesh(
  side: 'left' | 'right',
  material: THREE.Material = defaultShoeMaterial,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Shoe_${side === 'left' ? 'Left' : 'Right'}`;

  const template = side === 'left' ? leftGeometryTemplate : rightGeometryTemplate;
  if (!template) return group;

  const mesh = new THREE.Mesh(template, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Scale from millimeter coordinates to real-world meters (~27cm adult sandal)
  mesh.scale.setScalar(0.0011);

  // Lay flat on its sole:
  // In the original CAD/Blender mesh, the sole slopes at 27.25 degrees in the X-Y plane.
  // Rotation (-Math.PI / 2 + 0.4756, -Math.PI / 2, 0) perfectly levels the heel and ball of the foot horizontal (diff < 0.005mm).
  mesh.rotation.set(-Math.PI / 2 + 0.4756, -Math.PI / 2, 0);

  // Elevation offset so the bottom contact surface rests directly flush at local Y = 0
  // (lowest vertex is at -21.468mm, which at scale 0.0011 is -0.023615m)
  mesh.position.y = 0.02362;

  group.add(mesh);
  return group;
}

/**
 * Creates a matched pair of Calzado Chapín chanclas (Left + Right side by side).
 */
export function createShoePair(
  material: THREE.Material = defaultShoeMaterial,
  spacing = 0.20,
): THREE.Group {
  const pair = new THREE.Group();
  pair.name = 'Shoe_Pair';

  const left = createShoeMesh('left', material);
  left.position.x = -spacing / 2;

  const right = createShoeMesh('right', material);
  right.position.x = spacing / 2;

  pair.add(left, right);
  return pair;
}

/** Returns true if .glb assets are loaded and ready */
export function areShoesReady(): boolean {
  return leftGeometryTemplate !== null && rightGeometryTemplate !== null;
}
