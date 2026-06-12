# Asset Register

This register tracks assets that are not authored procedurally by the team.

## Imported Vehicles

| Vehicle | Format | Local path | Current status |
| --- | --- | --- | --- |
| Porsche Cayman GT4 | GLB | `src/assets/models/vehicles/porsche-cayman-gt4/source/porsche_cayman_gt4+.glb` | Integrated with cached loader, cloned instances, scale/orientation fit, JS lights and wheel handling |
| Nissan Silvia S14 Kouki | FBX | `src/assets/models/vehicles/nissan-silvia-kouki/source/FINAL_MODEL_VERTEX.fbx` | Imported only, not wired into gameplay |

## Porsche Cayman GT4

- Title: `porsche cayman gt4`
- Author: MattDoesBlender
- Source: `https://sketchfab.com/3d-models/porsche-cayman-gt4-4f3ce0e365d64af38b23a26dfb7f8d57`
- License: CC-BY-NC-SA-4.0
- License URL: `http://creativecommons.org/licenses/by-nc-sa/4.0/`
- Source metadata location: embedded GLB `asset.extras`
- Integration notes: loaded through `src/vehicles/loaders/loadPorscheModel.js`, cloned per instance, and animated with JavaScript-authored wheel and light handling.

## Team-authored Assets

| Asset | Method | Current status |
| --- | --- | --- |
| Procedural Kart | Three.js primitives | Integrated as team-authored hierarchical model |
| Eiffel Tower | Three.js primitives | Stylized glowing neon landmark on Vegas Neon track |
| Ferris Wheel | Three.js primitives | Rotating neon Ferris wheel with upright cabins on Vegas Neon track |
| Main Menu Logo | Raster PNG edited from team-provided artwork | Integrated in setup menu as transparent-background UI logo |
| Main Menu Vehicle Thumbnails | Browser-rendered PNGs from project vehicle models | Integrated in progressive setup menu vehicle step |

## Audio Samples

| Asset | Local path | Current status |
| --- | --- | --- |
| Kart engine sample | `src/assets/audio/kart-engine.mp3` | Reference sample for tuning only; current runtime uses procedural Web Audio engine |
| Kart acceleration sample | `src/assets/audio/kart-accelerate.wav` | Reference sample for tuning only; current runtime uses procedural Web Audio engine |
| Kart deceleration sample | `src/assets/audio/kart-decelerate.wav` | Reference sample for tuning only; current runtime uses procedural Web Audio engine |
| Porsche engine sample | `src/assets/audio/porsche-engine.mp3` | Reference sample for tuning only; current runtime uses procedural Web Audio engine |
| Nissan Silvia engine sample | `src/assets/audio/silvia-engine.mp3` | Reference sample for tuning only; current runtime uses procedural Web Audio engine |

## Follow-up Checks

- Validate model scale, orientation, origin, wheel nodes, and light placement before gameplay integration.
- Do not import animation clips from external models.
- Use loader-level caching for imported models before cloning them for player and AI.
