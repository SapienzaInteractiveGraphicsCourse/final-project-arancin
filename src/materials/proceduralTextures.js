import * as THREE from "three";

const TEXTURE_SIZE = 256;
const NORMAL_STRENGTH = 4.5;

export function createProceduralTrackTextureSet(definition) {
  return {
    road: createRoadTextureSet(definition),
    ground: createGroundTexture(definition)
  };
}

function createRoadTextureSet(definition) {
  const palette = definition.palette;
  const base = new THREE.Color(palette.road ?? 0x30323a);
  const accent = new THREE.Color(definition.id === "vegas" ? 0x4a4d59 : 0x3f4248);
  const heightMap = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const colorCanvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const colorCtx = colorCanvas.getContext("2d");
  const colorImage = colorCtx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const index = y * TEXTURE_SIZE + x;
      const grain = valueNoise(x, y, definition.id) * 0.7 + valueNoise(x * 0.42, y * 0.42, `${definition.id}:large`) * 0.3;
      const laneWear = Math.sin((x / TEXTURE_SIZE) * Math.PI * 2) * 0.03;
      const crack = getRoadCrack(x, y, definition.id);
      const mixAmount = THREE.MathUtils.clamp(0.18 + grain * 0.22 + laneWear - crack * 0.18, 0, 0.62);
      const color = base.clone().lerp(accent, mixAmount).multiplyScalar(0.78 + grain * 0.28 - crack * 0.2);
      const offset = index * 4;

      colorImage.data[offset] = toByte(color.r);
      colorImage.data[offset + 1] = toByte(color.g);
      colorImage.data[offset + 2] = toByte(color.b);
      colorImage.data[offset + 3] = 255;
      heightMap[index] = grain * 0.72 - crack * 0.42;
    }
  }

  colorCtx.putImageData(colorImage, 0, 0);
  drawRoadMarks(colorCtx, definition);

  return {
    map: createRepeatedCanvasTexture(colorCanvas, true),
    roughnessMap: createRoughnessTexture(heightMap, definition),
    normalMap: createNormalTexture(heightMap)
  };
}

function createGroundTexture(definition) {
  const palette = definition.palette;
  const base = new THREE.Color(palette.ground ?? 0x777777);
  const secondary = getGroundSecondaryColor(definition, base);
  const canvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const index = y * TEXTURE_SIZE + x;
      const grain = valueNoise(x * 0.85, y * 0.85, `${definition.id}:ground`);
      const broad = valueNoise(x * 0.18, y * 0.18, `${definition.id}:ground:broad`);
      const wave = definition.id === "beach" ? Math.sin((x + y * 0.35) * 0.11) * 0.08 : 0;
      const color = base.clone().lerp(secondary, THREE.MathUtils.clamp(grain * 0.32 + broad * 0.28 + wave, 0, 0.72));
      const offset = index * 4;

      colorImageWrite(image, offset, color.multiplyScalar(0.86 + grain * 0.22));
    }
  }

  ctx.putImageData(image, 0, 0);

  if (definition.id === "beach") {
    drawSandRipples(ctx);
  }

  return createRepeatedCanvasTexture(canvas, true, { repeatScale: definition.id === "beach" ? 18 : 28 });
}

function createRoughnessTexture(heightMap, definition) {
  const canvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const baseRoughness = definition.id === "vegas" ? 155 : 205;

  for (let index = 0; index < heightMap.length; index += 1) {
    const roughness = THREE.MathUtils.clamp(baseRoughness + heightMap[index] * 55, 115, 245);
    const offset = index * 4;
    image.data[offset] = roughness;
    image.data[offset + 1] = roughness;
    image.data[offset + 2] = roughness;
    image.data[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return createRepeatedCanvasTexture(canvas, false);
}

function createNormalTexture(heightMap) {
  const canvas = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const left = heightMap[y * TEXTURE_SIZE + wrap(x - 1, TEXTURE_SIZE)];
      const right = heightMap[y * TEXTURE_SIZE + wrap(x + 1, TEXTURE_SIZE)];
      const up = heightMap[wrap(y - 1, TEXTURE_SIZE) * TEXTURE_SIZE + x];
      const down = heightMap[wrap(y + 1, TEXTURE_SIZE) * TEXTURE_SIZE + x];
      const normal = new THREE.Vector3(
        (left - right) * NORMAL_STRENGTH,
        (up - down) * NORMAL_STRENGTH,
        1
      ).normalize();
      const offset = (y * TEXTURE_SIZE + x) * 4;

      image.data[offset] = toByte(normal.x * 0.5 + 0.5);
      image.data[offset + 1] = toByte(normal.y * 0.5 + 0.5);
      image.data[offset + 2] = toByte(normal.z * 0.5 + 0.5);
      image.data[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return createRepeatedCanvasTexture(canvas, false);
}

function drawRoadMarks(ctx, definition) {
  if (definition.id === "vegas") {
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    for (let x = 18; x < TEXTURE_SIZE; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, TEXTURE_SIZE);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (definition.id === "monaco") {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#ffffff";
    for (let y = 0; y < TEXTURE_SIZE; y += 34) {
      ctx.fillRect(TEXTURE_SIZE * 0.48, y, 3, 16);
    }
    ctx.globalAlpha = 1;
  }
}

function drawSandRipples(ctx) {
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#fff2bf";
  ctx.lineWidth = 1.5;
  for (let y = 12; y < TEXTURE_SIZE; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= TEXTURE_SIZE; x += 8) {
      const offsetY = Math.sin(x * 0.08 + y * 0.12) * 2.5;
      if (x === 0) {
        ctx.moveTo(x, y + offsetY);
      } else {
        ctx.lineTo(x, y + offsetY);
      }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function createRepeatedCanvasTexture(canvas, srgb, { repeatScale = 1 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatScale, repeatScale);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  if (srgb) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getGroundSecondaryColor(definition, base) {
  if (definition.id === "beach") {
    return new THREE.Color(0xfff4cc);
  }
  if (definition.id === "vegas") {
    return new THREE.Color(0x17121d);
  }
  if (definition.id === "monaco") {
    return new THREE.Color(0xc7d0d4);
  }
  return base.clone().offsetHSL(0, 0, 0.12);
}

function getRoadCrack(x, y, seed) {
  const crackNoise = valueNoise(x * 0.23 + 41, y * 0.07 - 19, `${seed}:cracks`);
  const thinLine = Math.abs(Math.sin((x * 0.031 + y * 0.017 + crackNoise * 5.2) * Math.PI));
  return crackNoise > 0.78 && thinLine < 0.09 ? 1 : 0;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  const n0 = lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), sx);
  const n1 = lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), sx);
  return lerp(n0, n1, sy);
}

function hash2(x, y, seed) {
  let hash = 2166136261;
  const string = `${seed}:${x}:${y}`;
  for (let index = 0; index < string.length; index += 1) {
    hash ^= string.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function colorImageWrite(image, offset, color) {
  image.data[offset] = toByte(color.r);
  image.data[offset + 1] = toByte(color.g);
  image.data[offset + 2] = toByte(color.b);
  image.data[offset + 3] = 255;
}

function toByte(value) {
  return Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function wrap(value, size) {
  return (value + size) % size;
}
