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
    tension: 0.46,
    roadWidth: 10.5,
    segments: 220,
    groundSize: 700,
    barrierOffset: 0.42,
    barrierHeight: 0.52,
    barrierThickness: 0.42,
    checkpointTs: [0, 0.18, 0.38, 0.58, 0.78],
    boostTs: [0.09, 0.44, 0.72],
    spawnOffsetMeters: -4.2,
    lightingMode: "day",
    skyboxTheme: "beach",
    particleProfile: "sand",
    scene: {
      background: 0x7ecef5,
      fog: 0xc8eaff,
      fogType: "linear",
      fogNear: 160,
      fogFar: 420,
      ambientColor: 0xfff3c8,
      ambientIntensity: 0.85,
      moonColor: 0xfff8e0,
      moonIntensity: 2.8,
      moonPosition: [-60, 80, 60],
      shadowBounds: 180,
      shadowFar: 320,
      skyGradient: {
        horizon: 0xfde9b0,
        mid: 0x7ecef5,
        zenith: 0x2a7ec8
      }
    },
    palette: {
      road: 0x2e3038,
      ground: 0xe4c06c,
      barrier: 0xf5e8b0,
      boost: 0xffee00,
      water: 0x0088cc,
      sand: 0xe4c06c,
      roadEdge: 0xf0d870,
      centerLine: 0xffffff,
      checkpoint: 0x1cd4c0,
      foliage: 0x20955a
    },
    // Layout: rettilineo di partenza → curva larga destra → S veloce → chicane sinistra-destra
    // → tornante a U (curva lenta) → rettilineo costiero → curva destra → rientro
    controlPoints: [
      [  0,  0, -150],  // start/finish (rettilineo)
      [  0,  0,  -90],  // rettilineo
      [ 22,  0,  -40],  // curva larga a destra
      [ 80,  0,   -8],  // entrata S
      [110,  0,   30],  // S – parte alta
      [ 90,  0,   70],  // S – parte bassa (sinistra)
      [ 48,  0,   90],  // uscita S
      [ 18,  0,  108],  // chicane: stretto sinistra
      [ 50,  0,  120],  // chicane: stretto destra
      [ 30,  0,  150],  // entrata tornante
      [-24,  0,  168],  // tornante U – apice
      [-80,  0,  148],  // tornante U – uscita
      [-95,  0,  105],  // rettilineo costiero inizia
      [-130, 0,   60],  // rettilineo costiero
      [-155, 0,   10],  // curva destra lenta
      [-140, 0,  -48],  // curva destra
      [-100, 0,  -90],  // rientro
      [ -52, 0, -120],  // rientro
      [ -20, 0, -148]   // back to start
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
