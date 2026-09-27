import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Procedural walking engine for Harley Quinn (rig ships with no animation clips).
 *
 * Rotations are applied in MODEL space (not bone-local space): for each bone we store
 * its rest orientation in the gltf.scene frame (`modelQ`) and the inverse of its
 * parent's (`parentInvQ`), so a rotation about a model axis becomes
 * `q = parentInvQ * R_model * modelQ`. This makes anatomical rotations exact without
 * hand-tuned per-bone axes (the rig is an A-pose with bone-local X along the limb).
 *
 * Gait curve parameters were validated offline against the real skeleton
 * (.artifacts/gait_sim.mjs + harley_rig.json): stance foot is grounded by a pelvis
 * bob fitted to a Fourier series, knee flexion peaks in mid-swing and is ~0 at heel
 * strike, and the hip waveform is third-harmonic-flattened so the stance foot moves
 * backward at ~translation speed (no foot sliding).
 */

const MODEL_URL = '/harley_quinn.glb';
const WALK_SPEED = 0.8; // m/s — matches ~1.9 steps/s at 42 cm step length
const HEIGHT = 1.72; // target model height in meters
const STRIDE_FREQUENCY = 5.24; // rad/m — stance ankle backward speed ≈ WALK_SPEED

const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [-24, 17.6],
  [28, 17.6],
  [28, 26.0],
  [-24, 26.0],
];

// Model-space anatomical axes (model faces +Z, up +Y, left +X)
const AX_LAT = new THREE.Vector3(1, 0, 0); // lateral: sagittal swing, knee & ankle pitch
const AX_UP = new THREE.Vector3(0, 1, 0); // vertical: pelvis/torso/head yaw
const AX_FWD = new THREE.Vector3(0, 0, 1); // forward: pelvis roll, arm adduction

// Gait amplitudes (radians) — calibrated in .artifacts/gait_sim.mjs
const HIP_AMP = 0.44;
const HIP_FLATTEN = 0.15; // 3rd-harmonic subtraction: constant-ish stance speed
const KNEE_AMP = 0.8; // peak mid-swing flexion
const KNEE_EXP = 1.5; // sharpens flexion so knee is extended at heel strike
const KNEE_STANCE = 0.12; // small loading-response yield in early stance
const ANKLE_DORSI = 0.22; // toes-up at heel strike & swing clearance
const ANKLE_PUSH = 0.2; // plantarflexion at push-off
const PELVIS_YAW = 0.07;
const PELVIS_ROLL = 0.05;
const TORSO_YAW = 0.05; // counter-rotation vs pelvis
const TORSO_LEAN = 0.05; // slight constant forward lean
const HEAD_COUNTER = 0.03;
const ARM_DROP = 0.5; // adduction from the rig's A-pose toward the body
const ARM_SWING = 0.3;
const ELBOW_BASE = 0.15;
const ELBOW_FLEX = 0.35; // extra flexion while the arm swings forward

// Pelvis vertical bob (cm), Fourier fit of "pelvis drops until the lowest foot
// reaches contact height", from the offline sim (max error 0.25 cm).
const BOB = [-2.973, 1.97, -0.476, -0.768, -0.709, 0.587, 0.335, -0.268, 0.2] as const;
const pelvisBob = (f: number): number =>
  BOB[0] +
  BOB[1] * Math.cos(2 * f) +
  BOB[2] * Math.sin(2 * f) +
  BOB[3] * Math.cos(4 * f) +
  BOB[4] * Math.sin(4 * f) +
  BOB[5] * Math.cos(6 * f) +
  BOB[6] * Math.sin(6 * f) +
  BOB[7] * Math.cos(8 * f) +
  BOB[8] * Math.sin(8 * f);

// Flatter-than-sine hip wave: reduces mid-stance foot sliding
const hipWave = (phi: number): number => Math.sin(phi) - HIP_FLATTEN * Math.sin(3 * phi);

interface BoneRef {
  bone: THREE.Bone;
  modelQ: THREE.Quaternion; // rest orientation in model space
  parentInvQ: THREE.Quaternion; // inverse of the parent's rest model-space orientation
  restY: number; // local rest Y (pelvis bob baseline; local units are FBX meters)
}

const BONE_KEYS = [
  'pelvis',
  'spine_01',
  'head',
  'thigh_l',
  'thigh_r',
  'calf_l',
  'calf_r',
  'foot_l',
  'foot_r',
  'upperarm_l',
  'upperarm_r',
  'lowerarm_l',
  'lowerarm_r',
];

export function createHarleyWalker(scene: THREE.Scene): {
  update: (delta: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'harley_walker';
  group.position.set(ROUTE[0][0], 0, ROUTE[0][1]);
  scene.add(group);

  let disposed = false;
  const bones = new Map<string, BoneRef>();
  let wp = 1;
  let walked = 0;

  // Reusable temporaries (garbage-free 60 fps loop)
  const qSwing = new THREE.Quaternion();
  const qAux = new THREE.Quaternion();

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;

      const found: Array<{ key: string; bone: THREE.Bone }> = [];
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false; // skinned meshes miscalculate bounds
        }
        if ((o as THREE.Bone).isBone) {
          const name = o.name.toLowerCase();
          for (const key of BONE_KEYS) {
            if (name.startsWith(key)) {
              found.push({ key, bone: o as THREE.Bone });
              break;
            }
          }
        }
      });

      // Rest orientation of a node in the gltf.scene frame (pure rotation chain)
      const modelQuat = (o: THREE.Object3D): THREE.Quaternion => {
        const q = o.quaternion.clone();
        let p = o.parent;
        while (p && p !== model) {
          q.premultiply(p.quaternion);
          p = p.parent;
        }
        return q;
      };

      for (const { key, bone } of found) {
        bones.set(key, {
          bone,
          modelQ: modelQuat(bone),
          parentInvQ: bone.parent ? modelQuat(bone.parent).invert() : new THREE.Quaternion(),
          restY: bone.position.y,
        });
      }

      // Normalize: height ~1.72 m and feet resting on y = 0
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const s = HEIGHT / (size.y || 1);
      model.scale.setScalar(s);
      model.position.y = -bbox.min.y * s;
      group.add(model);
    },
    undefined,
    () => console.warn('[factory] harley_quinn.glb could not be loaded'),
  );

  // Rotation about a model-space axis: q = parentInvQ * R * modelQ
  const applyModelRot = (key: string, axis: THREE.Vector3, angle: number): void => {
    const ref = bones.get(key);
    if (!ref) return;
    qSwing.setFromAxisAngle(axis, angle);
    ref.bone.quaternion.copy(ref.parentInvQ).multiply(qSwing).multiply(ref.modelQ);
  };

  // Applies a single composed model-space rotation (for bones with 2 rotation terms)
  const applyComposedRot = (
    key: string,
    axisA: THREE.Vector3,
    angleA: number,
    axisB: THREE.Vector3,
    angleB: number,
  ): void => {
    const ref = bones.get(key);
    if (!ref) return;
    qSwing.setFromAxisAngle(axisA, angleA);
    qAux.setFromAxisAngle(axisB, angleB);
    qSwing.multiply(qAux);
    ref.bone.quaternion.copy(ref.parentInvQ).multiply(qSwing).multiply(ref.modelQ);
  };

  const update = (delta: number): void => {
    // 1. Waypoint navigation with smooth cornering
    const [tx, tz] = ROUTE[wp];
    const dx = tx - group.position.x;
    const dz = tz - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      wp = (wp + 1) % ROUTE.length;
      return;
    }
    const vx = dx / dist;
    const vz = dz / dist;
    group.position.x += vx * WALK_SPEED * delta;
    group.position.z += vz * WALK_SPEED * delta;

    const targetRotY = Math.atan2(vx, vz);
    let diff = targetRotY - group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    group.rotation.y += diff * Math.min(1.0, delta * 6.0);

    walked += WALK_SPEED * delta;
    const f = walked * STRIDE_FREQUENCY;

    // 2. Pelvis: fitted bob keeps the stance foot grounded; yaw + roll for hip sway.
    //    Pelvis local units are FBX meters scaled x100 up the chain -> cm * 0.01.
    const pelvis = bones.get('pelvis');
    if (pelvis) {
      pelvis.bone.position.y = pelvis.restY + pelvisBob(f) * 0.01;
      applyComposedRot('pelvis', AX_UP, -PELVIS_YAW * Math.sin(f), AX_FWD, -PELVIS_ROLL * Math.cos(f));
    }

    // 3. Torso counter-rotation + slight forward lean; head steadies the gaze
    applyComposedRot('spine_01', AX_UP, TORSO_YAW * Math.sin(f), AX_LAT, TORSO_LEAN);
    applyModelRot('head', AX_UP, -HEAD_COUNTER * Math.sin(f));

    // 4. Legs (left phase f, right phase f + PI)
    //    About AX_LAT: negative = forward swing (thigh), positive = knee flexion.
    const leg = (thighKey: string, calfKey: string, footKey: string, phi: number): void => {
      const thigh = -HIP_AMP * hipWave(phi);
      const knee =
        KNEE_AMP * Math.pow(Math.max(0, Math.cos(phi)), KNEE_EXP) +
        KNEE_STANCE * Math.max(0, -Math.cos(phi + 0.9));
      const ankle =
        -ANKLE_DORSI * Math.max(0, Math.cos(phi - 0.6)) +
        ANKLE_PUSH * Math.max(0, Math.sin(phi - 2.6));
      applyModelRot(thighKey, AX_LAT, thigh);
      applyModelRot(calfKey, AX_LAT, knee);
      applyModelRot(footKey, AX_LAT, ankle);
    };
    leg('thigh_l', 'calf_l', 'foot_l', f);
    leg('thigh_r', 'calf_r', 'foot_r', f + Math.PI);

    // 5. Arms: drop from A-pose toward the body, swing opposite to the same-side leg.
    //    Elbow flexes a bit more while the arm swings forward.
    const s = Math.sin(f);
    applyComposedRot('upperarm_l', AX_LAT, ARM_SWING * s, AX_FWD, -ARM_DROP);
    applyComposedRot('upperarm_r', AX_LAT, -ARM_SWING * s, AX_FWD, ARM_DROP);
    applyModelRot('lowerarm_l', AX_LAT, -(ELBOW_BASE + ELBOW_FLEX * Math.max(0, -s)));
    applyModelRot('lowerarm_r', AX_LAT, -(ELBOW_BASE + ELBOW_FLEX * Math.max(0, s)));
  };

  const dispose = (): void => {
    disposed = true;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  };

  return { update, dispose };
}
