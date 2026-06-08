export const TRACK_OPTIONS = [
  {
    id: "vegas",
    name: "Vegas Neon",
    description: "Night city circuit with neon tunnels and technical chicanes."
  },
  {
    id: "beach",
    name: "Tropical Beach",
    description: "Wide coastal road with sand, palms and fast S sections."
  },
  {
    id: "monaco",
    name: "Monaco Formula 1",
    description: "Narrow city layout with barriers, hairpins and short straights."
  }
];

export const VEHICLE_OPTIONS = [
  {
    id: "kart",
    name: "Kart",
    description: "Team-authored procedural hierarchical vehicle."
  },
  {
    id: "porsche",
    name: "Porsche",
    description: "Fast imported sports car, strongest on straights."
  },
  {
    id: "silvia",
    name: "Silvia",
    description: "Agile imported coupe, responsive through corners."
  }
];

export const RACE_MODE_OPTIONS = [
  {
    id: "race",
    name: "Race",
    description: "Player versus AI with laps, checkpoints and standings."
  },
  {
    id: "time-trial",
    name: "Time Trial",
    description: "Solo lap timing mode for testing vehicles and tracks."
  }
];

export const VEHICLE_COLOR_OPTIONS = [
  {
    id: "racing-red",
    name: "Racing Red",
    value: "#d6332f"
  },
  {
    id: "electric-blue",
    name: "Electric Blue",
    value: "#2f74d6"
  },
  {
    id: "neon-lime",
    name: "Neon Lime",
    value: "#9be22d"
  },
  {
    id: "sunburst-yellow",
    name: "Sunburst Yellow",
    value: "#facc15"
  },
  {
    id: "pearl-white",
    name: "Pearl White",
    value: "#f8fafc"
  },
  {
    id: "midnight-black",
    name: "Midnight Black",
    value: "#111827"
  }
];

export const DEFAULT_RACE_SETUP = {
  trackId: TRACK_OPTIONS[0].id,
  vehicleId: VEHICLE_OPTIONS[0].id,
  raceMode: RACE_MODE_OPTIONS[0].id,
  bodyColor: VEHICLE_COLOR_OPTIONS[0].value
};

export function getRaceSetupLabels(setup) {
  const track = TRACK_OPTIONS.find((option) => option.id === setup.trackId);
  const vehicle = VEHICLE_OPTIONS.find((option) => option.id === setup.vehicleId);
  const mode = RACE_MODE_OPTIONS.find((option) => option.id === setup.raceMode);
  const color = VEHICLE_COLOR_OPTIONS.find((option) => option.value === setup.bodyColor);

  return {
    track: track?.name ?? setup.trackId,
    vehicle: vehicle?.name ?? setup.vehicleId,
    mode: mode?.name ?? setup.raceMode,
    color: color?.name ?? setup.bodyColor
  };
}
