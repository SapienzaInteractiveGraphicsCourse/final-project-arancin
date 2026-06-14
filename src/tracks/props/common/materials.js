import { createFlatStandardMaterial } from "../../trackMaterials.js";

export function createPropMaterial({
  color,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.82,
  metalness = 0.02,
  transparent = false,
  opacity = 1,
  side,
  fog = true
}) {
  return createFlatStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness,
    transparent,
    opacity,
    side,
    fog
  });
}
