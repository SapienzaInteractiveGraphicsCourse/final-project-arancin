import { RACE_PHASES } from "../systems/RaceManager.js";

export function createRaceOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "race-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-live", "polite");
  return overlay;
}

export function updateRaceOverlay(overlay, raceState) {
  if (raceState.phase === RACE_PHASES.COUNTDOWN) {
    if (raceState.countdown > 3) {
      setRaceOverlayText(overlay, raceState, "Ready?", "ready");
      return;
    }

    const countdownNumber = Math.max(1, Math.ceil(raceState.countdown));
    setRaceOverlayText(overlay, raceState, String(countdownNumber), "countdown");
    return;
  }

  if (raceState.phase === RACE_PHASES.RUNNING && raceState.totalTime < 0.65) {
    setRaceOverlayText(overlay, raceState, "GO!", "go");
    return;
  }

  setRaceOverlayText(overlay, raceState, "", "");
}

function setRaceOverlayText(overlay, raceState, text, state) {
  overlay.textContent = text;
  overlay.hidden = text.length === 0;
  overlay.dataset.phase = raceState.phase;
  overlay.dataset.state = state;
}
