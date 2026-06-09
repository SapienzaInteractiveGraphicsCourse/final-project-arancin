import { findClosestProgress, samplePathAtProgress } from "../tracks/centerline.js";

const DEFAULT_ENVIRONMENT_STATE = {
  surfaceType: "asphalt",
  surfaceGrip: 1,
  speedLimitMultiplier: 1,
  boostFactor: 1,
  collided: false,
  correction: null,
  impact: null
};
const OFF_ROAD_GRIP = 0.45;
const OFF_ROAD_SPEED_LIMIT_MULTIPLIER = 0.45;
const ROAD_EDGE_TOLERANCE_METERS = 0.35;
const BOOST_FACTOR = 1.75;
const BOOST_SPEED_LIMIT_MULTIPLIER = 1.18;
const BOOST_DURATION_SECONDS = 0.75;
const BOOST_COOLDOWN_SECONDS = 1.1;
const PLAYER_COLLISION_RADIUS = 0.9;
const BARRIER_CORRECTION_PADDING = 0.04;
const BARRIER_IMPACT_SPEED_MULTIPLIER = 0.35;

export class TrackInteractionSystem {
  constructor() {
    this.lastState = { ...DEFAULT_ENVIRONMENT_STATE };
    this.boostTimer = 0;
    this.boostCooldownTimer = 0;
  }

  reset() {
    this.lastState = { ...DEFAULT_ENVIRONMENT_STATE };
    this.boostTimer = 0;
    this.boostCooldownTimer = 0;
  }

  update(playerState = {}, trackInfo = {}, options = {}) {
    const deltaTime = Math.max(0, Number(options.deltaTime) || 0);
    const surfaceState = getSurfaceState(playerState, trackInfo);
    const barrierState = getBarrierState(playerState, trackInfo);
    const boostState = this.updateBoostState(deltaTime, playerState, trackInfo, {
      ...options,
      collided: Boolean(options.collided || barrierState.collided)
    });

    this.lastState = normalizeEnvironmentState({
      ...DEFAULT_ENVIRONMENT_STATE,
      ...surfaceState,
      ...boostState,
      ...barrierState,
      ...options.environmentState
    });

    return this.getState();
  }

  updateBoostState(deltaTime, playerState, trackInfo, options) {
    this.boostTimer = Math.max(0, this.boostTimer - deltaTime);
    this.boostCooldownTimer = Math.max(0, this.boostCooldownTimer - deltaTime);

    if (options.environmentState?.collided || options.collided) {
      this.boostTimer = 0;
    }

    if (this.boostTimer === 0 && this.boostCooldownTimer === 0 && isInsideBoostPad(playerState, trackInfo)) {
      this.boostTimer = BOOST_DURATION_SECONDS;
      this.boostCooldownTimer = BOOST_COOLDOWN_SECONDS;
    }

    if (this.boostTimer === 0) {
      return {};
    }

    return {
      boostFactor: BOOST_FACTOR,
      speedLimitMultiplier: BOOST_SPEED_LIMIT_MULTIPLIER
    };
  }

  getState() {
    return {
      ...this.lastState,
      correction: this.lastState.correction ? { ...this.lastState.correction } : null,
      impact: this.lastState.impact ? { ...this.lastState.impact } : null
    };
  }
}

function normalizeEnvironmentState(environmentState) {
  return {
    surfaceType: environmentState.surfaceType ?? DEFAULT_ENVIRONMENT_STATE.surfaceType,
    surfaceGrip: normalizePositiveNumber(environmentState.surfaceGrip, DEFAULT_ENVIRONMENT_STATE.surfaceGrip),
    speedLimitMultiplier: normalizePositiveNumber(
      environmentState.speedLimitMultiplier,
      DEFAULT_ENVIRONMENT_STATE.speedLimitMultiplier
    ),
    boostFactor: normalizePositiveNumber(environmentState.boostFactor, DEFAULT_ENVIRONMENT_STATE.boostFactor),
    collided: Boolean(environmentState.collided),
    correction: environmentState.correction ?? null,
    impact: environmentState.impact ?? null
  };
}

function getSurfaceState(playerState, trackInfo) {
  const centerline = Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];
  const roadSegments = Array.isArray(trackInfo.roadSegments) ? trackInfo.roadSegments : [];
  const roadHalfWidth = Number(trackInfo.roadHalfWidth);

  if (!Number.isFinite(roadHalfWidth) || roadHalfWidth <= 0 || !playerState.position) {
    return {};
  }

  const distanceFromCenter = roadSegments.length > 0
    ? getClosestRoadSegmentDistance(playerState.position, roadSegments)
    : getClosestCenterlineDistance(playerState.position, centerline);
  const isOffRoad = distanceFromCenter > roadHalfWidth + ROAD_EDGE_TOLERANCE_METERS;

  if (!isOffRoad) {
    return {};
  }

  return {
    surfaceType: getOffRoadSurfaceType(trackInfo),
    surfaceGrip: OFF_ROAD_GRIP,
    speedLimitMultiplier: OFF_ROAD_SPEED_LIMIT_MULTIPLIER
  };
}

function getClosestCenterlineDistance(position, centerline) {
  if (!centerline.length) {
    return 0;
  }

  const progress = findClosestProgress(centerline, position.x, position.z);
  const sample = samplePathAtProgress(centerline, progress);

  return Math.hypot(position.x - sample.x, position.z - sample.z);
}

function getClosestRoadSegmentDistance(position, roadSegments) {
  let closestDistance = Infinity;

  roadSegments.forEach((segment) => {
    const distance = getPointToSegmentDistance(position, segment.start, segment.end);
    closestDistance = Math.min(closestDistance, distance);
  });

  return closestDistance;
}

function getPointToSegmentDistance(position, start, end) {
  if (!start || !end) {
    return Infinity;
  }

  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;

  if (lengthSquared <= 0.000001) {
    return Math.hypot(position.x - start.x, position.z - start.z);
  }

  const pointX = position.x - start.x;
  const pointZ = position.z - start.z;
  const t = Math.min(1, Math.max(0, (pointX * segmentX + pointZ * segmentZ) / lengthSquared));
  const closestX = start.x + segmentX * t;
  const closestZ = start.z + segmentZ * t;

  return Math.hypot(position.x - closestX, position.z - closestZ);
}

function getOffRoadSurfaceType(trackInfo) {
  if (trackInfo.skyboxTheme === "beach" || trackInfo.particleProfile === "sand") {
    return "sand";
  }

  return "grass";
}

function isInsideBoostPad(playerState, trackInfo) {
  const boostPads = Array.isArray(trackInfo.boostPads) ? trackInfo.boostPads : [];

  if (!playerState.position || boostPads.length === 0) {
    return false;
  }

  return boostPads.some((boostPad) => {
    if (!boostPad?.position) {
      return false;
    }

    const radius = normalizePositiveNumber(boostPad.radius, 0);

    if (radius <= 0) {
      return false;
    }

    const distance = Math.hypot(
      playerState.position.x - boostPad.position.x,
      playerState.position.z - boostPad.position.z
    );

    return distance <= radius;
  });
}

function getBarrierState(playerState, trackInfo) {
  const barrierColliders = Array.isArray(trackInfo.barrierColliders) ? trackInfo.barrierColliders : [];

  if (!playerState.position || barrierColliders.length === 0) {
    return {};
  }

  const correction = barrierColliders.reduce((totalCorrection, collider) => {
    const colliderCorrection = getBarrierCorrection(playerState.position, collider);

    if (!colliderCorrection) {
      return totalCorrection;
    }

    totalCorrection.x += colliderCorrection.x;
    totalCorrection.z += colliderCorrection.z;
    return totalCorrection;
  }, { x: 0, z: 0 });

  if (Math.abs(correction.x) < 0.000001 && Math.abs(correction.z) < 0.000001) {
    return {};
  }

  return {
    collided: true,
    correction,
    impact: {
      type: "barrier",
      speedMultiplier: BARRIER_IMPACT_SPEED_MULTIPLIER
    }
  };
}

function getBarrierCorrection(position, collider) {
  if (!collider?.center) {
    return null;
  }

  const rotationY = Number(collider.rotationY) || 0;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const deltaX = position.x - collider.center.x;
  const deltaZ = position.z - collider.center.z;
  const localX = deltaX * cos - deltaZ * sin;
  const localZ = deltaX * sin + deltaZ * cos;
  const expandedHalfLength = normalizePositiveNumber(collider.halfLength, 0) + PLAYER_COLLISION_RADIUS;
  const expandedHalfThickness = normalizePositiveNumber(collider.halfThickness, 0) + PLAYER_COLLISION_RADIUS;
  const penetrationX = expandedHalfLength - Math.abs(localX);
  const penetrationZ = expandedHalfThickness - Math.abs(localZ);

  if (penetrationX <= 0 || penetrationZ <= 0) {
    return null;
  }

  const useLengthAxis = penetrationX < penetrationZ;
  const localNormalX = useLengthAxis ? Math.sign(localX || 1) : 0;
  const localNormalZ = useLengthAxis ? 0 : Math.sign(localZ || 1);
  const correctionDistance = (useLengthAxis ? penetrationX : penetrationZ) + BARRIER_CORRECTION_PADDING;

  return {
    x: (localNormalX * cos + localNormalZ * sin) * correctionDistance,
    z: (-localNormalX * sin + localNormalZ * cos) * correctionDistance
  };
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}
