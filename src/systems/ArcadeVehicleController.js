import * as THREE from "three";
import { Easing } from "@tweenjs/tween.js";
import { createRuntimeTween } from "./tweenRuntime.js";

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
const BARRIER_BOUNCE_MIN_SPEED = 3.5;
const BARRIER_BOUNCE_MIN_CORRECTION = 0.06;
const BARRIER_BOUNCE_COOLDOWN_SECONDS = 0.32;
const BARRIER_BOUNCE_INPUT_LOCK_SECONDS = 0.24;
const BARRIER_BOUNCE_DURATION_MS = 150;
const BARRIER_BOUNCE_SETTLE_DURATION_MS = 140;
const BARRIER_BOUNCE_MAX_DISTANCE = 1.35;
const BARRIER_REBOUND_MIN_DOT = 0.38;
const BARRIER_REBOUND_MIN_SPEED = 1.8;
const BARRIER_REBOUND_MAX_SPEED = 8.5;
const BARRIER_GLANCING_SPEED_MULTIPLIER = 0.58;

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
    this.bounceCooldownTimer = 0;
    this.collisionRecoveryTimer = 0;
    this.bounceTween = null;
    this.bounceRecoilTween = null;
    this.bounceState = {
      x: 0,
      z: 0
    };
    this.lastBounceState = { ...this.bounceState };
    this.bounceActive = false;

    this.reset(spawn);
  }

  reset(spawn = DEFAULT_SPAWN) {
    this.stopBounceTween();
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
    this.bounceCooldownTimer = 0;
    this.collisionRecoveryTimer = 0;
    this.bounceState = { x: 0, z: 0 };
    this.lastBounceState = { ...this.bounceState };
    this.bounceActive = false;
  }

  setPerformance(performance = {}) {
    this.performance = {
      ...this.performance,
      ...performance
    };
  }

  update(deltaTime = 0, inputState = {}, environmentState = {}) {
    this.bounceCooldownTimer = Math.max(0, this.bounceCooldownTimer - deltaTime);
    this.collisionRecoveryTimer = Math.max(0, this.collisionRecoveryTimer - deltaTime);
    const surfaceGrip = environmentState.surfaceGrip ?? 1;
    const speedLimitMultiplier = environmentState.speedLimitMultiplier ?? 1;
    const boostFactor = environmentState.boostFactor ?? 1;
    const maxForwardSpeed = this.performance.maxForwardSpeed * speedLimitMultiplier;
    const maxReverseSpeed = this.performance.maxReverseSpeed;

    this.surfaceGrip = surfaceGrip;
    this.surfaceType = environmentState.surfaceType ?? "asphalt";
    this.boostActive = boostFactor > 1;
    this.collided = Boolean(environmentState.collided);

    if (inputState.accelerate && this.collisionRecoveryTimer === 0) {
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

    const impactSpeed = this.speed;
    const handledBarrierImpact = this.maybeStartBarrierBounce(environmentState, impactSpeed);
    if (!handledBarrierImpact && environmentState.impact?.speedMultiplier) {
      this.speed *= clamp(environmentState.impact.speedMultiplier, 0, 1);
    }

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

    if (environmentState.correction) {
      this.position.x += Number(environmentState.correction.x) || 0;
      this.position.z += Number(environmentState.correction.z) || 0;
    }
    this.applyBounceDelta();

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
      collided: this.collided,
      bounceActive: this.bounceActive
    };
  }

  dispose() {
    this.stopBounceTween();
  }

  maybeStartBarrierBounce(environmentState, impactSpeed) {
    const impact = environmentState.impact;

    if (
      !impact ||
      impact.type !== "barrier" ||
      this.bounceCooldownTimer > 0 ||
      Math.abs(impactSpeed) < BARRIER_BOUNCE_MIN_SPEED
    ) {
      return false;
    }

    const normal = getImpactNormal(impact, environmentState.correction);
    const correctionMagnitude = getVector2Length(environmentState.correction);

    if (!normal || correctionMagnitude < BARRIER_BOUNCE_MIN_CORRECTION) {
      return false;
    }

    const headingForwardX = Math.sin(this.heading);
    const headingForwardZ = Math.cos(this.heading);
    const travelX = headingForwardX * Math.sign(impactSpeed || 1);
    const travelZ = headingForwardZ * Math.sign(impactSpeed || 1);
    const intoBarrierFactor = clamp(-(travelX * normal.x + travelZ * normal.z), 0, 1);
    const speedMagnitude = Math.abs(impactSpeed);
    const bounceDistance = clamp(
      correctionMagnitude * 0.9 + speedMagnitude * 0.035 * (0.35 + intoBarrierFactor * 0.65),
      BARRIER_BOUNCE_MIN_CORRECTION,
      BARRIER_BOUNCE_MAX_DISTANCE
    );
    const travelSign = impactSpeed >= 0 ? 1 : -1;

    this.stopBounceTween();
    this.bounceCooldownTimer = BARRIER_BOUNCE_COOLDOWN_SECONDS;
    this.collisionRecoveryTimer = BARRIER_BOUNCE_INPUT_LOCK_SECONDS;
    this.speed = intoBarrierFactor >= BARRIER_REBOUND_MIN_DOT
      ? -travelSign * clamp(
        speedMagnitude * (0.18 + intoBarrierFactor * 0.38),
        BARRIER_REBOUND_MIN_SPEED,
        BARRIER_REBOUND_MAX_SPEED
      )
      : impactSpeed * BARRIER_GLANCING_SPEED_MULTIPLIER;
    this.bounceState = { x: 0, z: 0 };
    this.lastBounceState = { ...this.bounceState };
    this.bounceActive = true;

    this.bounceRecoilTween = createRuntimeTween(this.bounceState)
      .to({
        x: normal.x * bounceDistance * 0.82,
        z: normal.z * bounceDistance * 0.82
      }, BARRIER_BOUNCE_SETTLE_DURATION_MS)
      .easing(Easing.Quadratic.InOut)
      .onComplete(() => {
        this.bounceActive = false;
      });

    this.bounceTween = createRuntimeTween(this.bounceState)
      .to({
        x: normal.x * bounceDistance,
        z: normal.z * bounceDistance
      }, BARRIER_BOUNCE_DURATION_MS)
      .easing(Easing.Quadratic.Out)
      .chain(this.bounceRecoilTween)
      .start();
    return true;
  }

  applyBounceDelta() {
    const hasPendingDelta =
      this.bounceState.x !== this.lastBounceState.x ||
      this.bounceState.z !== this.lastBounceState.z;

    if (!this.bounceActive && !hasPendingDelta) {
      return;
    }

    const deltaX = this.bounceState.x - this.lastBounceState.x;
    const deltaZ = this.bounceState.z - this.lastBounceState.z;

    this.position.x += deltaX;
    this.position.z += deltaZ;
    this.lastBounceState = { ...this.bounceState };
  }

  stopBounceTween() {
    if (this.bounceTween) {
      this.bounceTween.stopChainedTweens();
      this.bounceTween.stop();
      this.bounceTween = null;
    }
    if (this.bounceRecoilTween) {
      this.bounceRecoilTween.stop();
      this.bounceRecoilTween = null;
    }
  }
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

function getVector2Length(vector = {}) {
  return Math.hypot(Number(vector.x) || 0, Number(vector.z) || 0);
}

function getImpactNormal(impact, correction) {
  const normalX = Number(impact.normal?.x);
  const normalZ = Number(impact.normal?.z);

  if (Number.isFinite(normalX) && Number.isFinite(normalZ)) {
    const normalLength = Math.hypot(normalX, normalZ);

    if (normalLength > 0.000001) {
      return {
        x: normalX / normalLength,
        z: normalZ / normalLength
      };
    }
  }

  const correctionX = Number(correction?.x) || 0;
  const correctionZ = Number(correction?.z) || 0;
  const correctionLength = Math.hypot(correctionX, correctionZ);

  if (correctionLength <= 0.000001) {
    return null;
  }

  return {
    x: correctionX / correctionLength,
    z: correctionZ / correctionLength
  };
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
