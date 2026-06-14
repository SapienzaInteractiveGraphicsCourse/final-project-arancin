export function normalizeTrackTheme(trackId) {
  if (trackId === "vegas" || trackId === "beach" || trackId === "monaco") {
    return trackId;
  }

  return "default";
}
