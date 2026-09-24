import * as THREE from 'three';

export interface LogoMedallionOptions {
  radius?: number;
  depth?: number;
  hasHalo?: boolean;
  haloColor?: number;
  emissiveIntensity?: number;
}

/**
 * Creates an architectural, high-grade 3D corporate logo medallion for Calzado Chapín:
 * - Subtle extruded circular backing plaque in dark industrial slate
 * - Outer beveled brushed metallic rim with realistic light catch
 * - High-resolution logo face with alpha cutout from /logo.webp
 * - Clean Tech backlight halo ring for evening and ambient prominence
 */
export function createLogoMedallion(options: LogoMedallionOptions = {}): THREE.Group {
  const {
    radius = 1.0,
    depth = 0.06,
    hasHalo = true,
    haloColor = 0x38bdf8,
    emissiveIntensity = 0.4,
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
 * 1. Exterior Main Entrance Facade (Frontispicio Principal): Seen upon arrival & panoramic view.
 * 2. Interior Central Structural Truss (Mural Central): Overlooking active production.
 * 3. Hero Showcase Pedestal (Pedestal de Chanclas): Directly beneath the featured sandals.
 * 4. West Wing Logistics Wall: Above raw materials intake.
 * 5. East Wing Expansion Wall: Branding the future growth area.
 */
export function buildFactoryBranding(): THREE.Group {
  const brandingGroup = new THREE.Group();
  brandingGroup.name = 'FactoryBranding_Logos';

  // 1. Exterior Main Facade: Prominently mounted on the concrete fascia beam above the main central gate
  // X: 0.0 (exact center of open vehicular entrance), Y: 6.20 (aligned with roof gable/fascia), Z: 16.05 (exterior south facade)
  const exteriorLogo = createLogoMedallion({
    radius: 1.05, // 2.1m diameter facade emblem
    depth: 0.08,
    hasHalo: true,
    haloColor: 0x38bdf8,
    emissiveIntensity: 0.45,
  });
  exteriorLogo.position.set(0.0, 5.40, 16.12);
  exteriorLogo.rotation.y = 0; // Facing +Z (exterior parking/apron)
  brandingGroup.add(exteriorLogo);

  // 2. Interior Central Production Truss: Suspended above the main central production axis
  // Facing south (+Z) towards the entrance and the green safety walkway
  const interiorCenterLogo = createLogoMedallion({
    radius: 1.45, // 2.9m diameter interior emblem
    depth: 0.07,
    hasHalo: true,
    haloColor: 0x10b981, // Emerald Green Clean Tech halo
    emissiveIntensity: 0.5,
  });
  interiorCenterLogo.position.set(0.0, 5.20, -7.6);
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

  // 4. West Wing Wall Emblem (Almacén y Materias Primas)
  const westWallLogo = createLogoMedallion({
    radius: 1.6,
    depth: 0.08,
    hasHalo: true,
    haloColor: 0x0284c7,
    emissiveIntensity: 0.4,
  });
  westWallLogo.position.set(-42.55, 5.4, 0.0);
  westWallLogo.rotation.y = Math.PI / 2; // Facing East across the whole warehouse
  brandingGroup.add(westWallLogo);

  // 5. East Wing Expansion Wall Emblem (Fase 2)
  const eastWallLogo = createLogoMedallion({
    radius: 1.6,
    depth: 0.08,
    hasHalo: true,
    haloColor: 0xf59e0b, // Amber growth halo
    emissiveIntensity: 0.4,
  });
  eastWallLogo.position.set(49.9, 5.4, 0.0);
  eastWallLogo.rotation.y = -Math.PI / 2; // Facing West across the whole warehouse
  brandingGroup.add(eastWallLogo);

  return brandingGroup;
}
