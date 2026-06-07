import * as THREE from "three";

export function createFlatStandardMaterial({
  color,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.82,
  metalness = 0.02,
  transparent = false,
  opacity = 1
}) {
  const parameters = {
    color,
    roughness,
    metalness,
    transparent,
    opacity,
    flatShading: true
  };

  if (emissive !== undefined) {
    parameters.emissive = emissive;
    parameters.emissiveIntensity = emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(parameters);
}

export function createTrackMaterials(definition) {
  const palette = definition.palette;

  return {
    ground: createFlatStandardMaterial({
      color: palette.ground,
      roughness: 0.92
    }),
    road: createFlatStandardMaterial({
      color: palette.road,
      roughness: 0.8,
      metalness: definition.id === "vegas" ? 0.08 : 0.02
    }),
    roadEdge: createFlatStandardMaterial({
      color: palette.roadEdge,
      emissive: palette.roadEdge,
      emissiveIntensity: definition.id === "vegas" ? 2.8 : 0.12,
      roughness: definition.id === "vegas" ? 0.32 : 0.58
    }),
    centerLine: createFlatStandardMaterial({
      color: palette.centerLine ?? 0xf3f0dc,
      emissive: definition.id === "vegas" ? palette.centerLine : undefined,
      emissiveIntensity: definition.id === "vegas" ? 0.85 : 0,
      roughness: 0.55
    }),
    barrier: createFlatStandardMaterial({
      color: palette.barrier,
      roughness: 0.74,
      metalness: definition.id === "vegas" ? 0.12 : 0.04
    }),
    checkpoint: createFlatStandardMaterial({
      color: palette.checkpoint,
      emissive: palette.checkpoint,
      emissiveIntensity: definition.id === "vegas" ? 0.9 : 0.35,
      roughness: 0.48,
      transparent: true,
      opacity: 0.72
    }),
    boost: createFlatStandardMaterial({
      color: palette.boost,
      emissive: palette.boost,
      emissiveIntensity: 0.95,
      roughness: 0.44
    }),
    startWhite: createFlatStandardMaterial({
      color: 0xf4f2e8,
      roughness: 0.68
    }),
    startDark: createFlatStandardMaterial({
      color: 0x171b20,
      roughness: 0.72
    }),
    startGantry: createFlatStandardMaterial({
      color: definition.id === "vegas" ? 0x181b24 : 0x2b3036,
      roughness: 0.48,
      metalness: definition.id === "vegas" ? 0.36 : 0.12
    }),
    startSign: createFlatStandardMaterial({
      color: definition.id === "vegas" ? 0x48ff78 : 0xffd23a,
      emissive: definition.id === "vegas" ? 0x48ff78 : 0xffd23a,
      emissiveIntensity: definition.id === "vegas" ? 3.1 : 0.85,
      roughness: 0.18,
      metalness: 0.04
    })
  };
}
