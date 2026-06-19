import { clearRuntimeTweens, updateRuntimeTweens } from "../../systems/tweenRuntime.js";

const TARGET_FRAME_RATE = 60;
const TARGET_FRAME_INTERVAL_MS = 1000 / TARGET_FRAME_RATE;
const FIXED_DELTA_TIME = 1 / TARGET_FRAME_RATE;
const FRAME_INTERVAL_EPSILON_MS = 0.25;
const FIXED_DELTA_MAX_INTERVAL_MS = TARGET_FRAME_INTERVAL_MS * 1.5;
const MAX_DELTA_TIME = 0.25;

export function createPreviewFrameLoop({ update, render, frameRateMonitor }) {
  let animationFrameId = 0;
  let nextFrameTimestamp = 0;
  let lastRenderedTimestamp = 0;

  function animate(timestamp) {
    animationFrameId = requestAnimationFrame(animate);

    if (nextFrameTimestamp === 0) {
      nextFrameTimestamp = timestamp;
    }

    if (timestamp + FRAME_INTERVAL_EPSILON_MS < nextFrameTimestamp) {
      return;
    }

    const skippedIntervals = Math.max(
      0,
      Math.floor((timestamp - nextFrameTimestamp) / TARGET_FRAME_INTERVAL_MS)
    );
    nextFrameTimestamp += (skippedIntervals + 1) * TARGET_FRAME_INTERVAL_MS;
    frameRateMonitor.update(timestamp, TARGET_FRAME_RATE);

    const renderedIntervalMs = lastRenderedTimestamp > 0
      ? timestamp - lastRenderedTimestamp
      : TARGET_FRAME_INTERVAL_MS;
    lastRenderedTimestamp = timestamp;
    const deltaTime = renderedIntervalMs <= FIXED_DELTA_MAX_INTERVAL_MS
      ? FIXED_DELTA_TIME
      : Math.min(renderedIntervalMs / 1000, MAX_DELTA_TIME);

    updateRuntimeTweens();
    update(deltaTime);
    render();
  }

  return {
    start() {
      animationFrameId = requestAnimationFrame(animate);
    },
    dispose() {
      cancelAnimationFrame(animationFrameId);
      clearRuntimeTweens();
    }
  };
}
