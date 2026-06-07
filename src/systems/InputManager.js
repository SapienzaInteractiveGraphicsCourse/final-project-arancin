export class InputManager {
  constructor(target = window) {
    this.target = target;
    this.heldKeys = new Set();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
  }

  handleKeyDown(event) {
    const key = normalizeKey(event);

    if (isHeldKey(key)) {
      this.heldKeys.add(key);
    }
  }

  handleKeyUp(event) {
    const key = normalizeKey(event);

    if (isHeldKey(key)) {
      this.heldKeys.delete(key);
    }
  }

  getHeldState() {
    return {
      accelerate: this.hasAnyHeldKey("accelerate"),
      brake: this.hasAnyHeldKey("brake"),
      steerLeft: this.hasAnyHeldKey("steerLeft"),
      steerRight: this.hasAnyHeldKey("steerRight"),
      handbrake: this.hasAnyHeldKey("handbrake")
    };
  }

  hasAnyHeldKey(action) {
    return HELD_KEY_MAP.get(action).some((key) => this.heldKeys.has(key));
  }

  consumeActions() {
    return {
      camera: false,
      lights: false,
      restart: false
    };
  }

  dispose() {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.heldKeys.clear();
    this.target = null;
  }
}

function normalizeKey(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

function isHeldKey(key) {
  return [...HELD_KEY_MAP.values()].some((keys) => keys.includes(key));
}

const HELD_KEY_MAP = new Map([
  ["accelerate", ["w", "ArrowUp"]],
  ["brake", ["s", "ArrowDown"]],
  ["steerLeft", ["a", "ArrowLeft"]],
  ["steerRight", ["d", "ArrowRight"]],
  ["handbrake", [" "]]
]);
