import "./styles/main.css";
import { getRaceSetupLabels } from "./config/raceOptions.js";
import { createSetupMenu } from "./ui/setupMenu.js";

const app = document.querySelector("#app");
const placeholder = document.createElement("div");
placeholder.className = "scene-placeholder";
app.appendChild(placeholder);

const overlay = document.createElement("aside");
overlay.className = "status-overlay";
overlay.textContent = "Setup menu";
app.appendChild(overlay);

let sceneApp = null;

function setOverlayText(setup) {
  const labels = getRaceSetupLabels(setup);
  overlay.textContent = `Track: ${labels.track} | Vehicle: ${labels.vehicle} | Mode: ${labels.mode}`;
}

const setupMenu = createSetupMenu({
  onStart: async (setup) => {
    setOverlayText(setup);
    overlay.dataset.loading = "true";
    overlay.textContent += " | Loading scene";

    const { startScenePreview } = await import("./scene/startScenePreview.js");
    sceneApp = startScenePreview(app, setup);
    placeholder.hidden = true;
    setOverlayText(setup);
    overlay.dataset.loading = "false";
  }
});
app.appendChild(setupMenu.element);

window.addEventListener("beforeunload", () => {
  sceneApp?.dispose();
});
