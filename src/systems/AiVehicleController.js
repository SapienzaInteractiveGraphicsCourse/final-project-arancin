import { offsetProgress, samplePathAtProgress } from "../tracks/centerline.js";

const DEFAULT_MAX_FORWARD_SPEED = 30;
const DEFAULT_ACCELERATION = 10;
const DEFAULT_BRAKING = 24;
const DEFAULT_SPEED_FACTOR = 0.60;
const DEFAULT_CURVE_LOOKAHEAD_METERS = 14;
const DEFAULT_MIN_CURVE_SPEED_FACTOR = 0.52;
const DEFAULT_SPAWN_OFFSET_METERS = -11;
const DEFAULT_LATERAL_OFFSET_METERS = -1.35;
const COLLISION_SLOWDOWN_FACTOR = 0.18;
const COLLISION_SLOWDOWN_SECONDS = 1.25;

export class AiVehicleController {
  constructor(performance = {}, trackInfo = {}, {
    speedFactor = DEFAULT_SPEED_FACTOR,
    acceleration = DEFAULT_ACCELERATION,
    braking = DEFAULT_BRAKING,
    curveLookaheadMeters = DEFAULT_CURVE_LOOKAHEAD_METERS,
    minCurveSpeedFactor = DEFAULT_MIN_CURVE_SPEED_FACTOR,
    spawnOffsetMeters = DEFAULT_SPAWN_OFFSET_METERS,
    lateralOffsetMeters = DEFAULT_LATERAL_OFFSET_METERS
  } = {}) {
    this.performance = performance;
    this.speedFactor = speedFactor;
    this.acceleration = acceleration;
    this.braking = braking;
    this.curveLookaheadMeters = curveLookaheadMeters;
    this.minCurveSpeedFactor = minCurveSpeedFactor;
    this.spawnOffsetMeters = spawnOffsetMeters;
    this.lateralOffsetMeters = lateralOffsetMeters;
    this.progress = 0;
    this.lap = 1;
    this.speed = 0;
    this.collisionSlowdownTimer = 0;
    this.position = { x: 0, y: 0.42, z: 0 };
    this.heading = 0;
    this.hasCrossedStartLine = false;

    this.reset(trackInfo);
  }

  reset(trackInfo = {}) {
    const centerline = getCenterline(trackInfo);
    const spawnProgress = getSpawnProgress(trackInfo, centerline, this.spawnOffsetMeters);
    const sample = samplePathAtProgress(centerline, spawnProgress);

    this.progress = sample.progress;
    this.lap = 1;
    this.speed = 0;
    this.collisionSlowdownTimer = 0;
    this.hasCrossedStartLine = false;
    this.position = getOffsetPosition(sample, this.lateralOffsetMeters, trackInfo.spawn?.position?.y ?? 0.42);
    this.heading = sample.heading;
  }

  update(deltaTime = 0, trackInfo = {}) {
    const centerline = getCenterline(trackInfo);

    if (!centerline.length) {
      return this.getState();
    }

    const curveSpeedFactor = getCurveSpeedFactor(
      centerline,
      this.progress,
      this.curveLookaheadMeters,
      this.minCurveSpeedFactor
    );
    this.collisionSlowdownTimer = Math.max(0, this.collisionSlowdownTimer - Math.max(0, deltaTime));

    const collisionSpeedFactor = this.collisionSlowdownTimer > 0 ? COLLISION_SLOWDOWN_FACTOR : 1;
    const targetSpeed = getAiSpeed(this.performance, this.speedFactor) * curveSpeedFactor * collisionSpeedFactor;
    const speedStep = (targetSpeed >= this.speed ? this.acceleration : this.braking) * Math.max(0, deltaTime);
    this.speed = approachValue(this.speed, targetSpeed, speedStep);
    const nextProgress = offsetProgress(centerline, this.progress, this.speed * Math.max(0, deltaTime));

    if (nextProgress < this.progress && this.hasCrossedStartLine) {
      this.lap += 1;
    } else if (nextProgress < this.progress) {
      this.hasCrossedStartLine = true;
    }

    const sample = samplePathAtProgress(centerline, nextProgress);
    this.progress = sample.progress;
    this.position = getOffsetPosition(sample, this.lateralOffsetMeters, trackInfo.spawn?.position?.y ?? 0.42);
    this.heading = sample.heading;

    return this.getState();
  }

  getState() {
    return {
      position: this.position,
      heading: this.heading,
      progress: this.progress,
      lap: this.lap,
      speed: this.speed
    };
  }

  registerCollision() {
    this.collisionSlowdownTimer = COLLISION_SLOWDOWN_SECONDS;
  }
}

function getCenterline(trackInfo) {
  return Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];
}

function getSpawnProgress(trackInfo, centerline, spawnOffsetMeters) {
  if (!centerline.length) {
    return 0;
  }

  const startCheckpoint = Array.isArray(trackInfo.checkpoints) ? trackInfo.checkpoints[0] : null;
  const startProgress = findClosestCheckpointProgress(centerline, startCheckpoint);

  return offsetProgress(centerline, startProgress, spawnOffsetMeters);
}

function getAiSpeed(performance, speedFactor) {
  return (performance.maxForwardSpeed ?? DEFAULT_MAX_FORWARD_SPEED) * speedFactor;
}

function getOffsetPosition(sample, lateralOffsetMeters, y) {
  return {
    x: sample.x + Math.cos(sample.heading) * lateralOffsetMeters,
    y,
    z: sample.z - Math.sin(sample.heading) * lateralOffsetMeters
  };
}

function approachValue(currentValue, targetValue, maxStep) {
  if (currentValue < targetValue) {
    return Math.min(currentValue + maxStep, targetValue);
  }

  return Math.max(currentValue - maxStep, targetValue);
}

function getCurveSpeedFactor(centerline, progress, lookaheadMeters, minCurveSpeedFactor) {
  const current = samplePathAtProgress(centerline, progress);
  const ahead = samplePathAtProgress(centerline, offsetProgress(centerline, progress, lookaheadMeters));
  const headingDelta = Math.abs(getShortestAngleDelta(current.heading, ahead.heading));
  const curveSeverity = Math.min(headingDelta / (Math.PI / 2), 1);

  return 1 - curveSeverity * (1 - minCurveSpeedFactor);
}

function getShortestAngleDelta(currentAngle, targetAngle) {
  let delta = targetAngle - currentAngle;

  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

function findClosestCheckpointProgress(centerline, checkpoint) {
  if (!checkpoint?.position) {
    return 0;
  }

  let closestProgress = 0;
  let closestDistance = Infinity;

  centerline.forEach((point) => {
    const distance = Math.hypot(point.x - checkpoint.position.x, point.z - checkpoint.position.z);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestProgress = point.progress;
    }
  });

  return closestProgress;
}
