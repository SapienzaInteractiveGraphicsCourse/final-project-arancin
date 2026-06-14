import { TRACK_IDS } from "../trackData.js";
import { buildVegasProps } from "./vegasProps.js";
import { buildBeachProps } from "./beachProps.js";
import { buildMonacoProps } from "./monacoProps.js";

export { buildVegasProps, buildBeachProps, buildMonacoProps };

export function addTrackProps(group, curve, definition) {
  if (definition.id === TRACK_IDS.VEGAS) {
    buildVegasProps(group, curve, definition);
  } else if (definition.id === TRACK_IDS.BEACH) {
    buildBeachProps(group, curve, definition);
  } else if (definition.id === TRACK_IDS.MONACO) {
    buildMonacoProps(group, curve, definition);
  }
}
