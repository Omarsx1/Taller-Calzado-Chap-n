import * as THREE from 'three';
import type { HotspotDef } from './factory.config';

/**
 * DOM overlay of hotspot markers that track world-space anchors.
 *
 * The layer owns its buttons and its listeners: nothing is attached to
 * `window` or to shared globals, so the tour stays portable. Occlusion is
 * resolved with a raycast against a small occluder list, recomputed only every
 * sixth frame while screen positions update every frame.
 */

const OCCLUSION_INTERVAL = 6;
const OCCLUSION_BIAS = 0.35;

export class HotspotLayer {
  private readonly host: HTMLElement;
  private readonly camera: THREE.Camera;
  private readonly defs: readonly HotspotDef[];
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly occluded: boolean[] = [];
  private readonly abort = new AbortController();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly anchorWorld = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private frame = 0;

  constructor(
    host: HTMLElement,
    camera: THREE.Camera,
    defs: readonly HotspotDef[],
    onSelect: (def: HotspotDef) => void,
  ) {
    this.host = host;
    this.camera = camera;
    this.defs = defs;

    const { signal } = this.abort;
    defs.forEach((def) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'factory-hotspot';
      button.textContent = def.title;
      button.setAttribute('aria-label', `Ver información: ${def.title}`);
      button.hidden = true;
      button.addEventListener('click', () => onSelect(def), { signal });
      host.appendChild(button);
      this.buttons.push(button);
      this.occluded.push(false);
    });
  }

  /** Marks one hotspot button as the current selection. */
  setActive(id: string | null): void {
    this.defs.forEach((def, index) => {
      const button = this.buttons[index];
      if (def.id === id) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  /**
   * Projects every anchor and hides markers that are behind or occluded.
   * `insideWorkshop` gates the whole layer: markers are an interior affordance
   * and fade out while the camera orbits outside the building shell.
   */
  update(occluders: THREE.Object3D[], insideWorkshop: boolean): void {
    this.frame += 1;
    this.host.classList.toggle('is-outside', !insideWorkshop);
    if (!insideWorkshop) return;

    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const runOcclusion = this.frame % OCCLUSION_INTERVAL === 0;

    this.defs.forEach((def, index) => {
      const button = this.buttons[index];
      this.anchorWorld.set(def.anchor[0], def.anchor[1], def.anchor[2]);
      this.projected.copy(this.anchorWorld).project(this.camera);

      if (this.projected.z >= 1 || this.projected.z <= -1) {
        button.hidden = true;
        return;
      }

      if (runOcclusion) {
        const cameraDistance = this.camera.position.distanceTo(this.anchorWorld);
        this.pointer.set(this.projected.x, this.projected.y);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(occluders, true);
        let blocked = false;
        for (const hit of hits) {
          if (hit.distance < cameraDistance - OCCLUSION_BIAS) {
            blocked = true;
            break;
          }
        }
        this.occluded[index] = blocked;
      }

      if (this.occluded[index]) {
        button.hidden = true;
        return;
      }

      const x = (this.projected.x * 0.5 + 0.5) * width;
      const y = (-this.projected.y * 0.5 + 0.5) * height;
      button.hidden = false;
      // Pill floats above the anchor with a 10px stem pointing at the point
      button.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, calc(-100% - 10px))`;
      button.style.zIndex = String(Math.max(0, Math.round((1 - this.projected.z) * 1000)));
    });
  }

  /** Removes every button and listener created by this layer. */
  dispose(): void {
    this.abort.abort();
    for (const button of this.buttons) button.remove();
    this.buttons.length = 0;
  }
}
