import "./styles/main.css";
import { AppState } from "./systems/AppState.js";
import { createSetupMenu } from "./ui/setupMenu.js";

const app = document.querySelector("#app");
const appState = new AppState();
const placeholder = document.createElement("div");
placeholder.className = "scene-placeholder";
app.appendChild(placeholder);

let sceneApp = null;

const setupMenu = createSetupMenu({
  onStart: async (setup) => {
    appState.startLoading(setup);

    const { startScenePreview } = await import("./scene/startScenePreview.js");
    sceneApp = startScenePreview(app, setup, {
      onExitToSetup: returnToSetup
    });
    placeholder.hidden = true;
    appState.startPreview();
  }
});
app.appendChild(setupMenu.element);

function returnToSetup() {
  sceneApp?.dispose();
  sceneApp = null;
  placeholder.hidden = false;
  setupMenu.show();
  appState.startSetup();
}

window.addEventListener("beforeunload", () => {
  sceneApp?.dispose();
  setupMenu.dispose();
});
