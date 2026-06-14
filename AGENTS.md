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

Follow the project direction in `README.md`, `docs/`, and the external greenfield guide in the local `kartprivata` reference repository:

- `kartprivata/GUIDA.md`

The old non-official simulator is a reference only:

- `kartprivata/kart-simulator-NONUFFICIALE/`

Do not copy it mechanically. Rebuild the official project with cleaner structure and narrower scope.

The exact local path of `kartprivata` can differ between machines. If it is not next to this repository, locate it before using it as reference.

Never commit in `kartprivata`. Never copy whole files from `kartprivata`; inspect it to understand behavior and then reimplement the needed idea in this official repository.

Use `README.md` for the shared task list and current project status.

## Before Coding

Before making changes:

1. Run `git status --short`.
2. Fetch or pull remote updates.
3. Start from `develop` unless the user explicitly says otherwise.
4. Read `README.md` for the active task list.
5. Read `docs/branching-guide.md` for branch workflow.
6. Read relevant docs in `docs/`, especially `docs/project-skeleton.md` for setup/scene work.
7. Read `docs/contracts.md` before touching shared APIs, factories, vehicles, tracks, scene setup, HUD, or race systems.
8. Read `kartprivata/GUIDA.md` for project requirements and implementation constraints.
9. Inspect `kartprivata/kart-simulator-NONUFFICIALE/` only as a technical reference.
10. Create or switch to the requested feature branch.

## Branch Workflow

Read `docs/branching-guide.md` before creating or merging branches.

Expected flow:

- `main`: stable delivery branch
- `develop`: team integration branch
- `feature/*`: focused feature branches created from `develop` branch
- `docs/*`: documentation branches

Start new implementation branches from `develop` unless the user says otherwise.

Before working, fetch remote updates and check whether `develop` or your feature branch changed.

Do not merge unfinished work into `main`.

Do not merge feature branches directly into `develop`. Push the branch and open a pull request targeting `develop`.

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
- Respect shared contracts and factory entry points when they exist. Do not invent incompatible APIs without updating docs and coordinating the change.
- Do not import animation clips from external models.
- Imported models must be documented in `docs/asset-register.md`.
- Use loader-level caching for heavy imported models before cloning them for player and AI.
- Keep track data separate from track generation logic.
- Keep vehicle performance data separate from the physical controller.
- The game loop should orchestrate systems; it should not become a monolithic physics/rendering/UI file.
- Prefer procedural or team-authored assets when they help satisfy the exam requirements.
- Update docs when a change affects architecture, workflow, public APIs, assets, controls, or project scope.

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
- Do not merge directly; push the branch and make a PR to `develop`.

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
