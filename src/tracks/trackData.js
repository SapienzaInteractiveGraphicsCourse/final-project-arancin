export const TRACK_IDS = {
  VEGAS: "vegas",
  BEACH: "beach",
  MONACO: "monaco"
};

export const TRACK_DEFINITIONS = {
  [TRACK_IDS.VEGAS]: {
    id: TRACK_IDS.VEGAS,
    name: "Vegas Neon",
    themeId: "vegas-neon",
    curveType: "catmullrom",
    tension: 0.48,
    roadWidth: 10.5,
    segments: 256,
    groundSize: 680,
    barrierOffset: 0.95,
    barrierHeight: 0.72,
    barrierThickness: 0.42,
    checkpointTs: [0, 0.24, 0.46, 0.67, 0.84],
    boostTs: [],
    spawnOffsetMeters: -4.2,
    lightingMode: "vegas",
    skyboxTheme: "vegas",
    particleProfile: "neon",
    scene: {
      background: 0x07101c,
      fog: 0x07101c,
      fogType: "exp2",
      fogDensity: 0.007,
      ambientColor: 0x182848,
      ambientIntensity: 0.52,
      moonColor: 0xd7e6ff,
      moonIntensity: 2.4,
      moonPosition: [-42, 46, 30],
      shadowBounds: 170,
      shadowFar: 300,
      skyGradient: {
        horizon: 0xd66a25,
        mid: 0x6a1b70,
        zenith: 0x130820
      }
    },
    palette: {
      ground: 0x0a0a0c,
      road: 0x30323a,
      roadEdge: 0x32f6ff,
      centerLine: 0xffd36a,
      barrier: 0x252b38,
      checkpoint: 0x34f4ff,
      boost: 0xffd23a,
      neon: [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78]
    },
    controlPoints: [
      [0, 0, 170],
      [0, 0, 70],
      [0, 0, -70],
      [0, 0, -220],
      [48, 0, -305],
      [126, 0, -322],
      [194, 0, -278],
      [214, 0, -200],
      [176, 0, -132],
      [106, 0, -108],
      [92, 0, 22],
      [92, 0, 148],
      [48, 0, 210]
    ]
  },
  [TRACK_IDS.BEACH]: {
    id: TRACK_IDS.BEACH,
    name: "Tropical Beach",
    themeId: "tropical-beach",
    curveType: "catmullrom",
    tension: 0.34,
    roadWidth: 11.5,
    segments: 128,
    groundSize: 190,
    barrierOffset: 1.15,
    barrierHeight: 0.58,
    barrierThickness: 0.46,
    checkpointTs: [0, 0.22, 0.5, 0.74],
    boostTs: [0.18, 0.46, 0.82],
    spawnOffsetMeters: -4.4,
    lightingMode: "day",
    skyboxTheme: "beach",
    particleProfile: "sand",
    palette: {
      ground: 0xd7b56b,
      water: 0x21b7c6,
      road: 0x55616a,
      roadEdge: 0xf3e2a5,
      barrier: 0x2aa883,
      checkpoint: 0x21d6c6,
      boost: 0xffd166,
      foliage: 0x20955a
    },
    controlPoints: [
      [-44, 0, -18],
      [-24, 0, -44],
      [12, 0, -50],
      [46, 0, -34],
      [34, 0, -8],
      [52, 0, 20],
      [22, 0, 48],
      [-16, 0, 42],
      [-48, 0, 20],
      [-28, 0, 2]
    ]
  },
  [TRACK_IDS.MONACO]: {
    id: TRACK_IDS.MONACO,
    name: "Monaco Formula 1",
    themeId: "monaco-formula-1",
    curveType: "centripetal",
    tension: 0.08,
    roadWidth: 7.8,
    segments: 112,
    groundSize: 140,
    barrierOffset: 0.5,
    barrierHeight: 0.78,
    barrierThickness: 0.5,
    checkpointTs: [0, 0.26, 0.52, 0.78],
    boostTs: [0.16, 0.62],
    spawnOffsetMeters: -3.6,
    lightingMode: "day",
    skyboxTheme: "monaco",
    particleProfile: "urban",
    palette: {
      ground: 0xaab5b9,
      road: 0x2f363a,
      roadEdge: 0xf5f2e8,
      curbRed: 0xd92d2d,
      barrier: 0xd9dde2,
      checkpoint: 0x2f80ed,
      boost: 0xffd23a,
      marina: 0x3f9ec8
    },
    controlPoints: [
      [-18, 0, -34],
      [20, 0, -34],
      [20, 0, -18],
      [34, 0, -12],
      [34, 0, 10],
      [18, 0, 16],
      [12, 0, 34],
      [-22, 0, 34],
      [-34, 0, 16],
      [-18, 0, 6],
      [-34, 0, -10],
      [-30, 0, -26]
    ]
  }
};

export const TRACK_DEFINITION_LIST = Object.values(TRACK_DEFINITIONS);

export function getTrackDefinition(trackId) {
  return TRACK_DEFINITIONS[trackId] ?? TRACK_DEFINITIONS[TRACK_IDS.VEGAS];
}
