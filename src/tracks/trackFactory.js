import { createSplineTrack } from "./splineTrackGenerator.js";
import { getTrackDefinition } from "./trackData.js";

export function createTrackById(trackId) {
  return createSplineTrack(getTrackDefinition(trackId));
}
