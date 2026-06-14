import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";
import { VEHICLE_COLOR_OPTIONS } from "../config/raceOptions.js";
import { applyTrackLightingTheme, applyTrackSceneTheme } from "../tracks/applyTrackSceneTheme.js";
import { findClosestProgress } from "../tracks/centerline.js";
import { createTrackById } from "../tracks/trackFactory.js";
import { createVehicleById } from "../vehicles/vehicleFactory.js";
import { AiVehicleController } from "../systems/AiVehicleController.js";
import { ArcadeVehicleController } from "../systems/ArcadeVehicleController.js";
import { AudioManager } from "../systems/AudioManager.js";
import { CameraController } from "../systems/CameraController.js";
import { getOrderedCheckpoints } from "../systems/checkpointUtils.js";
import { InputManager } from "../systems/InputManager.js";
import { MinimapSystem } from "../systems/MinimapSystem.js";
import { RaceManager, RACE_MODES, RACE_PHASES } from "../systems/RaceManager.js";
import { TrackInteractionSystem } from "../systems/TrackInteractionSystem.js";
import { WrongWayDetector } from "../systems/WrongWayDetector.js";
import { createRaceHud } from "../ui/RaceHud.js";
import {
  createGhostLapRecorder,
  getRaceGhostKey,
  readGhostLap,
  sampleGhostLap,
  writeGhostLap
} from "../systems/ghostLapRecords.js";
import {
  appendLapRecord,
  ensureBestLapInRecords,
  getRaceLapRecordsKey,
  getRaceRecordKey,
  readBestLapTime,
  readLapRecords,
  writeBestLapTime
} from "../systems/raceRecords.js";

const VEHICLE_LOADING_MIN_MS = {
  kart: 420,
  porsche: 850,
  silvia: 850
};

const VEHICLE_DISPLAY_NAMES = {
  kart: "Kart",
  porsche: "Porsche",
  silvia: "Silvia"
};
const AUDIO_SETTINGS_KEY = "kart-racing-audio-settings";
const DEFAULT_AUDIO_SETTINGS = {
  muted: false,
  gameVolume: 1,
  ambienceVolume: 1
};
const TARGET_FRAME_RATE = 60;
const TARGET_FRAME_INTERVAL_MS = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE;
const FRAME_INTERVAL_EPSILON_MS = 0.25;
const FIXED_DELTA_MAX_INTERVAL_MS = TARGET_FRAME_INTERVAL_MS * 1.5;
const MAX_DELTA_TIME = 0.25;

export function startScenePreview(container, setup, options = {}) {
  const renderer = createRenderer(container);
  const scene = createScene();
  const camera = createMainCamera();
  const cameraController = new CameraController(camera);
  const lights = createSceneLights(scene);
  const track = createTrackById(setup.trackId);
  const vehicle = createVehicleById(setup.vehicleId);
  let selectedBodyColor = setup.bodyColor ?? VEHICLE_COLOR_OPTIONS[0].value;
  vehicle.setBodyColor(selectedBodyColor);
  const aiVehicle = setup.raceMode === "race" ? createVehicleById(setup.vehicleId) : null;
  const ghostVehicle = setup.raceMode === RACE_MODES.TIME_TRIAL ? createVehicleById(setup.vehicleId) : null;
  const ghostPosition = new THREE.Vector3();
  const inputManager = new InputManager(window);
  const audioSettings = readAudioSettings(window.localStorage);
  const audioManager = new AudioManager({
    vehicleId: setup.vehicleId,
    trackId: setup.trackId,
    gameVolume: audioSettings.gameVolume,
    ambienceVolume: audioSettings.ambienceVolume
  });
  audioManager.setMuted(audioSettings.muted);
  const controller = new ArcadeVehicleController(vehicle.performance, track.spawn);
  const aiController = aiVehicle ? new AiVehicleController(aiVehicle.performance, track.trackInfo) : null;
  const trackInteraction = new TrackInteractionSystem();
  const wrongWayDetector = new WrongWayDetector();
  const recordKey = getRaceRecordKey(setup);
  const lapRecordsKey = getRaceLapRecordsKey(recordKey);
  const ghostKey = getRaceGhostKey(recordKey);
  const savedBestLapTime = readBestLapTime(window.localStorage, recordKey);
  let savedLapRecords = ensureBestLapInRecords(window.localStorage, lapRecordsKey, savedBestLapTime);
  let savedGhostLap = readGhostLap(window.localStorage, ghostKey);
  let pendingGhostLap = null;
  const ghostRecorder = createGhostLapRecorder({
    enabled: setup.raceMode === RACE_MODES.TIME_TRIAL
  });
  const raceManager = new RaceManager({
    mode: setup.raceMode,
    countdownSeconds: 4,
    bestLapTime: savedBestLapTime,
    onLapComplete: (lapRecord) => {
      savedLapRecords = appendLapRecord(window.localStorage, lapRecordsKey, lapRecord);
      pendingGhostLap = ghostRecorder.complete(lapRecord.time, setup);
    },
    onBestLap: (bestLapTime) => {
      writeBestLapTime(window.localStorage, recordKey, bestLapTime);
      if (pendingGhostLap) {
        savedGhostLap = writeGhostLap(window.localStorage, ghostKey, pendingGhostLap);
      }
      pendingGhostLap = null;
    }
  });
  const raceOverlay = createRaceOverlay();
  const raceHud = createRaceHud();
  const frameRateMonitor = createFrameRateMonitor();
  const debugStatsPanel = createDebugStatsPanel();
  const wrongWayOverlay = createWrongWayOverlay();
  const loadingOverlay = createVehicleLoadingOverlay({
    ...setup,
    trackName: track.trackInfo.name
  });
  const minimapPanel = createMinimapPanel();
  const minimapCanvas = minimapPanel.querySelector("canvas");
  const minimap = new MinimapSystem(minimapCanvas);
  minimap.setTrack(track.trackInfo);
  const colorPicker = createPreRaceColorPicker({
    selectedColor: selectedBodyColor,
    onSelect: (color) => {
      selectedBodyColor = color;
      setup.bodyColor = color;
      vehicle.setBodyColor(color);
      audioManager.playUiSelect();
    },
    onConfirm: () => {
      raceArmed = true;
      colorPicker.hide();
      audioManager.playUiConfirm();
      void audioManager.enable();
      raceManager.startCountdown();
      resetAudioEventState();
    }
  });
  colorPicker.element.hidden = true;
  const checkpointHighlighter = createCheckpointHighlighter(track.trackInfo);
  const finishScreen = createFinishScreen({
    onRestart: resetRace,
    onExitToSetup: options.onExitToSetup,
    trackId: setup.trackId
  });
  const pauseMenu = createPauseMenu({
    onResume: resumeGame,
    onExitToSetup: options.onExitToSetup,
    audioManager,
    trackId: setup.trackId,
    onAudioSettingsChange: (settings) => {
      writeAudioSettings(window.localStorage, settings);
    }
  });
  let animationFrameId = 0;
  let nextFrameTimestamp = 0;
  let lastRenderedTimestamp = 0;
  let paused = false;
  let raceArmed = false;
  let disposed = false;
  let renderedFinishSignature = "";
  let totalElapsedTime = 0;
  const debugOptions = {
    minimap: true,
    shadows: renderer.shadowMap.enabled,
    props: true,
    stats: false
  };
  let lastAudioCountdownStep = null;
  let lastAudioCheckpoint = 0;
  let lastAudioLapCount = 0;
  let lastAudioBestLapTime = savedBestLapTime;
  let lastAudioFinished = false;
  let lastAudioBoostActive = false;
  let lastAudioRacePosition = raceManager.getState().position;
  let lastAudioRacePhase = raceManager.getState().phase;

  applyTrackSceneTheme(scene, track.trackInfo);
  applyTrackLightingTheme(lights, track.trackInfo);
  scene.add(track.group, vehicle.group);
  if (ghostVehicle) {
    ghostVehicle.group.visible = false;
    scene.add(ghostVehicle.group);
    ghostVehicle.whenReady().then(() => {
      if (!disposed) {
        applyGhostVehicleMaterial(ghostVehicle);
      }
    });
  }
  if (lights.sun && lights.sun.target) {
    scene.add(lights.sun.target);
  }

  // Debug globals for programmatic scene verification
  window.gameScene = scene;
  window.gameTrack = track;
  window.gameVehicle = vehicle;
  window.gameController = controller;

  // Cache references to animating props and start lights to avoid costly traversals in the frame loop
  const animatingProps = [];
  const gantryStartLights = [];
  const decorativePropGroups = [];

  track.group.traverse((child) => {
    if (child.userData.spin || child.userData.float) {
      animatingProps.push(child);
    }
    if (child.name === "GantryStartLights" && child.userData.lamps) {
      gantryStartLights.push(...child.userData.lamps);
    }
    if (isDecorativePropsGroup(child)) {
      decorativePropGroups.push(child);
    }
  });

  if (aiVehicle && aiController) {
    scene.add(aiVehicle.group);
    applyAiVehicleTransform(aiVehicle, aiController.getState());
  }

  container.appendChild(raceOverlay);
  container.appendChild(raceHud.element);
  container.appendChild(debugStatsPanel.element);
  container.appendChild(wrongWayOverlay);
  container.appendChild(minimapPanel);
  container.appendChild(loadingOverlay.element);
  container.appendChild(colorPicker.element);
  container.appendChild(finishScreen.element);
  container.appendChild(pauseMenu.element);
  vehicle.setTransform(controller.position, controller.heading);
  waitForVehicleReadiness([vehicle, aiVehicle], setup.vehicleId).then(() => {
    if (disposed) {
      return;
    }

    loadingOverlay.remove();
    colorPicker.element.hidden = false;
  });

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    cameraController.resize(width, height);
    renderer.setSize(width, height);
    minimap.resize();
  }

  function setPaused(nextPaused) {
    paused = nextPaused;
    audioManager.setEngineAudible(!paused && !raceManager.getState().finished);
    pauseMenu.setPaused(paused);
  }

  function resumeGame() {
    setPaused(false);
  }

  function resetRace() {
    controller.reset(track.spawn);
    aiController?.reset(track.trackInfo);
    trackInteraction.reset();
    raceManager.reset();
    wrongWayDetector.reset();
    ghostRecorder.reset();
    raceManager.startCountdown();
    audioManager.setEngineAudible(true);
    resetAudioEventState();
    pendingGhostLap = null;
    renderedFinishSignature = "";
    finishScreen.setVisible(false);
    if (ghostVehicle) {
      ghostVehicle.group.visible = false;
    }
    totalElapsedTime = 0;
  }

  function resetAudioEventState() {
    const raceState = raceManager.getState();

    lastAudioCountdownStep = null;
    lastAudioCheckpoint = raceState.currentCheckpoint;
    lastAudioLapCount = raceState.lapTimes.length;
    lastAudioBestLapTime = raceState.bestLapTime;
    lastAudioFinished = raceState.finished;
    lastAudioBoostActive = false;
    lastAudioRacePosition = raceState.position;
    lastAudioRacePhase = raceState.phase;
  }

  function update(deltaTime) {
    const actions = inputManager.consumeActions();

    if (actions.pause) {
      setPaused(!paused);
    }

    if (actions.camera) {
      cameraController.nextMode();
    }

    if (actions.toggleMinimap) {
      debugOptions.minimap = !debugOptions.minimap;
      minimapPanel.hidden = !debugOptions.minimap;
    }

    if (actions.toggleShadows) {
      debugOptions.shadows = !debugOptions.shadows;
      renderer.shadowMap.enabled = debugOptions.shadows;
      if (lights.sun) {
        lights.sun.castShadow = debugOptions.shadows;
      }
    }

    if (actions.toggleProps) {
      debugOptions.props = !debugOptions.props;
      decorativePropGroups.forEach((group) => {
        group.visible = debugOptions.props;
      });
    }

    if (actions.toggleDebugStats) {
      debugOptions.stats = !debugOptions.stats;
      debugStatsPanel.setVisible(debugOptions.stats);
    }

    if (paused) {
      return;
    }

    if (!raceArmed) {
      const state = controller.getState();
      vehicle.setTransform(state.position, state.heading);
      vehicle.update(deltaTime, state);
      hideGhostVehicle();
      cameraController.update(deltaTime, state, track.trackInfo);
      updateTrackSkyPosition();
      raceHud.update({
        raceState: raceManager.getState(),
        vehicleState: state,
        wrongWayState: wrongWayDetector.getState(),
        trackId: track.trackInfo.id,
        trackName: track.trackInfo.name,
        performanceState: frameRateMonitor.getState()
      });
      updateMinimapIfEnabled(state);
      debugStatsPanel.update({
        visible: debugOptions.stats,
        performanceState: frameRateMonitor.getState(),
        rendererInfo: renderer.info,
        options: debugOptions
      });
      audioManager.update(deltaTime, state);
      return;
    }

    if (actions.restart) {
      resetRace();
    }

    if (actions.lights) {
      vehicle.toggleHeadlights();
    }

    totalElapsedTime += deltaTime;

    const currentVehicleState = controller.getState();
    const updatedRaceState = raceManager.update(deltaTime, currentVehicleState, track.trackInfo);
    const canDrive = updatedRaceState.phase === RACE_PHASES.RUNNING;
    const heldInputState = canDrive ? inputManager.getHeldState() : {};
    const opponentStates = aiController ? [aiController.getState()] : [];
    const environmentState = trackInteraction.update(currentVehicleState, track.trackInfo, {
      deltaTime,
      opponentStates
    });
    if (environmentState.impact?.type === "opponent") {
      aiController?.registerCollision();
    }

    const state = updatedRaceState.finished
      ? controller.getState()
      : controller.update(deltaTime, heldInputState, environmentState);

    vehicle.setTransform(state.position, state.heading);
    vehicle.update(deltaTime, state);
    const audioEvents = audioManager.update(deltaTime, state, heldInputState);
    if (audioEvents?.enginePop) {
      vehicle.triggerExhaustPop?.();
    }

    // Auto-enable headlights for night circuits (Vegas)
    if (track.trackInfo.lightingMode === "vegas" && !vehicle.headlightsEnabled) {
      vehicle.setHeadlights(true);
    }

    // 1. Center the moon/sun directional light & shadow camera on the car
    if (lights.sun) {
      lights.sun.position.set(
        state.position.x - 42,
        state.position.y + 46,
        state.position.z + 30
      );
      lights.sun.target.position.copy(state.position);
    }

    // 3. Update the start gantry F1 countdown lights
    if (gantryStartLights.length > 0) {
      const countdown = updatedRaceState.countdown;
      const phase = updatedRaceState.phase;

      if (phase === RACE_PHASES.COUNTDOWN) {
        const visualLeftToRightLamps = [...gantryStartLights].reverse();
        setStartLampState(visualLeftToRightLamps[0], countdown <= 3.0, 0xff0000);
        setStartLampState(visualLeftToRightLamps[1], countdown <= 2.0, 0xff0000);
        setStartLampState(visualLeftToRightLamps[2], countdown <= 1.0, 0xff0000);
      } else if (phase === RACE_PHASES.RUNNING) {
        // All lamps turn Green!
        gantryStartLights.forEach((lampMat) => {
          lampMat.color.setHex(0x00ff00);
          lampMat.emissive.setHex(0x00ff00);
          lampMat.emissiveIntensity = 2.5;
        });
      } else {
        // Off
        gantryStartLights.forEach((lampMat) => {
          lampMat.color.setHex(0x1f1f24);
          lampMat.emissive.setHex(0x000000);
          lampMat.emissiveIntensity = 0;
        });
      }
    }

    // 4. Rotate and float props (MSG Sphere, Casino Hologram Dice)
    for (let i = 0; i < animatingProps.length; i++) {
      const child = animatingProps[i];
      if (child.userData.spin) {
        child.rotation.x += child.userData.spin.x * deltaTime;
        child.rotation.y += child.userData.spin.y * deltaTime;
        child.rotation.z += child.userData.spin.z * deltaTime;
      }
      if (child.userData.float) {
        const f = child.userData.float;
        child.position.y = f.baseY + Math.sin(totalElapsedTime * f.speed + f.phase) * f.amplitude;
      }
    }

    let aiState = null;

    if (aiVehicle && aiController) {
      aiState = updatedRaceState.phase === RACE_PHASES.RUNNING && !updatedRaceState.finished
        ? aiController.update(deltaTime, track.trackInfo)
        : aiController.getState();
      applyAiVehicleTransform(aiVehicle, aiState);
      aiVehicle.update(deltaTime, aiState);
    }

    updatePlayerRacePosition(raceManager, state, aiState, track.trackInfo);
    const raceState = raceManager.getState();
    updateRaceAudioCues(raceState, environmentState);

    if (environmentState.impact) {
      cameraController.applyShake(environmentState.impact.type === "opponent" ? 0.45 : 1);
    }

    cameraController.update(deltaTime, state, track.trackInfo);
    updateTrackSkyPosition();
    const wrongWayState = wrongWayDetector.update(deltaTime, state, track.trackInfo);
    updateWrongWayOverlay(wrongWayOverlay, wrongWayState);
    
    checkpointHighlighter.update(raceState);
    updateRaceOverlay(raceOverlay, raceState);
    ghostRecorder.update(raceState, state);
    updateGhostVehicle(deltaTime, raceState);
    raceHud.update({
      raceState,
      vehicleState: state,
      wrongWayState,
      trackId: track.trackInfo.id,
      trackName: track.trackInfo.name,
      performanceState: frameRateMonitor.getState()
    });
    updateMinimapIfEnabled(state, aiState);
    debugStatsPanel.update({
      visible: debugOptions.stats,
      performanceState: frameRateMonitor.getState(),
      rendererInfo: renderer.info,
      options: debugOptions
    });
    renderedFinishSignature = updateFinishScreen(
      finishScreen,
      raceState,
      savedLapRecords,
      renderedFinishSignature
    );
  }

  function updateMinimapIfEnabled(playerState, aiState = null) {
    if (!debugOptions.minimap) {
      return;
    }

    minimap.update({
      playerState,
      aiState: getVisibleAiMinimapState(aiState, aiVehicle)
    });
  }

  function updateTrackSkyPosition() {
    if (scene.userData.trackSky) {
      scene.userData.trackSky.position.copy(camera.position);
    }
  }

  function updateGhostVehicle(deltaTime, raceState) {
    if (
      !ghostVehicle ||
      !savedGhostLap ||
      raceState.mode !== RACE_MODES.TIME_TRIAL ||
      raceState.phase !== RACE_PHASES.RUNNING ||
      ghostVehicle.isLoading?.()
    ) {
      hideGhostVehicle();
      return;
    }

    const ghostSample = sampleGhostLap(savedGhostLap, raceState.lapTime);
    if (!ghostSample) {
      hideGhostVehicle();
      return;
    }

    ghostPosition.set(ghostSample.x, ghostSample.y, ghostSample.z);
    ghostVehicle.group.visible = true;
    ghostVehicle.setTransform(ghostPosition, ghostSample.heading);
    ghostVehicle.update(deltaTime, {
      position: ghostPosition,
      heading: ghostSample.heading,
      speed: ghostSample.speed ?? 0,
      steering: 0,
      throttle: 0,
      braking: false
    });
  }

  function hideGhostVehicle() {
    if (ghostVehicle) {
      ghostVehicle.group.visible = false;
    }
  }

  function updateRaceAudioCues(raceState, environmentState) {
    if (raceState.phase === RACE_PHASES.COUNTDOWN) {
      const countdownStep = Math.ceil(raceState.countdown);

      if (countdownStep >= 1 && countdownStep <= 3 && countdownStep !== lastAudioCountdownStep) {
        audioManager.playCountdown(countdownStep);
        lastAudioCountdownStep = countdownStep;
      }
    }

    if (lastAudioRacePhase === RACE_PHASES.COUNTDOWN && raceState.phase === RACE_PHASES.RUNNING) {
      audioManager.playCountdown(0);
      lastAudioCountdownStep = 0;
    }

    const boostActive = environmentState.boostFactor > 1;
    if (boostActive && !lastAudioBoostActive) {
      audioManager.playBoost();
    }
    lastAudioBoostActive = boostActive;

    if (environmentState.impact) {
      audioManager.playCollision();
    }

    if (
      raceState.phase === RACE_PHASES.RUNNING
      && raceState.participantCount > 1
      && raceState.position !== lastAudioRacePosition
    ) {
      if (raceState.position < lastAudioRacePosition) {
        audioManager.playCrowdCheer();
      } else {
        audioManager.playCrowdDisappointment();
      }
    }

    if (raceState.lapTimes.length > lastAudioLapCount) {
      const bestLap = raceState.bestLapTime !== lastAudioBestLapTime;
      if (!raceState.finished) {
        audioManager.playLapComplete({ bestLap });
      }
      lastAudioLapCount = raceState.lapTimes.length;
      lastAudioBestLapTime = raceState.bestLapTime;
    } else if (raceState.currentCheckpoint !== lastAudioCheckpoint && raceState.phase === RACE_PHASES.RUNNING) {
      const crossedInitialStart = lastAudioCheckpoint === 0 && raceState.currentCheckpoint === 1;
      if (!crossedInitialStart) {
        audioManager.playCheckpoint();
      }
    }

    if (raceState.finished && !lastAudioFinished) {
      audioManager.setEngineAudible(false);
      audioManager.playFinish();
      if (raceState.participantCount > 1 && raceState.position === 1) {
        audioManager.playCrowdCheer();
      } else if (raceState.participantCount > 1 && raceState.position === raceState.participantCount) {
        audioManager.playCrowdDisappointment();
      }
    }

    lastAudioCheckpoint = raceState.currentCheckpoint;
    lastAudioFinished = raceState.finished;
    lastAudioRacePosition = raceState.position;
    lastAudioRacePhase = raceState.phase;
  }

  function animate(timestamp) {
    animationFrameId = requestAnimationFrame(animate);

    if (nextFrameTimestamp === 0) {
      nextFrameTimestamp = timestamp;
    }

    if (timestamp + FRAME_INTERVAL_EPSILON_MS < nextFrameTimestamp) {
      return;
    }

    const skippedIntervals = Math.max(
      0,
      Math.floor((timestamp - nextFrameTimestamp) / TARGET_FRAME_INTERVAL_MS)
    );
    nextFrameTimestamp += (skippedIntervals + 1) * TARGET_FRAME_INTERVAL_MS;
    frameRateMonitor.update(timestamp, TARGET_FRAME_RATE);

    const renderedIntervalMs = lastRenderedTimestamp > 0
      ? timestamp - lastRenderedTimestamp
      : TARGET_FRAME_INTERVAL_MS;
    lastRenderedTimestamp = timestamp;
    const deltaTime = renderedIntervalMs <= FIXED_DELTA_MAX_INTERVAL_MS
      ? FIXED_DELTA_TIME
      : Math.min(renderedIntervalMs / 1000, MAX_DELTA_TIME);

    update(deltaTime);
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  resize();
  animationFrameId = requestAnimationFrame(animate);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      inputManager.dispose();
      audioManager.dispose();
      controller.dispose();
      cameraController.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      raceOverlay.remove();
      raceHud.remove();
      debugStatsPanel.remove();
      wrongWayOverlay.remove();
      loadingOverlay.remove();
      minimapPanel.remove();
      colorPicker.element.remove();
      finishScreen.element.remove();
      pauseMenu.element.remove();
      checkpointHighlighter.dispose();
      track.dispose();
      vehicle.dispose();
      aiVehicle?.dispose();
      ghostVehicle?.dispose();
      scene.remove(track.group, vehicle.group, lights.ambient, lights.sun);

      if (aiVehicle) {
        scene.remove(aiVehicle.group);
      }
      if (ghostVehicle) {
        scene.remove(ghostVehicle.group);
      }
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

function createVehicleLoadingOverlay(setup = {}) {
  const element = document.createElement("section");
  element.className = "vehicle-loading-overlay";
  element.setAttribute("aria-label", "Loading race vehicle");
  element.setAttribute("aria-live", "polite");

  const vehicleName = VEHICLE_DISPLAY_NAMES[setup.vehicleId] ?? "Vehicle";
  const trackName = setup.trackName ?? "";

  element.innerHTML = `
    <div class="vehicle-loading-panel">
      <span class="vehicle-loading-eyebrow">Preparing Race</span>
      <strong>${vehicleName}</strong>
      <div class="vehicle-loading-bar" aria-hidden="true">
        <span></span>
      </div>
      ${trackName ? `<small>${trackName}</small>` : ""}
    </div>
  `;

  return {
    element,
    remove() {
      element.remove();
    }
  };
}

function waitForVehicleReadiness(vehicles, vehicleId) {
  const readyPromises = vehicles
    .filter(Boolean)
    .map((vehicle) => vehicle.whenReady?.() ?? Promise.resolve(vehicle));
  const minimumDelay = wait(VEHICLE_LOADING_MIN_MS[vehicleId] ?? 650);

  return Promise.all([...readyPromises, minimumDelay]);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function setStartLampState(lampMaterial, active, activeColor) {
  if (!lampMaterial) {
    return;
  }

  lampMaterial.color.setHex(active ? activeColor : 0x1f1f24);
  lampMaterial.emissive.setHex(active ? activeColor : 0x000000);
  lampMaterial.emissiveIntensity = active ? 2.5 : 0;
}

function readAudioSettings(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY) ?? "{}");

    return {
      muted: Boolean(parsed.muted),
      gameVolume: normalizeVolume(parsed.gameVolume, DEFAULT_AUDIO_SETTINGS.gameVolume),
      ambienceVolume: normalizeVolume(parsed.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume)
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function writeAudioSettings(storage, settings) {
  storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
    muted: Boolean(settings.muted),
    gameVolume: normalizeVolume(settings.gameVolume, DEFAULT_AUDIO_SETTINGS.gameVolume),
    ambienceVolume: normalizeVolume(settings.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume)
  }));
}

function normalizeVolume(value, fallback) {
  const normalized = Number(value);

  return Number.isFinite(normalized) ? Math.min(1, Math.max(0, normalized)) : fallback;
}

function createMinimapPanel() {
  const panel = document.createElement("aside");
  panel.className = "race-minimap-panel";
  panel.setAttribute("aria-label", "Map");

  const canvas = document.createElement("canvas");
  canvas.className = "race-minimap";
  canvas.setAttribute("aria-label", "Rotating track minimap");

  panel.append(canvas);
  return panel;
}

function updatePlayerRacePosition(raceManager, playerState, aiState, trackInfo) {
  const centerline = Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];
  const raceState = raceManager.getState();

  if (!centerline.length || !aiState || raceState.mode !== "race") {
    raceManager.setPlayerPosition(1, aiState ? 2 : 1);
    return;
  }

  const playerProgress = findClosestProgress(centerline, playerState.position.x, playerState.position.z);
  const playerScore = getRaceProgressScore(raceState.currentLap, playerProgress, raceState.totalLaps);
  const aiProgress = !aiState.hasCrossedStartLine && aiState.progress > 0.5
    ? aiState.progress - 1
    : aiState.progress;
  const aiScore = getRaceProgressScore(aiState.lap, aiProgress, raceState.totalLaps);
  const playerPosition = playerScore >= aiScore ? 1 : 2;

  raceManager.setPlayerPosition(playerPosition, 2);
}

function getRaceProgressScore(lap, progress, totalLaps) {
  return Math.min(totalLaps, Math.max(1, lap) - 1 + Math.max(0, Math.min(1, progress)));
}

function applyAiVehicleTransform(vehicle, aiState) {
  vehicle.setTransform(
    new THREE.Vector3(aiState.position.x, aiState.position.y, aiState.position.z),
    aiState.heading
  );
}

function getVisibleAiMinimapState(aiState, aiVehicle) {
  if (!aiState?.position || !aiVehicle?.group) {
    return null;
  }

  return {
    ...aiState,
    hasVisibleModel: aiVehicle.group.visible !== false
  };
}

function applyGhostVehicleMaterial(vehicle) {
  vehicle.setHeadlights?.(false);
  vehicle.group.traverse((child) => {
    if (child.isLight) {
      child.visible = false;
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material)
      ? child.material.map(cloneGhostMaterial)
      : cloneGhostMaterial(child.material);
    child.material = materials;
  });
}

function cloneGhostMaterial(material) {
  const ghostMaterial = material.clone();

  ghostMaterial.transparent = true;
  ghostMaterial.opacity = Math.min(ghostMaterial.opacity ?? 1, 0.34);
  ghostMaterial.depthWrite = false;

  if (ghostMaterial.color) {
    ghostMaterial.color.lerp(new THREE.Color(0x7dd3fc), 0.68);
  }

  if (ghostMaterial.emissive) {
    ghostMaterial.emissive.setHex(0x164e63);
    ghostMaterial.emissiveIntensity = Math.max(ghostMaterial.emissiveIntensity ?? 0, 0.24);
  }

  return ghostMaterial;
}

function createFrameRateMonitor() {
  const sampleWindowMs = 500;
  let lastTimestamp = null;
  let sampleElapsed = 0;
  let sampleFrames = 0;
  let displayedFps = null;
  let smoothedFps = null;

  return {
    update(timestamp = 0, maxFps = Infinity) {
      if (!Number.isFinite(timestamp)) {
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        return;
      }

      const deltaMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (deltaMs <= 0) {
        return;
      }

      const instantFps = Math.min(maxFps, 1000 / deltaMs);
      smoothedFps = smoothedFps === null
        ? instantFps
        : smoothedFps * 0.86 + instantFps * 0.14;
      sampleElapsed += deltaMs;
      sampleFrames += 1;

      if (sampleElapsed >= sampleWindowMs) {
        displayedFps = Math.min(maxFps, sampleFrames * 1000 / sampleElapsed);
        sampleElapsed = 0;
        sampleFrames = 0;
      }
    },
    getState() {
      return {
        fps: displayedFps ?? smoothedFps
      };
    }
  };
}

function isDecorativePropsGroup(object) {
  return typeof object?.name === "string" && object.name.endsWith("Props");
}

function createDebugStatsPanel() {
  const element = document.createElement("aside");
  element.className = "debug-stats-panel";
  element.hidden = true;

  return {
    element,
    setVisible(visible) {
      element.hidden = !visible;
    },
    update({ visible, performanceState, rendererInfo, options } = {}) {
      if (!visible) {
        return;
      }

      const memory = rendererInfo?.memory ?? {};
      const render = rendererInfo?.render ?? {};
      element.innerHTML = `
        <strong>Debug Performance</strong>
        <span>F1 minimap: ${formatDebugToggle(options?.minimap)}</span>
        <span>F2 shadows: ${formatDebugToggle(options?.shadows)}</span>
        <span>F3 props: ${formatDebugToggle(options?.props)}</span>
        <span>FPS: ${formatDebugNumber(performanceState?.fps)}</span>
        <span>Draw calls: ${formatDebugNumber(render.calls)}</span>
        <span>Triangles: ${formatDebugNumber(render.triangles)}</span>
        <span>Geometries: ${formatDebugNumber(memory.geometries)}</span>
        <span>Textures: ${formatDebugNumber(memory.textures)}</span>
      `;
    },
    remove() {
      element.remove();
    }
  };
}

function formatDebugToggle(enabled) {
  return enabled ? "on" : "off";
}

function formatDebugNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return Math.round(value).toLocaleString("en-US");
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

function createFinishScreen({ onRestart, onExitToSetup, trackId }) {
  const element = document.createElement("section");
  element.className = "finish-screen";
  element.dataset.trackTheme = normalizePauseTheme(trackId);
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

function createPauseMenu({ onResume, onExitToSetup, audioManager, trackId, onAudioSettingsChange }) {
  const element = document.createElement("section");
  element.className = "pause-menu";
  element.dataset.trackTheme = normalizePauseTheme(trackId);
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

function normalizePauseTheme(trackId) {
  if (trackId === "vegas" || trackId === "beach" || trackId === "monaco") {
    return trackId;
  }

  return "default";
}

function createRaceOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "race-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-live", "polite");
  return overlay;
}

function updateRaceOverlay(overlay, raceState) {
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
