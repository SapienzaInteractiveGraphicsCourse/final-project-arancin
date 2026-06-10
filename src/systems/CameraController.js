import * as THREE from "three";

const CAMERA_MODES = {
  FOLLOW: "follow"
};

export class CameraController {
  constructor(camera, { initialMode = CAMERA_MODES.FOLLOW } = {}) {
    this.camera = camera;
    this.mode = initialMode;
    this.cameraTarget = new THREE.Vector3();
    this.cameraLookAt = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
  }

  update(deltaTime = 0, vehicleState = {}, trackInfo = {}) {
    if (this.mode === CAMERA_MODES.FOLLOW) {
      this.updateFollowCamera(vehicleState, trackInfo);
    }
  }

  updateFollowCamera(vehicleState, trackInfo) {
    if (!vehicleState.position || !Number.isFinite(vehicleState.heading)) {
      return;
    }

    const targetY = trackInfo.spawn?.position?.y ?? vehicleState.position.y ?? 0;
    const cameraDistance = 9.5;
    const cameraHeight = 6.2;

    this.cameraTarget.set(
      vehicleState.position.x + Math.sin(vehicleState.heading + Math.PI) * cameraDistance,
      targetY + cameraHeight,
      vehicleState.position.z + Math.cos(vehicleState.heading + Math.PI) * cameraDistance
    );

    this.camera.position.lerp(this.cameraTarget, 0.08);
    this.lookTarget.set(vehicleState.position.x, targetY + 0.75, vehicleState.position.z);
    this.cameraLookAt.lerp(this.lookTarget, 0.16);
    this.camera.lookAt(this.cameraLookAt);
  }

  nextMode() {
    return this.mode;
  }

  setMode(mode) {
    if (mode === CAMERA_MODES.FOLLOW) {
      this.mode = mode;
    }
  }

  applyShake() {}

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  getState() {
    return {
      mode: this.mode
    };
  }

  dispose() {}
}
