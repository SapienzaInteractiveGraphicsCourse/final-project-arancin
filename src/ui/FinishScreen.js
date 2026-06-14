import { normalizeTrackTheme } from "./trackTheme.js";

export function createFinishScreen({ onRestart, onExitToSetup, trackId }) {
  const element = document.createElement("section");
  element.className = "finish-screen";
  element.dataset.trackTheme = normalizeTrackTheme(trackId);
  element.hidden = true;
  element.setAttribute("aria-label", "Race results");

  element.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "restart") {
      onRestart?.();
      return;
    }

    onExitToSetup?.();
  });

  return {
    element,
    setVisible(visible) {
      element.hidden = !visible;
    }
  };
}

export function updateFinishScreen(finishScreen, raceState, savedLapRecords, previousSignature) {
  if (!raceState.finished) {
    finishScreen.setVisible(false);
    return "";
  }

  const signature = [
    raceState.mode,
    raceState.totalTime,
    raceState.lapTimes.length,
    raceState.bestLapTime,
    savedLapRecords.length
  ].join(":");

  if (signature === previousSignature) {
    return previousSignature;
  }

  finishScreen.element.innerHTML = `
    <div class="finish-panel">
      <p class="finish-eyebrow">${formatMode(raceState.mode)}</p>
      <h2>${raceState.mode === "time-trial" ? "Time Trial Complete" : "Race Complete"}</h2>
      <div class="finish-summary">
        <div>
          <span>Total</span>
          <strong>${formatRaceTime(raceState.totalTime)}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>${formatRaceTime(raceState.bestLapTime)}</strong>
        </div>
        <div>
          <span>Position</span>
          <strong>${raceState.position}/${raceState.participantCount}</strong>
        </div>
      </div>
      <table class="finish-table">
        <caption>This Run</caption>
        <thead>
          <tr>
            <th>Lap</th>
            <th>Time</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          ${formatLapRows(raceState.lapTimes, raceState.bestLapTime)}
        </tbody>
      </table>
      <table class="finish-table">
        <caption>Saved Laps</caption>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Time</th>
            <th>Gap</th>
          </tr>
        </thead>
        <tbody>
          ${formatSavedLapRows(savedLapRecords, raceState.bestLapTime)}
        </tbody>
      </table>
      <div class="finish-actions">
        <button class="finish-button" type="button" data-action="restart">Restart</button>
        <button class="finish-button finish-button-secondary" type="button" data-action="setup">Main Menu</button>
      </div>
    </div>
  `;
  finishScreen.setVisible(true);
  return signature;
}

function formatSavedLapRows(savedLapRecords, bestLapTime) {
  if (!savedLapRecords.length) {
    return `
      <tr>
        <td colspan="3">No saved laps</td>
      </tr>
    `;
  }

  return savedLapRecords
    .map((record, index) => {
      const gap = Number.isFinite(bestLapTime) ? Math.max(0, record.time - bestLapTime) : 0;
      const bestClass = isSameTime(record.time, bestLapTime) ? " class=\"finish-best-lap\"" : "";

      return `
        <tr${bestClass}>
          <td>${index + 1}</td>
          <td>${formatRaceTime(record.time)}</td>
          <td>${formatGapTime(gap)}</td>
        </tr>
      `;
    })
    .join("");
}

function formatLapRows(lapTimes, bestLapTime) {
  if (!lapTimes.length) {
    return `
      <tr>
        <td colspan="3">No laps completed</td>
      </tr>
    `;
  }

  return lapTimes
    .map((lap) => {
      const gap = Number.isFinite(bestLapTime) ? Math.max(0, lap.time - bestLapTime) : 0;
      const bestClass = isSameTime(lap.time, bestLapTime) ? " class=\"finish-best-lap\"" : "";

      return `
        <tr${bestClass}>
          <td>${lap.lap}</td>
          <td>${formatRaceTime(lap.time)}</td>
          <td>${formatGapTime(gap)}</td>
        </tr>
      `;
    })
    .join("");
}

function formatMode(mode) {
  return mode === "time-trial" ? "Time Trial" : "Race";
}

function formatRaceTime(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const centiseconds = Math.floor((value % 1) * 100);

  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function formatGapTime(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "+0.00";
  }

  return `+${value.toFixed(2)}`;
}

function isSameTime(first, second) {
  return Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) < 0.005;
}
