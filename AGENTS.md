# AGENTS.md

Guidance for this repository.

## Project Goal

Build a browser-based 3D racing simulator for the Interactive Graphics final project.

Use:

- Vite
- Three.js
- JavaScript ES modules
- `@tweenjs/tween.js` for smooth transitions where useful
- `playwright-core` for future browser verification scripts

Follow the project direction in `docs/` and the external greenfield guide at:

`/KARTNONUFFICIALE/GUIDA.md`

The old non-official simulator is a reference only:

`/KARTNONUFFICIALE/kart-simulator-NONUFFICIALE/`

Do not copy it mechanically. Rebuild the official project with cleaner structure and narrower scope.

## Branch Workflow

Read `docs/branching-guide.md` before creating or merging branches.

Expected flow:

- `main`: stable delivery branch
- `develop`: team integration branch
- `feature/*`: focused feature branches created from `develop` branch
- `docs/*`: documentation branches

Start new implementation branches from `develop` unless the user says otherwise.

Do not merge unfinished work into `main`.

## Current Scope

Implement exactly these three playable vehicles:

- Porsche
- Nissan Silvia
- Procedural Kart

The Porsche and Silvia assets are imported under:

- `src/assets/models/vehicles/porsche-cayman-gt4/`
- `src/assets/models/vehicles/nissan-silvia-kouki/`

The kart should be built from scratch with Three.js primitives. It should be the main team-authored hierarchical model.

Implement three main tracks:

- Vegas Neon
- Tropical Beach
- Monaco Formula 1

Avoid adding extra tracks until these three are complete.

## Code Organization

Prefer this responsibility split:

- `src/main.js`: app entry point and loop orchestration only
- `src/config/`: constants and vehicle/track tuning
- `src/scene/`: renderer, scene, camera, lights, skybox
- `src/vehicles/`: vehicle classes, loaders, factory, shared vehicle interface
- `src/tracks/`: track data, spline generation, barriers, checkpoints
- `src/systems/`: input, physics, collisions, race state, AI, audio, particles, minimap
- `src/materials/`: procedural textures and shader/material helpers
- `src/styles/`: UI styles when the starter CSS is replaced
- `docs/`: project documentation and team workflow notes

Keep heavy model files in `src/assets/models/`.

## Implementation Rules

- Keep changes focused to the current branch purpose.
- Do not import animation clips from external models.
- Imported models must be documented in `docs/asset-register.md`.
- Use loader-level caching for heavy imported models before cloning them for player and AI.
- Keep track data separate from track generation logic.
- Keep vehicle performance data separate from the physical controller.
- The game loop should orchestrate systems; it should not become a monolithic physics/rendering/UI file.
- Prefer procedural or team-authored assets when they help satisfy the exam requirements.

## Required Checks

Before finishing a coding task, run:

```bash
bun run build
```

If a task introduces browser-only behavior, also add or run an appropriate browser verification when available.

Report clearly if a check could not be run.

## Git Safety

- Check `git status --short` before editing.
- Do not revert changes you did not make.
- Do not delete or overwrite another teammate's work without explicit instruction.
- Avoid broad refactors unless they are necessary for the current feature.
- Prefer small, meaningful commits.
- Do not merge, make a PR.

## Documentation Expectations

The final exam documentation must explain:

- environment and libraries used
- external assets, models, and textures
- technical implementation choices
- user interactions
- hierarchical models
- lights and texture types
- JavaScript-authored animations

Keep `docs/asset-register.md` updated as new external assets are added.
