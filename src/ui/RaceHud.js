import { RACE_PHASES } from "../systems/RaceManager.js";

const HUD_FIELDS = [
  { id: "mode", label: "Mode" },
  { id: "speed", label: "Speed" },
  { id: "lap", label: "Lap" },
  { id: "totalTime", label: "Total" },
  { id: "lapTime", label: "Lap Time" },
  { id: "checkpoint", label: "Checkpoint" },
  { id: "surface", label: "Surface" },
  { id: "status", label: "Status" },
  { id: "position", label: "Position" },
  { id: "gap", label: "Gap" }
];

export function createRaceHud() {
  const element = document.createElement("aside");
  element.className = "race-hud";
  element.setAttribute("aria-label", "Race status");

  const values = new Map();

  HUD_FIELDS.forEach((field) => {
    const row = document.createElement("div");
    row.className = "race-hud-field";
    row.dataset.hudField = field.id;

    const label = document.createElement("span");
    label.textContent = field.label;

    const value = document.createElement("strong");
    value.textContent = "--";

    row.append(label, value);
    element.appendChild(row);
    values.set(field.id, value);
  });

  return {
    element,
    update({ raceState, vehicleState, wrongWayState } = {}) {
      values.get("speed").textContent = formatSpeed(vehicleState?.speed);
      values.get("mode").textContent = formatMode(raceState?.mode);
      values.get("lap").textContent = formatLap(raceState);
      values.get("totalTime").textContent = formatRaceTime(raceState?.totalTime);
      values.get("lapTime").textContent = formatRaceTime(raceState?.lapTime);
      values.get("checkpoint").textContent = formatCheckpoint(raceState);
      values.get("surface").textContent = formatSurface(vehicleState?.surfaceType);
      values.get("status").textContent = formatStatus(raceState, wrongWayState);
      values.get("position").textContent = formatPosition(raceState);
      values.get("gap").textContent = formatGap(raceState);
    },
    remove() {
      element.remove();
    }
  };
}

function formatSpeed(speed) {
  if (!Number.isFinite(speed)) {
    return "0 km/h";
  }

  return `${Math.round(Math.abs(speed) * 3.6)} km/h`;
}

function formatMode(mode) {
  return mode === "time-trial" ? "Time Trial" : "Race";
}

function formatLap(raceState) {
  if (!raceState) {
    return "--";
  }

  return `${raceState.currentLap}/${raceState.totalLaps}`;
}

function formatCheckpoint(raceState) {
  if (!raceState || raceState.checkpointCount <= 0) {
    return "--";
  }

  return `${raceState.currentCheckpoint + 1}/${raceState.checkpointCount}`;
}

function formatSurface(surfaceType) {
  if (!surfaceType) {
    return "--";
  }

  return surfaceType.charAt(0).toUpperCase() + surfaceType.slice(1);
}

function formatStatus(raceState, wrongWayState) {
  if (wrongWayState?.warning) {
    return "Wrong Way";
  }

  if (!raceState) {
    return "Ready";
  }

  if (raceState.finished || raceState.phase === RACE_PHASES.FINISHED) {
    return "Finished";
  }

  if (raceState.phase === RACE_PHASES.COUNTDOWN) {
    return "Countdown";
  }

  if (raceState.phase === RACE_PHASES.RUNNING) {
    return raceState.mode === "time-trial" ? "Time Trial" : "Race";
  }

  return "Ready";
}

function formatPosition(raceState) {
  if (!raceState) {
    return "--";
  }

  if (raceState.mode === "race") {
    return `${raceState.position}/${raceState.participantCount}`;
  }

  return "1/1";
}

function formatGap(raceState) {
  if (!raceState) {
    return "--";
  }

  if (raceState.mode === "time-trial") {
    return `Best ${formatRaceTime(raceState.bestLapTime)}`;
  }

  return "--";
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
