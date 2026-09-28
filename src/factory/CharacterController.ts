import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Third-person & First-person Character Controller for Calzado Chapín Factory Tour.
 *
 * Features:
 * - Full WASD / Arrow Key movement relative to camera direction.
 * - Shift to Sprint (up to 7.5 m/s), Space to Jump (with vertical gravity arc).
 * - Full 360° mouse-look orbit in 3rd person and mouselook in 1st person.
 * - 'V' key toggle between 3rd Person and 1st Person view.
 * - Procedural biomechanical gait engine (Harley Quinn rig) with speed-adaptive frequency,
 *   hip sway, arm balance, jump suspension, and breathing idle animation.
 * - Zero-delay fallback avatar while GLB loads, seamlessly swapped once ready.
 * - Ground collision and soft boundary clamping to explore the entire 93m+ factory grounds.
 * - Touch joystick and on-screen controls for mobile/tablet devices.
 */

const MODEL_URL = '/harley_quinn.glb';
const HEIGHT = 1.72; // Character height in meters

// Movement speeds
const WALK_SPEED = 3.6; // m/s (~13 km/h)
const RUN_SPEED = 7.2; // m/s (~26 km/h)
const JUMP_FORCE = 5.6; // m/s upward velocity
const GRAVITY = 15.0; // m/s² downward acceleration
const ROTATION_SPEED = 12.0; // rad/s for turning to movement direction

// Camera settings
const CAM_DIST_DEFAULT = 3.8;
const CAM_DIST_MIN = 1.5;
const CAM_DIST_MAX = 8.0;
const CAM_HEIGHT_OFFSET = 1.45; // Shoulder/head anchor height
const EYE_HEIGHT = 1.65; // 1st person eye level

// Model-space anatomical axes
const AX_LAT = new THREE.Vector3(1, 0, 0); // Sagittal (swing/pitch)
const AX_UP = new THREE.Vector3(0, 1, 0); // Yaw
const AX_FWD = new THREE.Vector3(0, 0, 1); // Roll / adduction

// Gait amplitudes
const HIP_AMP = 0.46;
const HIP_FLATTEN = 0.15;
const KNEE_AMP = 0.85;
const KNEE_EXP = 1.5;
const KNEE_STANCE = 0.12;
const ANKLE_DORSI = 0.22;
const ANKLE_PUSH = 0.2;
const PELVIS_YAW = 0.08;
const PELVIS_ROLL = 0.06;
const TORSO_YAW = 0.06;
const TORSO_LEAN = 0.08;
const HEAD_COUNTER = 0.04;
const ARM_DROP = 0.48;
const ARM_SWING = 0.35;
const ELBOW_BASE = 0.18;
const ELBOW_FLEX = 0.4;

// Pelvis vertical bob Fourier coefficients
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

const hipWave = (phi: number): number => Math.sin(phi) - HIP_FLATTEN * Math.sin(3 * phi);

interface BoneRef {
  bone: THREE.Bone;
  modelQ: THREE.Quaternion;
  parentInvQ: THREE.Quaternion;
  restY: number;
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

export interface CharacterControllerOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  initialPosition?: [number, number, number];
  onExit?: () => void;
  onViewChange?: (isFirstPerson: boolean) => void;
}

export class CharacterController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private onExit?: () => void;
  private onViewChange?: (isFirstPerson: boolean) => void;

  public group: THREE.Group;
  private avatarMesh: THREE.Group | null = null;
  private placeholderGroup: THREE.Group;
  private bones = new Map<string, BoneRef>();

  // State
  public position = new THREE.Vector3(0, 0, 18);
  public velocity = new THREE.Vector3();
  public verticalVelocity = 0;
  public isGrounded = true;
  public isRunning = false;
  public isFirstPerson = false;
  public active = false;

  // Rotation & Camera
  public characterYaw = Math.PI; // Facing towards factory (-Z)
  public cameraYaw = 0; // Camera behind character looking towards -Z
  public cameraPitch = 0.28; // Looking slightly down
  public cameraDistance = CAM_DIST_DEFAULT;

  private currentCamPos = new THREE.Vector3();
  private currentCamTarget = new THREE.Vector3();

  // Animation state
  private gaitPhase = 0;
  private walkWeight = 0; // 0 = idle, 1 = moving
  private moveSpeed = 0;

  // Input states
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };

  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private isTouching = false;

  // Temporary vectors for garbage-free loop
  private qSwing = new THREE.Quaternion();
  private qAux = new THREE.Quaternion();
  private moveDir = new THREE.Vector3();
  private camForward = new THREE.Vector3();
  private camRight = new THREE.Vector3();

  private abortController = new AbortController();

  constructor(options: CharacterControllerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.onExit = options.onExit;
    this.onViewChange = options.onViewChange;

    if (options.initialPosition) {
      this.position.set(...options.initialPosition);
    }

    this.group = new THREE.Group();
    this.group.name = 'player_character';
    this.group.position.copy(this.position);
    this.group.visible = false; // Hidden until activated
    this.scene.add(this.group);

    // Initial placeholder avatar while 3D mesh loads
    this.placeholderGroup = this.createPlaceholderAvatar();
    this.group.add(this.placeholderGroup);

    this.loadAvatarModel();
    this.bindInputs();
  }

  /**
   * Stylized low-poly mannequin placeholder (Chapín Cyan/Navy/White)
   */
  private createPlaceholderAvatar(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'placeholder_avatar';

    const matBody = new THREE.MeshStandardMaterial({
      color: 0x0584c7, // Azul añil Chapín
      roughness: 0.4,
      metalness: 0.1,
    });
    const matSkin = new THREE.MeshStandardMaterial({
      color: 0xffd1a4,
      roughness: 0.6,
    });
    const matShoes = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Obsidiana
      roughness: 0.3,
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.45, 8, 16), matBody);
    torso.position.y = 1.05;
    torso.castShadow = true;
    root.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), matSkin);
    head.position.y = 1.54;
    head.castShadow = true;
    root.add(head);

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.65, 12), matBody);
    legL.position.set(-0.13, 0.45, 0);
    legL.castShadow = true;
    root.add(legL);

    const legR = legL.clone();
    legR.position.x = 0.13;
    root.add(legR);

    // Shoes
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.24), matShoes);
    shoeL.position.set(-0.13, 0.05, 0.04);
    shoeL.castShadow = true;
    root.add(shoeL);

    const shoeR = shoeL.clone();
    shoeR.position.x = 0.13;
    root.add(shoeR);

    return root;
  }

  /**
   * Load Harley Quinn rigged GLB model
   */
  private loadAvatarModel(): void {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'harley_avatar_mesh';

        const found: Array<{ key: string; bone: THREE.Bone }> = [];
        model.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.frustumCulled = false;
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
          this.bones.set(key, {
            bone,
            modelQ: modelQuat(bone),
            parentInvQ: bone.parent ? modelQuat(bone.parent).invert() : new THREE.Quaternion(),
            restY: bone.position.y,
          });
        }

        // Normalize height & scale
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const s = HEIGHT / (size.y || 1);
        model.scale.setScalar(s);
        model.position.y = -bbox.min.y * s;

        // Swap placeholder with real mesh
        this.group.remove(this.placeholderGroup);
        this.avatarMesh = model;
        this.group.add(model);
      },
      undefined,
      (err) => console.warn('[factory] Character GLB load fallback active:', err),
    );
  }

  private applyModelRot(key: string, axis: THREE.Vector3, angle: number): void {
    const ref = this.bones.get(key);
    if (!ref) return;
    this.qSwing.setFromAxisAngle(axis, angle);
    ref.bone.quaternion.copy(ref.parentInvQ).multiply(this.qSwing).multiply(ref.modelQ);
  }

  private applyComposedRot(
    key: string,
    axisA: THREE.Vector3,
    angleA: number,
    axisB: THREE.Vector3,
    angleB: number,
  ): void {
    const ref = this.bones.get(key);
    if (!ref) return;
    this.qSwing.setFromAxisAngle(axisA, angleA);
    this.qAux.setFromAxisAngle(axisB, angleB);
    this.qSwing.multiply(this.qAux);
    ref.bone.quaternion.copy(ref.parentInvQ).multiply(this.qSwing).multiply(ref.modelQ);
  }

  /**
   * Bind keyboard, mouse, pointer and touch inputs
   */
  private bindInputs(): void {
    const { signal } = this.abortController;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.active) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          e.preventDefault();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          e.preventDefault();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          e.preventDefault();
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        case 'Space':
          this.keys.jump = true;
          if (this.isGrounded) {
            this.verticalVelocity = JUMP_FORCE;
            this.isGrounded = false;
          }
          e.preventDefault();
          break;
        case 'KeyV':
          this.toggleViewMode();
          e.preventDefault();
          break;
        case 'Escape':
          if (this.onExit) this.onExit();
          e.preventDefault();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!this.active) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown, { signal });
    window.addEventListener('keyup', onKeyUp, { signal });

    // Mouse look / drag
    const onMouseDown = (e: MouseEvent) => {
      if (!this.active) return;
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.active || !this.isDragging) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      const sensitivity = 0.005;
      this.cameraYaw += dx * sensitivity;
      this.cameraPitch = Math.max(-0.6, Math.min(1.2, this.cameraPitch + dy * sensitivity));
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!this.active || this.isFirstPerson) return;
      this.cameraDistance = Math.max(
        CAM_DIST_MIN,
        Math.min(CAM_DIST_MAX, this.cameraDistance + e.deltaY * 0.005),
      );
    };

    // Touch controls
    const onTouchStart = (e: TouchEvent) => {
      if (!this.active || e.touches.length === 0) return;
      this.isTouching = true;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.active || !this.isTouching || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - this.touchStartX;
      const dy = e.touches[0].clientY - this.touchStartY;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;

      const sensitivity = 0.006;
      this.cameraYaw += dx * sensitivity;
      this.cameraPitch = Math.max(-0.6, Math.min(1.2, this.cameraPitch + dy * sensitivity));
    };

    const onTouchEnd = () => {
      this.isTouching = false;
    };

    this.domElement.addEventListener('mousedown', onMouseDown, { signal });
    window.addEventListener('mousemove', onMouseMove, { signal });
    window.addEventListener('mouseup', onMouseUp, { signal });
    this.domElement.addEventListener('wheel', onWheel, { signal, passive: true });

    this.domElement.addEventListener('touchstart', onTouchStart, { signal, passive: true });
    window.addEventListener('touchmove', onTouchMove, { signal, passive: true });
    window.addEventListener('touchend', onTouchEnd, { signal });
  }

  /**
   * Set joystick direction from touch controls (-1..1 range)
   */
  public setJoystickInput(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len < 0.15) {
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
    } else {
      this.keys.forward = y < -0.3;
      this.keys.backward = y > 0.3;
      this.keys.left = x < -0.3;
      this.keys.right = x > 0.3;
    }
  }

  public setSprint(active: boolean): void {
    this.keys.sprint = active;
  }

  public triggerJump(): void {
    if (this.isGrounded && this.active) {
      this.verticalVelocity = JUMP_FORCE;
      this.isGrounded = false;
    }
  }

  /**
   * Toggle between 3rd Person and 1st Person view mode
   */
  public toggleViewMode(): void {
    this.isFirstPerson = !this.isFirstPerson;
    if (this.group) {
      // In first person, hide the player mesh so it doesn't obstruct view
      if (this.avatarMesh) this.avatarMesh.visible = !this.isFirstPerson;
      this.placeholderGroup.visible = !this.isFirstPerson;
    }
    if (this.onViewChange) this.onViewChange(this.isFirstPerson);
  }

  /**
   * Activate character mode
   */
  public activate(spawnPos?: [number, number, number]): void {
    this.active = true;
    this.group.visible = true;
    if (spawnPos) {
      this.position.set(...spawnPos);
      this.group.position.copy(this.position);
    }
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.cameraYaw = 0;
    this.characterYaw = Math.PI;
    this.cameraPitch = 0.24;
    this.cameraDistance = CAM_DIST_DEFAULT;

    // Reset camera tracking
    this.currentCamPos.copy(this.camera.position);
    this.currentCamTarget.copy(this.position);

    // Ensure model visibility matches view mode
    if (this.avatarMesh) this.avatarMesh.visible = !this.isFirstPerson;
    this.placeholderGroup.visible = !this.isFirstPerson;
  }

  /**
   * Deactivate character mode
   */
  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.sprint = false;
    this.keys.jump = false;
    this.isDragging = false;
    this.isTouching = false;
  }

  /**
   * Teleport character to a specific landmark/zone
   */
  public teleport(x: number, y: number, z: number, yaw?: number): void {
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
    if (yaw !== undefined) {
      this.characterYaw = yaw;
      this.cameraYaw = yaw;
    }
    this.verticalVelocity = 0;
    this.isGrounded = true;
  }

  /**
   * Main update loop called each frame
   */
  public update(delta: number): void {
    if (!this.active) return;
    const dt = Math.min(delta, 0.1); // Guard against giant delta jumps

    // 1. Calculate movement direction relative to camera forward & right
    this.camForward.set(Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)).normalize();
    this.camRight.set(Math.cos(this.cameraYaw), 0, Math.sin(this.cameraYaw)).normalize();

    this.moveDir.set(0, 0, 0);
    if (this.keys.forward) this.moveDir.add(this.camForward);
    if (this.keys.backward) this.moveDir.sub(this.camForward);
    if (this.keys.left) this.moveDir.sub(this.camRight);
    if (this.keys.right) this.moveDir.add(this.camRight);

    const hasInput = this.moveDir.lengthSq() > 0.001;
    if (hasInput) {
      this.moveDir.normalize();
      this.isRunning = this.keys.sprint;
      const targetSpeed = this.isRunning ? RUN_SPEED : WALK_SPEED;
      this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, targetSpeed, dt * 10);

      // Smoothly rotate character to face movement direction
      const targetRotY = Math.atan2(this.moveDir.x, this.moveDir.z);
      let diff = targetRotY - this.characterYaw;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.characterYaw += diff * Math.min(1.0, dt * ROTATION_SPEED);
    } else {
      this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, 0, dt * 14);
      this.isRunning = false;
    }

    // Apply horizontal velocity
    if (this.moveSpeed > 0.05) {
      this.velocity.x = this.moveDir.x * this.moveSpeed;
      this.velocity.z = this.moveDir.z * this.moveSpeed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // 2. Vertical Physics (Gravity & Jump)
    if (!this.isGrounded) {
      this.verticalVelocity -= GRAVITY * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    // 3. Move position and apply soft world boundary
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Bounds: X [-96, 96], Z [-85, 85]
    this.position.x = Math.max(-96, Math.min(96, this.position.x));
    this.position.z = Math.max(-85, Math.min(85, this.position.z));

    this.group.position.copy(this.position);
    this.group.rotation.y = this.characterYaw;

    // 4. Update Procedural Animation & Gait
    this.updateAnimation(dt);

    // 5. Update Camera (1st or 3rd Person)
    this.updateCamera(dt);
  }

  /**
   * Biomechanical procedural gait & idle animation update
   */
  private updateAnimation(dt: number): void {
    const isMoving = this.moveSpeed > 0.1;
    this.walkWeight = THREE.MathUtils.lerp(this.walkWeight, isMoving ? 1.0 : 0.0, dt * 12);

    // Speed-adaptive stride frequency: ~5.0 rad/m for walk, ~6.4 for sprint
    const strideFreq = this.isRunning ? 6.2 : 5.1;
    if (isMoving) {
      this.gaitPhase += this.moveSpeed * strideFreq * dt;
    }

    const f = this.gaitPhase;
    const w = this.walkWeight;
    const elapsed = performance.now() * 0.001;

    // Pelvis bob & sway
    const pelvis = this.bones.get('pelvis');
    if (pelvis) {
      const bobY = pelvisBob(f) * 0.01 * w;
      pelvis.bone.position.y = pelvis.restY + bobY;
      this.applyComposedRot(
        'pelvis',
        AX_UP,
        -PELVIS_YAW * Math.sin(f) * w,
        AX_FWD,
        -PELVIS_ROLL * Math.cos(f) * w,
      );
    }

    // Spine lean (forward during sprint) & breathing idle sway
    const sprintLean = this.isRunning ? 0.14 : TORSO_LEAN;
    const idleBreathe = Math.sin(elapsed * 2.2) * 0.02 * (1 - w);
    this.applyComposedRot(
      'spine_01',
      AX_UP,
      TORSO_YAW * Math.sin(f) * w,
      AX_LAT,
      sprintLean * w + idleBreathe,
    );
    this.applyModelRot('head', AX_UP, -HEAD_COUNTER * Math.sin(f) * w);

    // Legs: sagittal swing & knee flexion
    const updateLeg = (thighKey: string, calfKey: string, footKey: string, phi: number): void => {
      const thigh = -HIP_AMP * hipWave(phi) * w;
      const knee =
        (KNEE_AMP * Math.pow(Math.max(0, Math.cos(phi)), KNEE_EXP) +
          KNEE_STANCE * Math.max(0, -Math.cos(phi + 0.9))) *
        w;
      const ankle =
        (-ANKLE_DORSI * Math.max(0, Math.cos(phi - 0.6)) +
          ANKLE_PUSH * Math.max(0, Math.sin(phi - 2.6))) *
        w;

      this.applyModelRot(thighKey, AX_LAT, thigh);
      this.applyModelRot(calfKey, AX_LAT, knee);
      this.applyModelRot(footKey, AX_LAT, ankle);
    };

    updateLeg('thigh_l', 'calf_l', 'foot_l', f);
    updateLeg('thigh_r', 'calf_r', 'foot_r', f + Math.PI);

    // Arms: swing opposite to legs
    const armSwingFactor = this.isRunning ? ARM_SWING * 1.4 : ARM_SWING;
    const s = Math.sin(f) * w;
    this.applyComposedRot('upperarm_l', AX_LAT, armSwingFactor * s, AX_FWD, -ARM_DROP);
    this.applyComposedRot('upperarm_r', AX_LAT, -armSwingFactor * s, AX_FWD, ARM_DROP);
    this.applyModelRot('lowerarm_l', AX_LAT, -(ELBOW_BASE + ELBOW_FLEX * Math.max(0, -s) * w));
    this.applyModelRot('lowerarm_r', AX_LAT, -(ELBOW_BASE + ELBOW_FLEX * Math.max(0, s) * w));
  }

  /**
   * Smooth 1st/3rd person camera update
   */
  private updateCamera(dt: number): void {
    if (this.isFirstPerson) {
      // First Person: Camera placed at head/eye level
      const eyePos = this.position.clone();
      eyePos.y += EYE_HEIGHT;

      this.camera.position.copy(eyePos);

      // Look direction from camera yaw and pitch
      const cosPitch = Math.cos(this.cameraPitch);
      const sinPitch = Math.sin(this.cameraPitch);
      const lookX = Math.sin(this.cameraYaw) * cosPitch;
      const lookY = -sinPitch;
      const lookZ = -Math.cos(this.cameraYaw) * cosPitch;

      const lookTarget = eyePos.clone().add(new THREE.Vector3(lookX, lookY, lookZ));
      this.camera.lookAt(lookTarget);
    } else {
      // Third Person: Camera orbits smoothly behind the player
      const targetPos = this.position.clone();
      targetPos.y += CAM_HEIGHT_OFFSET;

      // Desired camera position in spherical coords (-camForward offset)
      const cosPitch = Math.cos(this.cameraPitch);
      const sinPitch = Math.sin(this.cameraPitch);
      const offsetX = -Math.sin(this.cameraYaw) * cosPitch * this.cameraDistance;
      const offsetY = sinPitch * this.cameraDistance + 0.3;
      const offsetZ = Math.cos(this.cameraYaw) * cosPitch * this.cameraDistance;

      const idealCamPos = targetPos.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

      // Smooth damping interpolation (spring follow)
      const lerpSpeed = Math.min(1.0, dt * 14.0);
      this.currentCamPos.lerp(idealCamPos, lerpSpeed);
      this.currentCamTarget.lerp(targetPos, lerpSpeed);

      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentCamTarget);
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.abortController.abort();
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
