import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";
import { VEHICLE_COLOR_OPTIONS } from "../config/raceOptions.js";
import { applyTrackLightingTheme, applyTrackSceneTheme } from "../tracks/applyTrackSceneTheme.js";
import { createTrackById } from "../tracks/trackFactory.js";
import { createVehicleById } from "../vehicles/vehicleFactory.js";
import { ArcadeVehicleController } from "../systems/ArcadeVehicleController.js";
import { getOrderedCheckpoints } from "../systems/checkpointUtils.js";
import { InputManager } from "../systems/InputManager.js";
import { RaceManager, RACE_PHASES } from "../systems/RaceManager.js";
import { WrongWayDetector } from "../systems/WrongWayDetector.js";
import {
  appendLapRecord,
  ensureBestLapInRecords,
  getRaceLapRecordsKey,
  getRaceRecordKey,
  readBestLapTime,
  readLapRecords,
  writeBestLapTime
} from "../systems/raceRecords.js";

export function startScenePreview(container, setup, options = {}) {
  const renderer = createRenderer(container);
  const scene = createScene();
  const camera = createMainCamera();
  const cameraTarget = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const timer = new THREE.Timer();
  const lights = createSceneLights(scene);
  const track = createTrackById(setup.trackId);
  const vehicle = createVehicleById(setup.vehicleId);
  let selectedBodyColor = setup.bodyColor ?? VEHICLE_COLOR_OPTIONS[0].value;
  vehicle.setBodyColor(selectedBodyColor);
  const inputManager = new InputManager(window);
  const controller = new ArcadeVehicleController(vehicle.performance, track.spawn);
  const wrongWayDetector = new WrongWayDetector();
  const recordKey = getRaceRecordKey(setup);
  const lapRecordsKey = getRaceLapRecordsKey(recordKey);
  const savedBestLapTime = readBestLapTime(window.localStorage, recordKey);
  let savedLapRecords = ensureBestLapInRecords(window.localStorage, lapRecordsKey, savedBestLapTime);
  const raceManager = new RaceManager({
    mode: setup.raceMode,
    bestLapTime: savedBestLapTime,
    onLapComplete: (lapRecord) => {
      savedLapRecords = appendLapRecord(window.localStorage, lapRecordsKey, lapRecord);
    },
    onBestLap: (bestLapTime) => {
      writeBestLapTime(window.localStorage, recordKey, bestLapTime);
    }
  });
  const raceOverlay = createRaceOverlay();
  const raceHud = createRaceHud();
  const wrongWayOverlay = createWrongWayOverlay();
  const colorPicker = createPreRaceColorPicker({
    selectedColor: selectedBodyColor,
    onSelect: (color) => {
      selectedBodyColor = color;
      setup.bodyColor = color;
      vehicle.setBodyColor(color);
    },
    onConfirm: () => {
      colorPicker.hide();
      raceManager.startCountdown();
    }
  });
  const checkpointHighlighter = createCheckpointHighlighter(track.trackInfo);
  const finishScreen = createFinishScreen({
    onRestart: resetRace,
    onExitToSetup: options.onExitToSetup
  });
  const pauseMenu = createPauseMenu({
    onResume: resumeGame,
    onExitToSetup: options.onExitToSetup
  });
  let animationFrameId = 0;
  let paused = false;
  let renderedFinishSignature = "";

  applyTrackSceneTheme(scene, track.trackInfo);
  applyTrackLightingTheme(lights, track.trackInfo);
  timer.connect(document);
  scene.add(track.group, vehicle.group);
  container.appendChild(raceOverlay);
  container.appendChild(raceHud);
  container.appendChild(wrongWayOverlay);
  container.appendChild(colorPicker.element);
  container.appendChild(finishScreen.element);
  container.appendChild(pauseMenu.element);
  vehicle.setTransform(controller.position, controller.heading);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function setPaused(nextPaused) {
    paused = nextPaused;
    pauseMenu.setPaused(paused);
  }

  function resumeGame() {
    setPaused(false);
  }

  function resetRace() {
    controller.reset(track.spawn);
    raceManager.reset();
    wrongWayDetector.reset();
    raceManager.startCountdown();
    renderedFinishSignature = "";
    finishScreen.setVisible(false);
  }

  function update(deltaTime) {
    const actions = inputManager.consumeActions();

    if (actions.pause) {
      setPaused(!paused);
    }

    if (paused) {
      return;
    }

    if (actions.restart) {
      resetRace();
    }

    if (actions.lights) {
      vehicle.toggleHeadlights();
    }

    const currentVehicleState = controller.getState();
    const raceState = raceManager.update(deltaTime, currentVehicleState, track.trackInfo);
    const canDrive = raceState.phase === RACE_PHASES.RUNNING;
    const state = raceState.finished
      ? controller.getState()
      : controller.update(deltaTime, canDrive ? inputManager.getHeldState() : {}, {
        surfaceType: "asphalt",
        surfaceGrip: 1,
        speedLimitMultiplier: 1,
        boostFactor: 1,
        collided: false
      });

    vehicle.setTransform(state.position, state.heading);
    vehicle.update(deltaTime, state);
    updateCameraFollow(state);
    updateWrongWayOverlay(wrongWayOverlay, wrongWayDetector.update(deltaTime, state, track.trackInfo));
    checkpointHighlighter.update(raceState);
    updateRaceOverlay(raceOverlay, raceState);
    updateRaceHud(raceHud, raceState);
    renderedFinishSignature = updateFinishScreen(
      finishScreen,
      raceState,
      savedLapRecords,
      renderedFinishSignature
    );
  }

  function updateCameraFollow(state) {
    const targetY = track.spawn.position.y;
    const cameraDistance = 9.5;
    const cameraHeight = 6.2;
    cameraTarget.set(
      state.position.x + Math.sin(state.heading + Math.PI) * cameraDistance,
      targetY + cameraHeight,
      state.position.z + Math.cos(state.heading + Math.PI) * cameraDistance
    );

    camera.position.lerp(cameraTarget, 0.08);
    lookTarget.set(state.position.x, targetY + 0.75, state.position.z);
    cameraLookAt.lerp(lookTarget, 0.16);
    camera.lookAt(cameraLookAt);
  }

  function animate(timestamp) {
    timer.update(timestamp);
    const deltaTime = Math.min(timer.getDelta(), 0.05);

    update(deltaTime);
    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();

  return {
    dispose() {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      timer.dispose();
      inputManager.dispose();
      controller.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      raceOverlay.remove();
      raceHud.remove();
      wrongWayOverlay.remove();
      colorPicker.element.remove();
      finishScreen.element.remove();
      pauseMenu.element.remove();
      checkpointHighlighter.dispose();
      track.dispose();
      vehicle.dispose();
      scene.remove(track.group, vehicle.group, lights.ambient, lights.sun);
    }
  };
}

function createPreRaceColorPicker({ selectedColor, onSelect, onConfirm }) {
  const element = document.createElement("section");
  element.className = "pre-race-color-picker";
  element.setAttribute("aria-label", "Choose vehicle color");

  const colorButtons = VEHICLE_COLOR_OPTIONS.map((option) => {
    const button = document.createElement("button");
    button.className = "pre-race-color-option";
    button.type = "button";
    button.dataset.color = option.value;
    button.style.setProperty("--vehicle-color", option.value);
    button.setAttribute("aria-label", option.name);
    button.setAttribute("aria-pressed", String(option.value === selectedColor));
    button.innerHTML = `
      <span class="pre-race-color-swatch" aria-hidden="true"></span>
      <strong>${option.name}</strong>
    `;

    button.addEventListener("click", () => {
      selectedColor = option.value;
      colorButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.color === selectedColor));
      });
      onSelect?.(selectedColor);
    });

    return button;
  });

  const options = document.createElement("div");
  options.className = "pre-race-color-options";
  colorButtons.forEach((button) => options.appendChild(button));

  const confirmButton = document.createElement("button");
  confirmButton.className = "pre-race-start-button";
  confirmButton.type = "button";
  confirmButton.textContent = "Start Race";
  confirmButton.addEventListener("click", () => {
    onConfirm?.(selectedColor);
  });

  element.innerHTML = `
    <div class="pre-race-color-copy">
      <span>Vehicle Color</span>
      <strong>Choose your livery</strong>
    </div>
  `;
  element.appendChild(options);
  element.appendChild(confirmButton);

  return {
    element,
    hide: () => {
      element.hidden = true;
    }
  };
}

function createCheckpointHighlighter(trackInfo) {
  const checkpoints = getOrderedCheckpoints(trackInfo);
  const inactiveMaterial = createCheckpointHighlightMaterial(0x34f4ff, 0.22, 0.28);
  const activeMaterial = createCheckpointHighlightMaterial(0xfacc15, 1.8, 0.88);
  let activeCheckpointOrder = null;

  checkpoints.forEach((checkpoint) => {
    setCheckpointGateMaterial(checkpoint, inactiveMaterial);
  });

  return {
    update(raceState) {
      if (raceState.finished || raceState.phase !== RACE_PHASES.RUNNING) {
        setActiveCheckpoint(null);
        return;
      }

      setActiveCheckpoint(raceState.currentCheckpoint);
    },
    dispose() {
      inactiveMaterial.dispose();
      activeMaterial.dispose();
    }
  };

  function setActiveCheckpoint(checkpointOrder) {
    if (activeCheckpointOrder === checkpointOrder) {
      return;
    }

    activeCheckpointOrder = checkpointOrder;

    checkpoints.forEach((checkpoint) => {
      setCheckpointGateMaterial(
        checkpoint,
        checkpoint.order === checkpointOrder ? activeMaterial : inactiveMaterial
      );
    });
  }
}

function createCheckpointHighlightMaterial(color, emissiveIntensity, opacity) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.42,
    transparent: true,
    opacity
  });
}

function setCheckpointGateMaterial(checkpoint, material) {
  checkpoint.gate?.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
    }
  });
}

function createWrongWayOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "wrong-way-overlay";
  overlay.hidden = true;
  overlay.textContent = "WRONG WAY";
  overlay.setAttribute("aria-live", "polite");
  return overlay;
}

function updateWrongWayOverlay(overlay, wrongWayState) {
  overlay.hidden = !wrongWayState.warning;
}

function createFinishScreen({ onRestart, onExitToSetup }) {
  const element = document.createElement("section");
  element.className = "finish-screen";
  element.hidden = true;
  element.setAttribute("aria-label", "Race results");

  element.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "restart") {
      onRestart?.();
      return;
    }

    onExitToSetup?.();
  });

  return {
    element,
    setVisible(visible) {
      element.hidden = !visible;
    }
  };
}

function updateFinishScreen(finishScreen, raceState, savedLapRecords, previousSignature) {
  if (!raceState.finished) {
    finishScreen.setVisible(false);
    return "";
  }

  const signature = [
    raceState.mode,
    raceState.totalTime,
    raceState.lapTimes.length,
    raceState.bestLapTime,
    savedLapRecords.length
  ].join(":");

  if (signature === previousSignature) {
    return previousSignature;
  }

  finishScreen.element.innerHTML = `
    <div class="finish-panel">
      <p class="finish-eyebrow">${formatMode(raceState.mode)}</p>
      <h2>${raceState.mode === "time-trial" ? "Time Trial Complete" : "Race Complete"}</h2>
      <div class="finish-summary">
        <div>
          <span>Total</span>
          <strong>${formatRaceTime(raceState.totalTime)}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>${formatRaceTime(raceState.bestLapTime)}</strong>
        </div>
        <div>
          <span>Position</span>
          <strong>${raceState.position}/${raceState.participantCount}</strong>
        </div>
      </div>
      <table class="finish-table">
        <caption>This Run</caption>
        <thead>
          <tr>
            <th>Lap</th>
            <th>Time</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          ${formatLapRows(raceState.lapTimes, raceState.bestLapTime)}
        </tbody>
      </table>
      <table class="finish-table">
        <caption>Saved Laps</caption>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Time</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          ${formatSavedLapRows(savedLapRecords, raceState.bestLapTime)}
        </tbody>
      </table>
      <div class="finish-actions">
        <button class="finish-button" type="button" data-action="restart">Restart</button>
        <button class="finish-button finish-button-secondary" type="button" data-action="setup">Main Menu</button>
      </div>
    </div>
  `;
  finishScreen.setVisible(true);
  return signature;
}

function formatSavedLapRows(savedLapRecords, bestLapTime) {
  if (!savedLapRecords.length) {
    return `
      <tr>
        <td colspan="3">No saved laps</td>
      </tr>
    `;
  }

  return savedLapRecords
    .map((record, index) => {
      const gap = Number.isFinite(bestLapTime) ? Math.max(0, record.time - bestLapTime) : 0;
      const bestClass = isSameTime(record.time, bestLapTime) ? " class=\"finish-best-lap\"" : "";

      return `
        <tr${bestClass}>
          <td>${index + 1}</td>
          <td>${formatRaceTime(record.time)}</td>
          <td>${formatGapTime(gap)}</td>
        </tr>
      `;
    })
    .join("");
}

function formatLapRows(lapTimes, bestLapTime) {
  if (!lapTimes.length) {
    return `
      <tr>
        <td colspan="3">No laps completed</td>
      </tr>
    `;
  }

  return lapTimes
    .map((lap) => {
      const gap = Number.isFinite(bestLapTime) ? Math.max(0, lap.time - bestLapTime) : 0;
      const bestClass = isSameTime(lap.time, bestLapTime) ? " class=\"finish-best-lap\"" : "";

      return `
        <tr${bestClass}>
          <td>${lap.lap}</td>
          <td>${formatRaceTime(lap.time)}</td>
          <td>${formatGapTime(gap)}</td>
        </tr>
      `;
    })
    .join("");
}

function createRaceHud() {
  const hud = document.createElement("aside");
  hud.className = "race-hud";
  hud.setAttribute("aria-label", "Race status");
  return hud;
}

function updateRaceHud(hud, raceState) {
  const finalPanel = raceState.mode === "race"
    ? { label: "Position", value: `${raceState.position}/${raceState.participantCount}` }
    : { label: "Best", value: formatRaceTime(raceState.bestLapTime) };

  hud.innerHTML = `
    <div>
      <span>Mode</span>
      <strong>${formatMode(raceState.mode)}</strong>
    </div>
    <div>
      <span>Lap</span>
      <strong>${raceState.currentLap}/${raceState.totalLaps}</strong>
    </div>
    <div>
      <span>Total</span>
      <strong>${formatRaceTime(raceState.totalTime)}</strong>
    </div>
    <div>
      <span>Lap Time</span>
      <strong>${formatRaceTime(raceState.lapTime)}</strong>
    </div>
    <div>
      <span>${finalPanel.label}</span>
      <strong>${finalPanel.value}</strong>
    </div>
  `;
}

function createPauseMenu({ onResume, onExitToSetup }) {
  const element = document.createElement("section");
  element.className = "pause-menu";
  element.hidden = true;
  element.setAttribute("aria-label", "Pause menu");
  element.innerHTML = `
    <div class="pause-panel">
      <p class="pause-eyebrow">Paused</p>
      <h2>Race Paused</h2>
      <div class="pause-actions">
        <button class="pause-button" type="button" data-action="resume">Resume</button>
        <button class="pause-button pause-button-secondary" type="button" data-action="setup">Main Menu</button>
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

  return {
    element,
    setPaused(paused) {
      element.hidden = !paused;
    }
  };
}

function createRaceOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "race-overlay";
  overlay.setAttribute("aria-live", "polite");
  return overlay;
}

function updateRaceOverlay(overlay, raceState) {
  if (raceState.phase === RACE_PHASES.COUNTDOWN) {
    const countdownNumber = Math.max(1, Math.ceil(raceState.countdown));
    setRaceOverlayText(overlay, raceState, String(countdownNumber));
    return;
  }

  if (raceState.phase === RACE_PHASES.RUNNING && raceState.totalTime < 0.65) {
    setRaceOverlayText(overlay, raceState, "GO");
    return;
  }

  setRaceOverlayText(overlay, raceState, "");
}

function setRaceOverlayText(overlay, raceState, text) {
  overlay.textContent = text;
  overlay.hidden = text.length === 0;
  overlay.dataset.phase = raceState.phase;
}

function formatMode(mode) {
  return mode === "time-trial" ? "Time Trial" : "Race";
}

function formatRaceTime(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const centiseconds = Math.floor((value % 1) * 100);

  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function formatGapTime(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "+0.00";
  }

  return `+${value.toFixed(2)}`;
}

function isSameTime(first, second) {
  return Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) < 0.005;
}
