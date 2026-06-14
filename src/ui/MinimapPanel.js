export function createMinimapPanel() {
  const panel = document.createElement("aside");
  panel.className = "race-minimap-panel";
  panel.setAttribute("aria-label", "Map");

  const canvas = document.createElement("canvas");
  canvas.className = "race-minimap";
  canvas.setAttribute("aria-label", "Rotating track minimap");

  panel.append(canvas);
  return panel;
}
