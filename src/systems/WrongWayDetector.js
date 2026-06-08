import { findClosestProgress, headingFromLookahead } from "../tracks/centerline.js";

const DEFAULT_HEADING_DOT_THRESHOLD = -0.45;
const DEFAULT_MIN_SPEED = 2.5;
const DEFAULT_TRIGGER_SECONDS = 1.1;
const DEFAULT_LOOKAHEAD_METERS = 4;

export class WrongWayDetector {
  constructor({
    headingDotThreshold = DEFAULT_HEADING_DOT_THRESHOLD,
    minSpeed = DEFAULT_MIN_SPEED,
    triggerSeconds = DEFAULT_TRIGGER_SECONDS,
    lookAheadMeters = DEFAULT_LOOKAHEAD_METERS
  } = {}) {
    this.headingDotThreshold = headingDotThreshold;
    this.minSpeed = minSpeed;
    this.triggerSeconds = triggerSeconds;
    this.lookAheadMeters = lookAheadMeters;
    this.reset();
  }

  reset() {
    this.wrongWayTime = 0;
    this.warning = false;
    this.progress = 0;
    this.headingDot = 1;
  }

  update(deltaTime = 0, vehicleState = {}, trackInfo = {}) {
    const centerline = Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];

    if (!centerline.length || !vehicleState.position) {
      this.reset();
      return this.getState();
    }

    this.progress = findClosestProgress(centerline, vehicleState.position.x, vehicleState.position.z);
    const trackHeading = headingFromLookahead(centerline, this.progress, this.lookAheadMeters);
    this.headingDot = getHeadingDot(vehicleState.heading, trackHeading);
    const movingEnough = Math.abs(vehicleState.speed ?? 0) >= this.minSpeed;
    const currentlyWrongWay = movingEnough && this.headingDot < this.headingDotThreshold;

    this.wrongWayTime = currentlyWrongWay
      ? this.wrongWayTime + Math.max(0, deltaTime)
      : 0;
    this.warning = this.wrongWayTime >= this.triggerSeconds;

    return this.getState();
  }

  getState() {
    return {
      warning: this.warning,
      wrongWayTime: this.wrongWayTime,
      progress: this.progress,
      headingDot: this.headingDot
    };
  }
}

function getHeadingDot(vehicleHeading, trackHeading) {
  const vehicleForwardX = Math.sin(vehicleHeading);
  const vehicleForwardZ = Math.cos(vehicleHeading);
  const trackForwardX = Math.sin(trackHeading);
  const trackForwardZ = Math.cos(trackHeading);

  return vehicleForwardX * trackForwardX + vehicleForwardZ * trackForwardZ;
}
