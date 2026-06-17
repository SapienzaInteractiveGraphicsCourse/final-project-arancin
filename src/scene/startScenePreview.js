import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";
import { readAudioSettings, writeAudioSettings } from "./preview/audioSettings.js";
import { createCheckpointHighlighter } from "./preview/checkpointHighlighter.js";
import { createPreviewDebugOptions } from "./preview/debugOptions.js";
import { createPreviewFrameLoop } from "./preview/frameLoop.js";
import { createGhostVehicleController } from "./preview/ghostVehicle.js";
import { updatePlayerRacePosition } from "./preview/racePosition.js";
import { VEHICLE_COLOR_OPTIONS } from "../config/raceOptions.js";
import { applyTrackLightingTheme, applyTrackSceneTheme } from "../tracks/applyTrackSceneTheme.js";
import { createTrackById } from "../tracks/trackFactory.js";
import { createVehicleById } from "../vehicles/vehicleFactory.js";
import { AiVehicleController } from "../systems/AiVehicleController.js";
import { ArcadeVehicleController } from "../systems/ArcadeVehicleController.js";
import { AudioManager } from "../systems/AudioManager.js";
import { BarrierParticleSystem } from "../systems/BarrierParticleSystem.js";
import { CameraController } from "../systems/CameraController.js";
import { InputManager } from "../systems/InputManager.js";
import { MinimapSystem } from "../systems/MinimapSystem.js";
import { RaceManager, RACE_MODES, RACE_PHASES } from "../systems/RaceManager.js";
import { TrackInteractionSystem } from "../systems/TrackInteractionSystem.js";
import { WrongWayDetector } from "../systems/WrongWayDetector.js";
import { createFrameRateMonitor } from "../systems/frameRateMonitor.js";
import { createDebugStatsPanel } from "../ui/DebugStatsPanel.js";
import { createFinishScreen, updateFinishScreen } from "../ui/FinishScreen.js";
import { createMinimapPanel } from "../ui/MinimapPanel.js";
import { createPauseMenu } from "../ui/PauseMenu.js";
import { createPreRaceColorPicker } from "../ui/PreRaceColorPicker.js";
import { createRaceHud } from "../ui/RaceHud.js";
import { createRaceOverlay, updateRaceOverlay } from "../ui/RaceOverlay.js";
import { createVehicleLoadingOverlay } from "../ui/VehicleLoadingOverlay.js";
import { createWrongWayOverlay, updateWrongWayOverlay } from "../ui/WrongWayOverlay.js";
import {
  createGhostLapRecorder,
  getRaceGhostKey,
  readGhostLap,
  writeGhostLap
} from "../systems/ghostLapRecords.js";
import {
  appendLapRecord,
  ensureBestLapInRecords,
  getRaceLapRecordsKey,
  getRaceRecordKey,
  readBestLapTime,
  writeBestLapTime
} from "../systems/raceRecords.js";
import { updateBoostPadShaderTime } from "../materials/boostPadShader.js";

const VEHICLE_LOADING_MIN_MS = {
  kart: 420,
  porsche: 850,
  silvia: 850
};

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
  const ghostVehicleController = createGhostVehicleController(ghostVehicle);
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
  const barrierParticles = new BarrierParticleSystem();
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
  let paused = false;
  let raceArmed = false;
  let disposed = false;
  let renderedFinishSignature = "";
  let totalElapsedTime = 0;
  let headlightsManuallyToggled = false;
  let lastAudioCountdownStep = null;
  let lastAudioCheckpoint = 0;
  let lastAudioLapCount = 0;
  let lastAudioBestLapTime = savedBestLapTime;
  let lastAudioFinished = false;
  let lastAudioBoostActive = false;
  let lastAudioRacePosition = raceManager.getState().position;
  let lastAudioRacePhase = raceManager.getState().phase;
  let shaderElapsedTime = 0;

  applyTrackSceneTheme(scene, track.trackInfo);
  applyTrackLightingTheme(lights, track.trackInfo);
  scene.add(track.group, vehicle.group, barrierParticles.group);
  if (ghostVehicle) {
    ghostVehicle.group.visible = false;
    scene.add(ghostVehicle.group);
    ghostVehicle.whenReady().then(() => {
      if (!disposed) {
        ghostVehicleController.applyMaterial();
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
    if (child.userData.spin || child.userData.float || child.userData.flight) {
      animatingProps.push(child);
    }
    if (child.name === "GantryStartLights" && child.userData.lamps) {
      gantryStartLights.push(...child.userData.lamps);
    }
    if (isDecorativePropsGroup(child)) {
      decorativePropGroups.push(child);
    }
  });

  const debugOptions = createPreviewDebugOptions({
    renderer,
    lights,
    minimapPanel,
    debugStatsPanel,
    decorativePropGroups
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
    barrierParticles.reset();
    raceManager.startCountdown();
    audioManager.setEngineAudible(true);
    resetAudioEventState();
    pendingGhostLap = null;
    renderedFinishSignature = "";
    finishScreen.setVisible(false);
    ghostVehicleController.hide();
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

    if (actions.lights) {
      headlightsManuallyToggled = true;
      vehicle.toggleHeadlights();
    }

    debugOptions.applyActions(actions);

    if (paused) {
      return;
    }

    shaderElapsedTime += deltaTime;
    updateBoostPadShaderTime(track.group, shaderElapsedTime);

    if (!raceArmed) {
      const state = controller.getState();
      vehicle.setTransform(state.position, state.heading);
      vehicle.update(deltaTime, state);
      ghostVehicleController.hide();
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
      debugOptions.updateStatsPanel({
        performanceState: frameRateMonitor.getState(),
        rendererInfo: renderer.info
      });
      audioManager.update(deltaTime, state);
      barrierParticles.update(deltaTime);
      return;
    }

    if (actions.restart) {
      resetRace();
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
    if (!headlightsManuallyToggled && track.trackInfo.lightingMode === "vegas" && !vehicle.headlightsEnabled) {
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
      if (child.userData.flight) {
        const f = child.userData.flight;
        const angle = totalElapsedTime * f.speed + f.phase;
        const nextAngle = angle + 0.02;
        const x = f.center.x + Math.cos(angle) * f.radiusX;
        const z = f.center.z + Math.sin(angle) * f.radiusZ;
        const nextX = f.center.x + Math.cos(nextAngle) * f.radiusX;
        const nextZ = f.center.z + Math.sin(nextAngle) * f.radiusZ;

        child.position.set(
          x,
          f.center.y + Math.sin(totalElapsedTime * f.bobSpeed + f.phase) * f.bobAmplitude,
          z
        );
        child.rotation.y = Math.atan2(nextX - x, nextZ - z);
        child.rotation.z = Math.sin(angle) * 0.08;

        if (child.userData.wings) {
          const flap = Math.sin(totalElapsedTime * f.wingSpeed + f.phase) * f.wingAmplitude;
          child.userData.wings.leftWing.rotation.x = -0.12 + flap;
          child.userData.wings.rightWing.rotation.x = -0.12 - flap;
        }
        if (child.userData.flockWings) {
          const flap = Math.sin(totalElapsedTime * f.wingSpeed + f.phase) * f.wingAmplitude;
          child.userData.flockWings.forEach((wings, wingIndex) => {
            const offsetFlap = flap * (0.85 + (wingIndex % 3) * 0.08);
            wings.leftWing.rotation.x = -0.12 + offsetFlap;
            wings.rightWing.rotation.x = -0.12 - offsetFlap;
          });
        }
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
    if (environmentState.impact?.type === "barrier") {
      barrierParticles.spawnBarrierImpact(state, environmentState.impact, track.trackInfo);
    }
    barrierParticles.update(deltaTime);

    cameraController.update(deltaTime, state, track.trackInfo);
    updateTrackSkyPosition();
    const wrongWayState = wrongWayDetector.update(deltaTime, state, track.trackInfo);
    updateWrongWayOverlay(wrongWayOverlay, wrongWayState);
    
    checkpointHighlighter.update(raceState);
    updateRaceOverlay(raceOverlay, raceState);
    ghostRecorder.update(raceState, state);
    ghostVehicleController.update(deltaTime, raceState, savedGhostLap);
    raceHud.update({
      raceState,
      vehicleState: state,
      wrongWayState,
      trackId: track.trackInfo.id,
      trackName: track.trackInfo.name,
      performanceState: frameRateMonitor.getState()
    });
    updateMinimapIfEnabled(state, aiState);
    debugOptions.updateStatsPanel({
      performanceState: frameRateMonitor.getState(),
      rendererInfo: renderer.info
    });
    renderedFinishSignature = updateFinishScreen(
      finishScreen,
      raceState,
      savedLapRecords,
      renderedFinishSignature
    );
  }

  function updateMinimapIfEnabled(playerState, aiState = null) {
    if (!debugOptions.isMinimapVisible()) {
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

  const frameLoop = createPreviewFrameLoop({
    update,
    render: () => renderer.render(scene, camera),
    frameRateMonitor
  });

  window.addEventListener("resize", resize);
  resize();
  frameLoop.start();

  return {
    dispose() {
      disposed = true;
      frameLoop.dispose();
      window.removeEventListener("resize", resize);
      inputManager.dispose();
      audioManager.dispose();
      controller.dispose();
      barrierParticles.dispose();
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
      scene.remove(track.group, vehicle.group, barrierParticles.group, lights.ambient, lights.sun);

      if (aiVehicle) {
        scene.remove(aiVehicle.group);
      }
      if (ghostVehicle) {
        scene.remove(ghostVehicle.group);
      }
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

function isDecorativePropsGroup(object) {
  return typeof object?.name === "string" && object.name.endsWith("Props");
}
