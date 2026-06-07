import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";
import { createTrackById } from "../tracks/trackFactory.js";
import { createVehicleById } from "../vehicles/vehicleFactory.js";
import { ArcadeVehicleController } from "../systems/ArcadeVehicleController.js";
import { InputManager } from "../systems/InputManager.js";
import { RaceManager, RACE_PHASES } from "../systems/RaceManager.js";
import { getRaceRecordKey, readBestLapTime, writeBestLapTime } from "../systems/raceRecords.js";

export function startScenePreview(container, setup, options = {}) {
  const renderer = createRenderer(container);
  const scene = createScene();
  const camera = createMainCamera();
  const timer = new THREE.Timer();
  const lights = createSceneLights(scene);
  const track = createTrackById(setup.trackId);
  const vehicle = createVehicleById(setup.vehicleId);
  const inputManager = new InputManager(window);
  const controller = new ArcadeVehicleController(vehicle.performance, track.spawn);
  const recordKey = getRaceRecordKey(setup);
  const raceManager = new RaceManager({
    mode: setup.raceMode,
    bestLapTime: readBestLapTime(window.localStorage, recordKey),
    onBestLap: (bestLapTime) => {
      writeBestLapTime(window.localStorage, recordKey, bestLapTime);
    }
  });
  const raceOverlay = createRaceOverlay();
  const raceHud = createRaceHud();
  const pauseMenu = createPauseMenu({
    onResume: resumeGame,
    onExitToSetup: options.onExitToSetup
  });
  let animationFrameId = 0;
  let paused = false;

  timer.connect(document);
  scene.add(track.group, vehicle.group);
  container.appendChild(raceOverlay);
  container.appendChild(raceHud);
  container.appendChild(pauseMenu.element);
  vehicle.setTransform(controller.position, controller.heading);
  raceManager.startCountdown();

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

  function update(deltaTime) {
    const actions = inputManager.consumeActions();

    if (actions.pause) {
      setPaused(!paused);
    }

    if (paused) {
      return;
    }

    if (actions.restart) {
      controller.reset(track.spawn);
      raceManager.reset();
      raceManager.startCountdown();
    }

    const currentVehicleState = controller.getState();
    const raceState = raceManager.update(deltaTime, currentVehicleState, track.trackInfo);
    const canDrive = raceState.phase === RACE_PHASES.RUNNING;
    const state = controller.update(deltaTime, canDrive ? inputManager.getHeldState() : {}, {
      surfaceType: "asphalt",
      surfaceGrip: 1,
      speedLimitMultiplier: 1,
      boostFactor: 1,
      collided: false
    });

    vehicle.setTransform(state.position, state.heading);
    vehicle.update(deltaTime, state);
    updateCameraFollow(state);
    updateRaceOverlay(raceOverlay, raceState);
    updateRaceHud(raceHud, raceState);
  }

  function updateCameraFollow(state) {
    const cameraTarget = new THREE.Vector3(
      state.position.x + Math.sin(state.heading + Math.PI) * 8,
      state.position.y + 5.5,
      state.position.z + Math.cos(state.heading + Math.PI) * 8
    );

    camera.position.lerp(cameraTarget, 0.08);
    camera.lookAt(state.position.x, state.position.y + 0.7, state.position.z);
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
      pauseMenu.element.remove();
      track.dispose();
      vehicle.dispose();
      scene.remove(track.group, vehicle.group, lights.ambient, lights.sun);
    }
  };
}

function createRaceHud() {
  const hud = document.createElement("aside");
  hud.className = "race-hud";
  hud.setAttribute("aria-label", "Race status");
  return hud;
}

function updateRaceHud(hud, raceState) {
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
      <span>Best</span>
      <strong>${formatRaceTime(raceState.bestLapTime)}</strong>
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
