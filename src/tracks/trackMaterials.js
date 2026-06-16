import * as THREE from "three";
import { createProceduralTrackTextureSet } from "../materials/proceduralTextures.js";

export function createFlatStandardMaterial({
  color,
  map,
  normalMap,
  roughnessMap,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.82,
  metalness = 0.02,
  normalScale = 1,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
  fog = true
}) {
  const parameters = {
    color,
    roughness,
    metalness,
    transparent,
    opacity,
    side,
    flatShading: true,
    fog
  };

  if (map) {
    parameters.map = map;
  }

  if (normalMap) {
    parameters.normalMap = normalMap;
    parameters.normalScale = new THREE.Vector2(normalScale, normalScale);
  }

  if (roughnessMap) {
    parameters.roughnessMap = roughnessMap;
  }

  if (emissive !== undefined) {
    parameters.emissive = emissive;
    parameters.emissiveIntensity = emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(parameters);
}

function createStartSignTexture(definition) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  // Background
  ctx.fillStyle = "#111115";
  ctx.fillRect(0, 0, width, height);

  // Theme-specific colors
  let borderColor = "#32f6ff"; // Neon Cyan
  let textColor = "#ff2bd6";    // Neon Pink
  let textShadow = "rgba(255, 43, 214, 0.85)";

  if (definition.id === "beach") {
    borderColor = "#ffd166";
    textColor = "#2aa883";
    textShadow = "rgba(42, 168, 131, 0.5)";
  } else if (definition.id === "monaco") {
    borderColor = "#d92d2d";
    textColor = "#ffffff";
    textShadow = "rgba(255, 255, 255, 0.65)";
  }

  // Double border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // START text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.shadowColor = textShadow;
  ctx.shadowBlur = 16;
  ctx.font = "bold 72px Arial Black, Arial, sans-serif";
  ctx.fillText("START", width * 0.5, height * 0.5 + 4);

  // Decorative side arrows
  ctx.shadowBlur = 0;
  ctx.fillStyle = borderColor;
  
  // Left arrow
  ctx.beginPath();
  ctx.moveTo(42, height * 0.5);
  ctx.lineTo(62, height * 0.5 - 14);
  ctx.lineTo(62, height * 0.5 + 14);
  ctx.fill();

  // Right arrow
  ctx.beginPath();
  ctx.moveTo(width - 42, height * 0.5);
  ctx.lineTo(width - 62, height * 0.5 - 14);
  ctx.lineTo(width - 62, height * 0.5 + 14);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createTrackMaterials(definition) {
  const palette = definition.palette;
  const startSignTex = createStartSignTexture(definition);
  const proceduralTextures = createProceduralTrackTextureSet(definition);

  return {
    ground: createFlatStandardMaterial({
      color: palette.ground,
      map: proceduralTextures.ground,
      emissive: definition.id === "vegas" ? 0x0a0020 : undefined,
      emissiveIntensity: definition.id === "vegas" ? 0.15 : 0,
      roughness: 0.92
    }),
    road: createFlatStandardMaterial({
      color: palette.road,
      map: proceduralTextures.road.map,
      normalMap: proceduralTextures.road.normalMap,
      roughnessMap: proceduralTextures.road.roughnessMap,
      normalScale: definition.id === "vegas" ? 0.36 : 0.48,
      roughness: definition.id === "vegas" ? 0.5 : 0.8,
      metalness: definition.id === "vegas" ? 0.16 : 0.02
    }),
    roadEdge: createFlatStandardMaterial({
      color: palette.roadEdge,
      emissive: palette.roadEdge,
      emissiveIntensity: definition.id === "vegas" ? 2.8 : 0.12,
      roughness: definition.id === "vegas" ? 0.32 : 0.58,
      side: THREE.DoubleSide
    }),
    centerLine: createFlatStandardMaterial({
      color: palette.centerLine ?? 0xf3f0dc,
      emissive: definition.id === "vegas" ? palette.centerLine : undefined,
      emissiveIntensity: definition.id === "vegas" ? 0.85 : 0,
      roughness: 0.55
    }),
    barrier: createFlatStandardMaterial({
      color: palette.barrier,
      roughness: 0.74,
      metalness: definition.id === "vegas" ? 0.12 : 0.04
    }),
    curbRed: createFlatStandardMaterial({
      color: 0xc91f2d,
      roughness: 0.64,
      metalness: 0.02
    }),
    curbWhite: createFlatStandardMaterial({
      color: 0xf3f0e8,
      roughness: 0.66,
      metalness: 0.02
    }),
    checkpoint: createFlatStandardMaterial({
      color: palette.checkpoint,
      emissive: palette.checkpoint,
      emissiveIntensity: definition.id === "vegas" ? 0.9 : 0.35,
      roughness: 0.48,
      transparent: true,
      opacity: 0.72
    }),
    boost: createFlatStandardMaterial({
      color: palette.boost,
      emissive: palette.boost,
      emissiveIntensity: 0.95,
      roughness: 0.44
    }),
    startWhite: createFlatStandardMaterial({
      color: 0xf4f2e8,
      roughness: 0.68
    }),
    startDark: createFlatStandardMaterial({
      color: 0x171b20,
      roughness: 0.72
    }),
    startGantry: createFlatStandardMaterial({
      color: definition.id === "vegas" ? 0x181b24 : (definition.id === "beach" ? 0xd8cba8 : 0x2b3036),
      roughness: definition.id === "vegas" ? 0.48 : 0.58,
      metalness: definition.id === "vegas" ? 0.36 : 0.08
    }),
    startSign: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: startSignTex,
      emissive: 0xffffff,
      emissiveMap: startSignTex,
      emissiveIntensity: definition.id === "vegas" ? 2.1 : 0.5,
      roughness: 0.22,
      metalness: 0.08,
      flatShading: true
    })
  };
}
