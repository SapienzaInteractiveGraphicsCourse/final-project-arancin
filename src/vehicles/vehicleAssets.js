export const VEHICLE_ASSETS = {
  porsche: {
    id: "porsche",
    displayName: "Porsche Cayman GT4",
    type: "imported",
    format: "glb",
    modelPath: "src/assets/models/vehicles/porsche-cayman-gt4/source/porsche_cayman_gt4+.glb",
    textureDirectory: "src/assets/models/vehicles/porsche-cayman-gt4/textures",
    notes: [
      "Imported reference asset, not animated.",
      "Future loader should cache the parsed template and clone it for player/bot.",
      "Headlights and wheel pivots must be checked before gameplay integration."
    ]
  },
  silvia: {
    id: "silvia",
    displayName: "Nissan Silvia S14 Kouki",
    type: "imported",
    format: "fbx",
    modelPath: "src/assets/models/vehicles/nissan-silvia-kouki/source/FINAL_MODEL_VERTEX.fbx",
    textureDirectory: "src/assets/models/vehicles/nissan-silvia-kouki/textures",
    notes: [
      "Imported reference asset, not animated.",
      "Future loader should cache the parsed template and clone it for player/bot.",
      "Light placement and wheel extraction must be validated during vehicle implementation."
    ]
  },
  kart: {
    id: "kart",
    displayName: "Procedural Kart",
    type: "procedural",
    format: null,
    modelPath: null,
    textureDirectory: null,
    notes: [
      "To be implemented from scratch with Three.js primitives.",
      "This should be the main team-made hierarchical vehicle model."
    ]
  }
};

export const VEHICLE_ASSET_LIST = Object.values(VEHICLE_ASSETS);
