import * as THREE from "three";

const DEFAULT_PERFORMANCE = {
  maxForwardSpeed: 32,
  maxReverseSpeed: 8,
  acceleration: 30,
  brakeAcceleration: 34,
  rollingFriction: 1.8,
  idleFriction: 2.8,
  handbrakeFriction: 8,
  turnRate: 1.95,
  steeringReturn: 8,
  steeringResponsiveness: 9
};

const DEFAULT_SPAWN = {
  position: new THREE.Vector3(0, 0.42, 0),
  heading: 0
};

export class ArcadeVehicleController {
  constructor(performance = {}, spawn = DEFAULT_SPAWN) {
    this.performance = {
      ...DEFAULT_PERFORMANCE,
      ...performance
    };
    this.position = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.steering = 0;
    this.boostTimer = 0;
    this.surfaceGrip = 1;
    this.surfaceType = "asphalt";
    this.distanceThisFrame = 0;
    this.speedRatio = 0;
    this.boostActive = false;
    this.collided = false;

    this.reset(spawn);
  }

  reset(spawn = DEFAULT_SPAWN) {
    this.position.copy(spawn.position ?? DEFAULT_SPAWN.position);
    this.heading = spawn.heading ?? DEFAULT_SPAWN.heading;
    this.speed = 0;
    this.steering = 0;
    this.boostTimer = 0;
    this.surfaceGrip = 1;
    this.surfaceType = "asphalt";
    this.distanceThisFrame = 0;
    this.speedRatio = 0;
    this.boostActive = false;
    this.collided = false;
  }

  setPerformance(performance = {}) {
    this.performance = {
      ...this.performance,
      ...performance
    };
  }

  update(deltaTime = 0, inputState = {}, environmentState = {}) {
    const surfaceGrip = environmentState.surfaceGrip ?? 1;
    const speedLimitMultiplier = environmentState.speedLimitMultiplier ?? 1;
    const boostFactor = environmentState.boostFactor ?? 1;
    const maxForwardSpeed = this.performance.maxForwardSpeed * speedLimitMultiplier;
    const maxReverseSpeed = this.performance.maxReverseSpeed;

    this.surfaceGrip = surfaceGrip;
    this.surfaceType = environmentState.surfaceType ?? "asphalt";
    this.boostActive = boostFactor > 1;
    this.collided = Boolean(environmentState.collided);

    if (inputState.accelerate) {
      this.speed += this.performance.acceleration * surfaceGrip * boostFactor * deltaTime;
    }

    if (inputState.brake) {
      const brakeDirection = this.speed > 0 ? -1 : -0.55;
      this.speed += this.performance.brakeAcceleration * brakeDirection * deltaTime;
    }

    const steeringTarget = Number(Boolean(inputState.steerLeft)) - Number(Boolean(inputState.steerRight));
    const steeringRate = steeringTarget === 0
      ? this.performance.steeringReturn
      : this.performance.steeringResponsiveness;
    this.steering = approach(this.steering, steeringTarget, steeringRate * deltaTime);

    const baseFriction = inputState.accelerate || inputState.brake
      ? this.performance.rollingFriction
      : this.performance.idleFriction;
    const friction = inputState.handbrake
      ? this.performance.handbrakeFriction
      : baseFriction;
    this.speed *= Math.exp(-friction * deltaTime);
    this.speed = clamp(this.speed, -maxReverseSpeed, maxForwardSpeed);
    this.speedRatio = getSpeedRatio(this.speed, this.performance.maxForwardSpeed);

    const reverseFactor = this.speed < 0 ? -1 : 1;
    const handbrakeTurnMultiplier = inputState.handbrake ? 1.25 : 1;
    const turnStrength =
      this.steering *
      this.performance.turnRate *
      surfaceGrip *
      this.speedRatio *
      handbrakeTurnMultiplier;
    this.heading += turnStrength * reverseFactor * deltaTime;

    const distance = this.speed * deltaTime;
    this.position.x += Math.sin(this.heading) * distance;
    this.position.z += Math.cos(this.heading) * distance;
    this.distanceThisFrame = Math.abs(distance);

    return this.getState();
  }

  getState() {
    return {
      position: this.position.clone(),
      heading: this.heading,
      speed: this.speed,
      steering: this.steering,
      distanceThisFrame: this.distanceThisFrame,
      speedRatio: this.speedRatio,
      surfaceType: this.surfaceType,
      surfaceGrip: this.surfaceGrip,
      boostTimer: this.boostTimer,
      boostActive: this.boostActive,
      collided: this.collided
    };
  }

  dispose() {}
}

function getSpeedRatio(speed, maxForwardSpeed) {
  if (!maxForwardSpeed) {
    return 0;
  }

  return Math.min(1, Math.abs(speed) / maxForwardSpeed);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function approach(current, target, maxDelta) {
  if (current < target) {
    return Math.min(target, current + maxDelta);
  }

  if (current > target) {
    return Math.max(target, current - maxDelta);
  }

  return current;
}
