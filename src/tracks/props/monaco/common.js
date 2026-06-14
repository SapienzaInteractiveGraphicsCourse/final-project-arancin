import { addInstancedPart } from "../common/instancing.js";
import { collectTrackSamples } from "../common/placement.js";
import {
  createTrackRibbonMesh,
  createVerticalTrackRibbonMesh
} from "../common/ribbons.js";

export function createMonacoRibbonMesh(curve, definition, options) {
  return createTrackRibbonMesh(curve, definition, options);
}

export function createMonacoVerticalRibbonMesh(curve, definition, options) {
  return createVerticalTrackRibbonMesh(curve, definition, options);
}

export function collectMonacoSamples(curve, start, end, spacingMeters) {
  return collectTrackSamples(curve, start, end, spacingMeters);
}

export function addMonacoInstancedPart(group, geometry, material, matrices, name) {
  addInstancedPart(group, geometry, material, matrices, name);
}
