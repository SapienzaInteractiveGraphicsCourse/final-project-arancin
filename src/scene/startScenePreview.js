import * as THREE from "three";
import { createMainCamera } from "./createMainCamera.js";
import { createRenderer } from "./createRenderer.js";
import { createScene } from "./createScene.js";
import { createSceneLights } from "./createSceneLights.js";

export function startScenePreview(container, setup) {
  const renderer = createRenderer(container);
  const scene = createScene();
  const camera = createMainCamera();
  const timer = new THREE.Timer();
  const lights = createSceneLights(scene);
  let animationFrameId = 0;

  timer.connect(document);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      color: setup.trackId === "beach" ? 0xc8a86a : 0x2f6f4e,
      roughness: 0.85,
      metalness: 0.02
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.7, 3.2),
    new THREE.MeshStandardMaterial({
      color: setup.vehicleId === "silvia" ? 0x2f74d6 : 0xd63b2f,
      roughness: 0.55,
      metalness: 0.18
    })
  );
  marker.position.y = 0.35;
  marker.castShadow = true;
  scene.add(marker);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function update(deltaTime) {
    marker.rotation.y += deltaTime * 0.35;
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
      renderer.dispose();
      renderer.domElement.remove();
      ground.geometry.dispose();
      ground.material.dispose();
      marker.geometry.dispose();
      marker.material.dispose();
      scene.remove(ground, marker, lights.ambient, lights.sun);
    }
  };
}
