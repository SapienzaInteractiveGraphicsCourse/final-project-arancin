import * as THREE from "three";
import "./styles/main.css";
import { createMainCamera } from "./scene/createMainCamera.js";
import { createRenderer } from "./scene/createRenderer.js";
import { createScene } from "./scene/createScene.js";
import { createSceneLights } from "./scene/createSceneLights.js";

const app = document.querySelector("#app");

const renderer = createRenderer(app);
const scene = createScene();
const camera = createMainCamera();
const clock = new THREE.Clock();

createSceneLights(scene);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    color: 0x2f6f4e,
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
    color: 0xd63b2f,
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

window.addEventListener("resize", resize);
resize();

function update(deltaTime) {
  marker.rotation.y += deltaTime * 0.35;
}

function animate() {
  const deltaTime = Math.min(clock.getDelta(), 0.05);

  update(deltaTime);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
