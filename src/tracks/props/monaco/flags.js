import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, getRightVector, optimizeStaticDecorativeProps, pseudoRandom } from "../shared.js";
import { MONACO_ROAD_Y } from "./constants.js";

let cachedMonacoFerrariFlagTexture = null;

function getMonacoFerrariFlagTexture() {
  if (cachedMonacoFerrariFlagTexture) {
    return cachedMonacoFerrariFlagTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const cloth = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  cloth.addColorStop(0, "#f73131");
  cloth.addColorStop(0.52, "#d80f1b");
  cloth.addColorStop(1, "#b80d17");
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.10)";
  for (let y = 14; y < canvas.height; y += 28) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let x = 26; x < canvas.width; x += 42) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  const checkerWidth = 112;
  const cell = 18;
  for (let y = 0; y < canvas.height; y += cell) {
    for (let x = 0; x < checkerWidth; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? "#f9fafb" : "#111827";
      ctx.fillRect(x, y, cell, cell);
    }
  }
  const fade = ctx.createLinearGradient(checkerWidth - 8, 0, checkerWidth + 72, 0);
  fade.addColorStop(0, "rgba(216,15,27,0)");
  fade.addColorStop(1, "#d80f1b");
  ctx.fillStyle = fade;
  ctx.fillRect(checkerWidth - 8, 0, 80, canvas.height);

  ctx.save();
  ctx.translate(318, 122);
  ctx.beginPath();
  ctx.moveTo(-48, -62);
  ctx.lineTo(48, -62);
  ctx.lineTo(58, 14);
  ctx.quadraticCurveTo(0, 76, -58, 14);
  ctx.closePath();
  ctx.fillStyle = "#ffd21f";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#173b2f";
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "bold 30px serif";
  ctx.textAlign = "center";
  ctx.fillText("SF", 0, 28);
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.bezierCurveTo(-26, -28, -14, -52, 4, -38);
  ctx.bezierCurveTo(26, -54, 30, -16, 8, -8);
  ctx.bezierCurveTo(28, 2, 14, 18, -4, 8);
  ctx.bezierCurveTo(-22, 16, -24, -2, -6, -12);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#0f5132";
  ctx.fillRect(236, 38, 118, 8);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(236, 48, 118, 8);
  ctx.fillStyle = "#0f5132";
  ctx.fillRect(236, 58, 118, 8);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("Ferrari", 318, 216);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  cachedMonacoFerrariFlagTexture = texture;
  return texture;
}

function createMonacoClothFlagGeometry(width = 3.05, height = 1.72, columns = 14, rows = 7) {
  const geometry = new THREE.PlaneGeometry(width, height, columns, rows);
  geometry.translate(width * 0.5, 0, 0);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const normalizedX = (x / width) + 0.5;
    const wave = Math.sin(normalizedX * Math.PI * 3.5 + y * 4.5) * 0.075 * normalizedX;
    positions.setZ(index, wave);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function addMonacoFerrariTracksideFlags(group, curve, definition, barrierOffset) {
  const flagGroup = new THREE.Group();
  flagGroup.name = "MonacoTracksideFerrariFlags";
  const clothMat = new THREE.MeshStandardMaterial({
    map: getMonacoFerrariFlagTexture(),
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const poleMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.48, metalness: 0.5 });
  const flagGeometry = createMonacoClothFlagGeometry();
  const poleGeometry = new THREE.CylinderGeometry(0.026, 0.034, 1.7, 8);
  const placements = [
    { side: 1, start: 0.06, end: 0.22, step: 0.038 },
    { side: 1, start: 0.31, end: 0.46, step: 0.043 },
    { side: -1, start: 0.56, end: 0.72, step: 0.042 },
    { side: -1, start: 0.80, end: 0.94, step: 0.046 }
  ];
  let flagIndex = 0;

  placements.forEach((section) => {
    for (let progress = section.start; progress <= section.end; progress += section.step) {
      const sample = {
        center: curve.getPointAt(progress),
        tangent: curve.getTangentAt(progress).setY(0).normalize()
      };
      const right = getRightVector(sample.tangent);
      const outward = right.clone().multiplyScalar(section.side).normalize();
      const polePosition = sample.center
        .clone()
        .addScaledVector(right, section.side * (barrierOffset + 0.52 + pseudoRandom(flagIndex + 3) * 0.18))
        .addScaledVector(sample.tangent, (pseudoRandom(flagIndex + 10) - 0.5) * 0.45);
      polePosition.y = MONACO_ROAD_Y + 0.9;

      const pole = new THREE.Mesh(poleGeometry, poleMat);
      pole.name = `MonacoFerrariFlagPole:${flagIndex}`;
      pole.position.copy(polePosition);
      pole.castShadow = true;
      flagGroup.add(pole);

      const heading = getHeading(sample.tangent) + (section.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const cloth = new THREE.Mesh(flagGeometry, clothMat);
      cloth.name = `MonacoFerrariTracksideFlag:${flagIndex}`;
      cloth.position.copy(polePosition).addScaledVector(outward, 0.08);
      cloth.position.y += 0.86 + pseudoRandom(flagIndex + 5) * 0.16;
      cloth.rotation.y = heading + Math.PI + (pseudoRandom(flagIndex + 6) - 0.5) * 0.18;
      cloth.rotation.z = (pseudoRandom(flagIndex + 7) - 0.5) * 0.1;
      cloth.castShadow = true;
      cloth.receiveShadow = true;
      flagGroup.add(cloth);
      flagIndex += 1;
    }
  });

  optimizeStaticDecorativeProps(flagGroup, []);
  group.add(flagGroup);
}

