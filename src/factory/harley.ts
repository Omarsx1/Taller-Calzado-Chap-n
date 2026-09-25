import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Harley Quinn caminando por el exterior del taller. El GLB trae esqueleto
 * (rig UE4) pero sin animaciones: la caminata es procedural — swing de
 * piernas y brazos sobre los huesos + bob de pelvis — recorriendo una ruta
 * cerrada por la fachada y el estacionamiento.
 */

const MODEL_URL = '/harley_quinn.glb';
const WALK_SPEED = 0.9;
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
  restQ: THREE.Quaternion;
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
                bones.set(key, { bone, restQ: bone.quaternion.clone(), restY: bone.position.y });
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

    // Caminata procedural sobre el esqueleto: el swing se PRE-multiplica en el
    // espacio del padre (eje lateral del modelo) — rotar sobre el eje local
    // del hueso giraba la pierna sobre sí misma (pies tiesos, brazos en T).
    const f = walked * 2.3;
    const swing = Math.sin(f);
    const qSwing = new THREE.Quaternion();
    const AX_SIDE = new THREE.Vector3(1, 0, 0); // lateral del modelo (T-pose)
    const AX_FWD = new THREE.Vector3(0, 0, 1); // frontal del modelo
    const applySwing = (key: string, axis: THREE.Vector3, angle: number): void => {
      const ref = bones.get(key);
      if (!ref) return;
      qSwing.setFromAxisAngle(axis, angle);
      ref.bone.quaternion.copy(qSwing).multiply(ref.restQ);
    };
    // Piernas: zancada adelante/atrás en el plano sagital
    applySwing('thigh_l', AX_SIDE, swing * 0.55);
    applySwing('thigh_r', AX_SIDE, -swing * 0.55);
    applySwing('calf_l', AX_SIDE, Math.max(0, -swing) * 0.6);
    applySwing('calf_r', AX_SIDE, Math.max(0, swing) * 0.6);
    // Brazos: bajar del T-pose (-/+1.1 rad sobre el eje frontal) + balanceo
    applySwing('upperarm_l', AX_FWD, -1.1 + swing * 0.28);
    applySwing('upperarm_r', AX_FWD, 1.1 - swing * 0.28);
    // Pelvis: bob vertical (en unidades nativas del rig)
    const pelvis = bones.get('pelvis');
    if (pelvis) pelvis.bone.position.y = pelvis.restY + Math.abs(Math.cos(f)) * 0.05 * invScale;
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
