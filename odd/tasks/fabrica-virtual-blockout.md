# Feature: fabrica-virtual-blockout

## Objective

Runnable standalone prototype of the "Calzado Chapín" factory virtual tour, so the user can
SEE the recorrido, OrbitControls behavior and hotspots before investing hours in Blender modeling.

## Problem

The real Calzado Chapín Astro project already ships a polished single-shoe scene
(`CraftShoeStage.ts`) with a hard constraint: the 3D shoe model/materials must NOT be altered.
A factory tour cannot live inside that monolith, and the user needs a preview first.

## Why

- User: "hazlo en la ruta actual Modelado 3D porque necesito ver como queda".
- Preview de-risks the asset pipeline: the scene composition, camera path and hotspot UX get
  validated with procedural geometry, then the blockout is swapped for the baked `.glb`.

## Scope

IN:
- Standalone Vite + TypeScript + three project inside `Modelado 3D/`.
- Procedural blockout of the 3 zones (Textiles y Corte / Aparado / Moldeado 3D y Ensamblaje).
- OrbitControls with rotate + pan + zoom (the brief explicitly requires all three).
- HTML hotspot layer with click -> camera flyTo + info panel.
- Fake-baked look: emissive LED strips, one shadow-casting key light, contact-shadow decals.
- Dev server the user can open in a browser.

OUT (explicitly not now):
- Real Blender model, baked lightmap atlas, Draco/KTX2 compression (pipeline documented, not built).
- Any change to `/Users/omarsalazar/Documents/Astro.nosync/Calzado Chapín` (forbidden by user).
- Portfolio/e-commerce pages.

## Constraints

- Must NOT touch the Calzado Chapín project.
- No git repo init (global rule: only commit when explicitly requested).
- Scene must stay within the documented performance budget so the port to Astro is a drop-in.
- Artifact language: code identifiers/comments in English. UI copy in Spanish (the brand site is Spanish).

## Tasks

- [ ] **T1 — Scaffold** (inline, mechanical)
  Vite + TS + three, `index.html`, `styles.css`, tsconfig, vite config. No research needed.
- [ ] **T2 — Escena procedural + hotspots + bootstrap** (delegated: writer trigger, 6+ non-trivial files)
  `src/factory/{materials,hall,zones,factory.config,FactoryHotspots,FactoryLoader,FactoryTourStage}.ts`
  plus `src/main.ts`.
- [ ] **T3 — Verificación** (inline)
  `npx tsc --noEmit` + production build + dev-server smoke test (HTTP 200, module graph resolves).
- [ ] **T4 — Port a Astro** (pending, not this session)
  Drop `src/factory/*` into Calzado Chapín as `/fabrica` route + lazy `import()` on viewport.
  Slice as chained PRs (>400 lines) with `size:exception` or split by zone.

## Acceptance criteria

1. `npm run dev` serves a page showing the factory hall with the 3 zones visible.
2. OrbitControls: left-drag rotates, wheel zooms, right-drag pans. `maxPolarAngle` prevents going under the floor.
3. At least 5 hotspots render as HTML markers, occluded by geometry, clickable.
4. Clicking a hotspot flies the camera to that station and opens an info panel.
5. No `window`-level listeners; all listeners scoped to canvas/elements. No global state collisions.
6. Draw calls stay low: shared materials, merged static geometry, instanced repeated machines.
7. `tsc --noEmit` clean; production build succeeds.

## Checks

Command: `npm run build` -> expect success
Command: `npx tsc --noEmit` -> expect 0 errors
Command: dev server smoke (`curl -s http://localhost:5173/`) -> expect HTTP 200 with the app shell

## Route log

| Task | Route | Trigger evidence |
|---|---|---|
| T1 | inline | mechanical scaffold, no research, no unresolved design |
| T2 | delegated (1 writer) | 8 non-trivial files, writer trigger |
| T3 | inline | bounded verification action |

## Delivery

- Forecast: ~900-1100 authored lines. No PR possible (no git repo) -> single artifact.
- If ported to Calzado Chapín later: `ask-on-risk`, chained PRs per zone.

## Progress

- [x] Reconocimiento: existing project audited (live vs dead Three.js stacks), weights measured.
- [x] T1 Scaffold — Vite + TS + three ^0.174.0, index.html, styles.css. 22 packages installed.
- [x] T2 Escena — 8 files, 1435 authored lines, delegated to one bounded writer.
- [x] T3 Verificación — typecheck + build + dev-server smoke, all green (see evidence).

## Verification evidence

Command: `npx tsc --noEmit` -> 0 errors (re-run by orchestrator, not trusted from writer report)
Command: `npm run build` -> success, `dist/assets/index-*.js` 519.59 kB raw / 132.19 kB gzip
Command: dev server `http://localhost:5173/` -> HTTP 200 on `/`, `/src/main.ts`, `/src/factory/FactoryTourStage.ts`, `/src/factory/zones.ts`
Command: `grep -rn "window\.|document\.body" src/factory/` -> only `window.devicePixelRatio` (read-only), no global mutation
Command: `grep -rn addEventListener src/factory/` -> canvas-scoped, `AbortController`-signalled, one `visibilitychange` read-only check
Command: `grep -n InstancedMesh src/factory/zones.ts` -> confirmed, 3 sewing heads share one InstancedMesh
Hotspots in `factory.config.ts` -> 6, Spanish copy verbatim per spec
Runtime counter -> `renderer.info.render.calls|triangles` logged once after first frame

NOT verified by the orchestrator: the visual result. WebGL output requires a real browser —
the user is the verifier of composition, lighting and camera framing.

## Known deviations from spec (accepted)

- `HotspotDef` tuples typed `readonly` + `as const satisfies` so the literal data stays const-correct
  under `strict` TS. Data and copy unchanged.
- `HotspotLayer.setActive(id)` added, uses `aria-current="true"` (no active class existed in styles.css).
- Sole blanks are flattened spheres, not rounded boxes — stayed inside the allowed primitive list.
- `glass` is a transparent `MeshStandardMaterial` (no transmission) because no env map/HDR is permitted.

## Work unit T5 — Ambiente exterior (cielo + volcanes + niebla)

Scope chosen by user: layers 0, 1 and 4 only. Layers 2/3/5 deferred.

- [x] **T5a — `src/factory/sky.ts`**: procedural equirectangular sky, 2048x1024 canvas.
- [x] **T5b — `src/factory/landscape.ts`**: 2 ridge planes with painted alpha profiles, `fog: true`.
- [x] **T5c — wired `FactoryTourStage.ts`**: sky background, PMREM environment from the sky,
  `THREE.Fog`. `RoomEnvironment` removed.
- [x] **T5d — rebalanced `setupLighting` + `envMapIntensity` + `toneMappingExposure`.**

### T5 verification evidence (orchestrator-run, with real rendered screenshots)

Built an actual visual-verification loop: headless Chrome (SwiftShader WebGL) screenshot ->
read the PNG. This is how the defects below were found; tsc alone would have called all of it done.

Found and fixed, in order:
1. Sky washed to grey. Cause: FOUR stacked whitening layers (additive sun glow at 0.95 alpha,
   cloud band, a 0.92-alpha haze band) plus `glassMat.envMapIntensity = 1.0`.
2. Volcanoes invisible. Cause: painted at y=296 on a 1024 canvas = **38 deg above the horizon**,
   outside any 45-degree-FOV frame. Lowered to y=424/452.
3. Ridges invisible. Cause: peaks sat inside their own top-40% haze-fade zone, and peak colours
   (`#7F94A8`) were too close to the fog colour. Lowered peaks to <=0.62, darkened to `#465F78`,
   fade zone to 28%, and fog far pushed 150 -> 260.
4. Mountains read as flat paper polygons. Cause: only 10 control points across 1024 px.
   Raised to 20 points + blur 1px -> 3px; volcano cone given concave flanks via quadraticCurveTo.
5. Glass veiled the exterior. Isolated the cause by moving the camera OUTSIDE the building with no
   glass in the way: the sky rendered correctly there, proving the glass was the veil.
   `glassMat.opacity` 0.28 -> 0.14.
6. Scene blown out (floor clipping to pure white). `toneMappingExposure` 1.0 -> 0.72,
   `floorMat.roughness` 0.26 -> 0.45, `floorMat.envMapIntensity` 0.65 -> 0.25.

Final state: `npx tsc --noEmit` clean, `npm run build` succeeds.

### STILL OPEN after T5 (honest status)

- Overall scene is STILL low-contrast / milky. Improved, but not yet "Clean Tech archviz".
- Hotspots overlap and pile up in the default view (a `chanclas` hotspot was added by the other
  writer, making 7 where the spec had 6).
- Draw-call delta was NOT measured. It is structurally +2 (two ridge planes; the sky is a
  background texture and fog is renderer state), but the browser console line
  `[factory] draw calls: N` has not been read.

### CONCURRENCY INCIDENT — RESOLVED (kept for history)

A SECOND writer/agent is editing this same project. Evidence:
- `src/factory/proceduralTextures.ts` created 22:17, `src/factory/ShoeModels.ts` created 22:29 —
  neither was in the T2 spec.
- `zones.ts` was mid-refactor when the T5 writer ran its typecheck (7 TS errors, `createWorkTable`
  / `createPress` returning `{ group, slot }` while still annotated `: THREE.Group`); it
  self-resolved minutes later.
- `factory.config.ts` gained a 7th hotspot (`chanclas`), unauthorised by the spec.
- `FactoryTourStage.ts` grew from 304 -> 313 -> 320 lines mid-session.
Risk: two writers on the same files will keep breaking the build. This must be resolved before
any further work.

Resolution (2026-09-24): the "second writer" was a parallel agent session run by the user, not a
rogue process. Both streams of work converged into the T6 expansion commit (`0f7304b`), which
typechecks and builds clean. No work was lost. Standing rule going forward: one writer per
work unit on this repo.

### Why this scope

The sky is a FINAL asset (it survives into the baked version), not throwaway blockout geometry.
Layers 2/3/5 are disposable once the Blender `.glb` lands.

### Cost

Sky = 0 draw calls (it is a background). Ridges = 2. Fog = 0. Total **+2 draw calls**.
Memory: one 2048x1024 texture plus a small PMREM cubemap.

### Known risk (must be verified visually, cannot be settled by code)

Swapping `environment` from the generic `RoomEnvironment` to a sky changes the shading of the
WHOLE scene. Exposure and light intensities WILL desync. Expect 2-3 visual tuning passes with
the user. This is expected, not a defect.

### Acceptance criteria T5

1. `npx tsc --noEmit` and `npm run build` clean.
2. Draw calls increase by no more than 4 versus the T3 measurement.
3. Volcanoes visible through the north glass wall; ridges hazed into the horizon.
4. Interior is NOT washed out by fog (fog `near` must stay beyond typical interior distances).
5. Sky reflections visible on the steel and the glass (this is the point of the swap).

## Work unit T6 — Expansión al almacén completo (93 m) + pipeline de assets

Authorized by user ("sube los cambios a github"). Delivered as three work units, pushed to
`origin/main` (`6c29b8f..0f7304b`).

- [x] **T6a — Assets CC0** `53b1fcc`: `scripts/download_assets.mjs` (Poly Haven 2K HDR +
  concrete/metal PBR, Kenney GLB props) with content-type, magic-byte and md5 validation;
  exposed as `npm run download-assets`; 15 derived files under `public/assets/` (23 MB).
- [x] **T6b — Expansión de zonas** `0f7304b`: `src/factory/WorkshopExpansion.ts` (new, 871 lines)
  builds the west raw-materials wing, east QC/packaging/logistics wing, the staged "Fase 2"
  area, central safety walkway, fire equipment and the exterior apron.
- [x] **T6c — Navegación + config**: `factory.config.ts` grows to 7 zones
  (`panoramica`, `almacen`, `empaque`, `expansion` new) and 10 hotspots (added `almacen`,
  `empaque`, `expansion`); `index.html` gains the matching nav buttons.
- [x] **T6d — Materiales/texturas**: hazard stripe, pedestrian walkway and kraft shoe-box
  procedural textures + pallet wood, safety-yellow and fire-red materials.
- [x] **T6e — Ajustes de layout**: `zones.ts` (molding line on two presses, placeholder chanclas
  removed now that real `.glb` shoes fill the slots), `ShoeModels.ts` (sole leveled against its
  27.25 deg CAD slope), `WarehouseLoader.ts` (warehouse recentered on the tour origin),
  `FactoryTourStage.ts` (expansion wired, fog/camera/controls range widened to 93 m).
- [x] **T6f — Repo hygiene**: `.atl/` local skill-registry cache added to `.gitignore` (`3e6ef6b`);
  it is machine-generated and contains absolute home-directory paths.

### T6 verification evidence (orchestrator-run)

Command: `npm run build` (`tsc --noEmit && vite build`) -> success, `dist/assets/index-*.js`
686.19 kB raw / 180.55 kB gzip, CSS 3.87 kB. Re-run on the frozen commit before delivery.
Command: `git push origin main` -> `6c29b8f..0f7304b`, branch back in sync with `origin/main`.
Asset size check -> largest file 6.3 MB HDR, under GitHub's 100 MB limit, no LFS required.
Secret scan over `scripts/download_assets.mjs` and the new `src/factory/*.ts` -> no keys/tokens;
the downloader uses public CC0 APIs only.

NOT verified: the visual result of the expansion. WebGL output needs a real browser; the user is
the verifier of composition, lighting and camera framing (same caveat as T5).

### Open after T6

- The scene was already flagged low-contrast/milky in T5; the T6 additions raise the same visual
  question and still need a browser pass.
- Draw-call delta for the expansion was NOT measured. `renderer.info.render.calls|triangles` is
  logged once after the first frame — read it in the browser to close criterion 6.
- The 686 kB bundle (>500 kB) warning from three.js remains open; code-splitting is deferred.

## Work unit T7 — Branding corporativo (medallones 3D + logo UI)

Authorized by user ("sube los cambios"). Pushed to `origin/main` (`f42bc65..58e2cb1`).

- [x] **T7a — `src/factory/BrandingLogo.ts`** (new, 176 lines) `987b606`: `createLogoMedallion`
  (extruded slate bezel, brushed-metal rim, alpha-cut logo face, Clean Tech halo ring) and
  `buildFactoryBranding`, placing 5 medallions — exterior main facade, interior central truss,
  hero pedestal badge, west logistics wall (Almacén) and east expansion wall (Fase 2).
- [x] **T7b — Wire + UI**: `FactoryTourStage.ts` adds the branding group and registers it as a
  hotspot occluder; `index.html` shows `public/logo.webp` in the topbar; `src/styles.css` styles
  `.topbar__identity` / `.topbar__logo`.
- [x] **T7c — Asset**: `public/logo.webp` (75 KB, valid WebP, passed to the texture loader).
- [x] **T7d — Verification harness** `58e2cb1`: `scripts/verify_logos.mjs` drives headless Chrome
  over CDP to screenshot the pedestal and exterior views. Made portable before committing.

### T7 verification evidence (orchestrator-run)

Command: `npm run build` -> success, `dist/assets/index-*.js` 689.56 kB raw / 181.49 kB gzip,
CSS 4.20 kB (re-run on the frozen commit before delivery).
Command: `node --check scripts/verify_logos.mjs` -> syntax OK.
Command: `git push origin main` -> `f42bc65..58e2cb1`, branch back in sync.
NOT verified: the rendered medallions. Placement, halo intensity and logo legibility need a real
browser; the user is the visual verifier (same caveat as T5 / T6).

### Deviation recorded (T7d)

`scripts/verify_logos.mjs` originally hardcoded the Chrome binary path and a personal output
directory (`/Users/<user>/.gemini/antigravity/brain/<uuid>/`). That would only run on one machine
and leaks a local path, so before committing it was rewritten to read `CHROME_BIN`, `APP_URL` and
`LOGO_SHOT_DIR`, defaulting to the macOS Chrome path, `localhost:5173` and the project-local
`.artifacts/logos` (now gitignored). If the antigravity workflow reads screenshots from the old
brain directory, set `LOGO_SHOT_DIR` to that path when running the script.

### Open after T7

- Five medallions add draw calls and materials; the delta was NOT measured. Read
  `renderer.info.render.calls|triangles` in the browser alongside the T6 number.
- Logo legibility at the pedestal badge scale (36 cm) is unproven visually.
- The bundle warning from T6 persists (689 kB raw).

## Work unit T8 — Ambiente exterior de atardecer (cielo, montañas 360°, iluminación)

Authorized by user: "Mejora el ambiente exterior que se vea como atardecer, y que se vean bien las
montañas y el exterior, mejora a una alta calidad que se vea realista." Not yet committed.

- [x] **T8a — `src/factory/sky.ts` rewritten**: sunset equirectangular map (indigo→violet→gold
  gradient, sun disc at u = 0.34 / ~15° elevation with three additive blooms, golden low stratus
  clustered at the sun, violet high wisps, warm horizon haze, recoloured volcano silhouettes,
  dark dusk nadir, seeded dither grain against ACES banding). The sun placement is documented as
  the single source of truth for T8b/T8c.
- [x] **T8b — `src/factory/landscape.ts` rewritten**: two flat ridge planes → three concentric
  open cylinders (r = 560/400/300, BackSide, alpha silhouettes) giving a 360° mountain horizon
  for every orbit angle. Ridge profiles sum integer-frequency triangular waves (seamless wrap,
  deterministic via mulberry32) with a sharpness exponent for angular peaks; crest rim light and
  a warm/cool body wash follow the sun azimuth (ring-u 0.41); the base 14% alpha-fades into the
  terrain. Plus a 760 m ground disc (dusk earth, receives shadows) closing the apron-to-mountain
  gap. Dispose covers geometries, textures and materials.
- [x] **T8c — `src/factory/hall.ts` `setupLighting`**: daylight rig → golden-hour rig. Key sun
  `0xffa257` at 1.8 placed 300 units along the sky-sun direction (155, 78, −245), shadow frustum
  widened to ±140/±65 with 4096² map for the long evening shadows; hemisphere amber-over-warm-violet
  0.75; ambient `0xffdcc0` 0.38; fills re-tinted (violet dusk fill, warm horizon bounce).
- [x] **T8d — `src/factory/FactoryTourStage.ts`**: fog `0xdae6f0 60..420` → `0xe9a873 100..900`
  (warm haze eats the rings and terrain, interior crisp), camera far 450 → 1500 (rings at 560 m),
  exposure 0.76 → 0.85, `environmentIntensity` 0.75 → 0.9 (sunset IBL is dimmer overall).
- [x] **T8e — `src/factory/WorkshopExpansion.ts`**: apron concrete textures get `anisotropy = 8`
  and repeat 24×20 → 16×14 (grazing-angle moiré under the warm light).
- [x] **T8f — `scripts/verify_sunset.mjs`** (new): headless-Chrome CDP harness capturing the
  initial view, the panorámica and two orbit steps toward the sun; collects console errors.
  Configurable via `CHROME_BIN` / `APP_URL` / `SUNSET_SHOT_DIR`, defaults to `.artifacts/sunset`.

### T8 verification evidence (orchestrator-run, rendered screenshots in `.artifacts/sunset/`)

Command: `npm run build` -> success after every iteration (`dist/assets/index-*.js` ~693 kB).
Command: `APP_URL=http://localhost:5178/ node scripts/verify_sunset.mjs` -> 4 PNGs, "No console
errors" on every run.
Visual pass (visual-judge subagent unavailable in-session; screenshots inspected directly),
three iterations with defects found and fixed:

1. Mountain rings read as smooth rolling dunes ("wavy curtains"). Cause: the low-frequency
   triangle octave dominated and `tri` alone is too round. Fixed with a sharpness exponent per
   octave (`tri(u*f + phase) ** s`, s 1.2–2.6) and rebalanced amplitudes so mid/high octaves cut
   the crest detail.
2. Building shadow clipped by a razor-straight edge mid-apron; shadowed asphalt crushed to black.
   Cause: 13°-elevation shadow frustum (±80) too small for the true shadow length. Fixed: sun
   raised to 15°, frustum ±140/±65 near 150/far 520, ambient 0.2 → 0.38, hemisphere 0.5 → 0.75,
   ground disc lifted `0x453647` → `0x524052`.
3. Hard straight seam where ring bases met the terrain. Fixed with the bottom-14% alpha fade
   (destination-out) so the silhouettes melt into the fogged ground.
4. Apron tiling moiré at grazing angles. Fixed with anisotropy 8 + coarser repeat.

Final state: sunset gradient + sun glow render from the default view and on orbit; three ridge
layers read as mountains with sun-kissed crests; long shadows stretch across the apron; interior
stays readable (warm dusk tint, LEDs and white machines intact).

### Open after T8

- The sky-texture volcano silhouettes are almost fully hidden behind the 360° rings from ground
  views; harmless, but they could be removed if the rings stay.
- Shadow-map texel is ~6.8 cm (±140 at 4096²); PCFSoft hides it, but a cascaded setup would be
  needed if close-up exterior shadow quality ever matters.
- Draw-call delta NOT measured precisely (2 planes → 3 cylinders + disc ≈ +1 net, pending the
  same browser-console read flagged in T6/T7).
- Work unit not committed; `scripts/verify_sunset.mjs` and the code changes are in the working
  tree pending the user's explicit commit/push request.

## Work unit T9 — Colocación y orientación de medallones (auditoría de logos)

Authorized by user: los logos deben quedar en lugares estratégicos y verse correctamente de
frente, porque uno mostraba el reverso. Not yet committed.

- [x] **T9a — `src/factory/BrandingLogo.ts`**: medallones de doble cara (segunda cara + aro
  traseros, opción `doubleSided`) — un colgante o un montaje sobre vidrio muestra un logo
  legible por ambos lados en lugar de un disco oscuro con halo.
- [x] **T9b — Reubicados sobre caras reales medidas**: sondeo por CDP del modelo ya cargado
  (Box3 por material + raycast Möller–Trumbore) dio: fachada sur, cara exterior z=15.69 con
  vidrio hasta y=5.65 y puerta hasta ~4.9 m; caras interiores de lámina x=-42.02 (oeste) y
  x=49.64 (este) a la altura del emblema. Fachada (0, 6.6, 15.78); oeste (-41.96, 7.4, 0);
  este (49.58, 7.4, 0); radio de alas 1.6 → 1.2. Central y pedestal intactos.
- [x] **T9c — Auditoría con cámara controlada**: hook temporal (no commiteado) para colocar
  la cámara vía CDP y capturar cada medallón de frente y de reverso (`.artifacts/logo-audit2/`).

Defectos encontrados y corregidos:
1. Fachada: flotaba 0.43 m frente al muro a y=5.4 — el reverso asomaba por las ventanas altas
   desde dentro y de fuera parecía colgado en la puerta. Ahora va sobre la banda sólida que
   queda entre el dintel y el alero.
2. Central interior: al orbitar al norte mostraba disco negro + halo verde → la doble cara lo
   resuelve; el reverso ahora muestra el logo correcto.
3. Oeste/este: medio enterrados en el espesor del muro (insets adivinados) → montados al ras de
   las caras medidas; el emblema este ya aparece en la vista Fase 2.

### T9 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas por medallón (frente/reverso) en
`.artifacts/logo-audit2/`; vistas de zona en `.artifacts/logo-audit/`. Sin cambios netos en
`FactoryTourStage.ts` (hooks de auditoría removidos; diff vacío).

### Open after T9

- Desde el eje exacto (z=0) una luminaria/cercha cruza delante de los emblemas de los muros —
  realista y el logo sigue legible desde cualquier otro ángulo.
- Las etiquetas de hotspot se acumulan sobre la fachada en la panorámica (arrastrado de T5/T6).

## Work unit T10 — Props apoyados en la estructura real (extintores flotantes)

Authorized by user: los extintores flotaban en el aire; deben ir en las columnas, y revisar que
el detalle no se repita en otros elementos. Not yet committed.

- [x] **T10a — Columnas reales medidas**: escaneo de triángulos alto-angostos (minY<1, maxY>4.5,
  extensiones <1.6 m) sobre el modelo cargado → dos hileras de columnas en z=±5.62, X = ±3.89,
  ±11.47, ±19.05, ±26.83, ±34.41, sección ~0.3 m. Las estaciones estaban en z=±7.8 (pasillo
  lateral vacío) con una retícula X inventada.
- [x] **T10b — `WorkshopExpansion.ts`**: 16 estaciones de extintor montadas al ras de la cara
  de columna que mira al pasillo central (z=∓5.45, rotación hacia el walkway); paquete de
  perfiles de aluminio ahora descansa sobre durmientes de madera (antes flotaba 5 cm sin el
  dunnage que el comentario prometía); pallet de cajas (-34, -5.5) → (-33.3, -5.5) porque
  cortaba la columna (-34.41, -5.62).
- [x] **T10c — Auditoría del resto**: carretes de cable (apoyados en sus flancos por diseño),
pallets QC/expansión (holgados ≥0.08 m de columnas), barriles, letreros con base, racks de
pared norte y máquinas de zonas.ts (todas apoyadas en piso) — sin más casos de flotación.

### T10 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas de vistas Almacén/Fase 2/Inicial en
`.artifacts/logo-audit/` tras el cambio: extintores visibles montados en columnas junto al
pasillo, perfiles sobre durmientes, sin clips visibles.

## Work unit T11 — Artefactos en vistas exteriores (z-fighting + borde del terreno)

Authorized by user: al mover la cámara a vistas exteriores aparecen artefactos (parches
escalonados en la zona sombreada, triángulo suelto, banda oscura del "fin del mundo").

- [x] **T11a — Z-fighting de decals**: carretera (-0.012) vs apron (-0.015) separados por 3 mm
  y líneas de andén 2 mm sobre la carretera — a 100-300 m la precisión del z-buffer (near 0.1,
  far 1500) es de ~1-2 cm y titilan al orbitar. Offsets escalonados en centímetros: carretera
  +0.02, líneas de andén +0.028, walkway +0.012, crosswalks +0.014, cinta de peligro +0.016;
  `camera.near` 0.1 → 0.2 duplica la precisión de profundidad.
- [x] **T11b — Borde del terreno**: el disco (r=760) terminaba antes de la niebla máxima
  (900) → franja oscura visible desde vistas altas. Radio 760 → 1200 (el borde cae tras la
  niebla y se pinta como bruma pura) y el nadir del cielo ahora retiene la bruma cálida mucho
  más antes de hundirse en oscuro.

### T11 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas elevadas con zoom-out reproducido por CDP
(`.artifacts/sunset/sunset_5_elevada.png`, `sunset_6_elevada_orbitada.png`): parches de
z-fighting eliminados; el borde del terreno se funde con la bruma. Nota: la franja oscura entre
las montañas y el horizonte en vistas muy altas es el cuerpo propio de los anillos (comportamiento
esperado, no artefacto).

## Work unit T12 — Tooltips interiores profesionales + paredes blancas

Authorized by user: tooltips profesionales visibles únicamente dentro del taller, y paredes del
taller blancas como las columnas. Not yet committed.

- [x] **T12a — Visibilidad por interior**: `HotspotLayer.update(occluders, insideWorkshop)` —
  el stage calcula si la cámara está dentro de la carcasa medida (x -43.6..51.3, z ±16.6,
  y < 9.9) y la capa entera se desvanece (clase `is-outside`: opacity+visibility 320 ms) fuera
  del edificio. Elimina de raíz el amontonamiento de etiquetas sobre la fachada (deuda T5/T6).
- [x] **T12b — Rediseño de tooltips**: píldora blanca translúcida con blur, texto obsidiana,
  punto añil, stem de 10 px apuntando al ancla (el JS ahora ancla el pie de la píldora al punto
  3D), sombras suaves, hover con borde añil y selección en obsidiana.
- [x] **T12c — Paredes blancas**: `WarehouseLoader.ts` — `walls` y `metal` sin color map
  (textura gris teñida de ámbar por la luz era el marrón), pintura mate 0xf6f4ef / 0xf3f1ec,
  metalness 0.04/0.22; se conservan normal/roughness maps (relieve de panel y corrugado).
  Columnas, piso, techo y puertas sin cambios.

### T12 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas: `audit_0_initial` (interior blanco con tooltips
nuevos), `audit_1_fachada` (fachada blanca SIN etiquetas), `sunset_5_elevada` (vista alta sin
hotspots y edificio blanco desde fuera) — en `.artifacts/`.

## Work unit T13 — Mural central montado (ya no flota)

Authorized by user: "hay logo flotando dentro que no se ve bien". Not yet committed.

- [x] **T13 — `src/factory/BrandingLogo.ts`**: el mural central ya no cuelga del aire en
  (0, 5.2, -7.6). Causas: sin suspensión visible; las varillas de prueba (1.45 m hasta el velo
  del techo, y≈7.75 en z=-7.6 medido por raycast) quedaban ocultas tras el velo del techo norte
  (que baja hacia el alero, y 9.3→6.0) desde cualquier vista baja, y el ducto HVAC de z=-2.8
  cortaba su parte superior. Solución: montado en la cara interior del muro norte
  (raycast: cara de lámina z=-15.42), posición (0, 4.6, -15.395), doble cara hacia el pasillo.
  La vista por defecto y todas las vistas bajas lo leen como letrero de pared.

### T13 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas `.artifacts/logo-audit2/colgante_*.png` (montado
sobre la banda de ventanales, centrado en montante) y `audit_0_initial` (visible arriba al
centro desde la vista inicial). `FactoryTourStage.ts` sin cambios netos (hook temporal removido).

## Work unit T14 — Entorno exterior: parque, calles perimetrales y postes

Authorized by user: "Mejora el exterior con three.js crea un parque y calles al rededor con
postes." Not yet committed.

- [x] **T14a — `src/factory/grounds.ts`** (nuevo, ~300 líneas): calles perimetrales (anillo de
  4 tramos + 3 conectores) con líneas centrales discontinuas (textura dash repetida); parque al
  sur y césped en los márgenes (6 rectángulos disjuntos con textura de pasto procedural);
  senderos de gravilla; ~63 árboles y 9 bancas; 54 postes de luz con brazo, cabeza emisiva
  cálida y charco de luz falso (círculo aditivo). Todo con InstancedMesh: árboles 3 draw calls,
  postes 4, bancas 3; colocación determinista (mulberry32).
- [x] **T14b — Cableado**: `FactoryTourStage.ts` agrega `createGrounds()` con dispose en el
  teardown; `hall.ts` amplía el frustum de sombra ±140 → ±155 para cubrir las copas del
  perímetro (texel 7.3 cm).

### T14 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas elevadas/por zona en `.artifacts/sunset/` y
`.artifacts/logo-audit/`: calles con líneas, árboles con sombras largas, postes encendidos,
interior intacto (el parque se ve verde a través de los ventanales).

## Work unit T15 — Calles estilo referencia (aceras, postes de concreto, cableado)

Authorized by user con captura de referencia (calle estilizada japonesa): aceras elevadas con
guarnición y franja táctil, línea central amarilla, postes de concreto con cableado. Adaptado
al atardecer del tour. Not yet committed.

- [x] **T15a — Aceras y señalización**: aceras elevadas (0.14 m) con guarnición en las dos
  caras de las cuatro calles, franja táctil amarilla al borde, línea central sólida amarilla
  y líneas de borde blancas (sustituyen a las discontinuas), cruces peatonales en las
  conexiones del sur.
- [x] **T15b — Postes de concreto y cableado**: 16 postes (7.2 m, hormigón claro) sobre las
  aceras interiores de las dos calles principales, escalonados entre las luminarias, con 2
  crucetas cada uno y 3 cables catenarios por vano (sag 0.55 m) — 2 LineSegments en total.
- [x] **T15c — Costura del cielo**: el resplandor del horizonte (r=1000) y dos nubes
  alcanzaban el borde de la textura equirectangular → franja vertical visible mirando al
  oeste. Radio 1000 → 660 y nubes reposicionadas dentro del encuadre.

### T15 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas `.artifacts/sunset/calle_sur*.png` (nivel de
calle: aceras, franja táctil, línea amarilla, postes y cables contra el cielo) y
`sunset_5_elevada.png` (vista aérea). Costura del cielo eliminada; líneas sobre su eje.

## Work unit T16 — Carteles legibles (texto auto-ajustado, poste detrás)

Authorized by user con dos capturas: el título "ALMACÉN DE PRODUCTO TERMINADO" se salía del
tablero y un poste cruzaba por delante del texto. Not yet committed.

- [x] **T16a — `proceduralTextures.ts`**: el título y el subtítulo de los carteles ahora
  auto-ajustan su cuerpo (measureText + reducción progresiva hasta 436 px) en vez de usar
  fuente fija de 26/14 px que desbordaba con títulos largos.
- [x] **T16b — `WorkshopExpansion.ts`**: el panel del cartel se monta 11 cm delante del poste
  (z=+0.11) — antes compartían eje y el poste (r=0.04 vs medio grosor 0.025) atravesaba la
  cara del tablero mostrando un poste sobre el texto.

### T16 verification evidence (orchestrator-run)

Command: `npm run build` -> success. Capturas de primer plano `.artifacts/logo-audit2/cartel_depot.png`
y `cartel_qc.png`: título completo dentro del tablero, poste detrás del panel. Hook temporal
removido (diff limpio en FactoryTourStage.ts).

## Next step

Visual tuning pass with the user in the browser (T5 + T6 + T7 + T8: contrast, hotspot overlap,
expansion framing, medallion placement and now the sunset grading), then T4: port
`src/factory/*` into Calzado Chapín as `/fabrica` with lazy `import()` on viewport, sliced as
chained PRs per zone.
