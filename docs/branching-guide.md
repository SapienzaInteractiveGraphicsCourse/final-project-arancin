# Branching Guide

This project uses feature branches with `develop` as the integration branch.

## Permanent Branches

### `main`

Stable branch for delivery.

- Keep it buildable and presentable.
- Merge into it only when a complete project milestone is ready.
- Use it later for GitHub Pages / final exam delivery.

### `develop`

Integration branch for the team.

- Merge completed feature branches here first.
- Keep it reasonably stable: `bun run build` should pass after each merge.
- New feature branches should usually start from `develop`.

## Feature Branches

Create branches by feature, not by person.

Good names:

- `feature/project-skeleton`
- `feature/procedural-kart`
- `feature/vehicle-loaders`
- `feature/tracks`
- `feature/race-systems`
- `feature/hud-minimap`
- `docs/project-report`

Avoid names like:

- `mario`
- `luca-work`
- `test`
- `final`

The branch name should explain what the branch changes.

## Basic Workflow

Start a new feature from `develop`:

```bash
git switch develop
git pull
git switch -c feature/name-of-feature
```

Work in small steps and commit meaningful changes:

```bash
git status
git add path/to/files
git commit -m "add basic scene skeleton"
```

Before opening a pull request:

```bash
bun run build
git status
```

Push the branch:

```bash
git push -u origin feature/name-of-feature
```

Then open a pull request into `develop`.

Do not merge feature branches directly into `develop` from the local command line. Use a pull request so the team can review the diff, check the build result, and keep the project history understandable.

## Merge Rules

- Feature branches merge into `develop` through pull requests.
- `develop` merges into `main` only at stable milestones.
- Do not merge unfinished experiments into `main`.
- Keep each branch focused on one feature area.
- If a branch becomes too large, split later work into a new branch.

## Current Branch Purpose

| Branch | Purpose |
| --- | --- |
| `main` | Stable starting point / future delivery branch |
| `develop` | Team integration branch |
| `feature/vehicle-assets` | Imported Porsche and Silvia assets plus asset documentation |
| `feature/project-skeleton` | Placeholder branch for the initial Three.js project structure |
