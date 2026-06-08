import { offsetProgress, samplePathAtProgress } from "../tracks/centerline.js";

const DEFAULT_MAX_FORWARD_SPEED = 30;
const DEFAULT_SPEED_FACTOR = 0.72;
const DEFAULT_SPAWN_OFFSET_METERS = -11;

export class AiVehicleController {
  constructor(performance = {}, trackInfo = {}, {
    speedFactor = DEFAULT_SPEED_FACTOR,
    spawnOffsetMeters = DEFAULT_SPAWN_OFFSET_METERS
  } = {}) {
    this.performance = performance;
    this.speedFactor = speedFactor;
    this.spawnOffsetMeters = spawnOffsetMeters;
    this.progress = 0;
    this.lap = 1;
    this.speed = 0;
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
    this.hasCrossedStartLine = false;
    this.position = {
      x: sample.x,
      y: trackInfo.spawn?.position?.y ?? 0.42,
      z: sample.z
    };
    this.heading = sample.heading;
  }

  update(deltaTime = 0, trackInfo = {}) {
    const centerline = getCenterline(trackInfo);

    if (!centerline.length) {
      return this.getState();
    }

    this.speed = getAiSpeed(this.performance, this.speedFactor);
    const nextProgress = offsetProgress(centerline, this.progress, this.speed * Math.max(0, deltaTime));

    if (nextProgress < this.progress && this.hasCrossedStartLine) {
      this.lap += 1;
    } else if (nextProgress < this.progress) {
      this.hasCrossedStartLine = true;
    }

    const sample = samplePathAtProgress(centerline, nextProgress);
    this.progress = sample.progress;
    this.position = {
      x: sample.x,
      y: trackInfo.spawn?.position?.y ?? 0.42,
      z: sample.z
    };
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
