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
    boostTs: [0.16, 0.52, 0.78],
    spawnOffsetMeters: -4.2,
    lightingMode: "vegas",
    skyboxTheme: "vegas",
    particleProfile: "neon",
    scene: {
      background: 0x05010f,
      fog: 0x05010f,
      fogType: "exp2",
      fogDensity: 0.008,
      ambientColor: 0x0a0520,
      ambientIntensity: 0.4,
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
      [0, 0, 100],
      [0, 0, 50],
      [-20, 0, 10],
      [20, 0, -30],
      [0, 0, -80],
      [45, 0, -140],
      [110, 0, -150],
      [150, 0, -110],
      [130, 0, -60],
      [80, 0, -40],
      [100, 0, 20],
      [65, 0, 75],
      [35, 0, 120]
    ]
  },
  [TRACK_IDS.BEACH]: {
    id: TRACK_IDS.BEACH,
    name: "Tropical Beach",
    themeId: "beach",
    curveType: "catmullrom",
    tension: 0.44,
    roadWidth: 10.5,
    segments: 160,
    groundSize: 520,
    barrierOffset: 0.42,
    barrierHeight: 0.48,
    barrierThickness: 0.42,
    checkpointTs: [0, 0.20, 0.42, 0.63, 0.82],
    boostTs: [0.10, 0.48, 0.75],
    spawnOffsetMeters: -4.2,
    lightingMode: "day",
    skyboxTheme: "beach",
    particleProfile: "sand",
    scene: {
      background: 0x8fd8ff,
      fog: 0xbfefff,
      fogType: "linear",
      fogNear: 120,
      fogFar: 340,
      ambientColor: 0xfff3c8,
      ambientIntensity: 0.78,
      moonColor: 0xfff0bb,
      moonIntensity: 2.65,
      moonPosition: [-36, 58, 42],
      shadowBounds: 130,
      shadowFar: 260,
      skyGradient: {
        horizon: 0xffe4a5,
        mid: 0x8fd8ff,
        zenith: 0x3c91e6
      }
    },
    palette: {
      road: 0x30323a,
      ground: 0xe8c87a,
      barrier: 0xf3e2a5,
      boost: 0xffff00,
      water: 0x0088cc,
      sand: 0xe8c87a,
      roadEdge: 0xf3e2a5,
      centerLine: 0xffffff,
      checkpoint: 0x21d6c6,
      foliage: 0x20955a
    },
    controlPoints: [
      [0, 0, -120],
      [0, 0, -76],
      [18, 0, -34],
      [58, 0, -16],
      [92, 0, 16],
      [76, 0, 58],
      [28, 0, 72],
      [-20, 0, 48],
      [-58, 0, 62],
      [-92, 0, 98],
      [-130, 0, 82],
      [-146, 0, 34],
      [-118, 0, -10],
      [-64, 0, -28],
      [-42, 0, -72],
      [-24, 0, -118]
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
