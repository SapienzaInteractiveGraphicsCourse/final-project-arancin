export function createWrongWayOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "wrong-way-overlay";
  overlay.hidden = true;
  overlay.textContent = "WRONG WAY";
  overlay.setAttribute("aria-live", "polite");
  return overlay;
}

export function updateWrongWayOverlay(overlay, wrongWayState) {
  overlay.hidden = !wrongWayState.warning;
}
