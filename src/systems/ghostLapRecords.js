import { RACE_MODES, RACE_PHASES } from "./RaceManager.js";

const GHOST_VERSION = 1;
const DEFAULT_SAMPLE_RATE = 10;
const MAX_SAMPLES = 2400;

export function getRaceGhostKey(recordKey) {
  return `${recordKey}:ghost`;
}

export function readGhostLap(storage, key) {
  if (!storage || !key) {
    return null;
  }

  try {
    return normalizeGhostLap(JSON.parse(storage.getItem(key) ?? "null"));
  } catch {
    return null;
  }
}

export function writeGhostLap(storage, key, ghostLap) {
  const normalized = normalizeGhostLap(ghostLap);

  if (!storage || !key || !normalized) {
    return null;
  }

  storage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export function createGhostLapRecorder({ enabled = false, sampleRate = DEFAULT_SAMPLE_RATE } = {}) {
  const interval = 1 / Math.max(1, sampleRate);
  let samples = [];
  let nextSampleTime = 0;
  let lastVehicleState = null;

  return {
    reset() {
      samples = [];
      nextSampleTime = 0;
      lastVehicleState = null;
    },
    update(raceState = {}, vehicleState = {}) {
      if (!enabled || raceState.mode !== RACE_MODES.TIME_TRIAL || raceState.phase !== RACE_PHASES.RUNNING) {
        return;
      }

      lastVehicleState = vehicleState;

      if (!Number.isFinite(raceState.lapTime) || raceState.lapTime < nextSampleTime) {
        return;
      }

      const sample = createSample(raceState.lapTime, vehicleState);
      if (!sample) {
        return;
      }

      samples.push(sample);
      if (samples.length > MAX_SAMPLES) {
        samples.shift();
      }
      nextSampleTime = raceState.lapTime + interval;
    },
    complete(lapTime, setup = {}) {
      if (!enabled || !Number.isFinite(lapTime) || lapTime <= 0) {
        this.reset();
        return null;
      }

      const finalSample = createSample(lapTime, lastVehicleState);
      if (finalSample) {
        samples.push(finalSample);
      }

      const ghostLap = normalizeGhostLap({
        version: GHOST_VERSION,
        trackId: setup.trackId,
        vehicleId: setup.vehicleId,
        lapTime,
        sampleRate,
        createdAt: Date.now(),
        samples
      });

      this.reset();
      return ghostLap;
    }
  };
}

export function sampleGhostLap(ghostLap, lapTime) {
  if (!isUsableGhostLap(ghostLap) || !Number.isFinite(lapTime)) {
    return null;
  }

  const samples = ghostLap.samples;
  if (lapTime < samples[0].t || lapTime > ghostLap.lapTime) {
    return null;
  }

  if (lapTime >= samples[samples.length - 1].t) {
    return samples[samples.length - 1];
  }

  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];

    if (lapTime < current.t || lapTime > next.t) {
      continue;
    }

    const span = Math.max(0.0001, next.t - current.t);
    const alpha = Math.min(1, Math.max(0, (lapTime - current.t) / span));

    return {
      t: lapTime,
      x: lerp(current.x, next.x, alpha),
      y: lerp(current.y, next.y, alpha),
      z: lerp(current.z, next.z, alpha),
      heading: interpolateAngle(current.heading, next.heading, alpha),
      speed: lerp(current.speed ?? 0, next.speed ?? 0, alpha)
    };
  }

  return null;
}

function normalizeGhostLap(value) {
  if (
    !value ||
    value.version !== GHOST_VERSION ||
    typeof value.trackId !== "string" ||
    typeof value.vehicleId !== "string" ||
    !Number.isFinite(value.lapTime) ||
    value.lapTime <= 0 ||
    !Array.isArray(value.samples)
  ) {
    return null;
  }

  const samples = value.samples
    .map(normalizeSample)
    .filter(Boolean)
    .filter((sample) => sample.t <= value.lapTime + 0.05)
    .sort((first, second) => first.t - second.t);

  if (samples.length < 2) {
    return null;
  }

  return {
    version: GHOST_VERSION,
    trackId: value.trackId,
    vehicleId: value.vehicleId,
    lapTime: value.lapTime,
    sampleRate: Number.isFinite(value.sampleRate) ? value.sampleRate : DEFAULT_SAMPLE_RATE,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    samples: samples.slice(0, MAX_SAMPLES)
  };
}

function isUsableGhostLap(value) {
  return (
    value &&
    value.version === GHOST_VERSION &&
    Number.isFinite(value.lapTime) &&
    value.lapTime > 0 &&
    Array.isArray(value.samples) &&
    value.samples.length >= 2
  );
}

function createSample(time, vehicleState = {}) {
  const position = vehicleState?.position;

  if (
    !Number.isFinite(time) ||
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z) ||
    !Number.isFinite(vehicleState.heading)
  ) {
    return null;
  }

  return normalizeSample({
    t: time,
    x: position.x,
    y: position.y,
    z: position.z,
    heading: vehicleState.heading,
    speed: Number.isFinite(vehicleState.speed) ? vehicleState.speed : 0
  });
}

function normalizeSample(sample) {
  if (
    !sample ||
    !Number.isFinite(sample.t) ||
    !Number.isFinite(sample.x) ||
    !Number.isFinite(sample.y) ||
    !Number.isFinite(sample.z) ||
    !Number.isFinite(sample.heading)
  ) {
    return null;
  }

  return {
    t: Math.max(0, sample.t),
    x: sample.x,
    y: sample.y,
    z: sample.z,
    heading: sample.heading,
    speed: Number.isFinite(sample.speed) ? sample.speed : 0
  };
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function interpolateAngle(start, end, alpha) {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * alpha;
}
