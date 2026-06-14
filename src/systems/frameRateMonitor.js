export function createFrameRateMonitor() {
  const sampleWindowMs = 500;
  let lastTimestamp = null;
  let sampleElapsed = 0;
  let sampleFrames = 0;
  let displayedFps = null;
  let smoothedFps = null;

  return {
    update(timestamp = 0, maxFps = Infinity) {
      if (!Number.isFinite(timestamp)) {
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        return;
      }

      const deltaMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (deltaMs <= 0) {
        return;
      }

      const instantFps = Math.min(maxFps, 1000 / deltaMs);
      smoothedFps = smoothedFps === null
        ? instantFps
        : smoothedFps * 0.86 + instantFps * 0.14;
      sampleElapsed += deltaMs;
      sampleFrames += 1;

      if (sampleElapsed >= sampleWindowMs) {
        displayedFps = Math.min(maxFps, sampleFrames * 1000 / sampleElapsed);
        sampleElapsed = 0;
        sampleFrames = 0;
      }
    },
    getState() {
      return {
        fps: displayedFps ?? smoothedFps
      };
    }
  };
}
