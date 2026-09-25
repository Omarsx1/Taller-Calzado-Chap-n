import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Harley Quinn caminando por el exterior del taller. El GLB trae esqueleto
 * (rig UE4) pero sin animaciones: la caminata es procedural — swing de
 * piernas y brazos sobre los huesos + bob de pelvis — recorriendo una ruta
 * cerrada por la fachada y el estacionamiento.
 */

const MODEL_URL = '/harley_quinn.glb';
const WALK_SPEED = 1.45;
const HEIGHT = 1.72;

const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [-26, 17.4],
  [36, 17.4],
  [36, 25.5],
  [-26, 25.5],
];

const BONE_KEYS = [
  'pelvis',
  'thigh_l',
  'thigh_r',
  'calf_l',
  'calf_r',
  'upperarm_l',
  'upperarm_r',
];

interface BoneRef {
  bone: THREE.Bone;
  restX: number;
  restY: number;
}

export function createHarleyWalker(scene: THREE.Scene): {
  update: (delta: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'harley_walker';
  group.position.set(ROUTE[0][0], 0, ROUTE[0][1]);
  scene.add(group);

  let mixer: THREE.AnimationMixer | null = null;
  let disposed = false;
  const bones = new Map<string, BoneRef>();
  let invScale = 1;
  let wp = 1; // el destino inicial es el segundo waypoint (arranca en el primero)
  let walked = 0;

  new GLTFLoader()
    .load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        model.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.frustumCulled = false; // los skinned meshes pueden calcular mal el bounds
          }
          if ((o as THREE.Bone).isBone) {
            const name = o.name.toLowerCase();
            for (const key of BONE_KEYS) {
              if (name.startsWith(key)) {
                const bone = o as THREE.Bone;
                bones.set(key, { bone, restX: bone.rotation.x, restY: bone.position.y });
                break;
              }
            }
          }
        });
        // Normalizar: altura ~1.72 m y pies apoyados en y = 0
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const s = HEIGHT / (size.y || 1);
        invScale = 1 / s;
        model.scale.setScalar(s);
        model.position.y = -bbox.min.y * s;
        group.add(model);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      () => console.warn('[factory] harley_quinn.glb no cargó'),
    );

  const update = (delta: number): void => {
    mixer?.update(delta);

    const [tx, tz] = ROUTE[wp];
    const dx = tx - group.position.x;
    const dz = tz - group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      wp = (wp + 1) % ROUTE.length;
      return;
    }
    const vx = dx / d;
    const vz = dz / d;
    group.position.x += vx * WALK_SPEED * delta;
    group.position.z += vz * WALK_SPEED * delta;
    group.rotation.y = Math.atan2(vx, vz);
    walked += WALK_SPEED * delta;

    // Caminata procedural sobre el esqueleto
    const f = walked * 2.3;
    const swing = Math.sin(f);
    for (const [key, ref] of bones) {
      const { bone, restX, restY } = ref;
      switch (key) {
        case 'thigh_l':
          bone.rotation.x = restX + swing * 0.5;
          break;
        case 'thigh_r':
          bone.rotation.x = restX - swing * 0.5;
          break;
        case 'calf_l':
          bone.rotation.x = restX + Math.max(0, -swing) * 0.5;
          break;
        case 'calf_r':
          bone.rotation.x = restX + Math.max(0, swing) * 0.5;
          break;
        case 'upperarm_l':
          bone.rotation.x = restX - swing * 0.35;
          break;
        case 'upperarm_r':
          bone.rotation.x = restX + swing * 0.35;
          break;
        case 'pelvis':
          bone.position.y = restY + Math.abs(Math.cos(f)) * 0.05 * invScale;
          break;
      }
    }
  };

  const dispose = (): void => {
    disposed = true;
    mixer?.stopAllAction();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  };

  return { update, dispose };
}
