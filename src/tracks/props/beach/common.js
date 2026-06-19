import { createPropMaterial } from "../common/materials.js";
import { getRoadsidePlacement } from "../common/placement.js";

export function createBeachMaterial(parameters) {
  return createPropMaterial({
    roughness: 0.85,
    metalness: 0.02,
    ...parameters
  });
}

export function safePlace(curve, progress, side, offset, roadHalfWidth, minClearance = 12) {
  return getRoadsidePlacement(curve, progress, side, offset, roadHalfWidth, {
    minClearance,
    clampSamples: 220,
    targetClearance: minClearance
  });
}
