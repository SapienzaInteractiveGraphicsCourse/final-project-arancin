# Asset Register

This register tracks assets that are not authored procedurally by the team.

## Imported Vehicles

| Vehicle | Format | Local path | Current status |
| --- | --- | --- | --- |
| Porsche Cayman GT4 | GLB | `src/assets/models/vehicles/porsche-cayman-gt4/source/porsche_cayman_gt4+.glb` | Imported only, not wired into gameplay |
| Nissan Silvia S14 Kouki | FBX | `src/assets/models/vehicles/nissan-silvia-kouki/source/FINAL_MODEL_VERTEX.fbx` | Imported only, not wired into gameplay |

## Team-authored Assets

| Asset | Method | Current status |
| --- | --- | --- |
| Procedural Kart | Three.js primitives | Planned |

## Follow-up Checks

- Validate model scale, orientation, origin, wheel nodes, and light placement before gameplay integration.
- Do not import animation clips from external models.
- Use loader-level caching for imported models before cloning them for player and AI.
