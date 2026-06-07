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

export const DEFAULT_RACE_SETUP = {
  trackId: TRACK_OPTIONS[0].id,
  vehicleId: VEHICLE_OPTIONS[0].id,
  raceMode: RACE_MODE_OPTIONS[0].id
};

export function getRaceSetupLabels(setup) {
  const track = TRACK_OPTIONS.find((option) => option.id === setup.trackId);
  const vehicle = VEHICLE_OPTIONS.find((option) => option.id === setup.vehicleId);
  const mode = RACE_MODE_OPTIONS.find((option) => option.id === setup.raceMode);

  return {
    track: track?.name ?? setup.trackId,
    vehicle: vehicle?.name ?? setup.vehicleId,
    mode: mode?.name ?? setup.raceMode
  };
}
