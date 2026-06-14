export const TRACK_IDS = {
  VEGAS: "vegas",
  BEACH: "beach",
  MONACO: "monaco"
};

const TRACK_DEFINITIONS = {
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
    checkpointTs: [0.87, 0.11, 0.33, 0.54, 0.71],
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
    checkpointTs: [0.906, 0.106, 0.326, 0.536, 0.726],
    boostTs: [0.10, 0.48, 0.75],
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
    // Layout: original layout from commit 3298db6
    controlPoints: [
      [0, 0, -120],
      [46, 0, -118],
      [84, 0, -104],
      [110, 0, -66],
      [102, 0, 12],
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
    curveType: "catmullrom",
    tension: 0.32,
    roadWidth: 12.6,
    segments: 200,
    groundSize: 300,
    barrierOffset: 0.5,
    barrierHeight: 0.78,
    barrierThickness: 0.5,
    checkpointTs: [0.534, 0.734, 0.934, 0.134, 0.334],
    boostTs: [0.3, 0.65],
    spawnOffsetMeters: -3.6,
    lightingMode: "day",
    skyboxTheme: "monaco",
    particleProfile: "urban",
    scene: {
      background: 0x90caf9,
      fog: 0xe3f2fd,
      fogType: "linear",
      fogNear: 140,
      fogFar: 380,
      ambientColor: 0xfffaf0,
      ambientIntensity: 0.9,
      moonColor: 0xfffde7,
      moonIntensity: 2.2,
      moonPosition: [80, 120, 50],
      shadowBounds: 160,
      shadowFar: 280,
      skyGradient: {
        horizon: 0xe3f2fd,
        mid: 0x90caf9,
        zenith: 0x1565c0
      }
    },
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
    // ── Layout Monaco – versione con curve extra ──
    //
    // Sezioni originali:  A Start · B Sainte-Dévote · C Casino · D Hairpin
    //                     E Risalita · F Rascasse · G Raccordo
    // Curve aggiunte:    B2 Massenet · C2 Mirabeau · D2 Portier · E2 Jink
    //
    // Punto finale x=-22 → separazione ≥ 18m dal rettilineo (x=0) – no overlap.
    controlPoints: [
      // A ── RETTILINEO PARTENZA ──
      [  0, 0,  60],   // t=0  START LINE
      [  0, 0,  30],
      [  0, 0,   0],
      // B ── SAINTE-DÉVOTE: curva destra ──
      [ 22, 0, -12],
      [ 55, 0, -18],
      // B2 ── MASSENET: leggera piega sinistra poi destra (jink) ──
      [ 70, 0, -30],
      [ 80, 0, -44],
      // C ── CASINO: arco destro ampio ──
      [ 96, 0, -62],
      [104, 0, -82],
      // C2 ── MIRABEAU: curva destra stretta prima del tornante ──
      [106, 0, -100],
      [ 98, 0, -116],
      // D ── TORNANTE (hairpin): apice ──
      [ 80, 0, -134],
      [ 54, 0, -124],
      // D2 ── PORTIER: delicata curva destra in uscita dal tornante ──
      [ 38, 0, -108],
      [ 20, 0, -90],
      // E ── RISALITA: arco sinistro ──
      [ -8, 0, -68],
      [-22, 0, -48],
      // E2 ── JINK: leggero cambio direzione sulla risalita ──
      [-32, 0, -28],
      [-44, 0, -14],
      // F ── RASCASSE: tornante sinistro ampio ──
      [-64, 0,  -2],
      [-72, 0,  34],
      [-54, 0,  58],
      // G ── RACCORDO FINALE (x=-22, 18m a sinistra del rettilineo) ──
      [-22, 0,  76]
    ]
  }
};

export function getTrackDefinition(trackId) {
  const definition = TRACK_DEFINITIONS[trackId];

  if (!definition) {
    console.warn(`Unknown track id "${trackId}", falling back to ${TRACK_IDS.VEGAS}.`);
  }

  return definition ?? TRACK_DEFINITIONS[TRACK_IDS.VEGAS];
}
