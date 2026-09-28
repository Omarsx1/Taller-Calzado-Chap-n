import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Battle Bus Flying System:
 * Loads /battle_bus.glb and animates it flying smoothly across the sky above the factory map.
 *
 * Flight characteristics:
 * - Altitude: Flies at Y ≈ 48m - 58m above the terrain (clearly visible when zooming out or looking up).
 * - Smooth loop trajectory traversing the sky across the map (West to East and returning via South curve).
 * - Natural aerodynamic bobbing (slight pitch and roll waves) as the hot air balloon sails.
 * - Normalized scale: 8.5m length equivalent so it looks proportional to the 93m factory complex.
 */

const MODEL_URL = '/battle_bus.glb';
const FLY_SPEED = 2.4; // m/s (~8.6 km/h cruising speed — very slow and majestic hot-air balloon glide)

// Waypoints above the factory complex and mountain perimeter:
// Factory bounds: X: -60..+65, Z: -25..+35.
// Sky trajectory loops broadly across the entire sky horizon.
const FLIGHT_PATH: ReadonlyArray<readonly [number, number, number]> = [
  [-160, 56, -80],
  [-60, 60, -50],
  [40, 62, -35],
  [140, 58, -10],
  [150, 56, 65],
  [50, 54, 85],
  [-60, 52, 75],
  [-150, 54, 15],
];

export function createBattleBusFlyer(scene: THREE.Scene): {
  update: (delta: number) => void;
  dispose: () => void;
} {
  const container = new THREE.Group();
  container.name = 'battle_bus_flyer';
  container.position.set(FLIGHT_PATH[0][0], FLIGHT_PATH[0][1], FLIGHT_PATH[0][2]);
  scene.add(container);

  let disposed = false;
  let modelGroup: THREE.Group | null = null;
  let currentWp = 1;
  let flightTime = 0;

  // Visual beacon light / thruster light under the bus
  const thrusterLight = new THREE.PointLight(0x44aaff, 3.5, 45);
  thrusterLight.position.set(0, -1.2, 0);
  container.add(thrusterLight);

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;

      // Enable shadows and hide sky sphere backdrop if present
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          // Object_5 (Mesh 3) with material bus1910_Material__35 is a giant spherical backdrop from Sketchfab
          if (m.name === 'Object_5' || (m.material && !Array.isArray(m.material) && m.material.name === 'bus1910_Material__35')) {
            m.visible = false;
            return;
          }
          m.castShadow = true;
          m.receiveShadow = false;
          if (m.material) {
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => {
                mat.depthWrite = true;
              });
            } else {
              m.material.depthWrite = true;
            }
          }
        }
      });

      // Compute bounding box of visible bus meshes
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const center = new THREE.Vector3();
      bbox.getCenter(center);

      // Desired length for the battle bus in the sky (32m length along horizontal axis Z — ~2.5x larger and clearly prominent in the sky)
      const targetScale = 32.0 / (size.z || 1);

      // Center the geometry pivot so rotation and banking feel natural
      model.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale);
      model.scale.setScalar(targetScale);

      // Container moves along heading vector (atan2(x, z)). In Three.js, +Z is forward for rotation.y=0.
      const modelWrapper = new THREE.Group();
      modelWrapper.name = 'bus_model_wrapper';
      modelWrapper.add(model);

      container.add(modelWrapper);
      modelGroup = modelWrapper;
    },
    undefined,
    (err) => {
      console.warn('[factory] Failed to load battle_bus.glb:', err);
    },
  );

  const targetVec = new THREE.Vector3();
  const currentPos = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  const update = (delta: number): void => {
    if (disposed) return;
    flightTime += delta;

    // Pulse thruster light
    thrusterLight.intensity = 3.5 + Math.sin(flightTime * 8.0) * 1.2;

    const wp = FLIGHT_PATH[currentWp];
    targetVec.set(wp[0], wp[1], wp[2]);
    currentPos.copy(container.position);

    moveDir.subVectors(targetVec, currentPos);
    const dist = moveDir.length();

    if (dist < 5.0) {
      currentWp = (currentWp + 1) % FLIGHT_PATH.length;
      return;
    }

    moveDir.normalize();
    const step = FLY_SPEED * delta;
    container.position.addScaledVector(moveDir, step);

    // Natural flight bobbing (slight altitude float and gentle pitching)
    const altitudeBob = Math.sin(flightTime * 1.2) * 0.35;
    container.position.y += altitudeBob * delta;

    // Smooth yaw rotation towards heading
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    let diffYaw = targetYaw - container.rotation.y;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    container.rotation.y += diffYaw * Math.min(1.0, delta * 3.0);

    // Gentle banking (roll) during turns + pitch wave
    if (modelGroup) {
      const turnRate = diffYaw;
      const targetRoll = THREE.MathUtils.clamp(-turnRate * 1.5, -0.22, 0.22);
      modelGroup.rotation.z = THREE.MathUtils.lerp(modelGroup.rotation.z, targetRoll, delta * 4.0);

      // Subtle atmospheric sway (pitch)
      const swayPitch = Math.sin(flightTime * 1.5) * 0.04;
      modelGroup.rotation.x = swayPitch;
    }
  };

  const dispose = (): void => {
    disposed = true;
    container.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
    scene.remove(container);
  };

  return { update, dispose };
}
