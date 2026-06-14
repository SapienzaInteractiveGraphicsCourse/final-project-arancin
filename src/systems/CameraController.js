import * as THREE from "three";

const CAMERA_MODES = {
  FOLLOW: "follow",
  TOP: "top",
  HOOD: "hood",
  ORBIT: "orbit"
};
const CAMERA_MODE_ORDER = [
  CAMERA_MODES.FOLLOW,
  CAMERA_MODES.TOP,
  CAMERA_MODES.HOOD,
  CAMERA_MODES.ORBIT
];
const CAMERA_TRANSITION_SECONDS = 0.42;
const SHAKE_DURATION_SECONDS = 0.28;
const SHAKE_FREQUENCY = 42;

export class CameraController {
  constructor(camera, { initialMode = CAMERA_MODES.FOLLOW } = {}) {
    this.camera = camera;
    this.mode = initialMode;
    this.cameraTarget = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3().copy(camera.position);
    this.cameraLookAt = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.transitionStartPosition = new THREE.Vector3();
    this.transitionStartLookAt = new THREE.Vector3();
    this.transitionTime = 0;
    this.transitionDuration = CAMERA_TRANSITION_SECONDS;
    this.isTransitioning = false;
    this.deltaTime = 0;
    this.orbitAngle = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = new THREE.Vector3();
    this.needsSnap = true;
  }

  update(deltaTime = 0, vehicleState = {}, trackInfo = {}) {
    this.deltaTime = Math.max(0, deltaTime);
    this.updateShake();

    if (this.mode === CAMERA_MODES.FOLLOW) {
      this.updateFollowCamera(vehicleState, trackInfo);
      return;
    }

    if (this.mode === CAMERA_MODES.TOP) {
      this.updateTopCamera(vehicleState);
      return;
    }

    if (this.mode === CAMERA_MODES.HOOD) {
      this.updateHoodCamera(vehicleState, trackInfo);
      return;
    }

    if (this.mode === CAMERA_MODES.ORBIT) {
      this.updateOrbitCamera(vehicleState);
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
    this.lookAtTarget();
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

  updateHoodCamera(vehicleState, trackInfo) {
    if (!vehicleState.position || !Number.isFinite(vehicleState.heading)) {
      return;
    }

    const targetY = trackInfo.spawn?.position?.y ?? vehicleState.position.y ?? 0;
    const forwardX = Math.sin(vehicleState.heading);
    const forwardZ = Math.cos(vehicleState.heading);
    const cameraHeight = 1.45;
    const cameraForwardOffset = 1.55;
    const lookAhead = 9.5;

    this.cameraTarget.set(
      vehicleState.position.x + forwardX * cameraForwardOffset,
      targetY + cameraHeight,
      vehicleState.position.z + forwardZ * cameraForwardOffset
    );
    this.lookTarget.set(
      vehicleState.position.x + forwardX * lookAhead,
      targetY + 1.2,
      vehicleState.position.z + forwardZ * lookAhead
    );
    this.applyCameraTarget(0.28, 0.32);
    this.lookAtTarget();
  }

  updateOrbitCamera(vehicleState) {
    if (!vehicleState.position) {
      return;
    }

    this.orbitAngle += this.deltaTime * 0.38;
    const radius = 15.5;
    const height = 8.2;

    this.cameraTarget.set(
      vehicleState.position.x + Math.sin(this.orbitAngle) * radius,
      vehicleState.position.y + height,
      vehicleState.position.z + Math.cos(this.orbitAngle) * radius
    );
    this.lookTarget.set(vehicleState.position.x, vehicleState.position.y + 1.25, vehicleState.position.z);
    this.applyCameraTarget(0.12, 0.18);
    this.lookAtTarget();
  }

  applyCameraTarget(positionLerp, lookLerp) {
    if (this.needsSnap) {
      this.camera.position.copy(this.cameraTarget);
      this.cameraPosition.copy(this.cameraTarget);
      this.cameraLookAt.copy(this.lookTarget);
      this.needsSnap = false;
      return;
    }

    if (this.isTransitioning) {
      this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + this.deltaTime);
      const alpha = smoothStep(this.transitionTime / this.transitionDuration);
      this.cameraPosition.lerpVectors(this.transitionStartPosition, this.cameraTarget, alpha);
      this.camera.position.copy(this.cameraPosition);
      this.cameraLookAt.lerpVectors(this.transitionStartLookAt, this.lookTarget, alpha);

      if (this.transitionTime >= this.transitionDuration) {
        this.isTransitioning = false;
      }

      return;
    }

    this.cameraPosition.lerp(this.cameraTarget, getDeltaAdjustedAlpha(positionLerp, this.deltaTime));
    this.camera.position.copy(this.cameraPosition);
    this.cameraLookAt.lerp(this.lookTarget, getDeltaAdjustedAlpha(lookLerp, this.deltaTime));
  }

  lookAtTarget() {
    this.camera.position.copy(this.cameraPosition);

    if (this.mode !== CAMERA_MODES.TOP && this.shakeTimer > 0) {
      this.camera.position.add(this.shakeOffset);
    }

    this.camera.lookAt(this.cameraLookAt);
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
      if (mode === CAMERA_MODES.ORBIT) {
        this.orbitAngle = Math.atan2(this.camera.position.x - this.cameraLookAt.x, this.camera.position.z - this.cameraLookAt.z);
      }
    }
  }

  startTransition() {
    this.transitionStartPosition.copy(this.cameraPosition);
    this.transitionStartLookAt.copy(this.cameraLookAt);
    this.transitionTime = 0;
    this.isTransitioning = !this.needsSnap;
  }

  applyShake(intensity = 1) {
    if (this.mode === CAMERA_MODES.TOP) {
      return;
    }

    if (this.shakeTimer > 0) {
      return;
    }

    this.shakeTimer = SHAKE_DURATION_SECONDS;
    this.shakeIntensity = Math.max(this.shakeIntensity, Math.max(0, intensity));
  }

  updateShake() {
    if (this.shakeTimer <= 0) {
      this.shakeOffset.set(0, 0, 0);
      this.shakeIntensity = 0;
      return;
    }

    this.shakeTimer = Math.max(0, this.shakeTimer - this.deltaTime);
    const fade = this.shakeTimer / SHAKE_DURATION_SECONDS;
    const strength = this.shakeIntensity * 0.12 * fade;
    const time = performance.now() * 0.001 * SHAKE_FREQUENCY;

    this.shakeOffset.set(
      Math.sin(time * 1.17) * strength,
      Math.cos(time * 0.93) * strength * 0.45,
      Math.sin(time * 0.71) * strength
    );
  }

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

function getDeltaAdjustedAlpha(frameAlpha, deltaTime) {
  const clampedAlpha = Math.min(1, Math.max(0, frameAlpha));

  if (clampedAlpha <= 0 || deltaTime <= 0) {
    return clampedAlpha;
  }

  return 1 - ((1 - clampedAlpha) ** (deltaTime * 60));
}
