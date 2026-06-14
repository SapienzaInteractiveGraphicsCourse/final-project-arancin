import * as THREE from "three";
import { clampPropPosition, getHeading, getRightVector, markShadow, pseudoRandom } from "../shared.js";
import { addDecorativePointLight } from "./lights.js";

export function colorToHexStr(color) {
  return "#" + color.toString(16).padStart(6, "0");
}

const vegasCanvasTextureCache = new Map();
export function getCachedVegasCanvasTexture(width, height, title, subtitle, themeColorHex, textColorHex) {
  const key = `${width}_${height}_${title}_${subtitle || ""}_${themeColorHex}_${textColorHex}`;
  if (!vegasCanvasTextureCache.has(key)) {
    vegasCanvasTextureCache.set(
      key,
      createVegasCanvasTexture(width, height, title, subtitle, themeColorHex, textColorHex)
    );
  }
  return vegasCanvasTextureCache.get(key);
}

function createVegasCanvasTexture(width, height, title, subtitle, themeColorHex, textColorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = themeColorHex || "#ff2090";
  ctx.lineWidth = Math.min(width, height) * 0.08;
  ctx.strokeRect(ctx.lineWidth * 0.5, ctx.lineWidth * 0.5, width - ctx.lineWidth, height - ctx.lineWidth);

  // Inner border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.min(width, height) * 0.02;
  ctx.strokeRect(ctx.lineWidth * 2.5, ctx.lineWidth * 2.5, width - ctx.lineWidth * 5, height - ctx.lineWidth * 5);

  // Text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColorHex || "#ffffff";
  ctx.shadowColor = themeColorHex || "#ff2090";
  ctx.shadowBlur = Math.min(width, height) * 0.1;

  if (subtitle) {
    ctx.font = `bold ${Math.floor(height * 0.28)}px Arial Black, Arial, sans-serif`;
    ctx.fillText(title, width * 0.5, height * 0.4);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = `italic ${Math.floor(height * 0.14)}px Georgia, serif`;
    ctx.fillText(subtitle, width * 0.5, height * 0.72);
  } else {
    ctx.font = `bold ${Math.floor(height * 0.38)}px Arial Black, Arial, sans-serif`;
    ctx.fillText(title, width * 0.5, height * 0.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

let cachedWelcomeTexture = null;
export function getCachedWelcomeToVegasTexture() {
  if (!cachedWelcomeTexture) {
    cachedWelcomeTexture = createWelcomeToVegasTexture();
  }
  return cachedWelcomeTexture;
}

function createWelcomeToVegasTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Clear transparent
  ctx.clearRect(0, 0, 512, 512);

  // 1. Draw the blue posts (two vertical thick lines)
  ctx.fillStyle = "#1e73be";
  ctx.fillRect(180, 200, 30, 312);
  ctx.fillRect(302, 200, 30, 312);

  // 2. Draw the blue horizontal cross bar
  ctx.fillRect(160, 150, 192, 25);

  // 3. Draw the red 8-pointed star at the top (center 256, y 95)
  const starX = 256;
  const starY = 95;
  ctx.save();
  ctx.translate(starX, starY);

  // Gold spikes (8 points)
  ctx.fillStyle = "#f5d45a";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(angle) * 35, Math.sin(angle) * 35);
    ctx.lineTo(Math.cos(angle + Math.PI / 8) * 12, Math.sin(angle + Math.PI / 8) * 12);
  }
  ctx.closePath();
  ctx.fill();

  // Red inner star
  ctx.fillStyle = "#d12a2a";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
    ctx.lineTo(Math.cos(angle + Math.PI / 8) * 8, Math.sin(angle + Math.PI / 8) * 8);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 4. Draw the main Diamond body
  // Center of diamond is (256, 270), width is 380, height is 230
  const dX = 256;
  const dY = 270;
  const dW = 190;
  const dH = 115;

  // Outer gold neon border
  ctx.shadowColor = "#f5d45a";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#f5d45a";
  ctx.beginPath();
  ctx.moveTo(dX, dY - dH - 12);
  ctx.lineTo(dX + dW + 12, dY);
  ctx.lineTo(dX, dY + dH + 12);
  ctx.lineTo(dX - dW - 12, dY);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Red neon frame inside
  ctx.fillStyle = "#d12a2a";
  ctx.beginPath();
  ctx.moveTo(dX, dY - dH - 4);
  ctx.lineTo(dX + dW + 4, dY);
  ctx.lineTo(dX, dY + dH + 4);
  ctx.lineTo(dX - dW - 4, dY);
  ctx.closePath();
  ctx.fill();

  // White/cream center
  ctx.fillStyle = "#fcfaf0";
  ctx.beginPath();
  ctx.moveTo(dX, dY - dH);
  ctx.lineTo(dX + dW, dY);
  ctx.lineTo(dX, dY + dH);
  ctx.lineTo(dX - dW, dY);
  ctx.closePath();
  ctx.fill();

  // Little yellow bulb dots around the border
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#f5d45a";
  ctx.lineWidth = 1.5;
  const borderPoints = 28;
  for (let i = 0; i < borderPoints; i++) {
    const alpha = i / borderPoints;
    let x, y;
    if (alpha < 0.25) {
      const t = alpha / 0.25;
      x = dX + t * dW;
      y = (dY - dH) + t * dH;
    } else if (alpha < 0.5) {
      const t = (alpha - 0.25) / 0.25;
      x = (dX + dW) - t * dW;
      y = dY + t * dH;
    } else if (alpha < 0.75) {
      const t = (alpha - 0.5) / 0.25;
      x = dX - t * dW;
      y = (dY + dH) - t * dH;
    } else {
      const t = (alpha - 0.75) / 0.25;
      x = (dX - dW) + t * dW;
      y = dY - t * dH;
    }
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 5. Draw "WELCOME" circles & letters
  const welcomeY = dY - 60;
  const welcomeXStart = dX - 110;
  const welcomeXStep = 36;
  const letters = ["W", "E", "L", "C", "O", "M", "E"];

  letters.forEach((char, i) => {
    const cx = welcomeXStart + i * welcomeXStep;
    const cy = welcomeY;

    // Circle border
    ctx.strokeStyle = "#f5d45a";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Circle inner border
    ctx.strokeStyle = "#3a4a9f";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Letter
    ctx.fillStyle = "#d12a2a";
    ctx.font = "bold 19px 'Arial Black', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, cx, cy + 1);
  });

  // 6. Draw "TO Fabulous" text
  ctx.fillStyle = "#1e73be";
  ctx.font = "italic bold 17px 'Georgia', serif";
  ctx.textAlign = "center";
  ctx.fillText("TO Fabulous", dX, dY - 15);

  // 7. Draw "LAS VEGAS" text
  ctx.fillStyle = "#d12a2a";
  ctx.font = "bold 38px 'Arial Black', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "#f5d45a";
  ctx.shadowBlur = 6;
  ctx.fillText("LAS VEGAS", dX, dY + 32);
  ctx.shadowBlur = 0;

  // 8. Draw "NEVADA" text
  ctx.fillStyle = "#1e73be";
  ctx.font = "bold 16px 'Arial Black', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NEVADA", dX, dY + 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createVegasVerticalCanvasTexture(width, height, text, themeColorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = themeColorHex || "#00e5ff";
  ctx.lineWidth = width * 0.08;
  ctx.strokeRect(ctx.lineWidth * 0.5, ctx.lineWidth * 0.5, width - ctx.lineWidth, height - ctx.lineWidth);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = Math.floor(height / (text.length * 1.35));
  const startY = (height - (text.length - 1) * fontSize * 1.15) * 0.5;

  for (let i = 0; i < text.length; i++) {
    ctx.font = `bold ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = themeColorHex || "#00e5ff";
    ctx.shadowBlur = fontSize * 0.35;
    ctx.fillText(text[i], width * 0.5, startY + i * fontSize * 1.15);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createBillboardMaterial({ color, emissive, emissiveIntensity = 0, roughness = 0.38, metalness = 0.04 }) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ?? 0x000000,
    emissiveIntensity,
    flatShading: true,
    roughness,
    metalness
  });
}

function addClassicVegasPylonSign(sign, color, contrastColor) {
  const themeHex = colorToHexStr(color);
  const contrastHex = colorToHexStr(contrastColor);

  const panelMaterial = createBillboardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const brightMaterial = createBillboardMaterial({
    color: contrastColor,
    emissive: contrastColor,
    emissiveIntensity: 0.4
  });
  const darkMaterial = createBillboardMaterial({ color: 0x07070b, roughness: 0.62 });
  const whiteMaterial = createBillboardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0
  });
  const poleMaterial = createBillboardMaterial({ color: 0x161620, roughness: 0.72, metalness: 0.12 });

  // 0.55x scaled sizes
  const panelWidth = 5.5;
  const panelHeight = 8.8;
  const panelDepth = 0.35;
  const panelMesh = markShadow(new THREE.Mesh(new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth), panelMaterial));
  panelMesh.position.y = 7.7;
  sign.add(panelMesh);

  const marqueeWidth = 6.6;
  const marqueeHeight = 2.2;
  const marqueeDepth = 0.45;
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(marqueeWidth, marqueeHeight, marqueeDepth), brightMaterial);
  marquee.position.y = 13.2;
  sign.add(marquee);

  const readerWidth = 5.5;
  const readerHeight = 1.65;
  const readerDepth = 0.3;
  const reader = markShadow(new THREE.Mesh(new THREE.BoxGeometry(readerWidth, readerHeight, readerDepth), darkMaterial));
  reader.position.y = 2.75;
  sign.add(reader);

  const pole = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.66, 4.4, 0.66), poleMaterial));
  pole.position.y = 0.1;
  sign.add(pole);

  // Text Planes on front faces (z offset slightly)
  const panelTex = getCachedVegasCanvasTexture(256, 512, "JACKPOT", "SPIN & WIN", contrastHex, "#ffeb3b");
  const panelTextMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: panelTex,
    emissive: 0xffffff,
    emissiveMap: panelTex,
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.1,
    flatShading: true
  });
  const panelTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth - 0.2, panelHeight - 0.2), panelTextMat);
  panelTextPlane.position.set(0, 7.7, panelDepth * 0.5 + 0.02);
  sign.add(panelTextPlane);

  const marqueeTex = getCachedVegasCanvasTexture(256, 128, "777", "SLOTS", themeHex, "#ffffff");
  const marqueeTextMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: marqueeTex,
    emissive: 0xffffff,
    emissiveMap: marqueeTex,
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.1,
    flatShading: true
  });
  const marqueeTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(marqueeWidth - 0.2, marqueeHeight - 0.2), marqueeTextMat);
  marqueeTextPlane.position.set(0, 13.2, marqueeDepth * 0.5 + 0.02);
  sign.add(marqueeTextPlane);

  const readerTex = getCachedVegasCanvasTexture(256, 128, "PLAY NOW", null, "#39ff14", "#39ff14");
  const readerTextMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: readerTex,
    emissive: 0xffffff,
    emissiveMap: readerTex,
    emissiveIntensity: 1.2,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true
  });
  const readerTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(readerWidth - 0.2, readerHeight - 0.2), readerTextMat);
  readerTextPlane.position.set(0, 2.75, readerDepth * 0.5 + 0.02);
  sign.add(readerTextPlane);

  // Scaled coordinates for stars
  [
    [-2.42, 11.82],
    [2.42, 11.82],
    [-2.42, 3.57],
    [2.42, 3.57]
  ].forEach(([x, y]) => {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.22, 4, 3), whiteMaterial);
    star.position.set(x, y, 0.25);
    sign.add(star);
  });
}

function addCasinoNameBoardSign(sign, color, contrastColor) {
  const themeHex = colorToHexStr(color);

  const boardMaterial = createBillboardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const frameMaterial = createBillboardMaterial({
    color: contrastColor,
    emissive: contrastColor,
    emissiveIntensity: 0.5
  });
  const poleMaterial = createBillboardMaterial({ color: 0x171724, roughness: 0.72, metalness: 0.12 });
  const bulbMaterial = createBillboardMaterial({
    color: 0xfff0a0,
    emissive: 0xfff0a0,
    emissiveIntensity: 1.2
  });
  const underMaterial = createBillboardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.2
  });

  const boardWidth = 12.0;
  const boardHeight = 4.4;
  const boardDepth = 0.3;
  const board = markShadow(new THREE.Mesh(new THREE.BoxGeometry(boardWidth, boardHeight, boardDepth), boardMaterial));
  board.position.y = 5.5;
  sign.add(board);

  // Frames
  [
    [0, 7.8, boardWidth + 0.6, 0.2],
    [0, 3.2, boardWidth + 0.6, 0.2],
    [-(boardWidth * 0.5 + 0.15), 5.5, 0.2, boardHeight + 4.8],
    [boardWidth * 0.5 + 0.15, 5.5, 0.2, boardHeight + 4.8]
  ].forEach(([x, y, w, h]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.36), frameMaterial);
    frame.position.set(x, y, 0.04);
    sign.add(frame);
  });

  [-4.0, 4.0].forEach((x) => {
    const pole = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.5, 5), poleMaterial));
    pole.position.set(x, 2.75, -0.05);
    sign.add(pole);
  });

  // Text Plane
  const boardTex = getCachedVegasCanvasTexture(512, 128, "CASINO", "ROYALE", themeHex, "#ffeb3b");
  const boardTextMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: boardTex,
    emissive: 0xffffff,
    emissiveMap: boardTex,
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.1,
    flatShading: true
  });
  const boardTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(boardWidth - 0.2, boardHeight - 0.2), boardTextMat);
  boardTextPlane.position.set(0, 5.5, boardDepth * 0.5 + 0.02);
  sign.add(boardTextPlane);

  for (let index = 0; index < 12; index += 1) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 4, 3), bulbMaterial);
    bulb.position.set(-(boardWidth * 0.45) + index * (boardWidth * 0.9 / 11), 7.9, 0.25);
    sign.add(bulb);
  }

  const underLight = new THREE.Mesh(new THREE.BoxGeometry(boardWidth - 1, 0.15, 0.3), underMaterial);
  underLight.position.set(0, 3.05, 0.22);
  sign.add(underLight);
}

function addSpectacularTowerSign(sign, color, contrastColor) {
  const themeHex = colorToHexStr(color);

  const bodyMaterial = createBillboardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const goldMaterial = createBillboardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.8,
    roughness: 0.26
  });
  const baseMaterial = createBillboardMaterial({ color: 0x11111b, roughness: 0.72, metalness: 0.12 });
  const barMaterials = [color, contrastColor].map((barColor) => createBillboardMaterial({
    color: barColor,
    emissive: barColor,
    emissiveIntensity: 0.7
  }));

  const bodyWidth = 3.3;
  const bodyHeight = 15.4;
  const bodyDepth = 0.3;
  const body = markShadow(new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth), bodyMaterial));
  body.position.y = 7.7;
  sign.add(body);

  [-4.4, 0, 4.4].forEach((yOffset, index) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.33, 0.35), barMaterials[index % 2]);
    bar.position.set(0, 7.7 + yOffset, 0.18);
    sign.add(bar);
  });

  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), goldMaterial);
  finial.position.y = 15.95;
  const base = markShadow(new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.65, 1.65), baseMaterial));
  base.position.y = 0.825;
  sign.add(finial, base);

  // Vertical text Plane
  const texts = ["SLOTS", "POKER", "VEGAS", "CASINO"];
  // Let's pick a text based on the color to have variety
  const textVal = texts[themeHex.charCodeAt(1) % texts.length];
  const bodyTex = createVegasVerticalCanvasTexture(128, 512, textVal, themeHex);
  const bodyTextMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bodyTex,
    emissive: 0xffffff,
    emissiveMap: bodyTex,
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.1,
    flatShading: true
  });
  const bodyTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(bodyWidth - 0.2, bodyHeight - 0.2), bodyTextMat);
  bodyTextPlane.position.set(0, 7.7, bodyDepth * 0.5 + 0.02);
  sign.add(bodyTextPlane);
}

function addMarqueeArchEntranceSign(sign, color, contrastColor, seed) {
  const contrastHex = colorToHexStr(contrastColor);

  const pillarMaterial = createBillboardMaterial({ color: 0x171724, roughness: 0.68, metalness: 0.12 });
  const barMaterial = createBillboardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
  const bulbMaterial = createBillboardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 1.25
  });
  const glowColors = [color, contrastColor, 0xffe600];

  const pillarWidth = 0.8;
  const pillarHeight = 6.6;
  const pillarDepth = 0.8;
  [-3.3, 3.3].forEach((x) => {
    const pillar = markShadow(new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth), pillarMaterial));
    pillar.position.set(x, 3.3, 0);
    sign.add(pillar);
  });

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.8, 0.8), barMaterial);
  topBar.position.y = 6.6;
  sign.add(topBar);

  const letters = ["W", "I", "N"];
  const panelWidth = 1.65;
  const panelHeight = 3.3;
  const panelDepth = 0.16;

  for (let index = 0; index < 3; index += 1) {
    const panelColor = glowColors[(seed + index) % glowColors.length];
    const panelMaterial = createBillboardMaterial({
      color: panelColor,
      emissive: panelColor,
      emissiveIntensity: 0.5
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth), panelMaterial);
    panel.position.set((index - 1) * 1.87, 4.12, 0.38);
    sign.add(panel);

    const letterTex = getCachedVegasCanvasTexture(128, 256, letters[index], null, colorToHexStr(panelColor), "#ffffff");
    const letterTextMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: letterTex,
      emissive: 0xffffff,
      emissiveMap: letterTex,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.1,
      flatShading: true
    });
    const letterTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth - 0.1, panelHeight - 0.1), letterTextMat);
    letterTextPlane.position.set((index - 1) * 1.87, 4.12, 0.38 + panelDepth * 0.5 + 0.01);
    sign.add(letterTextPlane);
  }

  for (let index = 0; index < 6; index += 1) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 4, 3), bulbMaterial);
    bulb.position.set(-2.75 + index * 1.1, 6.05 - (index % 2) * 0.28, 0.52);
    sign.add(bulb);
  }
}

export function isNearGrandstand(progress, side, threshold = 0.05) {
  const locations = [
    { progress: 0.1, side: 1 },
    { progress: 0.18, side: -1 },
    { progress: 0.38, side: 1 },
    { progress: 0.52, side: -1 },
    { progress: 0.66, side: 1 },
    { progress: 0.82, side: -1 },
    { progress: 0.92, side: 1 }
  ];
  return locations.some((loc) => {
    return loc.side === side && Math.abs(progress - loc.progress) < threshold;
  });
}

export function buildVegasBillboards(group, curve, roadHalfWidth) {
  const palette = [0xff2090, 0x00e5ff, 0xffe600, 0x39ff14, 0xff8800];
  const progressPoints = [0.10, 0.28, 0.45, 0.59, 0.74, 0.87];
  const typeBuilders = [
    addClassicVegasPylonSign,
    addCasinoNameBoardSign,
    addSpectacularTowerSign,
    addMarqueeArchEntranceSign
  ];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    // Choose side, and flip to opposite side if we are near a grandstand
    let side = index % 2 === 0 ? -1 : 1;
    if (isNearGrandstand(progress, side, 0.05)) {
      side = -side;
    }

    const color = palette[Math.floor(pseudoRandom(index * 13.7 + 4.1) * palette.length) % palette.length];
    const contrastColor = palette[(palette.indexOf(color) + 2) % palette.length];

    const distance = roadHalfWidth + 13.5;
    const position = point.clone().addScaledVector(normal, side * distance);
    const sign = new THREE.Group();

    sign.name = `VegasBillboard:${index}`;
    sign.position.copy(position);

    clampPropPosition(curve, sign.position, roadHalfWidth, 200, 12, 13.5);

    sign.rotation.y = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);

    typeBuilders[index % typeBuilders.length](sign, color, contrastColor, index);

    // Adjusted light intensity/range/position for smaller sign
    const light = addDecorativePointLight(sign, color, 10, 15, 1.8, new THREE.Vector3(0, 6, 1.2));
    if (light) {
      light.name = `VegasBillboardLight:${index}`;
    }
    group.add(sign);
  });
}
