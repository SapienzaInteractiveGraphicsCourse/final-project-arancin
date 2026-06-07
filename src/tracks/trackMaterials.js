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
      emissiveIntensity: definition.id === "vegas" ? 1.4 : 0.12,
      roughness: 0.58
    })
  };
}
