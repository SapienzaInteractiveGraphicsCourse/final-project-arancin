import * as THREE from "three";

const CAMERA_MODES = {
  FOLLOW: "follow",
  TOP: "top"
};
const CAMERA_MODE_ORDER = [
  CAMERA_MODES.FOLLOW,
  CAMERA_MODES.TOP
];
const CAMERA_TRANSITION_SECONDS = 0.42;

export class CameraController {
  constructor(camera, { initialMode = CAMERA_MODES.FOLLOW } = {}) {
    this.camera = camera;
    this.mode = initialMode;
    this.cameraTarget = new THREE.Vector3();
    this.cameraLookAt = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.transitionStartPosition = new THREE.Vector3();
    this.transitionStartLookAt = new THREE.Vector3();
    this.transitionTime = 0;
    this.transitionDuration = CAMERA_TRANSITION_SECONDS;
    this.isTransitioning = false;
    this.deltaTime = 0;
    this.needsSnap = true;
  }

  update(deltaTime = 0, vehicleState = {}, trackInfo = {}) {
    this.deltaTime = Math.max(0, deltaTime);

    if (this.mode === CAMERA_MODES.FOLLOW) {
      this.updateFollowCamera(vehicleState, trackInfo);
      return;
    }

    if (this.mode === CAMERA_MODES.TOP) {
      this.updateTopCamera(vehicleState);
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

    this.lookTarget.set(vehicleState.position.x, targetY + 0.75, vehicleState.position.z);
    this.applyCameraTarget(0.08, 0.16);
    this.camera.lookAt(this.cameraLookAt);
  }

  updateTopCamera(vehicleState) {
    if (!vehicleState.position) {
      return;
    }

    this.cameraTarget.set(vehicleState.position.x, vehicleState.position.y + 42, vehicleState.position.z);
    this.lookTarget.set(vehicleState.position.x, vehicleState.position.y, vehicleState.position.z);
    this.applyCameraTarget(0.16, 1);
    this.camera.lookAt(this.cameraLookAt);
  }

  applyCameraTarget(positionLerp, lookLerp) {
    if (this.needsSnap) {
      this.camera.position.copy(this.cameraTarget);
      this.cameraLookAt.copy(this.lookTarget);
      this.needsSnap = false;
      return;
    }

    if (this.isTransitioning) {
      this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + this.deltaTime);
      const alpha = smoothStep(this.transitionTime / this.transitionDuration);
      this.camera.position.lerpVectors(this.transitionStartPosition, this.cameraTarget, alpha);
      this.cameraLookAt.lerpVectors(this.transitionStartLookAt, this.lookTarget, alpha);

      if (this.transitionTime >= this.transitionDuration) {
        this.isTransitioning = false;
      }

      return;
    }

    this.camera.position.lerp(this.cameraTarget, positionLerp);
    this.cameraLookAt.lerp(this.lookTarget, lookLerp);
  }

  nextMode() {
    const currentIndex = CAMERA_MODE_ORDER.indexOf(this.mode);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % CAMERA_MODE_ORDER.length;
    this.setMode(CAMERA_MODE_ORDER[nextIndex]);
    return this.mode;
  }

  setMode(mode) {
    if (CAMERA_MODE_ORDER.includes(mode) && mode !== this.mode) {
      this.startTransition();
      this.mode = mode;
    }
  }

  startTransition() {
    this.transitionStartPosition.copy(this.camera.position);
    this.transitionStartLookAt.copy(this.cameraLookAt);
    this.transitionTime = 0;
    this.isTransitioning = !this.needsSnap;
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

function smoothStep(alpha) {
  const clamped = Math.min(1, Math.max(0, alpha));

  return clamped * clamped * (3 - 2 * clamped);
}
