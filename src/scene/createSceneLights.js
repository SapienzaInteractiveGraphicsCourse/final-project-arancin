import * as THREE from "three";

export function createSceneLights(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  return { ambient, sun };
}
