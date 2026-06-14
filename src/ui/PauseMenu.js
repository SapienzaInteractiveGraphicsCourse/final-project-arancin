import { normalizeTrackTheme } from "./trackTheme.js";

export function createPauseMenu({ onResume, onExitToSetup, audioManager, trackId, onAudioSettingsChange }) {
  const element = document.createElement("section");
  element.className = "pause-menu";
  element.dataset.trackTheme = normalizeTrackTheme(trackId);
  element.hidden = true;
  element.setAttribute("aria-label", "Pause menu");
  const audioSettings = audioManager.getSettings();
  element.innerHTML = `
    <div class="pause-panel">
      <p class="pause-eyebrow">Paused</p>
      <h2>Race Paused</h2>
      <div class="pause-actions">
        <button class="pause-button" type="button" data-action="resume">Resume</button>
        <button class="pause-button pause-button-secondary" type="button" data-action="setup">Main Menu</button>
      </div>
      <div class="pause-audio-panel" aria-label="Audio settings">
        <label class="pause-audio-toggle">
          <input type="checkbox" data-audio-muted ${audioSettings.muted ? "" : "checked"}>
          <span>Audio</span>
        </label>
        <label class="pause-audio-control">
          <span>Game</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.gameVolume * 100)}" data-audio-volume="game">
        </label>
        <label class="pause-audio-control">
          <span>Ambience</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.ambienceVolume * 100)}" data-audio-volume="ambience">
        </label>
      </div>
    </div>
  `;

  element.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "resume") {
      onResume?.();
      return;
    }

    onExitToSetup?.();
  });

  element.addEventListener("input", (event) => {
    const target = event.target;

    if (target.matches("[data-audio-muted]")) {
      audioManager.setMuted(!target.checked);
      onAudioSettingsChange?.(audioManager.getSettings());
      return;
    }

    if (target.matches("[data-audio-volume]")) {
      const value = Number(target.value) / 100;
      if (target.dataset.audioVolume === "game") {
        audioManager.setGameVolume(value);
      } else {
        audioManager.setAmbienceVolume(value);
      }
      onAudioSettingsChange?.(audioManager.getSettings());
    }
  });

  return {
    element,
    setPaused(paused) {
      element.hidden = !paused;
    }
  };
}
