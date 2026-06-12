const HUD_GROUPS = [
  {
    className: "race-hud-top-left",
    fields: [
      { id: "speed", className: "race-hud-speed" },
      { id: "totalTime", className: "race-hud-time" },
      { id: "position", className: "race-hud-place" },
      { id: "lap", className: "race-hud-chip race-hud-lap" },
      { id: "checkpoint", className: "race-hud-chip race-hud-checkpoint" },
      { id: "fps", className: "race-hud-chip race-hud-fps" },
      { id: "surface", className: "race-hud-chip race-hud-surface" },
      { id: "gap", className: "race-hud-chip race-hud-gap" }
    ]
  },
  {
    className: "race-hud-track",
    fields: [
      { id: "track", className: "race-hud-track-name" }
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
    update({ raceState, vehicleState, wrongWayState, trackId, trackName, performanceState } = {}) {
      element.dataset.trackTheme = normalizeTrackTheme(trackId);
      setField(values, "speed", formatSpeed(vehicleState?.speed));
      setField(values, "lap", formatLap(raceState));
      setField(values, "totalTime", formatRaceTime(raceState?.totalTime));
      setField(values, "checkpoint", formatCheckpoint(raceState));
      setField(values, "track", trackName ?? "--");
      setField(values, "surface", formatSurface(vehicleState?.surfaceType));
      setField(values, "position", formatPosition(raceState));
      setField(values, "gap", formatGap(raceState));
      setField(values, "fps", formatFps(performanceState));
    },
    remove() {
      element.remove();
    }
  };
}

function setField(values, id, text) {
  const element = values.get(id);

  if (!element) {
    return;
  }

  element.textContent = text;
  element.hidden = text.length === 0;
}

function normalizeTrackTheme(trackId) {
  if (trackId === "vegas" || trackId === "beach" || trackId === "monaco") {
    return trackId;
  }

  return "default";
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

  const checkpointNumber = raceState.currentCheckpoint === 0
    ? raceState.checkpointCount
    : raceState.currentCheckpoint;

  return `Checkpoint ${checkpointNumber}/${raceState.checkpointCount}`;
}

function formatSurface(surfaceType) {
  if (!surfaceType) {
    return "Surface --";
  }

  return `Grip: ${surfaceType.charAt(0).toUpperCase()}${surfaceType.slice(1)}`;
}

function formatPosition(raceState) {
  if (!raceState) {
    return "--";
  }

  if (raceState.mode === "race") {
    return `Pos ${raceState.position}/${raceState.participantCount}`;
  }

  return "Solo";
}

function formatGap(raceState) {
  if (!raceState) {
    return "--";
  }

  if (raceState.mode === "time-trial") {
    return `BEST ${formatRaceTime(raceState.bestLapTime)}`;
  }

  return "";
}

function formatFps(performanceState) {
  const fps = performanceState?.fps;

  if (!Number.isFinite(fps)) {
    return "FPS --";
  }

  return `FPS ${Math.round(fps)}`;
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
