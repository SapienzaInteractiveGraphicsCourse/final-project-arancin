import * as THREE from "three";

export function createMainCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  camera.position.set(8, 6, 10);
  camera.lookAt(0, 0.5, 0);

  return camera;
}
