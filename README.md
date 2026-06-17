# Kart Racing Simulator

![Kart Racing Simulator logo](src/assets/ui/kart-racing-logo.png)

Kart Racing Simulator is a browser-based 3D racing game built with Three.js. The project focuses on real-time interaction, arcade vehicle physics, procedural modeling, imported 3D assets, animated race systems, themed tracks, lights, collisions, HUD elements and JavaScript-authored animations.

## Play The Game

Play the latest deployed version here:

[https://sapienzainteractivegraphicscourse.github.io/final-project-arancin/](https://sapienzainteractivegraphicscourse.github.io/final-project-arancin/)

For the best experience, use a desktop browser with hardware acceleration enabled.

## Project Overview

The game lets the player choose a car, a track and a race mode before entering a 3D racing scene. The simulator includes three playable vehicles:

- Porsche Cayman GT4
- Nissan Silvia S14 Kouki
- Procedural Kart

The Porsche and Silvia are imported 3D models adapted for gameplay, while the kart is a team-authored hierarchical model built from Three.js primitives. The vehicles have different performance profiles, animated wheels, headlights and selectable body colors.

The game includes three main tracks:

- Vegas Neon
- Tropical Beach
- Monaco Formula 1

Each track has a distinct visual theme, layout, lighting setup and environmental props.

## Main Features

- 3D browser racing scene with Three.js and WebGL
- Arcade driving model with acceleration, braking, reverse, steering and handbrake
- Three selectable vehicles with different speed and handling profiles
- Procedural kart model with hierarchical components and JavaScript animations
- Imported Porsche and Nissan Silvia models with cached loading
- Three themed tracks with checkpoints, barriers and decorative environments
- Custom GLSL boost-pad shader with animated pulse uniforms
- Race mode and time trial mode
- AI opponent in race mode
- Collision handling with track barriers and opponent vehicle
- Lap counter, countdown, timing, checkpoint progress and finish screen
- Wrong-way detection
- Minimap and runtime HUD
- Toggleable headlights
- Procedural and imported audio effects
- Responsive setup menu with vehicle and track selection

## Controls

| Action | Keys |
| --- | --- |
| Accelerate | `W` or `ArrowUp` |
| Brake / Reverse | `S` or `ArrowDown` |
| Steer left | `A` or `ArrowLeft` |
| Steer right | `D` or `ArrowRight` |
| Handbrake | `Space` |
| Change camera | `C` |
| Toggle headlights | `L` |
| Restart race | `R` |
| Pause / menu | `Esc` |

## Debug Controls

The following keys are available during gameplay to inspect the scene and performance:

| Action | Key |
| --- | --- |
| Toggle minimap | `F1` |
| Toggle shadows | `F2` |
| Toggle decorative props | `F3` |
| Toggle renderer statistics panel | `F4` |

## Technologies Used

- JavaScript ES modules
- Three.js
- WebGL
- Vite
- `@tweenjs/tween.js`
- `playwright-core`
- HTML
- CSS

## Documentation

Project documentation is available in the `docs/` directory.

Useful references:

- [Asset register](docs/asset-register.md)
- [Project skeleton](docs/project-skeleton.md)
- [Shared contracts](docs/contracts.md)
- [Physics and input](docs/physics-input.md)
- [Race systems](docs/race-systems.md)
- [Camera system](docs/camera-system.md)
- [Audio system](docs/audio-system.md)

## Local Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Create a production build:

```bash
bun run build
```

## Authors

- Matteo Genovese
- Daniele D'Alba
- Gloria Palumbo Piccionello
