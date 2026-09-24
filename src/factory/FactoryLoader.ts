import type { WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Documented swap-in point for the real baked model.
 *
 * The procedural blockout never loads a file, but this factory wires the
 * full compressed pipeline (Draco + KTX2/Basis + Meshopt) so the Astro port
 * can drop in the exported `.glb` without touching the rest of the tour.
 * Decoder assets are served from `/factory/draco/` and `/factory/basis/`.
 */
export function createGltfLoader(renderer: WebGLRenderer): {
  loader: GLTFLoader;
  dispose: () => void;
} {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/factory/draco/');

  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('/factory/basis/');
  ktx2Loader.detectSupport(renderer);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const dispose = (): void => {
    dracoLoader.dispose();
    ktx2Loader.dispose();
  };

  return { loader, dispose };
}
