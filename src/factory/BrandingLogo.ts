import * as THREE from 'three';

export interface LogoMedallionOptions {
  radius?: number;
  depth?: number;
  hasHalo?: boolean;
  haloColor?: number;
  emissiveIntensity?: number;
  /** Second logo face on the back so the medallion reads correctly from any side. */
  doubleSided?: boolean;
}

/**
 * Creates an architectural, high-grade 3D corporate logo medallion for Calzado Chapín:
 * - Subtle extruded circular backing plaque in dark industrial slate
 * - Outer beveled brushed metallic rim with realistic light catch
 * - High-resolution logo face with alpha cutout from /logo.webp
 * - Clean Tech backlight halo ring for evening and ambient prominence
 * - Optional double-sided build: hanging and glass-mounted signs show a
 *   correct, readable logo from both sides (never a blank reverse)
 */
export function createLogoMedallion(options: LogoMedallionOptions = {}): THREE.Group {
  const {
    radius = 1.0,
    depth = 0.06,
    hasHalo = true,
    haloColor = 0x38bdf8,
    emissiveIntensity = 0.4,
    doubleSided = true,
  } = options;

  const group = new THREE.Group();
  group.name = 'CalzadoChapin_LogoMedallion';

  const textureLoader = new THREE.TextureLoader();
  const logoTexture = textureLoader.load('/logo.webp');
  logoTexture.colorSpace = THREE.SRGBColorSpace;

  // 1. Backing Plinth / Bezel in deep industrial slate (matches the logo outer navy ring)
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x1b2838,
    roughness: 0.35,
    metalness: 0.65,
  });
  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, depth, 48),
    bezelMat,
  );
  bezel.rotation.x = Math.PI / 2;
  bezel.castShadow = true;
  bezel.receiveShadow = true;

  // 2. Beveled outer chrome/steel trim ring
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xdce5ee,
    roughness: 0.22,
    metalness: 0.88,
  });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.05, radius * 0.038, 12, 48),
    rimMat,
  );
  rim.position.z = depth / 2;
  rim.castShadow = true;

  // 3. Front circular face with Calzado Chapín logo emblem
  const faceMat = new THREE.MeshStandardMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.03,
    roughness: 0.32,
    metalness: 0.08,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: logoTexture,
    emissiveIntensity: emissiveIntensity,
  });

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    faceMat,
  );
  face.position.z = depth / 2 + 0.005;

  group.add(bezel, rim, face);

  // 3b. Double-sided build: a second face turned 180° so viewers on the back
  // side (hanging sign, glass mounting) also see a correct, readable logo.
  if (doubleSided) {
    const backRim = new THREE.Mesh(rim.geometry, rimMat);
    backRim.position.z = -depth / 2;

    const backFace = new THREE.Mesh(face.geometry, faceMat);
    backFace.rotation.y = Math.PI;
    backFace.position.z = -(depth / 2 + 0.005);

    group.add(backRim, backFace);
  }

  // 4. Subtle Clean Tech ambient halo illumination
  if (hasHalo) {
    const haloMat = new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.04, radius * 1.28, 48),
      haloMat,
    );
    halo.position.z = -0.01;
    group.add(halo);
  }

  return group;
}

/**
 * Builds the complete factory branding package and places logo medallions at key strategic locations:
 * 1. Exterior Main Entrance Facade (Frontispicio Principal): mounted on the curtain wall above
 *    the main gate, seen upon arrival & from the panoramic view.
 * 2. Interior Central Structural Truss (Mural Central): overlooking active production.
 * 3. Hero Showcase Pedestal (Pedestal de Chanclas): Directly beneath the featured sandals.
 * 4. West Wing Logistics Wall: Above raw materials intake.
 * 5. East Wing Expansion Wall: Branding the future growth area.
 *
 * Placement uses the measured warehouse shell layers (per-material Box3 probe):
 * walls outer face z = 15.69 / x -42.59..50.19, metal siding inner faces x = -42.23
 * (west) and x = 49.74 (east), glass band y 0.77..5.65, gate top ~4.9 m. Emblems sit
 * proud of those faces on solid bands so none is buried in, or pokes through, a wall.
 */
export function buildFactoryBranding(): THREE.Group {
  const brandingGroup = new THREE.Group();
  brandingGroup.name = 'FactoryBranding_Logos';

  // 1. Exterior Main Facade: mounted on the wall band above the main central gate
  // (glass tops at y 5.65; wall outer face z = 15.69, roof fascia at z 15.77)
  const exteriorLogo = createLogoMedallion({
    radius: 1.05, // 2.1m diameter facade emblem
    depth: 0.08,
    hasHalo: true,
    haloColor: 0x38bdf8,
    emissiveIntensity: 0.45,
  });
  exteriorLogo.position.set(0.0, 6.6, 15.78); // y 5.55..7.65 on the solid band above the glass
  exteriorLogo.rotation.y = 0; // Front faces +Z (exterior parking/apron)
  brandingGroup.add(exteriorLogo);

  // 2. Interior Central Production Truss: suspended above the main central production axis
  // Facing south (+Z) towards the entrance and the green safety walkway; double-sided so the
  // north half of the hall also sees a correct logo instead of a blank reverse
  const interiorCenterLogo = createLogoMedallion({
    radius: 1.45, // 2.9m diameter interior emblem
    depth: 0.07,
    hasHalo: true,
    haloColor: 0x10b981, // Emerald Green Clean Tech halo
    emissiveIntensity: 0.5,
  });
  interiorCenterLogo.position.set(0.0, 5.2, -7.6);
  interiorCenterLogo.rotation.y = 0; // Facing +Z into the hall
  brandingGroup.add(interiorCenterLogo);

  // 3. Hero Showcase Pedestal Badge: Embossed on the front face of the circular pedestal
  // Directly beneath the authentic Chanclas Chapín pair
  const pedestalBadge = createLogoMedallion({
    radius: 0.18, // 36cm circular badge
    depth: 0.025,
    hasHalo: true,
    haloColor: 0x0fa889, // Jade glow
    emissiveIntensity: 0.35,
  });
  pedestalBadge.position.set(0.0, 0.58, 6.335);
  pedestalBadge.rotation.y = 0; // Facing +Z directly at visitor eye level
  brandingGroup.add(pedestalBadge);

  // 4. West Wing Wall Emblem (Almacén y Materias Primas): proud of the corrugated
  // siding inner face at emblem height (raycast: x = -42.02), above the glass band
  const westWallLogo = createLogoMedallion({
    radius: 1.2,
    depth: 0.08,
    hasHalo: true,
    haloColor: 0x0284c7,
    emissiveIntensity: 0.4,
  });
  westWallLogo.position.set(-41.96, 7.4, 0.0); // y 6.2..8.6: above pendants, below eave (~9.1)
  westWallLogo.rotation.y = Math.PI / 2; // Facing East across the whole warehouse
  brandingGroup.add(westWallLogo);

  // 5. East Wing Expansion Wall Emblem (Fase 2): proud of the siding inner face
  // (raycast: x = 49.64), plain metal wall there
  const eastWallLogo = createLogoMedallion({
    radius: 1.2,
    depth: 0.08,
    hasHalo: true,
    haloColor: 0xf59e0b, // Amber growth halo
    emissiveIntensity: 0.4,
  });
  eastWallLogo.position.set(49.58, 7.4, 0.0);
  eastWallLogo.rotation.y = -Math.PI / 2; // Facing West across the whole warehouse
  brandingGroup.add(eastWallLogo);

  return brandingGroup;
}
