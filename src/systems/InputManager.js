export class InputManager {
  constructor(target = window) {
    this.target = target;
  }

  getHeldState() {
    return {
      accelerate: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false
    };
  }

  consumeActions() {
    return {
      camera: false,
      lights: false,
      restart: false
    };
  }

  dispose() {
    this.target = null;
  }
}
