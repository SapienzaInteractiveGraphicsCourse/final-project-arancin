import { getOrderedCheckpoints, isInsideCheckpoint } from "./checkpointUtils.js";

export const RACE_PHASES = {
  IDLE: "idle",
  COUNTDOWN: "countdown",
  RUNNING: "running",
  FINISHED: "finished"
};

export const RACE_MODES = {
  RACE: "race",
  TIME_TRIAL: "time-trial"
};

const DEFAULT_COUNTDOWN_SECONDS = 3;

export class RaceManager {
  constructor({
    mode = RACE_MODES.RACE,
    totalLaps = getDefaultTotalLaps(mode),
    countdownSeconds = DEFAULT_COUNTDOWN_SECONDS,
    bestLapTime = null,
    aiEnabled = mode === RACE_MODES.RACE,
    opponentCount = aiEnabled ? 1 : 0,
    onLapComplete,
    onBestLap
  } = {}) {
    this.mode = normalizeMode(mode);
    this.totalLaps = normalizePositiveInteger(totalLaps, getDefaultTotalLaps(this.mode));
    this.countdownSeconds = Math.max(0, countdownSeconds);
    this.initialBestLapTime = normalizeLapTime(bestLapTime);
    this.aiEnabled = Boolean(aiEnabled);
    this.opponentCount = this.aiEnabled ? normalizeNonNegativeInteger(opponentCount, 1) : 0;
    this.onLapComplete = onLapComplete;
    this.onBestLap = onBestLap;

    this.reset();
  }

  startCountdown() {
    this.phase = this.countdownSeconds > 0 ? RACE_PHASES.COUNTDOWN : RACE_PHASES.RUNNING;
    this.countdown = this.countdownSeconds;
    this.finished = false;
  }

  startRace() {
    this.phase = RACE_PHASES.RUNNING;
    this.countdown = 0;
    this.finished = false;
  }

  reset() {
    this.phase = RACE_PHASES.IDLE;
    this.currentLap = 1;
    this.currentCheckpoint = 0;
    this.checkpointArmed = true;
    this.lapHasPassedSectors = false;
    this.checkpointCount = 0;
    this.totalTime = 0;
    this.lapTime = 0;
    this.lapTimes = [];
    this.bestLapTime = this.initialBestLapTime;
    this.position = 1;
    this.participantCount = 1 + this.opponentCount;
    this.countdown = this.countdownSeconds;
    this.finished = false;
  }

  update(deltaTime = 0, playerState = {}, trackInfo = {}) {
    const safeDeltaTime = Math.max(0, deltaTime);
    const checkpoints = getOrderedCheckpoints(trackInfo);
    this.checkpointCount = checkpoints.length;

    if (this.phase === RACE_PHASES.COUNTDOWN) {
      this.updateCountdown(safeDeltaTime);
      return this.getState();
    }

    if (this.phase !== RACE_PHASES.RUNNING) {
      return this.getState();
    }

    this.totalTime += safeDeltaTime;
    this.lapTime += safeDeltaTime;

    if (checkpoints.length > 0) {
      this.updateCheckpointProgress(playerState, checkpoints);
    }

    return this.getState();
  }

  getState() {
    return {
      phase: this.phase,
      mode: this.mode,
      totalLaps: this.totalLaps,
      currentLap: this.currentLap,
      currentCheckpoint: this.currentCheckpoint,
      checkpointCount: this.checkpointCount,
      totalTime: this.totalTime,
      lapTime: this.lapTime,
      lapTimes: this.lapTimes.map((lap) => ({ ...lap })),
      bestLapTime: this.bestLapTime,
      position: this.position,
      participantCount: this.participantCount,
      aiEnabled: this.aiEnabled,
      opponentCount: this.opponentCount,
      countdown: this.countdown,
      finished: this.finished
    };
  }

  updateCountdown(deltaTime) {
    this.countdown = Math.max(0, this.countdown - deltaTime);

    if (this.countdown === 0) {
      this.startRace();
    }
  }

  updateCheckpointProgress(playerState, checkpoints) {
    const nextCheckpoint = checkpoints[this.currentCheckpoint];

    if (!nextCheckpoint) {
      return;
    }

    if (!isInsideCheckpoint(playerState.position, nextCheckpoint)) {
      this.checkpointArmed = true;
      return;
    }

    if (!this.checkpointArmed) {
      return;
    }

    this.checkpointArmed = false;
    const crossedStartFinish = Boolean(nextCheckpoint.isStartFinish);

    if (crossedStartFinish && this.lapHasPassedSectors) {
      this.completeLap();
      return;
    }

    if (!crossedStartFinish) {
      this.lapHasPassedSectors = true;
    }

    this.currentCheckpoint = getNextCheckpointIndex(this.currentCheckpoint, checkpoints.length);
  }

  completeLap() {
    const completedLapTime = this.lapTime;
    const previousBestLapTime = this.bestLapTime;
    this.bestLapTime = previousBestLapTime === null
      ? completedLapTime
      : Math.min(previousBestLapTime, completedLapTime);

    const completedLap = {
      lap: this.currentLap,
      time: completedLapTime
    };
    this.lapTimes.push(completedLap);
    this.onLapComplete?.({ ...completedLap });

    if (this.bestLapTime !== previousBestLapTime) {
      this.onBestLap?.(this.bestLapTime);
    }

    this.lapTime = 0;
    this.currentCheckpoint = 0;
    this.checkpointArmed = false;
    this.lapHasPassedSectors = false;

    if (this.currentLap >= this.totalLaps) {
      this.phase = RACE_PHASES.FINISHED;
      this.finished = true;
      return;
    }

    this.currentLap += 1;
  }
}

function getDefaultTotalLaps(mode) {
  return normalizeMode(mode) === RACE_MODES.TIME_TRIAL ? 1 : 3;
}

function normalizeMode(mode) {
  return mode === RACE_MODES.TIME_TRIAL ? RACE_MODES.TIME_TRIAL : RACE_MODES.RACE;
}

function normalizePositiveInteger(value, fallback) {
  const normalized = Math.floor(Number(value));

  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const normalized = Math.floor(Number(value));

  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeLapTime(value) {
  const normalized = Number(value);

  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function getNextCheckpointIndex(currentCheckpoint, checkpointCount) {
  if (checkpointCount <= 0) {
    return 0;
  }

  return (currentCheckpoint + 1) % checkpointCount;
}
