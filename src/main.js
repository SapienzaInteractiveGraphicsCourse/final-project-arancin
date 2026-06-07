import "./styles/main.css";
import { getRaceSetupLabels } from "./config/raceOptions.js";
import { APP_PHASES, AppState } from "./systems/AppState.js";
import { createSetupMenu } from "./ui/setupMenu.js";

const app = document.querySelector("#app");
const appState = new AppState();
const placeholder = document.createElement("div");
placeholder.className = "scene-placeholder";
app.appendChild(placeholder);

const overlay = document.createElement("aside");
overlay.className = "status-overlay";
overlay.textContent = "Setup menu";
app.appendChild(overlay);

let sceneApp = null;

function setOverlayText({ phase, setup }) {
  const labels = getRaceSetupLabels(setup);
  const suffix = phase === APP_PHASES.LOADING ? " | Loading scene" : "";

  overlay.dataset.phase = phase;
  overlay.textContent = `Track: ${labels.track} | Vehicle: ${labels.vehicle} | Mode: ${labels.mode}${suffix}`;
}

appState.addEventListener("change", (event) => {
  setOverlayText(event.detail);
});
setOverlayText(appState.getSnapshot());

const setupMenu = createSetupMenu({
  onStart: async (setup) => {
    appState.startLoading(setup);

    const { startScenePreview } = await import("./scene/startScenePreview.js");
    sceneApp = startScenePreview(app, setup);
    placeholder.hidden = true;
    appState.startPreview();
  }
});
app.appendChild(setupMenu.element);

window.addEventListener("beforeunload", () => {
  sceneApp?.dispose();
});
