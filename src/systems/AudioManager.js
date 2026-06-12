const DEFAULT_MASTER_VOLUME = 0.18;
const COLLISION_COOLDOWN_SECONDS = 0.22;

const ENGINE_PROFILES = {
  kart: {
    oscillatorType: "triangle",
    harmonicType: "sine",
    baseFrequency: 82,
    frequencyRange: 145,
    throttleLift: 10,
    harmonicRatio: 1.88,
    harmonicGain: 0.16,
    noiseGain: 0.0065,
    noiseFilterBase: 760,
    noiseFilterRange: 1280,
    idleGain: 0.009,
    driveGain: 0.038,
    filterType: "bandpass",
    filterBase: 320,
    filterRange: 820,
    q: 0.68,
    response: 0.26
  },
  silvia: {
    oscillatorType: "triangle",
    harmonicType: "sine",
    baseFrequency: 76,
    frequencyRange: 118,
    throttleLift: 8,
    harmonicRatio: 2.18,
    harmonicGain: 0.1,
    noiseGain: 0.0032,
    noiseFilterBase: 720,
    noiseFilterRange: 1080,
    idleGain: 0.008,
    driveGain: 0.031,
    filterType: "lowpass",
    filterBase: 540,
    filterRange: 1020,
    q: 0.62,
    response: 0.24
  },
  porsche: {
    oscillatorType: "triangle",
    harmonicType: "sine",
    baseFrequency: 56,
    frequencyRange: 128,
    throttleLift: 12,
    harmonicRatio: 1.72,
    harmonicGain: 0.2,
    noiseGain: 0.0052,
    noiseFilterBase: 520,
    noiseFilterRange: 980,
    idleGain: 0.009,
    driveGain: 0.044,
    filterType: "lowpass",
    filterBase: 360,
    filterRange: 1240,
    q: 0.72,
    response: 0.2,
    pop: {
      chance: 0.038,
      cooldown: 0.15,
      releaseChance: 0.65,
      minSpeedRatio: 0.28
    }
  }
};

export class AudioManager {
  constructor({
    masterVolume = DEFAULT_MASTER_VOLUME,
    vehicleId = "kart"
  } = {}) {
    this.masterVolume = clamp(masterVolume, 0, 1);
    this.engineProfile = ENGINE_PROFILES[vehicleId] ?? ENGINE_PROFILES.kart;
    this.enabled = false;
    this.context = null;
    this.masterGain = null;
    this.engineOscillator = null;
    this.engineHarmonic = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineHarmonicGain = null;
    this.engineNoiseSource = null;
    this.engineNoiseGain = null;
    this.engineNoiseFilter = null;
    this.lastSpeedRatio = 0;
    this.collisionCooldown = 0;
    this.popCooldown = 0;
    this.wasAccelerating = false;
    this.disposed = false;
  }

  async enable() {
    if (this.disposed) {
      return false;
    }

    this.enabled = true;
    const context = this.ensureContext();

    if (!context) {
      this.enabled = false;
      return false;
    }

    try {
      if (context.state === "suspended") {
        await context.resume();
      }

      this.startEngineLoop();
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  disable() {
    this.enabled = false;
    this.stopEngineLoop();
  }

  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    }

    return this.enable();
  }

  setMasterVolume(volume) {
    this.masterVolume = clamp(volume, 0, 1);

    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.context.currentTime, 0.04);
    }
  }

  update(deltaTime = 0, vehicleState = {}, inputState = {}) {
    this.collisionCooldown = Math.max(0, this.collisionCooldown - Math.max(0, deltaTime));
    this.popCooldown = Math.max(0, this.popCooldown - Math.max(0, deltaTime));

    if (!this.enabled || !this.context || !this.engineGain || !this.engineOscillator) {
      return { enginePop: false };
    }

    const speedRatio = clamp(Math.abs(vehicleState.speedRatio ?? 0), 0, 1);
    const speed = Math.abs(vehicleState.speed ?? 0);
    const response = this.engineProfile.response ?? 0.28;
    const smoothing = clamp(deltaTime / response, 0, 1);

    this.lastSpeedRatio += (speedRatio - this.lastSpeedRatio) * smoothing;
    this.updateProceduralEngine(this.context.currentTime, speed, this.lastSpeedRatio, inputState);
    return {
      enginePop: this.updateEnginePops(this.context.currentTime, this.lastSpeedRatio, inputState)
    };
  }

  playCountdown(step = 0) {
    const frequency = step <= 1 ? 660 : 520;
    this.playTone({ frequency, duration: 0.09, gain: 0.1, type: "square" });
  }

  playCheckpoint() {
    this.playTone({ frequency: 740, duration: 0.08, gain: 0.1, type: "triangle" });
    window.setTimeout(() => {
      this.playTone({ frequency: 980, duration: 0.07, gain: 0.07, type: "triangle" });
    }, 70);
  }

  playCollision() {
    if (this.collisionCooldown > 0) {
      return;
    }

    this.collisionCooldown = COLLISION_COOLDOWN_SECONDS;
    this.playNoiseBurst({ duration: 0.12, gain: 0.1 });
  }

  playBoost() {
    if (!this.enabled || !this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const time = this.context.currentTime;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(220, time);
    oscillator.frequency.exponentialRampToValueAtTime(760, time + 0.2);
    filter.type = "bandpass";
    filter.frequency.value = 820;
    filter.Q.value = 0.85;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.075, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(time);
    oscillator.stop(time + 0.26);
  }

  dispose() {
    this.disposed = true;
    this.disable();

    if (this.context) {
      this.context.close();
    }

    this.context = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.context) {
      return this.context;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.context.destination);

    return this.context;
  }

  startEngineLoop() {
    if (!this.enabled || !this.context || this.engineOscillator || !this.masterGain) {
      return;
    }

    const profile = this.engineProfile;

    this.engineOscillator = this.context.createOscillator();
    this.engineHarmonic = this.context.createOscillator();
    this.engineGain = this.context.createGain();
    this.engineFilter = this.context.createBiquadFilter();
    this.engineHarmonicGain = this.context.createGain();
    this.engineNoiseSource = this.context.createBufferSource();
    this.engineNoiseGain = this.context.createGain();
    this.engineNoiseFilter = this.context.createBiquadFilter();

    this.engineOscillator.type = profile.oscillatorType ?? "triangle";
    this.engineHarmonic.type = profile.harmonicType ?? "sine";
    this.engineOscillator.frequency.value = profile.baseFrequency;
    this.engineHarmonic.frequency.value = profile.baseFrequency * profile.harmonicRatio;
    this.engineFilter.type = profile.filterType;
    this.engineFilter.frequency.value = profile.filterBase;
    this.engineFilter.Q.value = profile.q;
    this.engineHarmonicGain.gain.value = profile.harmonicGain;
    this.engineGain.gain.value = profile.idleGain * 0.35;
    this.engineNoiseSource.buffer = createNoiseBuffer(this.context);
    this.engineNoiseSource.loop = true;
    this.engineNoiseFilter.type = "bandpass";
    this.engineNoiseFilter.frequency.value = profile.noiseFilterBase;
    this.engineNoiseFilter.Q.value = 0.85;
    this.engineNoiseGain.gain.value = profile.noiseGain * 0.2;

    this.engineOscillator.connect(this.engineFilter);
    this.engineHarmonic.connect(this.engineHarmonicGain);
    this.engineHarmonicGain.connect(this.engineFilter);
    this.engineNoiseSource.connect(this.engineNoiseFilter);
    this.engineNoiseFilter.connect(this.engineNoiseGain);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineNoiseGain.connect(this.masterGain);

    this.engineOscillator.start();
    this.engineHarmonic.start();
    this.engineNoiseSource.start();
  }

  stopEngineLoop() {
    if (!this.context) {
      this.clearEngineNodes();
      return;
    }

    const time = this.context.currentTime;
    const stopTime = time + 0.08;

    this.engineGain?.gain.setTargetAtTime(0.0001, time, 0.02);
    this.engineNoiseGain?.gain.setTargetAtTime(0.0001, time, 0.02);

    try {
      this.engineOscillator?.stop(stopTime);
      this.engineHarmonic?.stop(stopTime);
      this.engineNoiseSource?.stop(stopTime);
    } catch {
      // Source nodes can only be stopped once.
    }

    this.clearEngineNodes();
  }

  clearEngineNodes() {
    this.engineOscillator = null;
    this.engineHarmonic = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineHarmonicGain = null;
    this.engineNoiseSource = null;
    this.engineNoiseGain = null;
    this.engineNoiseFilter = null;
  }

  updateProceduralEngine(time, speed, speedRatio, inputState) {
    const profile = this.engineProfile;
    const accelerating = Boolean(inputState.accelerate);
    const braking = Boolean(inputState.brake);
    const moving = speed > 0.12;
    const load = accelerating ? 1 : braking ? 0.18 : moving ? 0.46 : 0.12;
    const response = profile.response ?? 0.28;
    const pitchLoad = speedRatio * 0.82 + load * 0.18;
    const targetFrequency = profile.baseFrequency
      + pitchLoad * profile.frequencyRange
      + (accelerating ? profile.throttleLift : 0);
    const targetGain = moving || accelerating
      ? profile.idleGain + pitchLoad * (profile.driveGain - profile.idleGain)
      : profile.idleGain * 0.42;
    const targetFilter = profile.filterBase + pitchLoad * profile.filterRange;
    const targetNoiseFilter = profile.noiseFilterBase + pitchLoad * profile.noiseFilterRange;
    const targetNoiseGain = profile.noiseGain * (accelerating ? 1 : moving ? 0.45 : 0.18);

    this.engineOscillator.frequency.setTargetAtTime(targetFrequency, time, response);
    this.engineHarmonic.frequency.setTargetAtTime(targetFrequency * profile.harmonicRatio, time, response);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, time, response * 1.1);
    this.engineGain.gain.setTargetAtTime(targetGain, time, response * 1.2);
    this.engineHarmonicGain.gain.setTargetAtTime(
      profile.harmonicGain * (0.55 + pitchLoad * 0.45),
      time,
      response * 1.2
    );
    this.engineNoiseFilter.frequency.setTargetAtTime(targetNoiseFilter, time, response * 1.1);
    this.engineNoiseGain.gain.setTargetAtTime(targetNoiseGain, time, response * 1.3);
  }

  updateEnginePops(time, speedRatio, inputState) {
    const pop = this.engineProfile.pop;
    const accelerating = Boolean(inputState.accelerate);
    const releasedThrottle = this.wasAccelerating && !accelerating;

    this.wasAccelerating = accelerating;

    if (!pop || this.popCooldown > 0 || speedRatio < pop.minSpeedRatio) {
      return false;
    }

    const shouldPop = releasedThrottle
      ? Math.random() < pop.releaseChance
      : accelerating && Math.random() < pop.chance;

    if (!shouldPop) {
      return false;
    }

    this.popCooldown = pop.cooldown + Math.random() * 0.12;
    this.playEnginePop(time, speedRatio);
    return true;
  }

  playEnginePop(time, speedRatio) {
    if (!this.context || !this.masterGain) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const duration = 0.035 + speedRatio * 0.025;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      const fade = 1 - index / frameCount;
      data[index] = (Math.random() * 2 - 1) * fade * fade;
    }

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 520 + speedRatio * 260;
    filter.Q.value = 1.25;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.035 + speedRatio * 0.018, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  playTone({ frequency, duration, gain, type = "sine" }) {
    if (!this.enabled || !this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const toneGain = this.context.createGain();
    const time = this.context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    toneGain.gain.setValueAtTime(0.0001, time);
    toneGain.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(toneGain);
    toneGain.connect(this.masterGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  playNoiseBurst({ duration, gain }) {
    if (!this.enabled || !this.context || !this.masterGain) {
      return;
    }

    const sampleRate = this.context.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();
    const time = this.context.currentTime;

    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 340;
    noiseGain.gain.setValueAtTime(gain, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    source.start(time);
    source.stop(time + duration);
  }
}

function createNoiseBuffer(context) {
  const frameCount = context.sampleRate * 2;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const next = Math.random() * 2 - 1;
    previous = previous * 0.88 + next * 0.12;
    data[index] = previous * 0.22;
  }

  return buffer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
