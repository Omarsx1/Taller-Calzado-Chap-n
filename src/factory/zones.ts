import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createContactShadow, createLedStrip } from './hall';
import {
  buttonAmberMat,
  buttonGreenMat,
  buttonRedMat,
  canvasMat,
  darkSteelMat,
  emissivePanelMat,
  glassMat,
  jadeMat,
  rawCanvasMat,
  steelMat,
  uvStripMat,
  woodMat,
} from './materials';
import {
  createShoeMesh,
  createShoePair,
  defaultShoeMaterial,
  jadeShoeMaterial,
  terracottaShoeMaterial,
} from './ShoeModels';

/**
 * Production-grade procedural modeling of the three factory zones for Calzado Chapín:
 * - Zona A · Textiles y Corte (Artisanal wooden looms, Clicker press, fabric rolls)
 * - Zona B · Aparado (Industrial post-bed sewing machines, ergonomic operator chairs, hanging uppers)
 * - Zona C · Moldeado 3D (Pneumatic cementing presses, rotating ergonomic last rack, UV curing tunnel, finished ergonomic chanclas)
 */

export interface HeddleRef {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
}

export interface ShoeSlots {
  pedestal: THREE.Group;
  pressA: THREE.Group;
  pressB: THREE.Group;
  tray: THREE.Group;
  oven: THREE.Group;
  table: THREE.Group;
}

export interface ZoneBuild {
  group: THREE.Group;
  rack: THREE.Group;
  heddles: HeddleRef[];
  occluders: THREE.Object3D[];
  shoeSlots: ShoeSlots;
}

const TABLE_TOP_Y = 0.9;
const LOOM_HEDDLE_Y = 1.32;

function createMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addShadow(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  opacity = 0.5,
): void {
  const shadow = createContactShadow(width, depth, opacity);
  shadow.position.x = x;
  shadow.position.z = z;
  parent.add(shadow);
}

/* ------------------------------------------------------------------ ANATOMICAL FOOT LAST */

/**
 * Builds an authentic, biomechanically contoured orthopedic shoe last:
 * - Extruded ergonomic sole profile (narrow heel, high medial arch, wide metatarsus, tapered toe box)
 * - Anatomical instep dome (empeine) and heel block
 * - Aluminum hinge seam and top locator socket for industrial mounting
 */
function buildLastGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // 2D footprint contour in X-Z plane (scaled ~0.54m length, 0.22m width)
  shape.moveTo(0, -0.25);
  // Outer lateral edge
  shape.bezierCurveTo(0.08, -0.25, 0.1, -0.12, 0.1, 0.0);
  shape.bezierCurveTo(0.11, 0.1, 0.12, 0.2, 0.08, 0.27);
  // Ergonomic curved toe box
  shape.bezierCurveTo(0.05, 0.31, -0.02, 0.32, -0.06, 0.3);
  shape.bezierCurveTo(-0.09, 0.28, -0.11, 0.22, -0.11, 0.16);
  // Medial arch (distinct inner foot arch indentation)
  shape.bezierCurveTo(-0.11, 0.08, -0.05, -0.04, -0.06, -0.15);
  // Back to heel
  shape.bezierCurveTo(-0.07, -0.22, -0.05, -0.25, 0, -0.25);

  const soleGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  soleGeo.rotateX(Math.PI / 2);
  soleGeo.translate(0, 0.07, 0);

  // Instep anatomical dome (empeine)
  const instepGeo = new THREE.SphereGeometry(0.13, 16, 12);
  instepGeo.scale(0.82, 1.05, 1.6);
  instepGeo.translate(0, 0.14, 0.02);

  // Heel block / ankle collar
  const heelBlockGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.14, 16);
  heelBlockGeo.translate(0, 0.18, -0.16);

  // Chrome locator socket on top of heel
  const socketGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12);
  socketGeo.translate(0, 0.25, -0.16);

  const parts = [
    soleGeo.toNonIndexed(),
    instepGeo.toNonIndexed(),
    heelBlockGeo.toNonIndexed(),
    socketGeo.toNonIndexed(),
  ];
  soleGeo.dispose();
  instepGeo.dispose();
  heelBlockGeo.dispose();
  socketGeo.dispose();
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('[factory] failed to merge anatomical last geometry');
  merged.computeVertexNormals();
  return merged;
}

const lastGeometry = buildLastGeometry();

/* ------------------------------------------------------------------ FINISHED ERGONOMIC CHANCLA */



/* ------------------------------------------------------------------ ZONA A: TEXTILES Y CORTE */

/** Builds a traditional Guatemalan pedal loom with timber frame, heddles, and woven textile */
function createLoom(): { group: THREE.Group; heddle: THREE.Mesh } {
  const group = new THREE.Group();

  // Solid timber legs
  const legOffsets: ReadonlyArray<readonly [number, number]> = [
    [-0.95, -0.42],
    [0.95, -0.42],
    [-0.95, 0.42],
    [0.95, 0.42],
  ];
  const legGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
  for (const [x, z] of legOffsets) {
    const leg = createMesh(legGeo, woodMat);
    leg.position.set(x, 0.55, z);
    group.add(leg);
  }

  // Horizontal structural cross-beams
  const frameTopX = createMesh(new THREE.BoxGeometry(2.1, 0.1, 0.1), woodMat);
  frameTopX.position.set(0, 1.05, 0.42);
  const frameBottomX = createMesh(new THREE.BoxGeometry(2.1, 0.1, 0.1), woodMat);
  frameBottomX.position.set(0, 0.25, 0.42);
  const frameTopXBack = frameTopX.clone();
  frameTopXBack.position.z = -0.42;
  const frameBottomXBack = frameBottomX.clone();
  frameBottomXBack.position.z = -0.42;

  const frameSideL = createMesh(new THREE.BoxGeometry(0.1, 0.1, 0.94), woodMat);
  frameSideL.position.set(-0.95, 1.05, 0);
  const frameSideR = frameSideL.clone();
  frameSideR.position.x = 0.95;

  group.add(frameTopX, frameBottomX, frameTopXBack, frameBottomXBack, frameSideL, frameSideR);

  // Warp beam (urdidor) in rear with tensioned cotton yarns
  const warpBeamGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.9, 16);
  warpBeamGeo.rotateZ(Math.PI / 2);
  const warpBeam = createMesh(warpBeamGeo, woodMat);
  warpBeam.position.set(0, 1.15, -0.38);
  group.add(warpBeam);

  // Woven textile sheet rolling from the loom (authentic Mayan pattern)
  const clothGeo = new THREE.BoxGeometry(1.6, 0.02, 0.9);
  const cloth = createMesh(clothGeo, canvasMat);
  cloth.position.set(0, 0.85, 0.05);
  cloth.rotation.x = 0.08;
  group.add(cloth);

  // Moveable heddle frame (lizo) with wire eyelets
  const heddle = createMesh(new THREE.BoxGeometry(1.7, 0.12, 0.06), steelMat);
  heddle.position.set(0, LOOM_HEDDLE_Y, -0.1);
  group.add(heddle);

  // Beater reed frame (batán)
  const beater = createMesh(new THREE.BoxGeometry(1.7, 0.24, 0.05), woodMat);
  beater.position.set(0, 0.95, 0.22);
  group.add(beater);

  // Foot treadles (pedales de madera) on floor
  const treadleA = createMesh(new THREE.BoxGeometry(0.14, 0.04, 0.6), woodMat);
  treadleA.position.set(-0.25, 0.05, 0.1);
  treadleA.rotation.x = -0.15;
  const treadleB = createMesh(new THREE.BoxGeometry(0.14, 0.04, 0.6), woodMat);
  treadleB.position.set(0.25, 0.05, 0.1);
  treadleB.rotation.x = 0.15;
  group.add(treadleA, treadleB);

  return { group, heddle };
}

/** Linear Clicker Press for die-cutting cotton canvas and rubber soles */
function createClickerPress(): THREE.Group {
  const group = new THREE.Group();

  // Heavy cast-iron machine pedestal
  const base = createMesh(new THREE.BoxGeometry(2.4, 0.82, 1.5), darkSteelMat);
  base.position.y = 0.41;

  // Green self-healing high-density nylon cutting bed
  const cuttingBed = createMesh(new THREE.BoxGeometry(2.2, 0.06, 1.3), jadeMat);
  cuttingBed.position.y = 0.85;

  // Rear vertical hydraulic column
  const column = createMesh(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 20), steelMat);
  column.position.set(0, 1.4, -0.5);

  // Swing cutting beam (brazo oscilante de troquelado)
  const arm = createMesh(new THREE.BoxGeometry(1.8, 0.32, 0.9), darkSteelMat);
  arm.position.set(0, 1.45, 0.1);

  // Dual safety actuator buttons (OSHA standard)
  const btnL = createMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), buttonGreenMat);
  btnL.position.set(-0.75, 1.62, 0.35);
  const btnR = createMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), buttonGreenMat);
  btnR.position.set(0.75, 1.62, 0.35);
  const btnStop = createMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), buttonRedMat);
  btnStop.position.set(0, 1.62, 0.35);

  // Steel cutting die (troquel con forma de suela) on the cutting mat
  const die = createMesh(new THREE.BoxGeometry(0.35, 0.08, 0.7), steelMat);
  die.position.set(0.4, 0.91, 0.1);

  // Cut-out textile piece under the die
  const cutPiece = createMesh(new THREE.BoxGeometry(0.4, 0.015, 0.75), canvasMat);
  cutPiece.position.set(-0.4, 0.88, 0.1);

  group.add(base, cuttingBed, column, arm, btnL, btnR, btnStop, die, cutPiece);
  return group;
}

/** Rolls of raw organic cotton and woven Guatemalan canvas */
function createCanvasRolls(): THREE.Group {
  const group = new THREE.Group();

  // Heavy steel storage cradle
  const rack = createMesh(new THREE.BoxGeometry(1.8, 0.65, 1.2), steelMat);
  rack.position.y = 0.325;
  group.add(rack);

  // 3 rolls on bottom, 2 on top
  const rollGeo = new THREE.CylinderGeometry(0.26, 0.26, 1.6, 18);
  rollGeo.rotateZ(Math.PI / 2);

  const rollA = createMesh(rollGeo, canvasMat);
  rollA.position.set(0, 0.85, -0.32);
  const rollB = createMesh(rollGeo, rawCanvasMat);
  rollB.position.set(0, 0.85, 0.32);
  const rollC = createMesh(rollGeo, canvasMat);
  rollC.position.set(0, 1.32, 0);

  group.add(rollA, rollB, rollC);
  return group;
}

function buildTextilesZone(
  root: THREE.Group,
  heddles: HeddleRef[],
  occluders: THREE.Object3D[],
): void {
  const loomA = createLoom();
  loomA.group.position.set(-9.2, 0, -4.6);
  const loomB = createLoom();
  loomB.group.position.set(-9.2, 0, -1.8);
  root.add(loomA.group, loomB.group);
  heddles.push({ mesh: loomA.heddle, baseY: LOOM_HEDDLE_Y, phase: 0 });
  heddles.push({ mesh: loomB.heddle, baseY: LOOM_HEDDLE_Y, phase: Math.PI });
  addShadow(root, -9.2, -4.6, 2.3, 1.6, 0.55);
  addShadow(root, -9.2, -1.8, 2.3, 1.6, 0.55);
  occluders.push(loomA.group, loomB.group);

  const clicker = createClickerPress();
  clicker.position.set(-5.6, 0, -3.4);
  root.add(clicker);
  addShadow(root, -5.6, -3.4, 2.8, 1.8, 0.6);
  occluders.push(clicker);

  const rolls = createCanvasRolls();
  rolls.position.set(-10.6, 0, 0.6);
  root.add(rolls);
  addShadow(root, -10.6, 0.6, 2.2, 1.6, 0.5);
  occluders.push(rolls);
}

/* ------------------------------------------------------------------ ZONA B: APARADO */

/** Industrial post-bed sewing machine head assembly */
function buildSewingHeadGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Machine bedplate
  const plate = new THREE.BoxGeometry(0.65, 0.06, 0.48);
  plate.translate(0, 0.03, 0);
  parts.push(plate);

  // Slender post-bed (columna vertical de costura para calzado)
  const post = new THREE.BoxGeometry(0.12, 0.52, 0.14);
  post.translate(0.18, 0.32, 0.1);
  parts.push(post);

  // Cast iron arm & upper neck
  const pillar = new THREE.BoxGeometry(0.16, 0.55, 0.2);
  pillar.translate(-0.22, 0.34, -0.12);
  parts.push(pillar);

  const arm = new THREE.BoxGeometry(0.56, 0.14, 0.18);
  arm.translate(0.04, 0.62, -0.04);
  parts.push(arm);

  const head = new THREE.BoxGeometry(0.16, 0.24, 0.18);
  head.translate(0.24, 0.54, 0.1);
  parts.push(head);

  // Chrome needle bar
  const needleBar = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 8);
  needleBar.translate(0.24, 0.36, 0.1);
  parts.push(needleBar);

  // Handwheel with drive belt groove
  const handwheel = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 18);
  handwheel.rotateZ(Math.PI / 2);
  handwheel.translate(-0.32, 0.6, -0.12);
  parts.push(handwheel);

  // Spool stand and dual cotton cones
  const spoolStand = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 8);
  spoolStand.translate(-0.15, 0.85, -0.2);
  parts.push(spoolStand);

  const coneA = new THREE.ConeGeometry(0.05, 0.16, 12);
  coneA.translate(-0.2, 0.82, -0.2);
  const coneB = new THREE.ConeGeometry(0.05, 0.16, 12);
  coneB.translate(-0.1, 0.82, -0.2);
  parts.push(coneA, coneB);

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('[factory] failed to merge sewing machine geometry');
  merged.computeVertexNormals();
  return merged;
}

const sewingHeadGeometry = buildSewingHeadGeometry();
const SEWING_X = [-2.6, -0.4, 1.8] as const;

function createSewingMachines(): THREE.InstancedMesh {
  const machines = new THREE.InstancedMesh(sewingHeadGeometry, steelMat, SEWING_X.length);
  machines.castShadow = true;
  machines.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  SEWING_X.forEach((x, index) => {
    matrix.makeTranslation(x, TABLE_TOP_Y, -4.2);
    machines.setMatrixAt(index, matrix);
  });
  machines.instanceMatrix.needsUpdate = true;
  return machines;
}

/** Ergonomic task chair with 5-star base and lumbar support */
function createErgonomicChair(): THREE.Group {
  const chair = new THREE.Group();

  // 5-star base with casters
  const centerHub = createMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), darkSteelMat);
  centerHub.position.y = 0.12;
  chair.add(centerHub);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leg = createMesh(new THREE.BoxGeometry(0.04, 0.03, 0.28), darkSteelMat);
    leg.position.set(Math.sin(angle) * 0.15, 0.1, Math.cos(angle) * 0.15);
    leg.rotation.y = angle;
    chair.add(leg);
  }

  // Pneumatic gas lift cylinder
  const piston = createMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 12), steelMat);
  piston.position.y = 0.32;
  chair.add(piston);

  // Contoured padded seat
  const seat = createMesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), darkSteelMat);
  seat.position.y = 0.52;
  chair.add(seat);

  // Curved ergonomic lumbar backrest
  const backPost = createMesh(new THREE.BoxGeometry(0.05, 0.38, 0.04), steelMat);
  backPost.position.set(0, 0.72, -0.22);
  const backRest = createMesh(new THREE.BoxGeometry(0.44, 0.32, 0.06), darkSteelMat);
  backRest.position.set(0, 0.88, -0.21);
  backRest.rotation.x = 0.08;
  chair.add(backPost, backRest);

  return chair;
}

/** Worktable with teak top, steel legs, under-table LED and finished chanclas */
function createWorkTable(): { group: THREE.Group; slot: THREE.Group } {
  const group = new THREE.Group();

  // Thick teak solid workbench
  const top = createMesh(new THREE.BoxGeometry(7.2, 0.08, 1.4), woodMat);
  top.position.y = 0.86;
  group.add(top);

  const legGeo = new THREE.BoxGeometry(0.09, 0.86, 0.09);
  const legOffsets: ReadonlyArray<readonly [number, number]> = [
    [-3.4, -0.55],
    [3.4, -0.55],
    [-3.4, 0.55],
    [3.4, 0.55],
  ];
  for (const [x, z] of legOffsets) {
    const leg = createMesh(legGeo, steelMat);
    leg.position.set(x, 0.43, z);
    group.add(leg);
  }

  // Cool white LED under-lip strip
  const led = createLedStrip(6.8);
  led.position.set(0, 0.81, 0.58);
  group.add(led);

  // Work in progress: finished chanclas slot on the table
  const slot = new THREE.Group();
  slot.name = 'TableShoeSlot';
  group.add(slot);
  return { group, slot };
}

function buildAparadoZone(root: THREE.Group, occluders: THREE.Object3D[]): THREE.Group {
  const { group: table, slot: tableSlot } = createWorkTable();
  table.position.set(-0.4, 0, -4.2);
  root.add(table);
  addShadow(root, -0.4, -4.2, 7.6, 1.8, 0.6);

  const machines = createSewingMachines();
  root.add(machines);

  // Add 3 ergonomic chairs behind the sewing workstations
  for (const x of SEWING_X) {
    const chair = createErgonomicChair();
    chair.position.set(x, 0, -3.2);
    chair.rotation.y = Math.PI;
    root.add(chair);
    addShadow(root, x, -3.2, 0.7, 0.7, 0.45);
  }

  occluders.push(table, machines);
  return tableSlot;
}

/* ------------------------------------------------------------------ ZONA C: MOLDEADO 3D */

/** High-pressure pneumatic cementing press with sole mold cavity */
function createPress(): { group: THREE.Group; slot: THREE.Group } {
  const group = new THREE.Group();

  // Cast iron machine plinth
  const base = createMesh(new THREE.BoxGeometry(1.5, 0.38, 1.3), darkSteelMat);
  base.position.y = 0.19;

  // Dual chrome guide columns
  const colGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.3, 16);
  const colL = createMesh(colGeo, steelMat);
  colL.position.set(-0.58, 1.35, 0);
  const colR = createMesh(colGeo, steelMat);
  colR.position.set(0.58, 1.35, 0);

  // Heavy steel top crown
  const crown = createMesh(new THREE.BoxGeometry(1.6, 0.3, 1.2), darkSteelMat);
  crown.position.y = 2.6;

  // Upper heated platen
  const upperPlaten = createMesh(new THREE.BoxGeometry(1.15, 0.16, 0.95), steelMat);
  upperPlaten.position.y = 1.55;

  // Hydraulic ram cylinder
  const ram = createMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 18), darkSteelMat);
  ram.position.y = 2.05;

  // Contoured aluminum sole mold cavity on lower bed
  const moldBase = createMesh(new THREE.BoxGeometry(0.9, 0.12, 0.8), steelMat);
  moldBase.position.y = 0.44;

  // Finished chancla slot inside press
  const pressSlot = new THREE.Group();
  pressSlot.name = 'PressShoeSlot';
  group.add(pressSlot);

  // Safety acrylic guard
  const guard = createMesh(new THREE.BoxGeometry(1.25, 0.75, 0.04), glassMat);
  guard.position.set(0, 1.35, 0.64);

  // Digital operator console with buttons
  const consolePanel = createMesh(new THREE.BoxGeometry(0.3, 0.55, 0.14), darkSteelMat);
  consolePanel.position.set(0.85, 1.05, 0.35);

  const btnCycle = createMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), buttonGreenMat);
  btnCycle.rotation.x = Math.PI / 2;
  btnCycle.position.set(0.85, 1.18, 0.42);

  const btnWarm = createMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), buttonAmberMat);
  btnWarm.rotation.x = Math.PI / 2;
  btnWarm.position.set(0.85, 1.02, 0.42);

  const btnStop = createMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), buttonRedMat);
  btnStop.rotation.x = Math.PI / 2;
  btnStop.position.set(0.85, 0.86, 0.42);

  const led = createLedStrip(1.3);
  led.position.set(0, 0.4, 0.65);

  group.add(
    base,
    colL,
    colR,
    crown,
    upperPlaten,
    ram,
    moldBase,
    guard,
    consolePanel,
    btnCycle,
    btnWarm,
    btnStop,
    led,
  );
  return { group, slot: pressSlot };
}

const LAST_COUNT = 8;

/** Rotating carousel rack of anatomical jade bio-polymer shoe lasts */
function createLastRack(): THREE.Group {
  const rack = new THREE.Group();

  // Central column with chrome finish and bearing hub
  const colGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.6, 20);
  const column = createMesh(colGeo, steelMat);
  column.position.y = 1.3;
  rack.add(column);

  const hubBase = createMesh(new THREE.CylinderGeometry(0.45, 0.55, 0.16, 24), darkSteelMat);
  hubBase.position.y = 0.08;
  rack.add(hubBase);

  // Double tubular steel carousel rings
  const ringBottom = createMesh(new THREE.TorusGeometry(1.05, 0.05, 12, 32), steelMat);
  ringBottom.rotation.x = Math.PI / 2;
  ringBottom.position.y = 1.0;

  const ringTop = createMesh(new THREE.TorusGeometry(1.05, 0.05, 12, 32), steelMat);
  ringTop.rotation.x = Math.PI / 2;
  ringTop.position.y = 1.95;
  rack.add(ringBottom, ringTop);

  // Radial spoke arms connecting column to rings
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spoke = createMesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), steelMat);
    spoke.position.set(Math.cos(angle) * 0.98, 1.48, Math.sin(angle) * 0.98);
    rack.add(spoke);
  }

  // 8 Anatomical ergonomic shoe lasts in bio-polymer jade with technical serigraphy
  for (let i = 0; i < LAST_COUNT; i++) {
    const angle = (i / LAST_COUNT) * Math.PI * 2;
    const yPos = i % 2 === 0 ? 1.15 : 2.05;

    // Chrome mounting bracket arm
    const arm = createMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 12), steelMat);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -angle;
    arm.position.set(Math.cos(angle) * 1.12, yPos, Math.sin(angle) * 1.12);
    rack.add(arm);

    // Anatomical last
    const last = createMesh(lastGeometry, jadeMat);
    last.position.set(Math.cos(angle) * 1.32, yPos, Math.sin(angle) * 1.32);
    last.rotation.y = -angle + Math.PI / 2;
    rack.add(last);
  }

  return rack;
}

/** Steel staging frame with natural vulcanized rubber sole blanks */
function createSoleTray(): { group: THREE.Group; slot: THREE.Group } {
  const group = new THREE.Group();

  const legGeo = new THREE.BoxGeometry(0.08, 0.52, 0.08);
  const legOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1.15, -0.7],
    [1.15, -0.7],
    [-1.15, 0.7],
    [1.15, 0.7],
  ];
  for (const [x, z] of legOffsets) {
    const leg = createMesh(legGeo, steelMat);
    leg.position.set(x, 0.26, z);
    group.add(leg);
  }

  const tray = createMesh(new THREE.BoxGeometry(2.5, 0.08, 1.55), steelMat);
  tray.position.y = 0.56;
  group.add(tray);

  const slot = new THREE.Group();
  slot.name = 'TrayShoeSlot';

  const led = createLedStrip(2.3);
  led.position.set(0, 0.44, 0.78);
  group.add(led, slot);

  return { group, slot };
}

/** UV vulcanizing & curing tunnel with violet curing light */
function createUvOven(): { group: THREE.Group; slot: THREE.Group } {
  const group = new THREE.Group();

  const top = createMesh(new THREE.BoxGeometry(2.7, 0.12, 1.7), darkSteelMat);
  top.position.y = 1.62;
  const sideL = createMesh(new THREE.BoxGeometry(2.7, 1.6, 0.1), steelMat);
  sideL.position.set(0, 0.81, 0.8);
  const sideR = createMesh(new THREE.BoxGeometry(2.7, 1.6, 0.1), steelMat);
  sideR.position.set(0, 0.81, -0.8);
  const floor = createMesh(new THREE.BoxGeometry(2.7, 0.08, 1.6), darkSteelMat);
  floor.position.y = 0.06;

  // Violet UV LED curing array
  const uvStrip = createMesh(new THREE.BoxGeometry(2.4, 0.06, 0.15), uvStripMat);
  uvStrip.castShadow = false;
  uvStrip.position.set(0, 1.5, 0);

  // Conveyor belt with chancla passing through
  const belt = createMesh(new THREE.BoxGeometry(2.2, 0.06, 0.6), darkSteelMat);
  belt.position.y = 0.54;

  const slot = new THREE.Group();
  slot.name = 'OvenShoeSlot';

  group.add(top, sideL, sideR, floor, uvStrip, belt, slot);
  return { group, slot };
}

/** Clean Tech illuminated showcase pedestal displaying the authentic ShoesL & ShoesR chanclas */
function createShowcasePedestal(): { group: THREE.Group; slot: THREE.Group } {
  const group = new THREE.Group();
  group.name = 'ShowcasePedestal';

  const base = createMesh(new THREE.CylinderGeometry(0.5, 0.56, 0.88, 32), darkSteelMat);
  base.position.y = 0.44;

  const lightTop = createMesh(new THREE.CylinderGeometry(0.48, 0.48, 0.05, 32), emissivePanelMat);
  lightTop.position.y = 0.905;

  const rim = createMesh(new THREE.TorusGeometry(0.49, 0.016, 8, 32), steelMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.91;

  const slot = new THREE.Group();
  slot.name = 'PedestalShoeSlot';
  slot.position.set(0, 0.93, 0);

  group.add(base, lightTop, rim, slot);
  return { group, slot };
}

function buildMoldingZone(
  root: THREE.Group,
  occluders: THREE.Object3D[],
): {
  rack: THREE.Group;
  pedestalSlot: THREE.Group;
  pressSlotA: THREE.Group;
  pressSlotB: THREE.Group;
  traySlot: THREE.Group;
  ovenSlot: THREE.Group;
} {
  const { group: pressA, slot: pressSlotA } = createPress();
  pressA.position.set(1.2, 0, 3.8);
  const { group: pressB, slot: pressSlotB } = createPress();
  pressB.position.set(3.4, 0, 3.8);
  root.add(pressA, pressB);
  addShadow(root, 1.2, 3.8, 2.0, 1.8, 0.6);
  addShadow(root, 3.4, 3.8, 2.0, 1.8, 0.6);

  const rack = createLastRack();
  rack.position.set(6.2, 0, 2.8);
  root.add(rack);
  addShadow(root, 6.2, 2.8, 2.8, 2.8, 0.6);

  const { group: tray, slot: traySlot } = createSoleTray();
  tray.position.set(-3.2, 0, 4.0);
  root.add(tray);
  addShadow(root, -3.2, 4.0, 2.9, 1.9, 0.55);

  const { group: oven, slot: ovenSlot } = createUvOven();
  oven.position.set(-1.0, 0, 4.0);
  root.add(oven);
  addShadow(root, -1.0, 4.0, 3.1, 2.1, 0.55);

  const { group: pedestal, slot: pedestalSlot } = createShowcasePedestal();
  pedestal.position.set(0.0, 0, 5.8);
  root.add(pedestal);
  addShadow(root, 0.0, 5.8, 1.3, 1.3, 0.5);

  occluders.push(pressA, pressB, rack, tray, oven, pedestal);
  return { rack, pedestalSlot, pressSlotA, pressSlotB, traySlot, ovenSlot };
}

/** Injects the authentic ShoesL.glb and ShoesR.glb models once loaded */
export function updateWithRealShoes(slots: ShoeSlots): void {
  // 1. Featured Hero Showcase Pedestal (authentic pair, both left and right, presented prominently)
  slots.pedestal.clear();
  const heroPair = createShoePair(defaultShoeMaterial, 0.20);
  heroPair.rotation.y = Math.PI + 0.25; // Dynamic 3/4 hero presentation facing the visitor
  slots.pedestal.add(heroPair);

  // 2. Sole Staging Tray in Zone C: Mass-production batch of 8 pairs (16 sandals total, left & right)
  slots.tray.clear();
  const colX = [-0.84, -0.28, 0.28, 0.84];

  // Front row: 4 pairs of classic vulcanized plantation rubber
  for (const x of colX) {
    const pair = createShoePair(defaultShoeMaterial, 0.20);
    pair.position.set(x, 0.60, 0.35);
    slots.tray.add(pair);
  }

  // Back row: 4 pairs of signature Guatemalan jade bio-polymer
  for (const x of colX) {
    const pair = createShoePair(jadeShoeMaterial, 0.20);
    pair.position.set(x, 0.60, -0.35);
    slots.tray.add(pair);
  }

  // 3. Cementing Presses in Zone C (real shoes inside pressing platens)
  slots.pressA.clear();
  const pressedL = createShoeMesh('left', defaultShoeMaterial);
  pressedL.position.set(0, 0.50, 0);
  slots.pressA.add(pressedL);

  slots.pressB.clear();
  const pressedR = createShoeMesh('right', jadeShoeMaterial);
  pressedR.position.set(0, 0.50, 0);
  slots.pressB.add(pressedR);

  // 4. UV Curing Tunnel (real shoe on conveyor belt)
  slots.oven.clear();
  const ovenShoe = createShoeMesh('right', defaultShoeMaterial);
  ovenShoe.position.set(0, 0.57, 0);
  slots.oven.add(ovenShoe);

  // 5. Aparado Workbench in Zone B: 3 pairs of chanclas being assembled
  // (pair B sits between the sewing machines — never under a machine base)
  slots.table.clear();
  const tablePairA = createShoePair(defaultShoeMaterial, 0.20);
  tablePairA.position.set(-1.6, 0.90, 0.15);
  tablePairA.rotation.y = 0.2;

  const tablePairB = createShoePair(terracottaShoeMaterial, 0.20);
  tablePairB.position.set(0.5, 0.90, 0.5);

  const tablePairC = createShoePair(jadeShoeMaterial, 0.20);
  tablePairC.position.set(1.6, 0.90, 0.15);
  tablePairC.rotation.y = -0.25;

  slots.table.add(tablePairA, tablePairB, tablePairC);
}

export function buildZones(): ZoneBuild {
  const group = new THREE.Group();
  group.name = 'zones';

  const heddles: HeddleRef[] = [];
  const occluders: THREE.Object3D[] = [];

  buildTextilesZone(group, heddles, occluders);
  const tableSlot = buildAparadoZone(group, occluders);
  const { rack, pedestalSlot, pressSlotA, pressSlotB, traySlot, ovenSlot } = buildMoldingZone(group, occluders);

  const shoeSlots: ShoeSlots = {
    pedestal: pedestalSlot,
    pressA: pressSlotA,
    pressB: pressSlotB,
    tray: traySlot,
    oven: ovenSlot,
    table: tableSlot,
  };

  return { group, rack, heddles, occluders, shoeSlots };
}
