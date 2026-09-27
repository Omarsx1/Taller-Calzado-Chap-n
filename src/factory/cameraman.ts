import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Agente de seguridad (cameraman.glb, rig CICADA Bodyguard con clip
 * "Animation") apostado fuera de la oficina de gerencia. Normalizado a
 * ~1.8 m, sombras y animación en loop.
 */

const MODEL_URL = '/cameraman.glb';
const HEIGHT = 1.8;

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

  let mixer: THREE.AnimationMixer | null = null;
  let disposed = false;

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
            m.frustumCulled = false;
          }
        });
        // Normalizar: altura ~1.8 m y pies en y = 0
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const s = HEIGHT / (size.y || 1);
        model.scale.setScalar(s);
        model.position.y = -bbox.min.y * s;
        group.add(model);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      () => console.warn('[factory] cameraman.glb no cargó'),
    );

  const update = (delta: number): void => {
    mixer?.update(delta);
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
