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

## Next step

Visual tuning pass with the user in the browser (T5 + T6: contrast, hotspot overlap, expansion
framing), then T4: port `src/factory/*` into Calzado Chapín as `/fabrica` with lazy `import()` on
viewport, sliced as chained PRs per zone.
