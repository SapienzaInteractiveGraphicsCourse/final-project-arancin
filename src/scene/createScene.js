import * as THREE from "three";

export function createScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x9fc8e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 70, 145);

  return scene;
}
