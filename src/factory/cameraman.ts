import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Agente de seguridad (cameraman.glb, rig ValveBiped "CICADA Bodyguard") patrullando
 * frente a la oficina de gerencia.
 *
 * El clip embebido del GLB solo anima brazos/dedos (pose estática) y el rig NO
 * descansa de pie: pierna izquierda adelantada +0.54 rad, derecha atrás -0.50 rad,
 * pie derecho en puntillas, antebrazo derecho levantado. Por eso la caminata es
 * procedural con NORMALIZACIÓN DE POSE: cada articulación se corrige de su lean rest
 * a un objetivo sagital absoluto (en el espacio del modelo, conjugado por la
 * orientación rest del padre, igual que src/factory/harley.ts), y el bob de pelvis se
 * resuelve en forma cerrada por frame para que el pie de apoyo toque el suelo.
 * Curvas calibradas con .artifacts/gait_sim.mjs y verificación headless.
 */

const MODEL_URL = '/cameraman.glb';
const HEIGHT = 1.8; // normalized model height (m)

// Patrol: short beat across the office-front plaza. The office spans x 50.4..62.4,
// z ±6.93 (south wall at z = 6.93, glass/door facade at z ≈ 7.06, door at x ≈ 59.5),
// so every waypoint stays SOUTH of the facade (z ≥ 7.6) and west of the east wall:
// the guard paces in front of the glass and the door, never through them.
const PATROL: ReadonlyArray<readonly [number, number]> = [
  [56.2, 7.7],
  [61.4, 7.7],
  [61.4, 13.0],
  [56.2, 13.0],
];
const WALK_SPEED = 0.55; // m/s — vigilance pace (~1.3 steps/s)
const STRIDE_FREQUENCY = 5.24; // rad/m — anti-slide calibration (same as harley)

const AX_LAT = new THREE.Vector3(1, 0, 0); // sagittal swing (negative = forward)
const AX_UP = new THREE.Vector3(0, 1, 0); // yaw
const AX_FWD = new THREE.Vector3(0, 0, 1); // coronal (arm adduction)

const HIP_AMP = 0.4;
const HIP_FLATTEN = 0.15;
const KNEE_AMP = 0.75;
const KNEE_EXP = 1.5;
const KNEE_STANCE = 0.12;
const ANKLE_DORSI = 0.2;
const ANKLE_PUSH = 0.2;
const PELVIS_YAW = 0.06;
const PELVIS_ROLL = 0.045;
const TORSO_YAW = 0.045;
const ARM_OUT = 0.15; // resting abduction from vertical (rad)
const ARM_SWING = 0.28;
const ELBOW_BASE = 0.25;
const ELBOW_FLEX = 0.35;
const FOOT_PITCH_FLAT = 1.03; // sole flat: foot->toe lean from vertical (rad)

// ValveBiped node fragments (lowercase) for each logical bone
const FRAG = (side: 'l' | 'r', part: string): string => `${side}_${part}`;
const KEYS = ['pelvis', 'spine1'] as const;
type BoneMap = Map<string, THREE.Bone>;

interface BoneRef {
  bone: THREE.Bone;
  modelQ: THREE.Quaternion; // rest orientation in model space
  parentInvQ: THREE.Quaternion;
  restPos: THREE.Vector3;
  parentUpLocal: THREE.Vector3; // parent-frame direction mapping to model +Y
  parentYScale: number; // model units per local position unit (bob conversion)
}

interface LegSeg {
  key: string;
  cur: number; // rest lean from vertical (rad, +forward)
  len: number; // segment length (model units)
}

interface ArmRest {
  psi: number; // abduction from vertical in the coronal plane (rad, +outward)
  pitch: number; // lean from vertical in the sagittal plane (rad, +forward)
}

const hipWave = (phi: number): number => Math.sin(phi) - HIP_FLATTEN * Math.sin(3 * phi);

export function createCameraman(
  scene: THREE.Scene,
  position: [number, number, number],
  faceRotation: number,
): { update: (delta: number) => void; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'cameraman';
  group.position.set(...position);
  group.rotation.y = faceRotation;
  scene.add(group);

  let disposed = false;
  const refs = new Map<string, BoneRef>();
  let legL: { thigh: LegSeg; calf: LegSeg; foot: LegSeg } | null = null;
  let legR: { thigh: LegSeg; calf: LegSeg; foot: LegSeg } | null = null;
  let armL: ArmRest | null = null;
  let armR: ArmRest | null = null;
  let foreLCur = 0;
  let foreRCur = 0;
  let contactY = 0;
  let pelvisY0 = 0;
  let wp = 1;
  let walked = 0;

  const qSwing = new THREE.Quaternion();
  const qAux = new THREE.Quaternion();

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      const byName: BoneMap = new Map();
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.frustumCulled = false;
        }
        if ((o as THREE.Bone).isBone) byName.set(o.name.toLowerCase(), o as THREE.Bone);
      });
      const findBone = (frag: string): THREE.Bone | null => {
        for (const [name, bone] of byName) if (name.includes(frag)) return bone;
        return null;
      };

      const modelQuat = (o: THREE.Object3D): THREE.Quaternion => {
        const q = o.quaternion.clone();
        let p = o.parent;
        while (p && p !== model) {
          q.premultiply(p.quaternion);
          p = p.parent;
        }
        return q;
      };
      const modelPos = (o: THREE.Object3D): THREE.Vector3 => {
        const chain: THREE.Object3D[] = [];
        let p: THREE.Object3D | null = o;
        while (p && p !== model) {
          chain.unshift(p);
          p = p.parent;
        }
        const m = new THREE.Matrix4();
        for (const n of chain) m.multiply(new THREE.Matrix4().compose(n.position, n.quaternion, n.scale));
        return new THREE.Vector3().setFromMatrixPosition(m);
      };
      const yScaleAbove = (o: THREE.Object3D): number => {
        let s = 1;
        let p = o.parent;
        while (p && p !== model) {
          s *= p.scale.y;
          p = p.parent;
        }
        return s;
      };

      const register = (key: string, bone: THREE.Bone | null): void => {
        if (!bone || !bone.parent) return;
        const parentInvQ = modelQuat(bone.parent).invert();
        refs.set(key, {
          bone,
          modelQ: modelQuat(bone),
          parentInvQ,
          restPos: bone.position.clone(),
          parentUpLocal: new THREE.Vector3(0, 1, 0).applyQuaternion(parentInvQ),
          parentYScale: yScaleAbove(bone),
        });
      };
      for (const k of KEYS) register(k, findBone(k));
      for (const side of ['l', 'r'] as const)
        for (const part of ['thigh', 'calf', 'foot', 'upperarm', 'forearm'])
          register(`${part}_${side}`, findBone(FRAG(side, part)));

      // Segment lean from vertical (model space, + = toward +Z) and length
      const seg = (key: string, childFrag: string): LegSeg => {
        const child = findBone(childFrag) ?? refs.get(key)?.bone;
        const a = modelPos(refs.get(key)!.bone);
        const v = modelPos(child!).sub(a);
        const len = Math.max(v.length(), 1e-6);
        v.normalize();
        return { key, cur: Math.atan2(v.z, -v.y), len };
      };
      const footSeg = (side: 'l' | 'r'): LegSeg => {
        const toe = findBone(FRAG(side, 'toe0'));
        if (!toe) return { key: `foot_${side}`, cur: FOOT_PITCH_FLAT, len: 0 };
        const v = modelPos(toe).sub(modelPos(refs.get(`foot_${side}`)!.bone)).normalize();
        return { key: `foot_${side}`, cur: Math.atan2(v.z, -v.y), len: 0 };
      };
      const armRest = (side: 'l' | 'r'): ArmRest => {
        const up = refs.get(`upperarm_${side}`)!.bone;
        const fo = refs.get(`forearm_${side}`)!.bone;
        const v = modelPos(fo).sub(modelPos(up)).normalize();
        return {
          psi: Math.atan2(side === 'l' ? v.x : -v.x, -v.y),
          pitch: Math.atan2(v.z, -v.y),
        };
      };

      legL = { thigh: seg('thigh_l', FRAG('l', 'calf')), calf: seg('calf_l', FRAG('l', 'foot')), foot: footSeg('l') };
      legR = { thigh: seg('thigh_r', FRAG('r', 'calf')), calf: seg('calf_r', FRAG('r', 'foot')), foot: footSeg('r') };
      armL = armRest('l');
      armR = armRest('r');
      foreLCur = (() => {
        const v = modelPos(findBone(FRAG('l', 'hand'))!).sub(modelPos(refs.get('forearm_l')!.bone)).normalize();
        return Math.atan2(v.z, -v.y);
      })();
      foreRCur = (() => {
        const v = modelPos(findBone(FRAG('r', 'hand'))!).sub(modelPos(refs.get('forearm_r')!.bone)).normalize();
        return Math.atan2(v.z, -v.y);
      })();

      pelvisY0 = modelPos(refs.get('pelvis')!.bone).y;
      contactY = Math.min(modelPos(refs.get('foot_l')!.bone).y, modelPos(refs.get('foot_r')!.bone).y);

      // Normalize: height ~1.8 m and feet resting on y = 0
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const s = HEIGHT / (size.y || 1);
      model.scale.setScalar(s);
      model.position.y = -bbox.min.y * s;
      group.add(model);

      // Patrol starts at the first waypoint
      group.position.set(PATROL[0][0], group.position.y, PATROL[0][1]);
    },
    undefined,
    () => console.warn('[factory] cameraman.glb could not be loaded'),
  );

  // Premultiplied model-space rotation: q = parentInvQ * R * modelQ
  const applyModelRot = (key: string, axis: THREE.Vector3, angle: number): void => {
    const ref = refs.get(key);
    if (!ref) return;
    qSwing.setFromAxisAngle(axis, angle);
    ref.bone.quaternion.copy(ref.parentInvQ).multiply(qSwing).multiply(ref.modelQ);
  };

  // Absolute sagittal targets: premultiplied model-space X-rotations are ADDITIVE down
  // the chain, so each segment compensates the lean delta already applied by its parent
  // (alpha reduces the segment lean: R_x(alpha) leans backward for alpha > 0).
  const legPose = (leg: { thigh: LegSeg; calf: LegSeg; foot: LegSeg }, phi: number): number => {
    const thighT = HIP_AMP * hipWave(phi);
    const knee =
      KNEE_AMP * Math.pow(Math.max(0, Math.cos(phi)), KNEE_EXP) +
      KNEE_STANCE * Math.max(0, -Math.cos(phi + 0.9));
    const calfT = thighT - knee; // knee flexion leans the calf backward
    // Absolute foot pitch vs vertical (FOOT_PITCH_FLAT = sole flat on the ground).
    // Human gait: DORSIFLEXION (toe up) during swing so the foot clears the floor,
    // PLANTARFLEXION (heel rises, toe presses down) at push-off. footT is the lean
    // angle from vertical, so dorsiflexion ADDS and push-off SUBTRACTS — the old
    // signs were inverted and showed the toe cranked up exactly at push-off.
    const footT =
      FOOT_PITCH_FLAT + ANKLE_DORSI * Math.max(0, Math.cos(phi - 0.6)) - ANKLE_PUSH * Math.max(0, Math.sin(phi - 2.6));
    const alphaThigh = -(thighT - leg.thigh.cur);
    applyModelRot(leg.thigh.key, AX_LAT, alphaThigh);
    const leanAfterThigh = leg.calf.cur - alphaThigh;
    const alphaCalf = -(calfT - leanAfterThigh);
    applyModelRot(leg.calf.key, AX_LAT, alphaCalf);
    const footSoFar = leg.foot.cur - alphaThigh - alphaCalf;
    applyModelRot(leg.foot.key, AX_LAT, -(footT - footSoFar));
    return leg.thigh.len * Math.cos(thighT) + leg.calf.len * Math.cos(calfT);
  };

  const update = (delta: number): void => {
    if (!legL || !legR || !armL || !armR) return;

    // 1. Patrol navigation with smooth cornering
    const [tx, tz] = PATROL[wp];
    const dx = tx - group.position.x;
    const dz = tz - group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      wp = (wp + 1) % PATROL.length;
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
    group.rotation.y += diff * Math.min(1.0, delta * 4.5);

    walked += WALK_SPEED * delta;
    const f = walked * STRIDE_FREQUENCY;

    // 2. Legs (left phase f, right f + PI)
    const extL = legPose(legL, f);
    const extR = legPose(legR, f + Math.PI);

    // 3. Pelvis: geometric grounding bob + hip sway (position in parent units)
    const pelvis = refs.get('pelvis');
    if (pelvis) {
      const bob = THREE.MathUtils.clamp(Math.min(extL, extR) + contactY - pelvisY0, -0.15, 0.4);
      pelvis.bone.position.copy(pelvis.restPos).addScaledVector(pelvis.parentUpLocal, bob / pelvis.parentYScale);
      qSwing.setFromAxisAngle(AX_UP, -PELVIS_YAW * Math.sin(f));
      qAux.setFromAxisAngle(AX_FWD, -PELVIS_ROLL * Math.cos(f));
      qSwing.multiply(qAux);
      pelvis.bone.quaternion.copy(pelvis.parentInvQ).multiply(qSwing).multiply(pelvis.modelQ);
    }

    // 4. Torso counter-rotation
    applyModelRot('spine1', AX_UP, TORSO_YAW * Math.sin(f));

    // 5. Arms: normalize to a relaxed hang (coronal drop + sagittal swing), elbows
    //    flex forward; arm swings opposite to the same-side leg. `swing` is the TARGET
    //    absolute upperarm pitch (forward positive), parent-delta compensated.
    const s = Math.sin(f);
    const arm = (side: 'l' | 'r', rest: ArmRest, foreCurPitch: number, swing: number, sgn: 1 | -1): void => {
      const key = `upperarm_${side}`;
      const ref = refs.get(key);
      if (!ref) return;
      const alphaUpPitch = -(swing - rest.pitch);
      qAux.setFromAxisAngle(AX_FWD, (ARM_OUT - rest.psi) * sgn);
      qSwing.setFromAxisAngle(AX_LAT, alphaUpPitch);
      qSwing.multiply(qAux);
      ref.bone.quaternion.copy(ref.parentInvQ).multiply(qSwing).multiply(ref.modelQ);
      // Elbow: forearm absolute pitch = upperarm pitch + flexion (parent-delta chain)
      const flex = ELBOW_BASE + ELBOW_FLEX * Math.max(0, side === 'l' ? -s : s);
      applyModelRot(`forearm_${side}`, AX_LAT, -(swing + flex - (foreCurPitch - alphaUpPitch)));
    };
    arm('l', armL, foreLCur, -ARM_SWING * s, 1);
    arm('r', armR, foreRCur, ARM_SWING * s, -1);
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
