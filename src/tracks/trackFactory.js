import { createSplineTrack } from "./splineTrackGenerator.js";
import { getTrackDefinition, TRACK_IDS } from "./trackData.js";
import { buildBeachProps, buildMonacoProps } from "./trackProps.js";

export function createTrackById(trackId) {
  const definition = getTrackDefinition(trackId);
  const propsBuilder =
    definition.id === TRACK_IDS.BEACH ? buildBeachProps :
    (definition.id === TRACK_IDS.MONACO ? buildMonacoProps : undefined);
  return createSplineTrack(definition, propsBuilder);
}
