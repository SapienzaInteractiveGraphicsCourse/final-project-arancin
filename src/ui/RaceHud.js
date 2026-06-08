import { RACE_PHASES } from "../systems/RaceManager.js";

const HUD_GROUPS = [
  {
    className: "race-hud-top-left",
    fields: [
      { id: "speed", className: "race-hud-speed" },
      { id: "totalTime", className: "race-hud-time" },
      { id: "map", className: "race-hud-chip race-hud-map" },
      { id: "status", className: "race-hud-chip race-hud-status" }
    ]
  },
  {
    className: "race-hud-position",
    fields: [
      { id: "position", className: "race-hud-place" },
      { id: "lap", className: "race-hud-chip race-hud-lap" },
      { id: "checkpoint", className: "race-hud-chip race-hud-checkpoint" },
      { id: "gap", className: "race-hud-chip race-hud-gap" }
    ]
  }
];

export function createRaceHud() {
  const element = document.createElement("aside");
  element.className = "race-hud";
  element.setAttribute("aria-label", "Race status");

  const values = new Map();

  HUD_GROUPS.forEach((group) => {
    const panel = document.createElement("div");
    panel.className = `race-hud-cluster ${group.className}`;

    group.fields.forEach((field) => {
      const value = document.createElement("span");
      value.className = `race-hud-value ${field.className}`;
      value.dataset.hudField = field.id;
      value.setAttribute("aria-label", field.id);
      value.textContent = "--";

      panel.appendChild(value);
      values.set(field.id, value);
    });

    element.appendChild(panel);
  });

  return {
    element,
    update({ raceState, vehicleState, wrongWayState, trackName } = {}) {
      values.get("speed").textContent = formatSpeed(vehicleState?.speed);
      values.get("lap").textContent = formatLap(raceState);
      values.get("totalTime").textContent = formatRaceTime(raceState?.totalTime);
      values.get("checkpoint").textContent = formatCheckpoint(raceState);
      values.get("map").textContent = formatMap(trackName);
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

function formatLap(raceState) {
  if (!raceState) {
    return "--";
  }

  return `Lap ${raceState.currentLap}/${raceState.totalLaps}`;
}

function formatCheckpoint(raceState) {
  if (!raceState || raceState.checkpointCount <= 0) {
    return "Checkpoint --";
  }

  return `Checkpoint ${raceState.currentCheckpoint + 1}/${raceState.checkpointCount}`;
}

function formatMap(trackName) {
  return `Map: ${trackName ?? "--"}`;
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
    return `${formatOrdinal(raceState.position)} / ${raceState.participantCount}`;
  }

  return "1st / 1";
}

function formatGap(raceState) {
  if (!raceState) {
    return "--";
  }

  if (raceState.mode === "time-trial") {
    return `BEST ${formatRaceTime(raceState.bestLapTime)}`;
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

function formatOrdinal(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const remainder = value % 100;

  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
