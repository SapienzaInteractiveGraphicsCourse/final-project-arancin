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

  update() {
    this.distanceThisFrame = 0;
    this.speedRatio = getSpeedRatio(this.speed, this.performance.maxForwardSpeed);
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
