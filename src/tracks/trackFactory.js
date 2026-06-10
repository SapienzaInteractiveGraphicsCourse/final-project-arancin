import { createSplineTrack } from "./splineTrackGenerator.js";
import { getTrackDefinition, TRACK_IDS } from "./trackData.js";
import { buildBeachProps } from "./trackProps.js";

export function createTrackById(trackId) {
  const definition = getTrackDefinition(trackId);
  const propsBuilder = definition.id === TRACK_IDS.BEACH ? buildBeachProps : undefined;
  return createSplineTrack(definition, propsBuilder);
}
