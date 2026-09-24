import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buttonGreenMat,
  canvasMat,
  cardboardBoxMat,
  darkSteelMat,
  emissivePanelMat,
  fireExtinguisherMat,
  hazardStripeMat,
  palletWoodMat,
  rawCanvasMat,
  rubberMat,
  safetyYellowMat,
  steelMat,
  walkwayMat,
  woodMat,
} from './materials';
import { createSignboardTexture } from './proceduralTextures';

/**
 * Full Workshop Expansion & Environment for Calzado Chapín:
 *
 * Populates the entire 93m x 32m industrial warehouse floor:
 * - West Wing (X: -38 to -12): Raw materials intake, textile & rubber inventory, staging pallets.
 * - Central Core (X: -10 to +7): Active artisan & 3D molding line (Textiles, Aparado, Moldeado).
 * - East Wing (X: +10 to +32): Quality control conveyor line, shoe packaging, and finished goods logistics depot.
 * - Far East Wing (X: +33 to +46): "Fase 2 · Área de Futura Expansión" staged with supplies, structural frames and expansion demarcation.
 * - Entire Hall: Central green safety walkway, column fire extinguishers, high-bay pendant lights, floor markings.
 * - Exterior: Expansive concrete ground apron, loading dock markings and perimeter landscaping.
 */

export interface WorkshopExpansionResult {
  group: THREE.Group;
  loadModels: () => Promise<void>;
}

/* -------------------------------------------------------- PROCEDURAL PROP BUILDERS */

/** Builds a realistic Euro-pallet (1.2m x 0.8m x 0.14m) merged into a single geometry */
export function buildEuroPalletGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];

  // Top deck boards (5 boards, 1.2m long, 0.14m wide, 0.022m thick)
  const boardGeo = new THREE.BoxGeometry(1.2, 0.022, 0.13);
  const zOffsets = [-0.33, -0.17, 0, 0.17, 0.33];
  for (const z of zOffsets) {
    const b = boardGeo.clone();
    b.translate(0, 0.134, z);
    geoms.push(b);
  }

  // 3 Stringer cross-boards (0.8m long along Z)
  const stringerGeo = new THREE.BoxGeometry(0.12, 0.022, 0.8);
  const xOffsets = [-0.52, 0, 0.52];
  for (const x of xOffsets) {
    const s = stringerGeo.clone();
    s.translate(x, 0.112, 0);
    geoms.push(s);
  }

  // 9 Solid wood spacer blocks (0.12m x 0.09m x 0.12m)
  const blockGeo = new THREE.BoxGeometry(0.12, 0.09, 0.12);
  for (const x of xOffsets) {
    for (const z of [-0.34, 0, 0.34]) {
      const blk = blockGeo.clone();
      blk.translate(x, 0.056, z);
      geoms.push(blk);
    }
  }

  // 3 Bottom skid boards
  for (const x of xOffsets) {
    const bot = stringerGeo.clone();
    bot.translate(x, 0.011, 0);
    geoms.push(bot);
  }

  const merged = mergeGeometries(geoms, false);
  merged.computeVertexNormals();
  geoms.forEach((g) => g.dispose());
  return merged;
}

const palletGeometry = buildEuroPalletGeometry();

/** Creates a Euro-pallet mesh */
function createPallet(x: number, y: number, z: number, rotY = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(palletGeometry, palletWoodMat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Builds an industrial pallet stacked with shoe boxes */
function createShoeBoxPallet(x: number, z: number, tiers = 4, rotY = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const pallet = createPallet(0, 0, 0);
  group.add(pallet);

  const boxGeo = new THREE.BoxGeometry(0.36, 0.22, 0.24);
  const tierYStart = 0.15;
  const boxSpacingX = [-0.38, 0, 0.38];
  const boxSpacingZ = [-0.25, 0.25];

  for (let t = 0; t < tiers; t++) {
    const y = tierYStart + t * 0.225 + 0.11;
    for (const bx of boxSpacingX) {
      for (const bz of boxSpacingZ) {
        // Slight random offset for organic industrial realism
        const boxMesh = new THREE.Mesh(boxGeo, cardboardBoxMat);
        boxMesh.position.set(
          bx + (Math.random() - 0.5) * 0.02,
          y,
          bz + (Math.random() - 0.5) * 0.02,
        );
        boxMesh.rotation.y = (Math.random() - 0.5) * 0.04;
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        group.add(boxMesh);
      }
    }
  }

  return group;
}

/** Builds a pallet stacked with raw natural rubber slabs */
function createRubberSlabPallet(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const pallet = createPallet(0, 0, 0);
  group.add(pallet);

  const slabGeo = new THREE.BoxGeometry(0.95, 0.06, 0.65);
  for (let i = 0; i < 6; i++) {
    const slab = new THREE.Mesh(slabGeo, rubberMat);
    slab.position.set(
      (Math.random() - 0.5) * 0.02,
      0.15 + i * 0.062 + 0.03,
      (Math.random() - 0.5) * 0.02,
    );
    slab.rotation.y = (Math.random() - 0.5) * 0.03;
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
  }

  return group;
}

/** Builds an industrial stainless steel barrel with eco-adhesive bio-label */
function createEcoBarrel(x: number, z: number, color = 0x2b3748): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const barrelMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.75,
  });

  // Barrel body with reinforcing ribs
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.95, 20),
    barrelMat,
  );
  body.position.y = 0.475;
  body.castShadow = true;
  body.receiveShadow = true;

  // Steel rim rings
  const rimGeo = new THREE.TorusGeometry(0.305, 0.015, 8, 20);
  rimGeo.rotateX(Math.PI / 2);
  const rimTop = new THREE.Mesh(rimGeo, steelMat);
  rimTop.position.y = 0.92;
  const rimMid1 = new THREE.Mesh(rimGeo, steelMat);
  rimMid1.position.y = 0.62;
  const rimMid2 = new THREE.Mesh(rimGeo, steelMat);
  rimMid2.position.y = 0.32;
  const rimBot = new THREE.Mesh(rimGeo, steelMat);
  rimBot.position.y = 0.05;

  // Clean-tech eco label
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.302, 0.302, 0.28, 20, 1, true, -Math.PI / 4, Math.PI / 2),
    emissivePanelMat,
  );
  label.position.y = 0.475;

  group.add(body, rimTop, rimMid1, rimMid2, rimBot, label);
  return group;
}

/** Multi-tier heavy-duty industrial pallet racking unit */
function createHeavyPalletRack(width = 3.6, height = 4.2, depth = 1.1): THREE.Group {
  const group = new THREE.Group();

  // Steel upright ladder columns (blue/dark steel)
  const colGeo = new THREE.BoxGeometry(0.1, height, 0.1);
  const leftF = new THREE.Mesh(colGeo, darkSteelMat);
  leftF.position.set(-width / 2, height / 2, depth / 2);
  const leftB = new THREE.Mesh(colGeo, darkSteelMat);
  leftB.position.set(-width / 2, height / 2, -depth / 2);
  const rightF = new THREE.Mesh(colGeo, darkSteelMat);
  rightF.position.set(width / 2, height / 2, depth / 2);
  const rightB = new THREE.Mesh(colGeo, darkSteelMat);
  rightB.position.set(width / 2, height / 2, -depth / 2);

  leftF.castShadow = leftB.castShadow = rightF.castShadow = rightB.castShadow = true;
  group.add(leftF, leftB, rightF, rightB);

  // Cross bracing diagonals
  const braceMat = steelMat;
  for (let y = 0.6; y < height; y += 1.0) {
    const braceGeo = new THREE.BoxGeometry(0.04, 0.04, depth);
    const bL = new THREE.Mesh(braceGeo, braceMat);
    bL.position.set(-width / 2, y, 0);
    const bR = new THREE.Mesh(braceGeo, braceMat);
    bR.position.set(width / 2, y, 0);
    group.add(bL, bR);
  }

  // Horizontal load beams (Safety Orange/Yellow)
  const beamLevels = [0.2, 1.5, 2.8];
  const beamGeo = new THREE.BoxGeometry(width, 0.12, 0.08);

  for (const by of beamLevels) {
    const beamF = new THREE.Mesh(beamGeo, safetyYellowMat);
    beamF.position.set(0, by, depth / 2);
    beamF.castShadow = true;
    const beamB = new THREE.Mesh(beamGeo, safetyYellowMat);
    beamB.position.set(0, by, -depth / 2);
    beamB.castShadow = true;

    // Wire mesh / steel deck surface
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.1, 0.03, depth - 0.06),
      steelMat,
    );
    deck.position.set(0, by + 0.06, 0);
    deck.receiveShadow = true;

    group.add(beamF, beamB, deck);
  }

  return group;
}

/** Fabric roll A-frame rack holding colorful rolls of authentic Guatemalan cotton */
function createTextileRollRack(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // A-frame side supports
  const sideGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
  const s1 = new THREE.Mesh(sideGeo, steelMat);
  s1.position.set(-1.2, 0.9, -0.4);
  s1.rotation.z = 0.12;
  const s2 = new THREE.Mesh(sideGeo, steelMat);
  s2.position.set(-1.2, 0.9, 0.4);
  s2.rotation.z = -0.12;

  const s3 = new THREE.Mesh(sideGeo, steelMat);
  s3.position.set(1.2, 0.9, -0.4);
  s3.rotation.z = 0.12;
  const s4 = new THREE.Mesh(sideGeo, steelMat);
  s4.position.set(1.2, 0.9, 0.4);
  s4.rotation.z = -0.12;

  group.add(s1, s2, s3, s4);

  // Horizontal spindle bars with fabric rolls
  const rollLevels = [
    { y: 0.55, mat: canvasMat, r: 0.16 },
    { y: 1.05, mat: rawCanvasMat, r: 0.18 },
    { y: 1.55, mat: canvasMat, r: 0.15 },
  ];

  for (const { y, mat, r } of rollLevels) {
    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 2.7, 8),
      steelMat,
    );
    spindle.rotation.z = Math.PI / 2;
    spindle.position.y = y;

    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 2.2, 16),
      mat,
    );
    roll.rotation.z = Math.PI / 2;
    roll.position.y = y;
    roll.castShadow = true;
    roll.receiveShadow = true;

    group.add(spindle, roll);
  }

  return group;
}

/** Fire extinguisher station mounted on warehouse column */
function createFireSafetyStation(): THREE.Group {
  const group = new THREE.Group();

  // White backing board with red header border
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.0, 0.04),
    emissivePanelMat,
  );
  board.position.y = 1.6;

  // Red cylinder extinguisher
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.55, 16),
    fireExtinguisherMat,
  );
  tank.position.set(0, 1.5, 0.12);
  tank.castShadow = true;

  // Top discharge valve and hose
  const valve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8),
    darkSteelMat,
  );
  valve.position.set(0, 1.82, 0.12);

  // Pressure gauge
  const gauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12),
    buttonGreenMat,
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.04, 1.83, 0.14);

  group.add(board, tank, valve, gauge);
  return group;
}

/** Standing industrial signpost */
function createIndustrialSignboard(
  x: number,
  z: number,
  title: string,
  subtitle: string,
  accentColor = '#f59e0b',
  rotY = 0,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  // Heavy steel base plinth
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.38, 0.08, 16),
    darkSteelMat,
  );
  base.position.y = 0.04;
  base.castShadow = true;

  // Upright steel post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.8, 12),
    steelMat,
  );
  post.position.y = 0.95;
  post.castShadow = true;

  // Double-sided signboard panel
  const signTex = createSignboardTexture(title, subtitle, accentColor);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.85, 0.05),
    signMat,
  );
  panel.position.y = 1.9;
  panel.castShadow = true;

  group.add(base, post, panel);
  return group;
}

/** Builds high-bay LED luminaire */
function createHighBayLuminaire(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 5.8, z);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 1.2, 8),
    darkSteelMat,
  );
  rod.position.y = 0.6;

  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.36, 0.22, 16),
    darkSteelMat,
  );
  bell.castShadow = true;

  const diffuser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.02, 16),
    emissivePanelMat,
  );
  diffuser.position.y = -0.11;

  group.add(rod, bell, diffuser);
  return group;
}

/* ------------------------------------------------------------- MAIN EXPANSION BUILDER */

export function buildWorkshopExpansion(): WorkshopExpansionResult {
  const group = new THREE.Group();
  group.name = 'workshop_full_expansion';

  /* --------------------------------------------------------- 1. CENTRAL SAFETY WALKWAY */
  // Green epoxy walkway running from West to East across the central factory aisle
  const walkwayGeo = new THREE.PlaneGeometry(82, 1.8);
  walkwayGeo.rotateX(-Math.PI / 2);
  const walkwayMesh = new THREE.Mesh(walkwayGeo, walkwayMat);
  walkwayMesh.position.set(3.8, 0.003, 0); // Along center aisle, just above floor
  walkwayMesh.receiveShadow = true;
  group.add(walkwayMesh);

  // Perpendicular zebra crosswalks connecting side bays to the main walkway
  const crosswalkPositions = [-26, -18, -10, -2, 6, 14, 22, 30];
  const crosswalkMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.6,
  });

  for (const cx of crosswalkPositions) {
    for (const cz of [-2.4, 2.4]) {
      const zebra = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), crosswalkMat);
      zebra.rotateX(-Math.PI / 2);
      zebra.position.set(cx, 0.0035, cz);
      zebra.receiveShadow = true;
      group.add(zebra);
    }
  }

  /* --------------------------------------------------------- 2. WEST WING: RAW MATERIALS & STAGING */
  // High-bay pallet racking along North wall (X: -36, -30, -24, -18, Z: -13.5)
  for (const rx of [-36, -30, -24, -18]) {
    const rack = createHeavyPalletRack(3.8, 4.4, 1.2);
    rack.position.set(rx, 0, -13.6);
    group.add(rack);

    // Populate lower rack tier with palletized raw materials
    const palletRolls = createShoeBoxPallet(rx - 0.9, -13.6, 2);
    const palletRubber = createRubberSlabPallet(rx + 0.9, -13.6);
    group.add(palletRolls, palletRubber);
  }

  // Textile roll A-frame racks
  const textileRackA = createTextileRollRack(-28, -8.5);
  const textileRackB = createTextileRollRack(-22, -8.5);
  group.add(textileRackA, textileRackB);

  // Staged wooden pallets with raw material bales and eco barrels
  group.add(
    createShoeBoxPallet(-34, -5.5, 3),
    createRubberSlabPallet(-36, -2.5),
    createRubberSlabPallet(-36, 1.5),
    createShoeBoxPallet(-34, 4.5, 3),
  );

  // Eco-adhesive barrel clusters
  group.add(
    createEcoBarrel(-31, -2.5, 0x1e3a5f),
    createEcoBarrel(-30.2, -2.2, 0x1e3a5f),
    createEcoBarrel(-30.6, -3.1, 0x2b3748),
    createEcoBarrel(-31, 2.5, 0x0f5132),
    createEcoBarrel(-30.2, 2.2, 0x0f5132),
  );

  // Industrial signboard for Raw Materials
  const signLogistics = createIndustrialSignboard(
    -34,
    -1.4,
    'Recepción y Materias Primas',
    'Lonas de Algodón Orgánico · Caucho Natural Certificado',
    '#0ea5e9',
    Math.PI / 2,
  );
  group.add(signLogistics);

  /* --------------------------------------------------------- 3. MAINTENANCE & TOOL CRIB */
  // Maintenance bay along South-West wall (X: -26 to -14, Z: 8 to 13)
  const signMaintenance = createIndustrialSignboard(
    -20,
    6.5,
    'Mantenimiento y Matricería',
    'Afilado de Troqueles · Calibración de Prensas y Moldes 3D',
    '#eab308',
    0,
  );
  group.add(signMaintenance);

  // Heavy pallet rack holding spare metal molds and tools
  const maintRack = createHeavyPalletRack(3.8, 3.2, 1.2);
  maintRack.position.set(-18, 0, 13.5);
  maintRack.rotation.y = Math.PI;
  group.add(maintRack);

  /* --------------------------------------------------------- 4. EAST WING: QC, PACKING & FINISHED GOODS */
  // Finished goods warehouse racks along North wall (X: +22, +28, Z: -13.5)
  for (const rx of [22, 28]) {
    const rack = createHeavyPalletRack(3.8, 4.4, 1.2);
    rack.position.set(rx, 0, -13.6);
    group.add(rack);

    // Stacks of finished shoe boxes on racks
    group.add(
      createShoeBoxPallet(rx - 0.9, -13.6, 3),
      createShoeBoxPallet(rx + 0.9, -13.6, 3),
    );
  }

  // Staged export pallets with finished Calzado Chapín shoe boxes
  group.add(
    createShoeBoxPallet(22, -6.0, 4),
    createShoeBoxPallet(24, -6.0, 4),
    createShoeBoxPallet(26, -6.0, 3),
    createShoeBoxPallet(22, 5.0, 4),
    createShoeBoxPallet(25, 5.0, 4),
    createShoeBoxPallet(28, 5.0, 3),
  );

  // Quality Control & Packaging Signboard
  const signQC = createIndustrialSignboard(
    14,
    -1.4,
    'Control de Calidad y Empaque',
    'Inspección Biométrica · Embalaje en Cartón Kraft 100% Reciclable',
    '#10b981',
    -Math.PI / 2,
  );
  group.add(signQC);

  // Finished Goods Warehouse Signboard
  const signDepot = createIndustrialSignboard(
    24,
    -1.4,
    'Almacén de Producto Terminado',
    'Despacho Nacional y Exportación · Tallas 38 a 44',
    '#6366f1',
    -Math.PI / 2,
  );
  group.add(signDepot);

  /* --------------------------------------------------------- 5. FAR EAST: FUTURE EXPANSION ZONE ("FASE 2") */
  // Demarcation line at X = 33 with diagonal hazard warning tape
  const hazardTapeGeo = new THREE.PlaneGeometry(0.35, 26);
  hazardTapeGeo.rotateX(-Math.PI / 2);
  const hazardTapeMesh = new THREE.Mesh(hazardTapeGeo, hazardStripeMat);
  hazardTapeMesh.position.set(33, 0.004, 0);
  hazardTapeMesh.receiveShadow = true;
  group.add(hazardTapeMesh);

  // Expansion Zone Signboard
  const signExpansion = createIndustrialSignboard(
    34,
    0,
    'Área de Futura Expansión · Fase 2',
    'Próxima Línea de Biopolímeros y Economía Circular · Creciendo el Taller',
    '#f59e0b',
    -Math.PI / 2,
  );
  group.add(signExpansion);

  // Staged construction / expansion preparation supplies in the open bay (X: 36 to 45)
  // 1. Stack of fresh wooden pallets ready for new lines
  for (let p = 0; p < 8; p++) {
    const freshPallet = createPallet(37.5, p * 0.142, 6.0, (p % 2) * 0.04);
    group.add(freshPallet);
  }

  // 2. Structural aluminum framing extrusions resting on wood dunnage
  const beamStack = new THREE.Group();
  beamStack.position.set(38, 0, -6.5);
  for (let layer = 0; layer < 4; layer++) {
    for (let col = 0; col < 3; col++) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.1, 0.1),
        steelMat,
      );
      beam.position.set(0, 0.1 + layer * 0.11, -0.3 + col * 0.3);
      beam.castShadow = true;
      beamStack.add(beam);
    }
  }
  group.add(beamStack);

  // 3. Bundles of spiral ventilation ducting waiting for ceiling installation
  const ductBundle = new THREE.Group();
  ductBundle.position.set(42, 0, 4.5);
  const dGeo = new THREE.CylinderGeometry(0.35, 0.35, 4.0, 16);
  dGeo.rotateZ(Math.PI / 2);
  const d1 = new THREE.Mesh(dGeo, steelMat);
  d1.position.set(0, 0.36, -0.38);
  const d2 = new THREE.Mesh(dGeo, steelMat);
  d2.position.set(0, 0.36, 0.38);
  const d3 = new THREE.Mesh(dGeo, steelMat);
  d3.position.set(0, 0.98, 0);
  d1.castShadow = d2.castShadow = d3.castShadow = true;
  ductBundle.add(d1, d2, d3);
  group.add(ductBundle);

  // 4. Industrial cable conduit reel
  const reel = new THREE.Group();
  reel.position.set(43, 0, -2.5);
  const flangeGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 16);
  flangeGeo.rotateZ(Math.PI / 2);
  const fL = new THREE.Mesh(flangeGeo, woodMat);
  fL.position.set(-0.45, 0.65, 0);
  const fR = new THREE.Mesh(flangeGeo, woodMat);
  fR.position.set(0.45, 0.65, 0);
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.86, 16),
    safetyYellowMat,
  );
  drum.rotateZ(Math.PI / 2);
  drum.position.set(0, 0.65, 0);
  drum.castShadow = true;
  reel.add(fL, fR, drum);
  group.add(reel);

  /* --------------------------------------------------------- 6. ARCHITECTURAL LIGHTING & SAFETY ACROSS FULL 93M */
  // Rhythmic high-bay LED luminaires suspended from roof trusses along the whole 93-meter length
  const luminaireXGrid = [-34.4, -26.7, -19.1, -11.5, -3.8, 3.8, 11.5, 19.1, 26.7, 34.4, 42.1];
  for (const lx of luminaireXGrid) {
    for (const lz of [-6.5, 0, 6.5]) {
      group.add(createHighBayLuminaire(lx, lz));
    }
  }

  // Fire safety stations on structural columns
  const columnPositionsX = [-34.4, -26.7, -19.1, -11.5, 11.5, 19.1, 26.7, 34.4];
  for (const cx of columnPositionsX) {
    const fireStationNorth = createFireSafetyStation();
    fireStationNorth.position.set(cx, 0, -7.8);
    const fireStationSouth = createFireSafetyStation();
    fireStationSouth.position.set(cx, 0, 7.8);
    fireStationSouth.rotation.y = Math.PI;
    group.add(fireStationNorth, fireStationSouth);
  }

  /* --------------------------------------------------------- 7. EXPANSIVE EXTERIOR GROUND APRON */
  // Ground concrete apron surrounding warehouse so zooming out looks solid and architectural.
  // Anisotropy keeps the warm grazing-angle sunset light from shimmering across the tiling.
  const groundTextureLoader = new THREE.TextureLoader();
  const groundDiff = groundTextureLoader.load('/assets/textures/concrete_floor_diff_2k.jpg');
  groundDiff.colorSpace = THREE.SRGBColorSpace;
  groundDiff.wrapS = THREE.RepeatWrapping;
  groundDiff.wrapT = THREE.RepeatWrapping;
  groundDiff.repeat.set(16, 14);
  groundDiff.anisotropy = 8;

  const groundRough = groundTextureLoader.load('/assets/textures/concrete_floor_rough_2k.jpg');
  groundRough.wrapS = THREE.RepeatWrapping;
  groundRough.wrapT = THREE.RepeatWrapping;
  groundRough.repeat.set(16, 14);
  groundRough.anisotropy = 8;

  const exteriorGroundMat = new THREE.MeshStandardMaterial({
    map: groundDiff,
    roughnessMap: groundRough,
    roughness: 0.85,
    metalness: 0.05,
  });

  const apronGeo = new THREE.PlaneGeometry(280, 240);
  apronGeo.rotateX(-Math.PI / 2);
  const apronMesh = new THREE.Mesh(apronGeo, exteriorGroundMat);
  apronMesh.position.set(3.8, -0.015, 0); // Directly underneath the interior floor
  apronMesh.receiveShadow = true;
  group.add(apronMesh);

  // Exterior asphalt loading bay access road with yellow guide markings
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1f242c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 32), roadMat);
  roadMesh.rotateX(-Math.PI / 2);
  roadMesh.position.set(3.8, -0.012, 32);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Yellow loading dock parking bay lines in front of the main entrance gate
  for (let bx = -16; bx <= 24; bx += 8) {
    const dockLine = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 14), safetyYellowMat);
    dockLine.rotateX(-Math.PI / 2);
    dockLine.position.set(bx, -0.01, 24);
    group.add(dockLine);
  }

  /* --------------------------------------------------------- 8. CC0 3D GLB MODELS INJECTION */
  const loadModels = async (): Promise<void> => {
    const gltfLoader = new GLTFLoader();

    const loadOne = (url: string): Promise<THREE.Group | null> => {
      return new Promise((resolve) => {
        gltfLoader.load(
          url,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => {
            console.warn(`[factory] Could not load model ${url}:`, err);
            resolve(null);
          },
        );
      });
    };

    const [workbenchScene, tableScene, shelvesScene, machineGenericScene, machinePressScene, conveyorScene] =
      await Promise.all([
        loadOne('/assets/3d/workbench.glb'),
        loadOne('/assets/3d/table_industrial.glb'),
        loadOne('/assets/3d/shelves_rack.glb'),
        loadOne('/assets/3d/machine_generic.glb'),
        loadOne('/assets/3d/machine_press.glb'),
        loadOne('/assets/3d/conveyor_belt.glb'),
      ]);

    const configureShadows = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    };

    // 1. Workbenches: Maintenance bay and QC inspection
    if (workbenchScene) {
      configureShadows(workbenchScene);

      // Maintenance workshop bench
      const benchMaint = workbenchScene.clone();
      benchMaint.scale.setScalar(2.2);
      benchMaint.position.set(-22, 0, 9.5);
      benchMaint.rotation.y = 0;

      // Quality control workbench
      const benchQC = workbenchScene.clone();
      benchQC.scale.setScalar(2.2);
      benchQC.position.set(16, 0, -3.8);
      benchQC.rotation.y = Math.PI;

      // Material prep workbench
      const benchPrep = workbenchScene.clone();
      benchPrep.scale.setScalar(2.2);
      benchPrep.position.set(-16, 0, -3.8);
      benchPrep.rotation.y = Math.PI;

      // Tabletop props on QC bench
      const boxOnQC1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), cardboardBoxMat);
      boxOnQC1.position.set(16 - 0.35, 0.95, -3.8);
      const boxOnQC2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), cardboardBoxMat);
      boxOnQC2.position.set(16 + 0.35, 0.95, -3.8);
      boxOnQC1.castShadow = boxOnQC2.castShadow = true;

      group.add(benchMaint, benchQC, benchPrep, boxOnQC1, boxOnQC2);
    }

    // 2. Industrial Tables: Packaging line and Textile cutting prep
    if (tableScene) {
      configureShadows(tableScene);

      const tablePack = tableScene.clone();
      tablePack.scale.setScalar(2.5);
      tablePack.position.set(19.5, 0, -3.8);
      tablePack.rotation.y = Math.PI;

      const tableTextile = tableScene.clone();
      tableTextile.scale.setScalar(2.5);
      tableTextile.position.set(-25, 0, -3.8);
      tableTextile.rotation.y = Math.PI;

      // Stacks of shoe boxes on packaging table
      const boxOnPack1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), cardboardBoxMat);
      boxOnPack1.position.set(19.5 - 0.4, 0.95, -3.8);
      const boxOnPack2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), cardboardBoxMat);
      boxOnPack2.position.set(19.5 + 0.4, 0.95, -3.8);
      const boxOnPack3 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), cardboardBoxMat);
      boxOnPack3.position.set(19.5, 1.17, -3.8);
      boxOnPack1.castShadow = boxOnPack2.castShadow = boxOnPack3.castShadow = true;

      // Rolled canvas on textile table
      const rollOnTable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 16), canvasMat);
      rollOnTable.rotation.z = Math.PI / 2;
      rollOnTable.position.set(-25, 0.95, -3.8);
      rollOnTable.castShadow = true;

      group.add(tablePack, tableTextile, boxOnPack1, boxOnPack2, boxOnPack3, rollOnTable);
    }

    // 3. Shelves Racks: West logistics storage & East finished goods display
    if (shelvesScene) {
      configureShadows(shelvesScene);

      const shelfCoords = [
        { x: -33, z: 8.5, ry: 0 },
        { x: -31, z: 8.5, ry: 0 },
        { x: -29, z: 8.5, ry: 0 },
        { x: 19, z: 8.5, ry: Math.PI },
        { x: 21, z: 8.5, ry: Math.PI },
        { x: 23, z: 8.5, ry: Math.PI },
      ];

      for (const { x, z, ry } of shelfCoords) {
        const shelf = shelvesScene.clone();
        shelf.scale.setScalar(2.6);
        shelf.position.set(x, 0, z);
        shelf.rotation.y = ry;
        group.add(shelf);
      }
    }

    // 4. Conveyor Line in East Wing: Moves shoes from 3D molding zone towards packaging
    if (conveyorScene) {
      configureShadows(conveyorScene);

      // Chained 3-segment conveyor line (X: 10 to 14.5, Z: -3.8)
      for (let i = 0; i < 3; i++) {
        const seg = conveyorScene.clone();
        seg.scale.set(1.5, 1.5, 1.5);
        seg.position.set(10.5 + i * 1.5, 0, -3.8);
        seg.rotation.y = Math.PI / 2;
        group.add(seg);
      }
    }

    // 5. Industrial Machinery: Maintenance bay
    if (machineGenericScene) {
      configureShadows(machineGenericScene);
      const machineGen = machineGenericScene.clone();
      machineGen.scale.setScalar(1.2);
      machineGen.position.set(-26, 0, 9.5);
      machineGen.rotation.y = 0;
      group.add(machineGen);
    }

    if (machinePressScene) {
      configureShadows(machinePressScene);
      const heavyPress = machinePressScene.clone();
      heavyPress.scale.setScalar(1.2);
      heavyPress.position.set(-18, 0, 9.5);
      heavyPress.rotation.y = 0;
      group.add(heavyPress);
    }

    console.log('[factory] Successfully integrated CC0 industrial GLB models across warehouse');
  };

  return { group, loadModels };
}
