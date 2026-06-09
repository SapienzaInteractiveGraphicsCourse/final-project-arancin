const DEFAULT_ENVIRONMENT_STATE = {
  surfaceType: "asphalt",
  surfaceGrip: 1,
  speedLimitMultiplier: 1,
  boostFactor: 1,
  collided: false,
  correction: null,
  impact: null
};

export class TrackInteractionSystem {
  constructor() {
    this.lastState = { ...DEFAULT_ENVIRONMENT_STATE };
  }

  reset() {
    this.lastState = { ...DEFAULT_ENVIRONMENT_STATE };
  }

  update(playerState = {}, trackInfo = {}, options = {}) {
    this.lastState = normalizeEnvironmentState({
      ...DEFAULT_ENVIRONMENT_STATE,
      ...options.environmentState
    });

    return this.getState();
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

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}
