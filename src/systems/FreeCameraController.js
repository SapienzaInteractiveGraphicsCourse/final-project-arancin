import * as THREE from "three";

const POINTER_SENSITIVITY = 0.0022;
const BASE_SPEED = 28;
const FAST_SPEED = 72;
const PITCH_LIMIT = Math.PI * 0.48;

const MOVE_KEYS = new Set(["w", "a", "s", "d", "q", "e", "Shift"]);
const EXIT_KEY = "Escape";

export class FreeCameraController {
  constructor(camera, domElement, { onExit } = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.onExit = onExit;
    this.enabled = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
  }

  enter() {
    if (this.enabled) {
      this.requestPointerLock();
      return;
    }

    this.syncAnglesFromCamera();
    this.enabled = true;
    this.keys.clear();
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    document.addEventListener("mousemove", this.handleMouseMove);
    this.requestPointerLock();
  }

  exit({ notify = true } = {}) {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.keys.clear();
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    document.removeEventListener("mousemove", this.handleMouseMove);

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }

    if (notify) {
      this.onExit?.();
    }
  }

  update(deltaTime) {
    if (!this.enabled) {
      return;
    }

    this.updateDirectionVectors();
    const movement = new THREE.Vector3();

    if (this.keys.has("w")) movement.add(this.forward);
    if (this.keys.has("s")) movement.sub(this.forward);
    if (this.keys.has("a")) movement.add(this.right);
    if (this.keys.has("d")) movement.sub(this.right);
    if (this.keys.has("e")) movement.add(this.up);
    if (this.keys.has("q")) movement.sub(this.up);

    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar((this.keys.has("Shift") ? FAST_SPEED : BASE_SPEED) * deltaTime);
      this.camera.position.add(movement);
    }

    this.camera.lookAt(this.camera.position.clone().add(this.forward));
  }

  dispose() {
    this.exit({ notify: false });
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    this.camera = null;
    this.domElement = null;
    this.onExit = null;
  }

  requestPointerLock() {
    this.domElement?.requestPointerLock?.();
  }

  syncAnglesFromCamera() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.yaw = Math.atan2(direction.x, direction.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
  }

  updateDirectionVectors() {
    const cosPitch = Math.cos(this.pitch);
    this.forward.set(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch
    ).normalize();
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  handleMouseMove(event) {
    if (!this.enabled) {
      return;
    }

    this.yaw -= event.movementX * POINTER_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * POINTER_SENSITIVITY,
      -PITCH_LIMIT,
      PITCH_LIMIT
    );
  }

  handlePointerLockChange() {
    if (this.enabled && document.pointerLockElement !== this.domElement) {
      this.exit();
    }
  }

  handleKeyDown(event) {
    const key = normalizeKey(event);

    if (key === EXIT_KEY) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.exit();
      return;
    }

    if (MOVE_KEYS.has(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.keys.add(key);
    }
  }

  handleKeyUp(event) {
    const key = normalizeKey(event);

    if (MOVE_KEYS.has(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.keys.delete(key);
    }
  }
}

function normalizeKey(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}
