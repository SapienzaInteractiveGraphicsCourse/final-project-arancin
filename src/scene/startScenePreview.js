import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";
import { applyTrackLightingTheme, applyTrackSceneTheme } from "../tracks/applyTrackSceneTheme.js";
import { createTrackById } from "../tracks/trackFactory.js";
import { createVehicleById } from "../vehicles/vehicleFactory.js";
import { ArcadeVehicleController } from "../systems/ArcadeVehicleController.js";
import { InputManager } from "../systems/InputManager.js";

export function startScenePreview(container, setup) {
  const renderer = createRenderer(container);
  const scene = createScene();
  const camera = createMainCamera();
  const timer = new THREE.Timer();
  const lights = createSceneLights(scene);
  const track = createTrackById(setup.trackId);
  const vehicle = createVehicleById(setup.vehicleId);
  const inputManager = new InputManager(window);
  const controller = new ArcadeVehicleController(vehicle.performance, track.spawn);
  let animationFrameId = 0;

  applyTrackSceneTheme(scene, track.trackInfo);
  applyTrackLightingTheme(lights, track.trackInfo);
  timer.connect(document);
  scene.add(track.group, vehicle.group);
  vehicle.setTransform(controller.position, controller.heading);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function update(deltaTime) {
    const actions = inputManager.consumeActions();

    if (actions.restart) {
      controller.reset(track.spawn);
    }

    if (actions.lights) {
      vehicle.toggleHeadlights();
    }

    const state = controller.update(deltaTime, inputManager.getHeldState(), {
      surfaceType: "asphalt",
      surfaceGrip: 1,
      speedLimitMultiplier: 1,
      boostFactor: 1,
      collided: false
    });

    vehicle.setTransform(state.position, state.heading);
    vehicle.update(deltaTime, state);
    updateCameraFollow(state);
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
      track.dispose();
      vehicle.dispose();
      scene.remove(track.group, vehicle.group, lights.ambient, lights.sun);
    }
  };
}
