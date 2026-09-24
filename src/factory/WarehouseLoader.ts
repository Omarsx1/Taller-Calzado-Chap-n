import * as THREE from 'three';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface WarehouseResult {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Loads the modular PBR industrial warehouse model (3DS format) and its 
 * calibrated textures, merges geometries by material for optimal 60 FPS performance,
 * and centers the warehouse around the factory production line.
 */
export async function loadWarehouse(): Promise<WarehouseResult> {
  const textureLoader = new THREE.TextureLoader();
  const texturesToDispose: THREE.Texture[] = [];

  function loadTexture(name: string, isColor = false): THREE.Texture {
    const tex = textureLoader.load(`/warehouse/textures/${name}`);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex.colorSpace = THREE.NoColorSpace;
    }
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    texturesToDispose.push(tex);
    return tex;
  }

  // 1. Load PBR Texture Sets
  const floorMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_floor_pbr',
    map: loadTexture('floor_color.jpg', true),
    normalMap: loadTexture('floor_nrm.png'),
    roughnessMap: loadTexture('floor_rough.jpg'),
    metalnessMap: loadTexture('floor_met.jpg'),
    roughness: 0.5,
    metalness: 0.15,
    envMapIntensity: 0.85,
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_concrete_pbr',
    map: loadTexture('concrete_color.jpg', true),
    normalMap: loadTexture('concrete_nrm.png'),
    roughnessMap: loadTexture('concrete_rough.jpg'),
    metalnessMap: loadTexture('concrete_met.jpg'),
    roughness: 0.88,
    metalness: 0.08,
    envMapIntensity: 0.6,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_metal_pbr',
    map: loadTexture('metal_color.jpg', true),
    normalMap: loadTexture('metal_nrm.png'),
    roughnessMap: loadTexture('metal_rough.jpg'),
    metalnessMap: loadTexture('metal_met.jpg'),
    roughness: 0.45,
    metalness: 0.85,
    envMapIntensity: 1.1,
  });

  const wallsMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_walls_pbr',
    map: loadTexture('walls_color.jpg', true),
    normalMap: loadTexture('walls_nrm.png'),
    roughnessMap: loadTexture('walls_rough.jpg'),
    metalnessMap: loadTexture('walls_met.jpg'),
    roughness: 0.65,
    metalness: 0.3,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_roof_pbr',
    map: loadTexture('roof_color.jpg', true),
    normalMap: loadTexture('roof_nrm.png'),
    roughnessMap: loadTexture('roof_rough.jpg'),
    metalnessMap: loadTexture('roof_met.jpg'),
    roughness: 0.75,
    metalness: 0.35,
    envMapIntensity: 0.65,
    side: THREE.DoubleSide,
  });

  const gatesMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_gates_pbr',
    map: loadTexture('gates_color.jpg', true),
    normalMap: loadTexture('gates_nrm.png'),
    roughnessMap: loadTexture('gates_rough.jpg'),
    metalnessMap: loadTexture('gates_met.jpg'),
    roughness: 0.5,
    metalness: 0.65,
    envMapIntensity: 0.9,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    name: 'warehouse_glass_pbr',
    color: 0xdeebf5,
    transparent: true,
    opacity: 0.35,
    roughness: 0.04,
    metalness: 0.15,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const materialsMap: Record<string, THREE.MeshStandardMaterial> = {
    floor: floorMat,
    concrete: concreteMat,
    metal: metalMat,
    walls: wallsMat,
    roof: roofMat,
    gates: gatesMat,
    glass: glassMat,
  };

  // 2. Load the 3DS model via TDSLoader
  const loader = new TDSLoader();
  const rawGroup = await new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      '/warehouse/warehouse_3ds.3DS',
      (group) => resolve(group),
      undefined,
      (err) => reject(err),
    );
  });

  // 3. Align 3ds Max Z-up coordinates to Three.js Y-up
  rawGroup.rotation.x = -Math.PI / 2;
  rawGroup.updateMatrixWorld(true);

  // Compute bounding box and center X/Z, placing floor base at Y = 0
  const box = new THREE.Box3().setFromObject(rawGroup);
  const center = new THREE.Vector3();
  box.getCenter(center);
  rawGroup.position.x = -center.x;
  rawGroup.position.y = -box.min.y;
  rawGroup.position.z = -center.z;
  rawGroup.updateMatrixWorld(true);

  // 4. Merge geometries by material to reduce 155 draw calls to just 7
  const geomsByMat: Record<string, THREE.BufferGeometry[]> = {};
  rawGroup.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material;
      const matName = mat
        ? (Array.isArray(mat) ? mat[0].name : mat.name)
        : 'metal';
      const key = materialsMap[matName] ? matName : 'metal';

      if (!geomsByMat[key]) geomsByMat[key] = [];

      mesh.updateMatrixWorld(true);
      const cloneGeo = mesh.geometry.clone();
      cloneGeo.applyMatrix4(mesh.matrixWorld);
      const nonIndexed = cloneGeo.toNonIndexed();
      nonIndexed.computeVertexNormals();
      geomsByMat[key].push(nonIndexed);
    }
  });

  const warehouseGroup = new THREE.Group();
  warehouseGroup.name = 'warehouse_industrial_hall';

  const mergedGeometries: THREE.BufferGeometry[] = [];

  for (const [key, geoms] of Object.entries(geomsByMat)) {
    if (geoms.length === 0) continue;
    const merged = mergeGeometries(geoms, false);
    merged.computeVertexNormals();
    mergedGeometries.push(merged);

    const mat = materialsMap[key] || metalMat;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `warehouse_${key}`;

    // Shadow flags tailored for photorealistic interior lighting:
    // Columns, frames, walls, and gates cast crisp shadows on the floor.
    // The roof receives shadows/light but does not cast shadow inside so the work floor stays radiant.
    if (key === 'roof') {
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    } else if (key === 'floor') {
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    } else if (key === 'glass') {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    } else {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    warehouseGroup.add(mesh);
  }

  // Free raw unmerged 3DS objects
  rawGroup.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    }
  });

  const dispose = (): void => {
    mergedGeometries.forEach((g) => g.dispose());
    Object.values(materialsMap).forEach((m) => m.dispose());
    texturesToDispose.forEach((t) => t.dispose());
  };

  return { group: warehouseGroup, dispose };
}
