import * as THREE from "three";
import { createFlatStandardMaterial } from "./trackMaterials.js";
import crowdTextureUrl from "../assets/textures/grandstand_crowd.png";

const ENABLE_VEGAS_DECORATIVE_POINT_LIGHTS = false;
const UP = new THREE.Vector3(0, 1, 0);

function addDecorativePointLight(parent, color, intensity, distance, decay, position) {
  if (!ENABLE_VEGAS_DECORATIVE_POINT_LIGHTS) {
    return null;
  }

  const light = new THREE.PointLight(color, intensity, distance, decay);
  light.position.copy(position);
  parent.add(light);
  return light;
}

function getRightVector(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
}

function getHeading(tangent) {
  return Math.atan2(tangent.x, tangent.z);
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function isNearAnyProgress(progress, values, threshold) {
  return values.some((value) => Math.abs(progress - value) < threshold);
}

function markShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function findClosestT(curve, pos, samples = 200) {
  let closestT = 0;
  let closestDistanceSq = Infinity;

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = curve.getPointAt(t);
    const distanceSq = (pos.x - point.x) ** 2 + (pos.z - point.z) ** 2;

    if (distanceSq < closestDistanceSq) {
      closestT = t;
      closestDistanceSq = distanceSq;
    }
  }

  return closestT;
}

function clampPropPosition(curve, propPos, roadHalfWidth, samples = 200, clearance = 10, targetClearance = 12) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const closestT = findClosestT(curve, propPos, samples);
    const roadCenter = curve.getPointAt(closestT);
    const distFromCenter = new THREE.Vector2(
      propPos.x - roadCenter.x,
      propPos.z - roadCenter.z
    ).length();

    if (distFromCenter >= roadHalfWidth + clearance) {
      return propPos;
    }

    const outDir = new THREE.Vector3(
      propPos.x - roadCenter.x,
      0,
      propPos.z - roadCenter.z
    );

    if (outDir.lengthSq() < 0.0001) {
      const tangent = curve.getTangentAt(closestT).setY(0).normalize();
      outDir.copy(getRightVector(tangent));
    } else {
      outDir.normalize();
    }

    propPos.x = roadCenter.x + outDir.x * (roadHalfWidth + targetClearance);
    propPos.z = roadCenter.z + outDir.z * (roadHalfWidth + targetClearance);
  }

  return propPos;
}

function getSafeRoadsidePosition(curve, progress, side, initialOffset, roadHalfWidth, minClearance = 20) {
  const point = curve.getPointAt(progress % 1.0);
  const tangent = curve.getTangentAt(progress % 1.0).setY(0).normalize();
  const normal = getRightVector(tangent);

  // Determine absolute minimum clearance to prevent physical clipping, scaled with minClearance
  const safeClearance = Math.max(16, minClearance * 0.35);
  const absoluteMinClearance = roadHalfWidth + safeClearance;

  let bestPos = null;
  let bestDist = -1;

  const sidesToTry = [side, -side];

  for (const s of sidesToTry) {
    let currentOffset = initialOffset;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const testPos = point.clone().addScaledVector(normal, s * currentOffset);

      // Calculate minimum distance from testPos to the entire track
      let minTrackDist = Infinity;
      for (let index = 0; index <= 120; index += 1) {
        const trackPoint = curve.getPointAt(index / 120);
        const dist = Math.sqrt((testPos.x - trackPoint.x) ** 2 + (testPos.z - trackPoint.z) ** 2);
        if (dist < minTrackDist) {
          minTrackDist = dist;
        }
      }

      // If this position is safe from physical road clipping
      if (minTrackDist >= absoluteMinClearance) {
        // If it also satisfies the desired minClearance, return it immediately
        if (minTrackDist >= roadHalfWidth + minClearance) {
          return testPos;
        }

        // Otherwise, keep track of the one that is furthest from the road
        if (minTrackDist > bestDist) {
          bestDist = minTrackDist;
          bestPos = testPos;
        }
      }

      currentOffset += 20;
    }
  }

  // If we found a position that doesn't clip, return it
  if (bestPos) {
    return bestPos;
  }

  // Fallback to roadside position with safe clear distance
  for (const s of [side, -side]) {
    const safeNearPos = point.clone().addScaledVector(normal, s * (roadHalfWidth + safeClearance + 2));
    let minTrackDist = Infinity;
    for (let index = 0; index <= 120; index += 1) {
      const trackPoint = curve.getPointAt(index / 120);
      const dist = Math.sqrt((safeNearPos.x - trackPoint.x) ** 2 + (safeNearPos.z - trackPoint.z) ** 2);
      if (dist < minTrackDist) {
        minTrackDist = dist;
      }
    }
    if (minTrackDist >= roadHalfWidth + 6) {
      return safeNearPos;
    }
  }

  // Ultimate fallback to initial offset
  return point.clone().addScaledVector(normal, side * initialOffset);
}

const windowMaterialCache = new Map();
function getCachedWindowMaterial(color, lit) {
  const key = `${color}_${lit}`;
  if (!windowMaterialCache.has(key)) {
    windowMaterialCache.set(key, createWindowMaterial(color, lit));
  }
  return windowMaterialCache.get(key);
}

const windowGeometryCache = new Map();
function getCachedWindowGeometry(w, h, d) {
  const key = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  if (!windowGeometryCache.has(key)) {
    windowGeometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  }
  return windowGeometryCache.get(key);
}

function createWindowMaterial(color, lit) {
  return createFlatStandardMaterial({
    color: lit ? color : 0x050509,
    emissive: lit ? color : 0x000000,
    emissiveIntensity: lit ? 5.2 : 0,
    roughness: lit ? 0.22 : 0.7,
    metalness: lit ? 0.04 : 0.02
  });
}

function addWindowGrid(group, block, neonColors, seed, face) {
  const isFront = face === "front";
  const columns = Math.max(3, Math.floor((isFront ? block.width : block.depth) / 1.6));
  const rows = Math.max(6, Math.floor(block.height / 2.2));

  const windowWidth = isFront ? Math.min(0.5, block.width / (columns * 2.2)) : 0.08;
  const windowDepth = isFront ? 0.08 : Math.min(0.5, block.depth / (columns * 2.2));
  const windowHeight = Math.min(0.45, block.height / (rows * 2.8));

  const xStep = block.width / (columns + 1);
  const zStep = block.depth / (columns + 1);
  const yStep = block.height / (rows + 1);

  const colorsList = (neonColors && neonColors.length > 0) ? neonColors : [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78];
  const darkMaterial = getCachedWindowMaterial(0x070811, false);
  const geometry = getCachedWindowGeometry(windowWidth, windowHeight, windowDepth);

  const litMatricesByColor = colorsList.map(() => []);
  const darkMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const noise = pseudoRandom(seed + row * 9.7 + column * 3.1 + (isFront ? 0 : 17));
      const lit = noise > 0.35;
      const position = new THREE.Vector3();

      if (isFront) {
        position.set(
          block.x + (column + 1) * xStep - block.width * 0.5,
          block.y - block.height * 0.5 + (row + 1) * yStep,
          block.z + block.depth * 0.5 + 0.028
        );
      } else {
        position.set(
          block.x + block.width * 0.5 + 0.028,
          block.y - block.height * 0.5 + (row + 1) * yStep,
          block.z + (column + 1) * zStep - block.depth * 0.5
        );
      }

      matrix.makeTranslation(position.x, position.y, position.z);
      if (lit) {
        const colorIndex = Math.floor(pseudoRandom(seed + row * 13.3 + column * 7.7) * colorsList.length);
        litMatricesByColor[colorIndex].push(matrix.clone());
      } else {
        darkMatrices.push(matrix.clone());
      }
    }
  }

  colorsList.forEach((color, colorIndex) => {
    const matrices = litMatricesByColor[colorIndex];
    if (matrices.length === 0) {
      return;
    }
    const litMaterial = getCachedWindowMaterial(color, true);
    const windows = new THREE.InstancedMesh(geometry, litMaterial, matrices.length);
    windows.name = `LitWindows_${colorIndex}`;
    windows.receiveShadow = true;
    matrices.forEach((windowMatrix, index) => windows.setMatrixAt(index, windowMatrix));
    windows.instanceMatrix.needsUpdate = true;
    group.add(windows);
  });

  if (darkMatrices.length > 0) {
    const windows = new THREE.InstancedMesh(geometry, darkMaterial, darkMatrices.length);
    windows.name = "DarkWindows";
    windows.receiveShadow = true;
    darkMatrices.forEach((windowMatrix, index) => windows.setMatrixAt(index, windowMatrix));
    windows.instanceMatrix.needsUpdate = true;
    group.add(windows);
  }
}

function addVerticalEdgeHighlights(group, block, material) {
  const thickness = 0.22;
  const edgeGeometry = new THREE.BoxGeometry(thickness, block.height * 1.01, thickness);
  const x = block.width * 0.5 + thickness * 0.45;
  const z = block.depth * 0.5 + thickness * 0.45;
  const corners = [
    [-x, -z],
    [x, -z],
    [-x, z],
    [x, z]
  ];

  corners.forEach(([cornerX, cornerZ]) => {
    const edge = new THREE.Mesh(edgeGeometry, material);
    edge.position.set(block.x + cornerX, block.y, block.z + cornerZ);
    edge.castShadow = true;
    edge.receiveShadow = true;
    group.add(edge);
  });
}

function addNeonFacadeStrips(group, block, neonColors, seed) {
  const stripCount = 2 + Math.floor(pseudoRandom(seed + 12.7) * 3);
  const geometry = new THREE.BoxGeometry(0.12, block.height * 0.86, 0.09);

  for (let index = 0; index < stripCount; index += 1) {
    const color = neonColors[(seed + index) % neonColors.length];
    const material = createFlatStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 5,
      roughness: 0.16,
      metalness: 0.04
    });
    const strip = new THREE.Mesh(geometry, material);
    const xAlpha = (index + 1) / (stripCount + 1);
    strip.position.set(
      block.x + xAlpha * block.width - block.width * 0.5,
      block.y,
      block.z + block.depth * 0.5 + 0.08
    );
    strip.receiveShadow = true;
    group.add(strip);
  }
}

function addRoofDetail(group, topY, width, depth, neonColor, variant) {
  const material = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 3.2,
    roughness: 0.18,
    metalness: 0.06
  });

  if (variant % 2 === 0) {
    const antenna = markShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.7, 6), material)
    );
    antenna.position.y = topY + 0.85;
    group.add(antenna);

    const beacon = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.26), material));
    beacon.position.y = topY + 1.78;
    group.add(beacon);
    return;
  }

  const ring = markShadow(
    new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(width, depth) * 0.36, 0.045, 6, 24),
      material
    )
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = topY + 0.12;
  group.add(ring);
}

function addRoofBillboard(group, block, neonColors, seed) {
  const topY = block.y + block.height * 0.5;
  const colorsList = (neonColors && neonColors.length > 0) ? neonColors : [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78];

  // Size scales with the top block (blocks[2] crown)
  const billboardWidth = Math.max(3.0, block.width * 1.25);
  const billboardHeight = billboardWidth * 0.5;
  const billboardDepth = 0.28;
  const poleHeight = Math.max(1.0, billboardHeight * 0.35);

  const billboardGroup = new THREE.Group();
  billboardGroup.position.set(block.x, topY, block.z);

  const neonColor = colorsList[seed % colorsList.length];
  const neonColorHex = colorToHexStr(neonColor);

  // 1. Support poles
  const poleMaterial = createBillboardMaterial({ color: 0x1a1a24, roughness: 0.68, metalness: 0.2 });
  const leftPole = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 6), poleMaterial));
  leftPole.position.set(-billboardWidth * 0.28, poleHeight * 0.5, 0);
  const rightPole = leftPole.clone();
  rightPole.position.x = billboardWidth * 0.28;
  billboardGroup.add(leftPole, rightPole);

  // 2. Billboard backing & frame
  const frameMaterial = createBillboardMaterial({ color: 0x0a0a0f, roughness: 0.5, metalness: 0.1 });
  const backing = markShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(billboardWidth, billboardHeight, billboardDepth),
      frameMaterial
    )
  );
  backing.position.y = poleHeight + billboardHeight * 0.5;
  billboardGroup.add(backing);

  // 3. Neon glowing borders
  const borderMaterial = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 4.8,
    roughness: 0.15
  });

  const borderThickness = 0.08;
  const topBorder = new THREE.Mesh(
    new THREE.BoxGeometry(billboardWidth + 0.16, borderThickness, billboardDepth + 0.04),
    borderMaterial
  );
  topBorder.position.set(0, poleHeight + billboardHeight + borderThickness * 0.5, 0);

  const bottomBorder = new THREE.Mesh(
    new THREE.BoxGeometry(billboardWidth + 0.16, borderThickness, billboardDepth + 0.04),
    borderMaterial
  );
  bottomBorder.position.set(0, poleHeight - borderThickness * 0.5, 0);
  billboardGroup.add(topBorder, bottomBorder);

  // 4. Advertising Titles
  const vegasTitles = [
    { title: "JACKPOT", subtitle: "SPIN & WIN" },
    { title: "CASINO", subtitle: "PLAY NOW" },
    { title: "777 SLOTS", subtitle: "$1,000,000" },
    { title: "LAS VEGAS", subtitle: "WELCOME" },
    { title: "ARANCIN GP", subtitle: "RACING TONIGHT" },
    { title: "NEON CLUB", subtitle: "OPEN 24H" },
    { title: "SAPIENZA", subtitle: "GRAPHICS LAB" },
    { title: "HIGH ROLLER", subtitle: "POKER ROOM" },
    { title: "HOTEL NEON", subtitle: "VACANCY" },
    { title: "VIP LOUNGE", subtitle: "FREE DRINKS" }
  ];
  const ad = vegasTitles[seed % vegasTitles.length];

  // 5. Canvas Text Texture with black background
  const textTexture = getCachedVegasCanvasTexture(512, 256, ad.title, ad.subtitle, neonColorHex, "#ffffff");
  const textMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textTexture,
    emissive: 0xffffff,
    emissiveMap: textTexture,
    emissiveIntensity: 1.8,
    roughness: 0.25,
    metalness: 0.08,
    flatShading: true
  });

  const textPlaneFront = new THREE.Mesh(
    new THREE.PlaneGeometry(billboardWidth - 0.2, billboardHeight - 0.2),
    textMaterial
  );
  textPlaneFront.position.set(0, poleHeight + billboardHeight * 0.5, billboardDepth * 0.5 + 0.01);

  const textPlaneBack = textPlaneFront.clone();
  textPlaneBack.rotation.y = Math.PI;
  textPlaneBack.position.z = -(billboardDepth * 0.5 + 0.01);

  billboardGroup.add(textPlaneFront, textPlaneBack);

  group.add(billboardGroup);
}

function addSkyLaser(group, topY, neonColor, variant) {
  const material = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 2.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.55
  });
  material.depthWrite = false;

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, 180, 8, 1, true), material);
  beam.name = `VegasSkyLaser:${variant}`;
  beam.position.set(0, topY + 90, 0);
  beam.rotation.x = (variant % 2 === 0 ? 1 : -1) * 0.08;
  beam.rotation.z = (variant % 3 - 1) * 0.06;
  group.add(beam);
}

function addMegaScreen(group, block, color, side, variant) {
  const screenMaterial = createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 5.4,
    roughness: 0.14,
    metalness: 0.04
  });
  const frameMaterial = createFlatStandardMaterial({
    color: 0x080912,
    roughness: 0.36,
    metalness: 0.26
  });
  const frame = new THREE.Group();
  const screenWidth = side === "front" ? block.width * 0.52 : 0.12;
  const screenDepth = side === "front" ? 0.12 : block.depth * 0.52;
  const screenHeight = Math.min(block.height * 0.26, 7.5);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(screenWidth, screenHeight, screenDepth), screenMaterial);
  const backing = markShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(screenWidth + 0.18, screenHeight + 0.18, screenDepth + 0.04),
      frameMaterial
    )
  );

  if (side === "front") {
    frame.position.set(block.x, block.y + block.height * 0.1, block.z + block.depth * 0.5 + 0.08);
  } else {
    frame.position.set(block.x + block.width * 0.5 + 0.08, block.y + block.height * 0.08, block.z);
  }

  panel.receiveShadow = true;
  backing.position.z = side === "front" ? -0.025 : 0;
  panel.position.z = side === "front" ? 0.035 : 0;

  if (side !== "front") {
    backing.position.x = -0.025;
    panel.position.x = 0.035;
  }

  frame.add(backing, panel);

  const stripeMaterial = createFlatStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.2,
    roughness: 0.2
  });
  const stripeCount = 2 + (variant % 3);

  for (let index = 0; index < stripeCount; index += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        side === "front" ? screenWidth * 0.62 : 0.035,
        0.06,
        side === "front" ? 0.035 : screenDepth * 0.62
      ),
      stripeMaterial
    );
    stripe.position.set(
      side === "front" ? 0 : 0.065,
      (index - (stripeCount - 1) * 0.5) * 0.22,
      side === "front" ? 0.075 : 0
    );
    frame.add(stripe);
  }

  group.add(frame);
}

function createVegasBuilding({ position, rotationY, height, width, depth, color, neonColor, neonColors, index }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotationY;
  group.name = `VegasSteppedSkyscraper:${index}`;

  const bodyMaterial = createFlatStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.25,
    emissive: 0x020204,
    emissiveIntensity: 0.2
  });

  const edgeMaterial = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 5.2,
    roughness: 0.2,
    metalness: 0.08
  });

  const baseHeight = height * 0.2;
  const towerHeight = height * 0.62;
  const crownHeight = height * 0.18;
  const blocks = [
    {
      x: 0,
      y: baseHeight * 0.5,
      z: 0,
      width,
      height: baseHeight,
      depth
    },
    {
      x: (index % 3 - 1) * width * 0.08,
      y: baseHeight + towerHeight * 0.5,
      z: index % 2 === 0 ? depth * 0.05 : -depth * 0.04,
      width: width * 0.88,
      height: towerHeight,
      depth: depth * 0.9
    },
    {
      x: (index % 2 === 0 ? -1 : 1) * width * 0.08,
      y: baseHeight + towerHeight + crownHeight * 0.5,
      z: 0,
      width: width * 0.58,
      height: crownHeight,
      depth: depth * 0.62
    }
  ];

  blocks.forEach((block, blockIndex) => {
    const mesh = markShadow(
      new THREE.Mesh(new THREE.BoxGeometry(block.width, block.height, block.depth), bodyMaterial)
    );
    mesh.position.set(block.x, block.y, block.z);
    group.add(mesh);

    // Add window grids to tower (block 1) and crown (block 2) on both front and side
    if (blockIndex === 1 || blockIndex === 2) {
      addWindowGrid(group, block, neonColors, index * 31 + blockIndex * 7, "front");
      addWindowGrid(group, block, neonColors, index * 43 + blockIndex * 11, "side");
    }
  });

  // Outline both the tower and the crown with glowing vertical corner LEDs
  addVerticalEdgeHighlights(group, blocks[1], edgeMaterial);
  addVerticalEdgeHighlights(group, blocks[2], edgeMaterial);

  // Alternate between roof billboard (50%) and traditional roof details (antennas/rings)
  if (index % 2 === 0) {
    addRoofBillboard(group, blocks[2], neonColors, index);
  } else {
    addRoofDetail(group, height * 1.04, width, depth, neonColor, index);
  }

  if ([0, 12, 28, 44].includes(index)) {
    addSkyLaser(group, height * 1.06, neonColors[(index + 1) % neonColors.length], index);
  }

  return group;
}

function generateCitySkyline(curve, group, definition) {
  const colors = definition.palette.neon;
  const bodyColors = [0x050508, 0x07070b, 0x090812, 0x08050c];
  const sampleCount = 20;

  for (let index = 0; index < sampleCount; index += 1) {
    // Alternate left and right side of the track
    const side = index % 2 === 0 ? 1 : -1;

    // Spaced out progress with a small jitter to keep it natural but prevent overlap
    const progressJitter = (pseudoRandom(index + 13.7) * 0.4 - 0.2) / sampleCount;
    const progress = ((index + 0.5) / sampleCount + progressJitter + 1.0) % 1.0;

    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    const buildingIndex = index;

    // Wider, taller, and more proportioned buildings
    const height = 32 + pseudoRandom(buildingIndex + 4.2) * 33;
    const width = 8 + pseudoRandom(buildingIndex + 8.6) * 4;
    const depth = 8 + pseudoRandom(buildingIndex + 13.1) * 4;

    // Position them further out so they are in the background and don't intersect other props
    const skylineOffset = definition.roadWidth * 0.5 + 82 + pseudoRandom(buildingIndex + 21.5) * 32;
    const heading = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);

    // Dynamically calculate a safe position that is guaranteed not to overlap ANY part of the track
    const position = getSafeRoadsidePosition(curve, progress, side, skylineOffset, definition.roadWidth * 0.5, 62);

    const building = createVegasBuilding({
      position,
      rotationY: heading,
      height,
      width,
      depth,
      color: bodyColors[buildingIndex % bodyColors.length],
      neonColor: colors[buildingIndex % colors.length],
      neonColors: colors,
      index: buildingIndex
    });

    group.add(building);
  }
}

function addVegasTunnel(group, curve, definition, baseProgress, tunnelIndex, archCount = 18, progressStep = 0.008) {
  const colors = definition.palette.neon;
  const tunnel = new THREE.Group();
  tunnel.name = `${definition.name}:NeonTunnel:${tunnelIndex}`;

  for (let segment = 0; segment < archCount; segment += 1) {
    const progress = (baseProgress + segment * progressStep) % 1;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const color = colors[(segment + tunnelIndex) % colors.length];
    const material = createFlatStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3,
      roughness: 0.2,
      metalness: 0.06
    });
    const arch = new THREE.Group();
    arch.position.copy(point);
    arch.rotation.y = getHeading(tangent);

    const span = definition.roadWidth + 3.2;
    const height = 4.2;
    const postWidth = 0.28;
    const archDepth = 0.34;
    const left = new THREE.Mesh(new THREE.BoxGeometry(postWidth, height, archDepth), material);
    left.position.set(-span * 0.5, height * 0.5, 0);
    const right = left.clone();
    right.position.x = span * 0.5;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(span, postWidth, archDepth), material);
    roof.position.set(0, height, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    right.castShadow = true;
    right.receiveShadow = true;
    roof.castShadow = true;
    roof.receiveShadow = true;
    arch.add(left, right, roof);

    if (segment % 4 === 0) {
      addDecorativePointLight(arch, color, 1.25, 17, 1.7, new THREE.Vector3(0, 2.7, 0));
    }

    tunnel.add(arch);
  }

  group.add(tunnel);
}

function colorToHexStr(color) {
  return "#" + color.toString(16).padStart(6, "0");
}

const vegasCanvasTextureCache = new Map();
function getCachedVegasCanvasTexture(width, height, title, subtitle, themeColorHex, textColorHex) {
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
function getCachedWelcomeToVegasTexture() {
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

function createBillboardMaterial({ color, emissive, emissiveIntensity = 0, roughness = 0.38, metalness = 0.04 }) {
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
  const contrastHex = colorToHexStr(contrastColor);

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
  const themeHex = colorToHexStr(color);
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

function isNearGrandstand(progress, side, threshold = 0.05) {
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

function buildVegasBillboards(group, curve, roadHalfWidth) {
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

    // Scale down distance since billboards are smaller and we want them visible
    const distance = roadHalfWidth + 9 + pseudoRandom(index * 19.3 + 2.8) * 4;
    const position = point.clone().addScaledVector(normal, side * distance);
    const sign = new THREE.Group();

    sign.name = `VegasBillboard:${index}`;
    sign.position.copy(position);

    // Clamp closer to road with custom clearance so it fits beautifully
    clampPropPosition(curve, sign.position, roadHalfWidth, 200, 8, 9);

    // Stand straight/upright! Point at the track horizontally (y = sign.position.y)
    sign.lookAt(point.x, sign.position.y, point.z);

    typeBuilders[index % typeBuilders.length](sign, color, contrastColor, index);

    // Adjusted light intensity/range/position for smaller sign
    const light = addDecorativePointLight(sign, color, 10, 15, 1.8, new THREE.Vector3(0, 6, 1.2));
    if (light) {
      light.name = `VegasBillboardLight:${index}`;
    }
    group.add(sign);
  });
}

function createNeonPalm({ position, rotationY, scale = 1, color = 0x48ff78 }) {
  const palm = new THREE.Group();
  palm.name = "VegasNeonPalm";
  palm.position.copy(position);
  palm.rotation.y = rotationY;
  palm.scale.setScalar(scale);

  const trunkMaterial = createFlatStandardMaterial({
    color: 0x111018,
    roughness: 0.54,
    metalness: 0.12
  });
  const leafMaterial = createFlatStandardMaterial({
    color: color === 0x32f6ff ? 0x061f26 : 0x092416,
    emissive: color,
    emissiveIntensity: 3.2,
    roughness: 0.24,
    side: THREE.DoubleSide
  });
  const edgeMaterial = createFlatStandardMaterial({
    color: 0xff2bd6,
    emissive: 0xff2bd6,
    emissiveIntensity: 2.9,
    roughness: 0.24
  });
  const trunkHeight = 6.4;
  const trunk = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, trunkHeight, 7), trunkMaterial));
  trunk.position.y = trunkHeight * 0.5;
  trunk.rotation.z = 0.1;
  palm.add(trunk);

  for (let index = 0; index < 5; index += 1) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 4, 14), edgeMaterial);
    band.position.y = 0.9 + index * 1.05;
    band.rotation.x = Math.PI / 2;
    palm.add(band);
  }

  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const leaf = markShadow(new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.4), leafMaterial));
    leaf.position.set(Math.cos(angle) * 1.35, trunkHeight + 0.6, Math.sin(angle) * 1.35);
    leaf.rotation.y = -angle;
    leaf.rotation.x = Math.PI / 2.8;
    leaf.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.16;
    palm.add(leaf);
  }

  return palm;
}

function addNeonPalms(group, curve, definition) {
  const roadHalfWidth = definition.roadWidth * 0.5;
  const colors = [0x48ff78, 0x32f6ff];
  const progressPoints = [0.08, 0.13, 0.18, 0.24, 0.32, 0.39, 0.47, 0.57, 0.66, 0.73, 0.81, 0.88, 0.94];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    let side = index % 2 === 0 ? 1 : -1;
    if (isNearGrandstand(progress, side, 0.05)) {
      side = -side;
    }

    const basePosition = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 2.9));

    for (let palmIndex = 0; palmIndex < 5; palmIndex += 1) {
      const offset = tangent.clone().multiplyScalar((palmIndex - 2) * 1.55);
      const position = basePosition.clone().add(offset).addScaledVector(normal, side * (palmIndex % 2) * 0.82);
      clampPropPosition(curve, position, roadHalfWidth, 200, 6, 7);
      const palm = createNeonPalm({
        position,
        rotationY: getHeading(tangent) + pseudoRandom(index + palmIndex) * 0.8,
        scale: 1.15 + pseudoRandom(index * 3 + palmIndex) * 0.45,
        color: colors[(index + palmIndex) % colors.length]
      });
      group.add(palm);
    }
  });
}

function createHologramDie({ position, rotationY, scale, color }) {
  const die = new THREE.Group();
  die.name = "VegasHologramDie";
  die.position.copy(position);
  die.rotation.set(0.18, rotationY, -0.08);
  die.scale.setScalar(scale);
  die.userData.spin = {
    x: 0.18 + pseudoRandom(scale) * 0.12,
    y: 0.32 + pseudoRandom(rotationY) * 0.18,
    z: 0.1
  };
  die.userData.float = {
    baseY: position.y,
    amplitude: 1.8,
    speed: 0.7 + pseudoRandom(rotationY + scale) * 0.25,
    phase: rotationY
  };

  const material = createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.8,
    roughness: 0.22,
    transparent: true,
    opacity: 0.38
  });
  const pipMaterial = createFlatStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.4,
    roughness: 0.2
  });
  material.depthWrite = false;

  const cube = markShadow(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3, 1, 1, 1), material));
  cube.position.y = 1.5;
  die.add(cube);

  const pipGeometry = new THREE.BoxGeometry(0.28, 0.28, 0.05);
  [
    [-0.65, 0.65],
    [0, 0],
    [0.65, -0.65],
    [0.65, 0.65],
    [-0.65, -0.65]
  ].forEach(([x, y]) => {
    const pip = new THREE.Mesh(pipGeometry, pipMaterial);
    pip.position.set(x, 1.5 + y, 1.53);
    die.add(pip);
  });

  return die;
}

function addCasinoDice(group, curve, definition) {
  const roadHalfWidth = definition.roadWidth * 0.5;
  const dice = [0.16, 0.34, 0.6, 0.82];

  dice.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const position = point
      .clone()
      .addScaledVector(normal, side * (definition.roadWidth * 0.5 + 8.5 + index * 0.7));
    position.y = 4.8 + index * 0.65;
    clampPropPosition(curve, position, roadHalfWidth);

    group.add(createHologramDie({
      position,
      rotationY: getHeading(tangent) + index * 0.4,
      scale: 0.75 + pseudoRandom(index + 44) * 0.25,
      color: [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78][index]
    }));
  });
}

function addLuxorPyramid(group, curve, definition) {
  const pyramid = new THREE.Group();
  pyramid.name = "VegasLuxorPyramid";
  const progress = 0.24;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const normal = getRightVector(tangent);

  pyramid.position
    .copy(point)
    .addScaledVector(normal, -(definition.roadWidth * 0.5 + 72))
    .addScaledVector(tangent, 18);
  pyramid.rotation.y = getHeading(tangent) + Math.PI * 0.25;

  const pyramidMaterial = createFlatStandardMaterial({
    color: 0x161026,
    emissive: 0x3a1758,
    emissiveIntensity: 0.45,
    roughness: 0.54,
    metalness: 0.08
  });
  const beamMaterial = createFlatStandardMaterial({
    color: 0xbfeaff,
    emissive: 0xbfeaff,
    emissiveIntensity: 4,
    roughness: 0.18,
    transparent: true,
    opacity: 0.62
  });
  beamMaterial.depthWrite = false;

  const body = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0, 28, 26, 4), pyramidMaterial));
  body.position.y = 13;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.52, 260, 8, 1, true), beamMaterial);
  beam.position.y = 143;
  pyramid.add(body, beam);
  group.add(pyramid);
}

function createTextPanelTexture({
  title,
  subtitle = "",
  background = "#07070b",
  foreground = "#fff4c8",
  accent = "#32f6ff",
  width = 512,
  height = 192
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.strokeStyle = foreground;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.fillStyle = foreground;
  ctx.font = "bold 58px Arial Black, Arial, sans-serif";
  ctx.fillText(title, width * 0.5, subtitle ? height * 0.43 : height * 0.5, width - 70);

  if (subtitle) {
    ctx.shadowBlur = 10;
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(subtitle, width * 0.5, height * 0.74, width - 90);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTextPanelMaterial({ title, subtitle, background, foreground, accent, emissiveIntensity = 1.15 }) {
  const texture = createTextPanelTexture({ title, subtitle, background, foreground, accent });

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity,
    roughness: 0.22,
    metalness: 0.03,
    flatShading: true
  });
}

function addFacadeTextSign(casino, { width, height, depth, title, subtitle, accentColor, foreground = "#fff4c8" }) {
  const panelMaterial = createTextPanelMaterial({
    title,
    subtitle,
    background: "#07070b",
    foreground,
    accent: `#${accentColor.toString(16).padStart(6, "0")}`
  });
  const frameMaterial = createFlatStandardMaterial({
    color: 0x0b0d13,
    roughness: 0.34,
    metalness: 0.24
  });
  const sign = new THREE.Group();
  const signWidth = Math.min(width * 0.84, 18);
  const signHeight = Math.min(height * 0.2, 5.8);
  const frame = markShadow(new THREE.Mesh(
    new THREE.BoxGeometry(signWidth + 0.5, signHeight + 0.35, 0.18),
    frameMaterial
  ));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(signWidth, signHeight), panelMaterial);

  frame.position.z = depth * 0.5 + 0.075;
  panel.position.z = depth * 0.5 + 0.18;
  panel.position.y = height * 0.72;
  frame.position.y = panel.position.y;
  sign.add(frame, panel);
  casino.add(sign);
}

function createStripCasino({ position, rotationY, width, height, depth, screenColor, accentColor, index }) {
  const casino = new THREE.Group();
  casino.name = `VegasStripCasino:${index}`;
  casino.position.copy(position);
  casino.rotation.y = rotationY;
  const signNames = [
    ["CAESARS", "PALACE"],
    ["BELLAGIO", "FOUNTAINS"],
    ["VENETIAN", "RESORT"],
    ["PARIS", "LAS VEGAS"],
    ["MGM", "GRAND"],
    ["WYNN", "LAS VEGAS"]
  ];
  const [title, subtitle] = signNames[index % signNames.length];

  const bodyMaterial = createFlatStandardMaterial({
    color: 0x06060a,
    emissive: 0x050008,
    emissiveIntensity: 0.08,
    roughness: 0.5,
    metalness: 0.1
  });
  const screenMaterial = createFlatStandardMaterial({
    color: screenColor,
    emissive: screenColor,
    emissiveIntensity: 6.4,
    roughness: 0.16,
    metalness: 0.04
  });
  const accentMaterial = createFlatStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 5.6,
    roughness: 0.18
  });
  const body = markShadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial));
  const mainScreen = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.72, height * 0.34, 0.12),
    screenMaterial
  );
  const sideScreen = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.42, height * 0.22, 0.12),
    accentMaterial
  );
  const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, height * 0.92, 0.14), accentMaterial);
  const rightStrip = leftStrip.clone();

  body.position.y = height * 0.5;
  mainScreen.position.set(0, height * 0.58, depth * 0.5 + 0.08);
  sideScreen.position.set(width * 0.18, height * 0.28, depth * 0.5 + 0.09);
  leftStrip.position.set(-width * 0.46, height * 0.52, depth * 0.5 + 0.1);
  rightStrip.position.set(width * 0.46, height * 0.52, depth * 0.5 + 0.1);

  casino.add(body, mainScreen, sideScreen, leftStrip, rightStrip);
  addFacadeTextSign(casino, {
    width,
    height,
    depth,
    title,
    subtitle,
    accentColor,
    foreground: index % 3 === 0 ? "#ffe6a7" : "#ffffff"
  });
  return casino;
}

function addStripCasinoWalls(group, curve, definition) {
  const colors = [0xffd23a, 0x32f6ff, 0xff2bd6, 0x48ff78];
  const start = 0.07;
  const end = 0.32;
  const casinoCount = 10;
  const reservedProgress = [0.1, 0.145, 0.18, 0.24];

  for (let index = 0; index < casinoCount; index += 1) {
    const progress = start + ((end - start) * index) / (casinoCount - 1);

    if (isNearAnyProgress(progress, reservedProgress, 0.018)) {
      continue;
    }

    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    [-1, 1].forEach((side) => {
      const casinoIndex = index * 2 + (side > 0 ? 1 : 0);
      const width = 10 + pseudoRandom(casinoIndex + 1.3) * 8;
      const height = 18 + pseudoRandom(casinoIndex + 7.2) * 32;
      const depth = 8 + pseudoRandom(casinoIndex + 4.8) * 8;
      const position = point
        .clone()
        .addScaledVector(normal, side * (definition.roadWidth * 0.5 + 34))
        .addScaledVector(tangent, pseudoRandom(casinoIndex + 9.4) * 3 - 1.5);

      group.add(createStripCasino({
        position,
        rotationY: getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        width,
        height,
        depth,
        screenColor: colors[casinoIndex % colors.length],
        accentColor: colors[(casinoIndex + 1) % colors.length],
        index: casinoIndex
      }));
    });
  }
}

function addDistributedCityBlocks(group, curve, definition) {
  const colors = [0x32f6ff, 0xff2bd6, 0xffd23a, 0x48ff78];
  const reservedProgress = [0.38, 0.48, 0.52, 0.66, 0.82, 0.92];
  const progressPoints = [
    0.36, 0.42, 0.49, 0.56, 0.63, 0.7, 0.77, 0.84, 0.91, 0.97
  ];

  progressPoints.forEach((progress, index) => {
    if (isNearAnyProgress(progress, reservedProgress, 0.022)) {
      return;
    }

    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    [-1, 1].forEach((side) => {
      if (pseudoRandom(index * 8 + side) < 0.22) {
        return;
      }

      const blockIndex = index * 2 + (side > 0 ? 1 : 0);
      const position = point
        .clone()
        .addScaledVector(normal, side * (definition.roadWidth * 0.5 + 40 + pseudoRandom(blockIndex + 6) * 18))
        .addScaledVector(tangent, pseudoRandom(blockIndex + 12) * 10 - 5);

      group.add(createStripCasino({
        position,
        rotationY: getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        width: 12 + pseudoRandom(blockIndex + 3) * 11,
        height: 16 + pseudoRandom(blockIndex + 8) * 26,
        depth: 8 + pseudoRandom(blockIndex + 14) * 9,
        screenColor: colors[blockIndex % colors.length],
        accentColor: colors[(blockIndex + 2) % colors.length],
        index: 100 + blockIndex
      }));
    });
  });
}

function addMsgSphere(group, curve, definition) {
  const progress = 0.48;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const normal = getRightVector(tangent);
  const sphere = new THREE.Group();
  sphere.name = "VegasMSGSphere";
  sphere.position
    .copy(point)
    .addScaledVector(normal, definition.roadWidth * 0.5 + 58);

  const sphereMaterial = createFlatStandardMaterial({
    color: 0x2810ff,
    emissive: 0x32f6ff,
    emissiveIntensity: 2.8,
    roughness: 0.2,
    metalness: 0.04
  });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(28, 32, 18), sphereMaterial);
  glass.position.y = 29;
  glass.castShadow = true;
  glass.receiveShadow = true;
  sphere.add(glass);

  const baseMaterial = createFlatStandardMaterial({
    color: 0x11131c,
    emissive: 0x071226,
    emissiveIntensity: 0.35,
    roughness: 0.46,
    metalness: 0.12
  });
  const base = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(24, 30, 3.2, 24), baseMaterial));
  base.position.y = 1.6;
  sphere.add(base);

  [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78].forEach((color, index) => {
    const ringMaterial = createFlatStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 4.4,
      roughness: 0.18
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(28.4, 0.18, 8, 80), ringMaterial);
    ring.position.y = 29 + (index - 1.5) * 7.5;
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = index * 0.4;
    sphere.add(ring);
  });

  [0x32f6ff, 0xff2bd6, 0xffffff].forEach((color, index) => {
    const meridianMaterial = createFlatStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.4,
      roughness: 0.18
    });
    const meridian = new THREE.Mesh(new THREE.TorusGeometry(28.75, 0.08, 6, 72), meridianMaterial);
    meridian.position.y = 29;
    meridian.rotation.y = Math.PI / 2;
    meridian.rotation.x = index * 0.58;
    sphere.add(meridian);
  });

  sphere.userData.spin = { x: 0, y: 0.08, z: 0 };
  group.add(sphere);
}

function addParisEiffel(group, curve, definition) {
  const progress = 0.145;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const normal = getRightVector(tangent);
  const tower = new THREE.Group();
  tower.name = "VegasParisEiffelTower";
  tower.position
    .copy(point)
    .addScaledVector(normal, -(definition.roadWidth * 0.5 + 54));
  tower.rotation.y = getHeading(tangent);

  const gold = 0xffd23a;
  const material = createFlatStandardMaterial({
    color: gold,
    emissive: gold,
    emissiveIntensity: 4.2,
    roughness: 0.24,
    metalness: 0.18
  });
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 14, 64, 4, 5, false), material);
  wire.name = "EiffelWireframeBody";
  wire.position.y = 32;
  wire.material.wireframe = true;
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 26), material);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.45, 14), material);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 36, 6), material);
  deck1.position.y = 18;
  deck2.position.y = 38;
  beacon.position.y = 78;
  tower.add(wire, deck1, deck2, beacon);
  group.add(tower);
}

function addBellagioFountains(group, curve, definition) {
  const progress = 0.145;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const normal = getRightVector(tangent);
  const fountain = new THREE.Group();
  fountain.name = "VegasBellagioFountains";
  fountain.position
    .copy(point)
    .addScaledVector(normal, definition.roadWidth * 0.5 + 62);
  fountain.rotation.y = getHeading(tangent);

  const waterMaterial = createFlatStandardMaterial({
    color: 0x071c3f,
    emissive: 0x0b5bb8,
    emissiveIntensity: 0.75,
    roughness: 0.38,
    metalness: 0.08
  });
  const jetMaterial = createFlatStandardMaterial({
    color: 0xcceeff,
    emissive: 0xcceeff,
    emissiveIntensity: 2.7,
    roughness: 0.2,
    transparent: true,
    opacity: 0.62
  });
  jetMaterial.depthWrite = false;

  const water = new THREE.Mesh(new THREE.BoxGeometry(46, 0.08, 82), waterMaterial);
  water.position.y = 0.06;
  fountain.add(water);

  const hotelMaterial = createFlatStandardMaterial({
    color: 0xd8c38f,
    emissive: 0x4d3113,
    emissiveIntensity: 0.22,
    roughness: 0.54,
    metalness: 0.04
  });
  const hotel = markShadow(new THREE.Mesh(new THREE.BoxGeometry(58, 18, 7), hotelMaterial));
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(21, 4.8),
    createTextPanelMaterial({
      title: "BELLAGIO",
      subtitle: "FOUNTAINS",
      background: "#16100a",
      foreground: "#fff0bd",
      accent: "#ffd23a",
      emissiveIntensity: 1.05
    })
  );
  hotel.position.set(0, 9, -45);
  sign.position.set(0, 15.2, -41.42);
  fountain.add(hotel, sign);

  for (let index = 0; index < 16; index += 1) {
    const height = 4 + Math.sin(index * 0.8) * 2.2 + pseudoRandom(index + 4) * 2.6;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 8), jetMaterial);
    jet.position.set((index - 7.5) * 2.55, height * 0.5 + 0.08, Math.sin(index * 0.9) * 8);
    fountain.add(jet);
  }

  group.add(fountain);
}

function addVegasLandmarks(group, curve, definition) {
  addMsgSphere(group, curve, definition);
  addParisEiffel(group, curve, definition);
  addBellagioFountains(group, curve, definition);
}

function createGrandstand({ position, rotationY, width, rows, accentColor, index }) {
  const stand = new THREE.Group();
  stand.name = `VegasGrandstand:${index}`;
  stand.position.copy(position);
  stand.rotation.y = rotationY;

  const concreteMaterial = createFlatStandardMaterial({
    color: 0x343844,
    roughness: 0.7,
    metalness: 0.04
  });
  const seatMaterial = createFlatStandardMaterial({
    color: 0xded7c9,
    emissive: 0xffefe0,
    emissiveIntensity: 0.34,
    roughness: 0.65
  });
  const lightMaterial = createFlatStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 2.4,
    roughness: 0.2
  });

  for (let row = 0; row < rows; row += 1) {
    const tier = markShadow(new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.42, 2.4),
      row % 2 === 0 ? seatMaterial : concreteMaterial
    ));
    tier.position.set(0, 0.35 + row * 0.62, -row * 1.15);
    stand.add(tier);
  }

  const roof = markShadow(new THREE.Mesh(new THREE.BoxGeometry(width + 2.5, 0.36, 3.2), concreteMaterial));
  const topLightStrip = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.18, 0.22), lightMaterial);
  roof.position.set(0, rows * 0.62 + 1.1, -rows * 1.15 - 0.8);
  topLightStrip.position.set(0, rows * 0.62 + 0.7, 1.35);
  stand.add(roof, topLightStrip);
  addSeatedSpectators(stand, width, rows, index);

  return stand;
}

const spectatorMaterialCache = {
  shirts: [],
  skins: [],
  hairs: [],
  pants: null
};

function getSpectatorMaterials(shirtColors, skinColors, hairColors) {
  if (spectatorMaterialCache.shirts.length === 0) {
    spectatorMaterialCache.shirts = shirtColors.map((color) => new THREE.MeshBasicMaterial({ color }));
    spectatorMaterialCache.skins = skinColors.map((color) => new THREE.MeshBasicMaterial({ color }));
    spectatorMaterialCache.hairs = hairColors.map((color) => new THREE.MeshBasicMaterial({ color }));
    spectatorMaterialCache.pants = new THREE.MeshBasicMaterial({ color: 0x18202a });
  }
  return spectatorMaterialCache;
}

function addSeatedSpectators(stand, width, rows, seed) {
  const shirtColors = [0xffd23a, 0x32f6ff, 0xff2bd6, 0x48ff78, 0xf4f2e8, 0x6aa7ff, 0xff7a59];
  const skinColors = [0xf0c7a0, 0xd49a6a, 0x8b5a3c, 0xf4d2b5];
  const hairColors = [0x15100c, 0x4a2b18, 0x8a5a2b, 0xd8b15f, 0x5f6470];

  const mats = getSpectatorMaterials(shirtColors, skinColors, hairColors);
  const shirtMaterials = mats.shirts;
  const skinMaterials = mats.skins;
  const hairMaterials = mats.hairs;
  const pantsMaterial = mats.pants;

  const torsoGeometry = new THREE.CylinderGeometry(0.3, 0.24, 0.82, 8);
  const headGeometry = new THREE.SphereGeometry(0.26, 12, 12);
  const hairGeometry = new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const legGeometry = new THREE.CylinderGeometry(0.12, 0.1, 0.72, 8);
  const armGeometry = new THREE.CylinderGeometry(0.095, 0.07, 0.55, 8);

  const seatsPerRow = Math.max(7, Math.floor(width / 1.62));
  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = skinMaterials.map(() => []);
  const hairMatrices = hairMaterials.map(() => []);
  const leftArmMatrices = skinMaterials.map(() => []);
  const rightArmMatrices = skinMaterials.map(() => []);
  const leftLegMatrices = [];
  const rightLegMatrices = [];

  const matrix = new THREE.Matrix4();
  const torsoQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0));
  const headQuaternion = new THREE.Quaternion();
  // Cylinders point along Y, legs point forward (Z) so rotate +90deg (PI/2) on X
  const legQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.28, 0, 0));
  const leftArmQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0.26));
  const rightArmQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, -0.26));
  const variedScale = new THREE.Vector3();

  for (let row = 0; row < rows; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const noise = pseudoRandom(seed * 19 + row * 7.3 + seat * 2.1);
      if (noise < 0.08) continue;

      const jitter = (pseudoRandom(seed * 11 + row * 5.1 + seat * 3.7) - 0.5) * 0.12;
      const x = (seat / (seatsPerRow - 1) - 0.5) * width * 0.86 + jitter;
      const y = 0.82 + row * 0.62;
      const z = 0.02 - row * 1.15;
      const shirtIndex = (seat + row + seed) % shirtMaterials.length;
      const skinIndex = (seat * 2 + row + seed) % skinMaterials.length;
      const hairIndex = (seat * 3 + row + seed) % hairMaterials.length;
      const scaleNoise = 1.08 + pseudoRandom(seed * 23 + row * 13 + seat) * 0.2;

      variedScale.set(scaleNoise, scaleNoise, scaleNoise);

      matrix.compose(new THREE.Vector3(x, y + 0.04, z), torsoQuaternion, variedScale);
      torsoMatrices[shirtIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x, y + 0.68, z + 0.03), headQuaternion, variedScale);
      headMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x, y + 0.69, z + 0.03), headQuaternion, variedScale);
      hairMatrices[hairIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.35, y + 0.04, z + 0.03), leftArmQuaternion, variedScale);
      leftArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.35, y + 0.04, z + 0.03), rightArmQuaternion, variedScale);
      rightArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.16, y - 0.33, z + 0.44), legQuaternion, variedScale);
      leftLegMatrices.push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.16, y - 0.33, z + 0.44), legQuaternion, variedScale);
      rightLegMatrices.push(matrix.clone());
    }
  }

  torsoMatrices.forEach((matrices, materialIndex) => {
    addInstancedSpectatorPart(stand, torsoGeometry, shirtMaterials[materialIndex], matrices, `Torso:${materialIndex}`);
  });
  headMatrices.forEach((matrices, materialIndex) => {
    addInstancedSpectatorPart(stand, headGeometry, skinMaterials[materialIndex], matrices, `Head:${materialIndex}`);
    addInstancedSpectatorPart(stand, armGeometry, skinMaterials[materialIndex], leftArmMatrices[materialIndex], `LeftArm:${materialIndex}`);
    addInstancedSpectatorPart(stand, armGeometry, skinMaterials[materialIndex], rightArmMatrices[materialIndex], `RightArm:${materialIndex}`);
  });
  hairMatrices.forEach((matrices, materialIndex) => {
    addInstancedSpectatorPart(stand, hairGeometry, hairMaterials[materialIndex], matrices, `Hair:${materialIndex}`);
  });
  addInstancedSpectatorPart(stand, legGeometry, pantsMaterial, leftLegMatrices, "LeftLeg");
  addInstancedSpectatorPart(stand, legGeometry, pantsMaterial, rightLegMatrices, "RightLeg");
}

function addInstancedSpectatorPart(stand, geometry, material, matrices, name) {
  if (matrices.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = `VegasGrandstandSpectator${name}`;
  matrices.forEach((partMatrix, partIndex) => mesh.setMatrixAt(partIndex, partMatrix));
  mesh.instanceMatrix.needsUpdate = true;
  stand.add(mesh);
}

function createPaddockBuilding({ position, rotationY }) {
  const paddock = new THREE.Group();
  paddock.name = "VegasF1Paddock";
  paddock.position.copy(position);
  paddock.rotation.y = rotationY;

  const wallMaterial = createFlatStandardMaterial({
    color: 0xb8b4aa,
    roughness: 0.48,
    metalness: 0.08
  });
  const glassMaterial = createFlatStandardMaterial({
    color: 0x182036,
    emissive: 0x5ec8ff,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.24
  });
  const redMaterial = createFlatStandardMaterial({
    color: 0xff2b2b,
    emissive: 0xff2b2b,
    emissiveIntensity: 1.8,
    roughness: 0.35
  });
  const roofMaterial = createFlatStandardMaterial({
    color: 0xf2f0e8,
    roughness: 0.58
  });

  const base = markShadow(new THREE.Mesh(new THREE.BoxGeometry(58, 7.2, 16), wallMaterial));
  const upper = markShadow(new THREE.Mesh(new THREE.BoxGeometry(48, 5.4, 13.5), glassMaterial));
  const roof = markShadow(new THREE.Mesh(new THREE.BoxGeometry(64, 0.7, 19), roofMaterial));
  const redRoof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.18, 1.8), redMaterial);
  const lightBand = new THREE.Mesh(new THREE.BoxGeometry(52, 0.16, 0.22), redMaterial);

  base.position.y = 4;
  upper.position.set(0, 11.2, -0.4);
  roof.position.y = 14.6;
  redRoof.position.set(0, 15.05, -8.2);
  lightBand.position.set(0, 8.4, 11.15);
  paddock.add(base, upper, roof, redRoof, lightBand);

  return paddock;
}

function createSkyBeam({ position, color, height = 170, rotationZ = 0 }) {
  const material = createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.6,
    roughness: 0.2,
    transparent: true,
    opacity: 0.5
  });
  material.depthWrite = false;

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.75, height, 8, 1, true), material);
  beam.name = "VegasSkyBeam";
  beam.position.copy(position);
  beam.position.y += height * 0.5;
  beam.rotation.z = rotationZ;
  return beam;
}

function addVegasF1Venue(group, curve, definition) {
  const roadHalfWidth = definition.roadWidth * 0.5;
  const colors = [0x32f6ff, 0xd7e6ff, 0xff2bd6, 0xffd23a];
  const grandstandProgress = [0.1, 0.18, 0.38, 0.52, 0.66, 0.82, 0.92];

  grandstandProgress.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const position = point
      .clone()
      .addScaledVector(normal, side * (definition.roadWidth * 0.5 + 38))
      .addScaledVector(tangent, pseudoRandom(index + 2.2) * 8 - 4);
    clampPropPosition(curve, position, roadHalfWidth, 200, 30, 35);

    group.add(createGrandstand({
      position,
      rotationY: getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
      width: 28 + pseudoRandom(index + 5.4) * 18,
      rows: 6 + Math.floor(pseudoRandom(index + 7.8) * 4),
      accentColor: colors[index % colors.length],
      index
    }));
  });

  const paddockPoint = curve.getPointAt(0.18);
  const paddockTangent = curve.getTangentAt(0.18).setY(0).normalize();
  const paddockNormal = getRightVector(paddockTangent);
  const paddockPosition = paddockPoint.clone().addScaledVector(paddockNormal, definition.roadWidth * 0.5 + 54);
  clampPropPosition(curve, paddockPosition, roadHalfWidth);
  group.add(createPaddockBuilding({
    position: paddockPosition,
    rotationY: getHeading(paddockTangent) - Math.PI / 2
  }));

  [0.34, 0.43, 0.52, 0.62, 0.72, 0.82, 0.93].forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const position = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 62));
    clampPropPosition(curve, position, roadHalfWidth);
    group.add(createSkyBeam({
      position,
      color: colors[index % colors.length],
      rotationZ: (side > 0 ? -1 : 1) * (0.08 + index * 0.012)
    }));
  });
}

function drawStar(ctx, centerX, centerY, outerRadius, innerRadius, points) {
  ctx.beginPath();

  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
}

function createVegasSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf2";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.5, height * 0.54);
  ctx.strokeStyle = "#166bd1";
  ctx.lineWidth = 20;
  ctx.strokeRect(-315, -120, 630, 240);
  ctx.strokeStyle = "#f5d45a";
  ctx.lineWidth = 6;
  ctx.strokeRect(-292, -97, 584, 194);
  ctx.restore();

  drawStar(ctx, width * 0.5, 44, 38, 16, 8);
  ctx.fillStyle = "#e5282f";
  ctx.fill();
  ctx.strokeStyle = "#ffef73";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 50, 80, 0.55)";
  ctx.shadowBlur = 12;

  ctx.fillStyle = "#e1242c";
  ctx.font = "bold 45px Arial, sans-serif";
  ctx.fillText("WELCOME", width * 0.5, 92);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#111111";
  ctx.font = "italic 30px Georgia, serif";
  ctx.fillText("TO Fabulous", width * 0.5, 135);

  ctx.shadowColor = "rgba(255, 0, 64, 0.65)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#f0163d";
  ctx.font = "bold 78px Arial Black, Arial, sans-serif";
  ctx.fillText("LAS VEGAS", width * 0.5, 210);

  ctx.shadowColor = "rgba(28, 94, 210, 0.65)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#1359c7";
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText("NEVADA", width * 0.5, 284);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1359c7";
  for (let index = 0; index < 11; index += 1) {
    ctx.beginPath();
    ctx.arc(234 + index * 30, 330, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createVegasSign(curve, definition) {
  const progress = 0.045;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const normal = getRightVector(tangent);
  const heading = getHeading(tangent);
  const sign = new THREE.Group();
  sign.name = "VegasWelcomeCanvasSign";
  sign.position
    .copy(point)
    .addScaledVector(normal, -(definition.roadWidth * 0.5 + 17));
  sign.rotation.y = heading + Math.PI / 2;

  const metalMaterial = createFlatStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.34,
    metalness: 0.72
  });
  const edgeMaterial = createFlatStandardMaterial({
    color: 0x145ad6,
    emissive: 0x145ad6,
    emissiveIntensity: 2.4,
    roughness: 0.22,
    metalness: 0.1
  });
  const bulbMaterial = createFlatStandardMaterial({
    color: 0xffd23a,
    emissive: 0xffd23a,
    emissiveIntensity: 3.4,
    roughness: 0.18
  });
  const signTexture = createVegasSignTexture();
  const signMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: signTexture,
    emissive: 0xffffff,
    emissiveMap: signTexture,
    emissiveIntensity: 0.95,
    roughness: 0.28,
    metalness: 0.02,
    flatShading: true
  });

  const postGeometry = new THREE.CylinderGeometry(0.14, 0.2, 5.8, 10);
  const leftPost = markShadow(new THREE.Mesh(postGeometry, metalMaterial));
  const rightPost = markShadow(new THREE.Mesh(postGeometry, metalMaterial));
  const connector = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 0.16), metalMaterial));
  const frame = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.45, 0.24), edgeMaterial));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 3.9), signMaterial);
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), bulbMaterial);

  leftPost.position.set(-4.0, 2.9, 0);
  rightPost.position.set(4.0, 2.9, 0);
  connector.position.set(0, 2.0, -0.04);
  frame.position.set(0, 4.25, -0.08);
  panel.position.set(0, 4.25, 0.06);
  crown.position.set(0, 6.55, 0.1);
  panel.castShadow = true;
  panel.receiveShadow = true;

  sign.add(leftPost, rightPost, connector, frame, panel, crown);

  for (let index = 0; index < 9; index += 1) {
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), bulbMaterial);
    bulb.position.set((index / 8 - 0.5) * 7.7, 2.25, 0.12);
    sign.add(bulb);
  }

  return sign;
}

function addVegasLightPosts(group, curve, definition) {
  const roadHalfWidth = definition.roadWidth * 0.5;
  const totalLength = curve.getLength();
  const lampCount = Math.min(24, Math.max(1, Math.floor(totalLength / 25)));
  const lampColor = 0xffe8a0;
  const poleGeometry = new THREE.CylinderGeometry(0.25, 0.25, 9, 5);
  const headGeometry = new THREE.BoxGeometry(2, 0.5, 1.5);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2a,
    flatShading: true,
    roughness: 0.72,
    metalness: 0.08
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: lampColor,
    emissive: lampColor,
    emissiveIntensity: 0.9,
    flatShading: true,
    roughness: 0.28,
    metalness: 0.02
  });

  for (let index = 0; index < lampCount; index += 1) {
    const progress = ((index * 25) + 12.5) / totalLength;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const base = point.clone().addScaledVector(normal, side * (roadHalfWidth + 2));
    clampPropPosition(curve, base, roadHalfWidth);

    const lamp = new THREE.Group();
    lamp.name = `VegasStreetLamp:${index}`;
    lamp.position.copy(base);
    lamp.rotation.y = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);

    const pole = markShadow(new THREE.Mesh(poleGeometry, poleMaterial));
    pole.position.y = 4.5;
    pole.rotation.z = side * -0.05;

    const head = new THREE.Mesh(headGeometry, lampMaterial);
    head.position.set(0, 9.2, 0);
    head.receiveShadow = true;

    const light = addDecorativePointLight(lamp, lampColor, 25, 20, 2, head.position);
    if (light) {
      light.name = `VegasStreetLampLight:${index}`;
    }

    lamp.add(pole, head);
    group.add(lamp);
  }
}

function getRoadsideTransform(curve, progress, side, offset, roadHalfWidth, minClearance = 20) {
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const position = getSafeRoadsidePosition(curve, progress, side, offset, roadHalfWidth, minClearance);
  const rotationY = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);

  return { position, rotationY };
}

function createVegasMaterial({ color, emissive, emissiveIntensity = 0.6, roughness = 0.85, metalness = 0.05 }) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ?? color,
    emissiveIntensity,
    roughness,
    metalness,
    flatShading: true
  });
}

function addFacadeNeonSign(parent, { position, seed, color, lineCount = 4 }) {
  const sign = new THREE.Group();
  sign.name = `VegasFacadeNeonSign:${seed}`;
  sign.position.copy(position);

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    flatShading: true,
    roughness: 0.22,
    metalness: 0.03
  });

  for (let line = 0; line < lineCount; line += 1) {
    const width = 8 + pseudoRandom(seed * 11 + line * 3.4) * 8;
    const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, 0.2), material);
    segment.position.set(
      (pseudoRandom(seed * 7 + line) - 0.5) * 1.8,
      -line * 2.05,
      0
    );
    sign.add(segment);
  }

  addDecorativePointLight(sign, color, 12, 15, 2, new THREE.Vector3(0, -lineCount, 2.2));
  parent.add(sign);
}

function buildCaesarsPalace(group, curve, roadHalfWidth) {
  const palace = new THREE.Group();
  palace.name = "VegasSkyline:CaesarsPalace";
  const transform = getRoadsideTransform(curve, 0.3, -1, roadHalfWidth + 145, roadHalfWidth, 70);
  palace.position.copy(transform.position);
  palace.rotation.y = transform.rotationY;
  palace.scale.set(0.52, 0.52, 0.52);

  const cream = createVegasMaterial({ color: 0xc8b89a });
  const domeMaterial = createVegasMaterial({ color: 0xb8a882, roughness: 0.68 });
  const goldTrim = createVegasMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.8,
    roughness: 0.32,
    metalness: 0.1
  });

  const main = markShadow(new THREE.Mesh(new THREE.BoxGeometry(60, 45, 40), cream));
  const leftWing = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 35, 30), cream));
  const rightWing = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 35, 30), cream));
  main.position.y = 22.5;
  leftWing.position.set(-40, 17.5, 0);
  rightWing.position.set(40, 17.5, 0);
  palace.add(main, leftWing, rightWing);

  for (let index = 0; index < 6; index += 1) {
    const column = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 20, 6), cream));
    column.position.set(-22 + index * 8.8, 10, 20.8);
    palace.add(column);
  }

  const dome = markShadow(new THREE.Mesh(new THREE.SphereGeometry(8, 6, 4), domeMaterial));
  dome.position.set(0, 48, 0);
  dome.scale.y = 0.58;
  palace.add(dome);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(64, 0.7, 1.2), goldTrim);
  cornice.position.set(0, 45.5, 20.9);
  palace.add(cornice);
  addFacadeNeonSign(palace, {
    position: new THREE.Vector3(-18, 34, 21.6),
    seed: 1,
    color: 0xff2090,
    lineCount: 4
  });
  addFacadeNeonSign(palace, {
    position: new THREE.Vector3(18, 28, 21.6),
    seed: 2,
    color: 0xffe600,
    lineCount: 3
  });

  group.add(palace);
}

function buildMgmGrand(group, curve, roadHalfWidth) {
  const mgm = new THREE.Group();
  mgm.name = "VegasSkyline:MGMGrand";
  const transform = getRoadsideTransform(curve, 0.5, 1, roadHalfWidth + 110, roadHalfWidth, 45);
  mgm.position.copy(transform.position);
  mgm.rotation.y = transform.rotationY;
  mgm.scale.set(0.5, 0.5, 0.5);

  const towerMaterial = createVegasMaterial({ color: 0x1a3d1a });
  const lionMaterial = createVegasMaterial({ color: 0xd4af37, roughness: 0.42, metalness: 0.16 });
  const neonMaterial = createVegasMaterial({
    color: 0x00ff44,
    emissive: 0x00ff44,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });
  const signMaterial = createVegasMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 1,
    roughness: 0.28,
    metalness: 0.08
  });

  const podium = markShadow(new THREE.Mesh(new THREE.BoxGeometry(60, 8, 55), towerMaterial));
  const tower = markShadow(new THREE.Mesh(new THREE.BoxGeometry(35, 120, 35), towerMaterial));
  podium.position.y = 4;
  tower.position.y = 68;
  mgm.add(podium, tower);

  const cornerPositions = [
    [-17.9, 68, -17.9],
    [17.9, 68, -17.9],
    [-17.9, 68, 17.9],
    [17.9, 68, 17.9]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 80, 0.4), neonMaterial);
    strip.position.set(x, y, z);
    mgm.add(strip);
  });

  const lionBody = markShadow(new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), lionMaterial));
  const lionHead = markShadow(new THREE.Mesh(new THREE.SphereGeometry(5, 4, 3), lionMaterial));
  lionBody.position.set(0, 7, 30);
  lionHead.position.set(0, 13, 30);
  mgm.add(lionBody, lionHead);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 1), signMaterial);
  sign.position.set(0, 131, 18.2);
  mgm.add(sign);
  addFacadeNeonSign(mgm, {
    position: new THREE.Vector3(0, 96, 18.4),
    seed: 3,
    color: 0x00e5ff,
    lineCount: 5
  });
  addFacadeNeonSign(mgm, {
    position: new THREE.Vector3(0, 46, 18.4),
    seed: 4,
    color: 0xff2090,
    lineCount: 3
  });

  group.add(mgm);
}

function buildBellagio(group, curve, roadHalfWidth) {
  const bellagio = new THREE.Group();
  bellagio.name = "VegasSkyline:Bellagio";
  const transform = getRoadsideTransform(curve, 0.6, -1, roadHalfWidth + 175, roadHalfWidth, 90);
  bellagio.position.copy(transform.position);
  bellagio.rotation.y = transform.rotationY;
  bellagio.scale.set(0.42, 0.42, 0.42);

  const facadeMaterial = createVegasMaterial({ color: 0xe0d0b8 });
  const glassMaterial = createVegasMaterial({ color: 0x1a3050, roughness: 0.42, metalness: 0.1 });
  const waterMaterial = createVegasMaterial({ color: 0x0a4a6e, roughness: 0.4, metalness: 0.08 });
  const jetMaterial = createVegasMaterial({
    color: 0x88ddff,
    emissive: 0x88ddff,
    emissiveIntensity: 1.2,
    roughness: 0.2
  });
  const warmStripMaterial = createVegasMaterial({
    color: 0xffa040,
    emissive: 0xffa040,
    emissiveIntensity: 0.8,
    roughness: 0.26
  });

  for (let index = 0; index < 5; index += 1) {
    const block = markShadow(new THREE.Mesh(new THREE.BoxGeometry(18, 55, 15), facadeMaterial));
    const offset = index - 2;
    block.position.set(offset * 15, 27.5, Math.abs(offset) * 3);
    block.rotation.y = -offset * 0.08;
    bellagio.add(block);
  }

  const glassTower = markShadow(new THREE.Mesh(new THREE.BoxGeometry(25, 75, 22), glassMaterial));
  glassTower.position.set(45, 37.5, 4);
  bellagio.add(glassTower);

  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.3, 12), waterMaterial);
  fountain.position.set(0, 0.15, 35);
  fountain.rotation.y = Math.PI / 12;
  bellagio.add(fountain);

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const height = 6 + pseudoRandom(index + 30.4) * 8;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.1, height, 4), jetMaterial);
    jet.position.set(Math.cos(angle) * 11, height * 0.5 + 0.3, 35 + Math.sin(angle) * 11);
    bellagio.add(jet);
  }

  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(82, 0.45, 1), warmStripMaterial);
  lightStrip.position.set(0, 2.2, 8.2);
  bellagio.add(lightStrip);
  addFacadeNeonSign(bellagio, {
    position: new THREE.Vector3(-22, 42, 15.2),
    seed: 5,
    color: 0xffe600,
    lineCount: 4
  });
  addFacadeNeonSign(bellagio, {
    position: new THREE.Vector3(45, 56, 15.4),
    seed: 6,
    color: 0x00e5ff,
    lineCount: 5
  });

  group.add(bellagio);
}

function buildWelcomeToVegasSign(group, curve, roadHalfWidth) {
  const signGroup = new THREE.Group();
  signGroup.name = "VegasSkyline:WelcomeToLasVegasSign";

  // progress=0.055 → midway between start (0) and first grandstand (0.1), right side of track.
  // offset roadHalfWidth+18 = 23.25u clears absoluteMinClearance from the approach track segment.
  // rotation +PI*0.5: front face points toward the road center so it's readable while driving.
  const transform = getRoadsideTransform(curve, 0.055, -1, roadHalfWidth + 18, roadHalfWidth, 8);
  signGroup.position.copy(transform.position);
  signGroup.rotation.y = transform.rotationY + Math.PI * 0.5;

  const welcomeTex = getCachedWelcomeToVegasTexture();
  const welcomeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: welcomeTex,
    emissive: 0xffffff,
    emissiveMap: welcomeTex,
    emissiveIntensity: 1.5,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.08
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), welcomeMat);
  plane.position.y = 10; // rests on the ground, 20m tall
  signGroup.add(plane);

  // Spotlight to illuminate the sign at night
  addDecorativePointLight(signGroup, 0xffffff, 8, 15, 1.5, new THREE.Vector3(0, 8, 3.5));

  group.add(signGroup);
}

function buildEiffelTower(group, curve, roadHalfWidth) {
  const tower = new THREE.Group();
  tower.name = "VegasSkyline:EiffelTower";

  // Position it at progress 0.11, right side (side = -1), offset = roadHalfWidth + 72
  const transform = getRoadsideTransform(curve, 0.11, -1, roadHalfWidth + 72, roadHalfWidth, 35);
  tower.position.copy(transform.position);
  tower.rotation.y = transform.rotationY;

  const metalMaterial = createVegasMaterial({
    color: 0x1f1d24,
    roughness: 0.6,
    metalness: 0.4
  });

  const goldNeonMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb800,
    emissive: 0xffb800,
    emissiveIntensity: 1.5,
    roughness: 0.2
  });

  // Base legs
  const legGeo = new THREE.CylinderGeometry(0.8, 1.6, 20, 5);
  const angles = [Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4];
  const legSpacing = 12;

  angles.forEach((angle) => {
    const leg = markShadow(new THREE.Mesh(legGeo, metalMaterial));
    leg.position.set(Math.cos(angle) * legSpacing, 10, Math.sin(angle) * legSpacing);
    leg.rotation.z = -Math.cos(angle) * 0.25;
    leg.rotation.x = Math.sin(angle) * 0.25;
    tower.add(leg);

    // Glowing neon strips along the legs
    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 20.2, 0.3), goldNeonMaterial);
    neonStrip.position.copy(leg.position);
    neonStrip.rotation.copy(leg.rotation);
    neonStrip.position.x += Math.cos(angle) * 0.8;
    neonStrip.position.z += Math.sin(angle) * 0.8;
    tower.add(neonStrip);
  });

  // Platform 1
  const plat1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 2.5, 20), metalMaterial));
  plat1.position.y = 20;
  tower.add(plat1);

  // Platform 1 neon border
  const plat1Neon = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.6, 20.4), goldNeonMaterial);
  plat1Neon.position.y = 20;
  tower.add(plat1Neon);

  // Decorative arches under platform 1
  const archMat = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 0.8
  });
  for (let i = 0; i < 4; i++) {
    const rot = (i * Math.PI) / 2;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.4, 6, 16, Math.PI), archMat);
    arch.position.set(0, 18.8, 0);
    arch.rotation.y = rot;
    arch.position.x += Math.cos(rot) * (legSpacing - 2);
    arch.position.z += Math.sin(rot) * (legSpacing - 2);
    arch.rotation.z = Math.PI;
    tower.add(arch);
  }

  // Mid legs
  const midLegGeo = new THREE.CylinderGeometry(0.5, 0.8, 18, 5);
  const midLegSpacing = 7;
  angles.forEach((angle) => {
    const leg = markShadow(new THREE.Mesh(midLegGeo, metalMaterial));
    leg.position.set(Math.cos(angle) * midLegSpacing, 29, Math.sin(angle) * midLegSpacing);
    leg.rotation.z = -Math.cos(angle) * 0.16;
    leg.rotation.x = Math.sin(angle) * 0.16;
    tower.add(leg);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 18.2, 0.2), goldNeonMaterial);
    neonStrip.position.copy(leg.position);
    neonStrip.rotation.copy(leg.rotation);
    neonStrip.position.x += Math.cos(angle) * 0.5;
    neonStrip.position.z += Math.sin(angle) * 0.5;
    tower.add(neonStrip);
  });

  // Platform 2
  const plat2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(11, 1.8, 11), metalMaterial));
  plat2.position.y = 38;
  tower.add(plat2);

  const plat2Neon = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 11.4), goldNeonMaterial);
  plat2Neon.position.y = 38;
  tower.add(plat2Neon);

  // Spire / Top section
  const spireGeo = new THREE.CylinderGeometry(0.1, 0.5, 27, 4);
  const spire = markShadow(new THREE.Mesh(spireGeo, metalMaterial));
  spire.position.set(0, 51.5, 0);
  tower.add(spire);

  const spireNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.55, 27.2, 4), goldNeonMaterial);
  spireNeon.position.set(0, 51.5, 0);
  tower.add(spireNeon);

  // Top Beacon Light
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 3.0
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), beaconMat);
  beacon.position.set(0, 65.5, 0);
  tower.add(beacon);

  addDecorativePointLight(tower, 0xffffff, 25, 45, 1.2, new THREE.Vector3(0, 65.5, 0));

  group.add(tower);
}

function buildFerrisWheel(group, curve, roadHalfWidth) {
  const ferrisGroup = new THREE.Group();
  ferrisGroup.name = "VegasSkyline:FerrisWheel";

  // Position at progress 0.13, right side (side = -1), offset = roadHalfWidth + 72
  const transform = getRoadsideTransform(curve, 0.13, -1, roadHalfWidth + 72, roadHalfWidth, 35);
  ferrisGroup.position.copy(transform.position);
  // Orient it so the wheel is parallel to the road
  ferrisGroup.rotation.y = transform.rotationY + Math.PI / 2;

  const metalMaterial = createVegasMaterial({ color: 0x222026, roughness: 0.7, metalness: 0.3 });

  const neonCyan = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.6,
    roughness: 0.1
  });

  const neonMagenta = new THREE.MeshStandardMaterial({
    color: 0xff2090,
    emissive: 0xff2090,
    emissiveIntensity: 1.6,
    roughness: 0.1
  });

  // Supports (A-frame structure)
  [-1.5, 1.5].forEach((zOffset) => {
    const legLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 30, 5), metalMaterial));
    legLeft.position.set(-6, 14, zOffset);
    legLeft.rotation.z = -0.2;
    ferrisGroup.add(legLeft);

    const legRight = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 30, 5), metalMaterial));
    legRight.position.set(6, 14, zOffset);
    legRight.rotation.z = 0.2;
    ferrisGroup.add(legRight);
  });

  const axle = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.2, 8), metalMaterial));
  axle.position.set(0, 28, 0);
  axle.rotation.x = Math.PI / 2;
  ferrisGroup.add(axle);

  // Rotating part group (this is what spins)
  const rotatingPart = new THREE.Group();
  rotatingPart.name = "FerrisWheelRotatingPart";
  rotatingPart.position.set(0, 28, 0);

  // Set the rotation spin! (slowly rotates around Z-axis)
  const spinSpeed = 0.08;
  rotatingPart.userData.spin = { x: 0, y: 0, z: spinSpeed };

  // Double outer rings
  const ringRadius = 18;
  [-0.9, 0.9].forEach((zOffset, ringIndex) => {
    const ringMat = ringIndex === 0 ? neonCyan : neonMagenta;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.35, 8, 36), ringMat);
    ring.position.set(0, 0, zOffset);
    rotatingPart.add(ring);
  });

  // Spokes connecting hub to outer rings
  const spokeMat = createVegasMaterial({
    color: 0x0088ff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.8,
    roughness: 0.3
  });
  const spokeCount = 12;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    [-0.9, 0.9].forEach((zOffset) => {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ringRadius, 4), spokeMat);
      spoke.position.set(Math.cos(angle) * (ringRadius * 0.5), Math.sin(angle) * (ringRadius * 0.5), zOffset);
      spoke.rotation.z = angle + Math.PI / 2;
      rotatingPart.add(spoke);
    });
  }

  // Cabins hanging off the outer edge
  const cabinColors = [0xffe600, 0xff2090, 0x39ff14, 0x00e5ff, 0xff8800];
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const cabinColor = cabinColors[i % cabinColors.length];

    const cabinGroup = new THREE.Group();
    cabinGroup.name = `FerrisCabin:${i}`;
    cabinGroup.position.set(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);

    // Apply counter-spin to keep cabin upright!
    cabinGroup.userData.spin = { x: 0, y: 0, z: -spinSpeed };

    // Support hanger
    const hanger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.8, 4),
      metalMaterial
    );
    hanger.position.set(0, 0.9, 0);
    cabinGroup.add(hanger);

    // Main cabin box
    const cabinMat = new THREE.MeshStandardMaterial({
      color: cabinColor,
      emissive: cabinColor,
      emissiveIntensity: 1.4,
      roughness: 0.2
    });
    const cabinBox = markShadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), cabinMat));
    cabinBox.position.set(0, 0, 0);
    cabinGroup.add(cabinBox);

    // Light inside/under the cabin
    addDecorativePointLight(cabinGroup, cabinColor, 3, 5, 2.0, new THREE.Vector3(0, -0.6, 0));

    rotatingPart.add(cabinGroup);
  }

  ferrisGroup.add(rotatingPart);

  // Center hub light
  addDecorativePointLight(ferrisGroup, 0x00ffcc, 15, 25, 1.5, new THREE.Vector3(0, 28, 0));

  group.add(ferrisGroup);
}

function buildBackgroundVegasTowers(group, curve, roadHalfWidth) {
  const colors = [0x0d0d20, 0x12112a, 0x0a1830, 0x1a0d2e];
  const windowColors = [0xffe066, 0xff8800, 0xffffff, 0x88aaff];
  const progressPoints = [0.08, 0.18, 0.28, 0.42, 0.56, 0.72, 0.86, 0.96];

  progressPoints.forEach((progress, index) => {
    const tower = new THREE.Group();
    tower.name = `VegasSkyline:BackgroundTower:${index}`;
    const side = index % 2 === 0 ? 1 : -1;
    const width = 20 + pseudoRandom(index + 1.2) * 20;
    const height = 60 + pseudoRandom(index + 2.4) * 90;
    const depth = 20 + pseudoRandom(index + 3.6) * 20;
    const distance = 85 + pseudoRandom(index + 4.8) * 65;
    const transform = getRoadsideTransform(curve, progress, side, roadHalfWidth + distance, roadHalfWidth, 65);
    const material = createVegasMaterial({ color: colors[index % colors.length], roughness: 0.62, metalness: 0.08 });
    const body = markShadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material));

    tower.position.copy(transform.position);
    tower.position.addScaledVector(
      curve.getTangentAt(progress).setY(0).normalize(),
      (pseudoRandom(index + 9) - 0.5) * 20
    );
    tower.rotation.y = transform.rotationY;
    body.position.y = height * 0.5;
    tower.add(body);

    const windowCount = 8 + Math.floor(pseudoRandom(index + 6.4) * 8);
    for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
      const color = windowColors[Math.floor(pseudoRandom(index * 31 + windowIndex * 5.7) * windowColors.length) % windowColors.length];
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.45,
        metalness: 0,
        flatShading: true
      });
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.2), windowMaterial);
      const x = (pseudoRandom(index * 17 + windowIndex) - 0.5) * width * 0.72;
      const y = 10 + pseudoRandom(index * 23 + windowIndex) * (height - 18);
      window.position.set(x, y, side > 0 ? -depth * 0.5 - 0.12 : depth * 0.5 + 0.12);
      tower.add(window);
    }

    group.add(tower);
  });
}

function buildVegasSkyline(group, curve, roadHalfWidth) {
  buildWelcomeToVegasSign(group, curve, roadHalfWidth);
  buildCaesarsPalace(group, curve, roadHalfWidth);
  buildMgmGrand(group, curve, roadHalfWidth);
  buildBellagio(group, curve, roadHalfWidth);
  buildBackgroundVegasTowers(group, curve, roadHalfWidth);
  buildEiffelTower(group, curve, roadHalfWidth);
  buildFerrisWheel(group, curve, roadHalfWidth);
}

function resolvePropClipping(propsGroup, curve, roadHalfWidth) {
  propsGroup.children.forEach((child) => {
    const name = child.name || "";
    // Skip objects that are meant to span the road (tunnels, gantries, start line, checkpoint gates)
    // or roadside lamps that are already carefully placed close to the road.
    if (
      name.includes("Tunnel") ||
      name.includes("Gantry") ||
      name.includes("Checkpoint") ||
      name.includes("Start") ||
      name.includes("StreetLamp") ||
      name.includes("LightPost")
    ) {
      return;
    }

    // Determine safety clearance based on the type of prop
    let minSafeDistance = roadHalfWidth + 3.0; // default for small props

    if (name.includes("CaesarsPalace") || name.includes("MGMGrand") || name.includes("Bellagio") || name.includes("EiffelTower") || name.includes("FerrisWheel")) {
      minSafeDistance = roadHalfWidth + 32.0;
    } else if (name.includes("BackgroundTower") || name.includes("Skyscraper")) {
      minSafeDistance = roadHalfWidth + 25.0;
    } else if (name.includes("Grandstand") || name.includes("LuxorPyramid") || name.includes("Paddock")) {
      minSafeDistance = roadHalfWidth + 32.0;
    } else if (name.includes("Billboard")) {
      minSafeDistance = roadHalfWidth + 7.5;
    } else if (name.includes("WelcomeToLasVegasSign")) {
      minSafeDistance = roadHalfWidth + 9.0;
    } else if (name.includes("HologramDie")) {
      if (child.position.y < 3.0) {
        minSafeDistance = roadHalfWidth + 3.0;
      } else {
        return;
      }
    }

    const pos = child.position;

    // We run up to 3 relaxation iterations to resolve clipping from all parts of the track
    for (let iteration = 0; iteration < 3; iteration += 1) {
      let closestPoint = null;
      let minTrackDist = Infinity;
      let closestT = 0;

      for (let index = 0; index <= 120; index += 1) {
        const t = index / 120;
        const trackPoint = curve.getPointAt(t);
        const dist = Math.sqrt((pos.x - trackPoint.x) ** 2 + (pos.z - trackPoint.z) ** 2);
        if (dist < minTrackDist) {
          minTrackDist = dist;
          closestPoint = trackPoint;
          closestT = t;
        }
      }

      if (minTrackDist < minSafeDistance) {
        const pushDir = new THREE.Vector3(pos.x - closestPoint.x, 0, pos.z - closestPoint.z);
        if (pushDir.lengthSq() < 0.0001) {
          const tangent = curve.getTangentAt(closestT).setY(0).normalize();
          pushDir.copy(getRightVector(tangent));
        } else {
          pushDir.normalize();
        }
        pos.x = closestPoint.x + pushDir.x * minSafeDistance;
        pos.z = closestPoint.z + pushDir.z * minSafeDistance;
      } else {
        break;
      }
    }
  });
}

function disableDecorativeCastShadows(group) {
  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
}

function addVegasProps(group, curve, definition) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "VegasDecorativeProps";

  generateCitySkyline(curve, propsGroup, definition);
  addVegasTunnel(propsGroup, curve, definition, 0.36, 0, 18, 0.009);
  buildVegasSkyline(propsGroup, curve, definition.roadWidth * 0.5);
  buildVegasBillboards(propsGroup, curve, definition.roadWidth * 0.5);
  addVegasF1Venue(propsGroup, curve, definition);
  addVegasLightPosts(propsGroup, curve, definition);
  addNeonPalms(propsGroup, curve, definition);
  addCasinoDice(propsGroup, curve, definition);

  // Clean up and resolve any remaining prop intersections/clipping
  resolvePropClipping(propsGroup, curve, definition.roadWidth * 0.5);

  disableDecorativeCastShadows(propsGroup);
  group.add(propsGroup);
}

function createBeachMaterial({
  color,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.85,
  metalness = 0.02
}) {
  const parameters = {
    color,
    roughness,
    metalness,
    flatShading: true
  };

  if (emissive !== undefined) {
    parameters.emissive = emissive;
    parameters.emissiveIntensity = emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(parameters);
}

function getRoadFrame(curve, progress) {
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const right = getRightVector(tangent);

  return {
    point,
    tangent,
    right,
    heading: getHeading(tangent)
  };
}

function safePlace(curve, progress, side, offset, roadHalfWidth, minClearance = 12) {
  const frame = getRoadFrame(curve, progress);
  const safeOffset = Math.max(Math.abs(offset), roadHalfWidth + minClearance);
  const position = frame.point.clone().addScaledVector(frame.right, side * safeOffset);
  clampPropPosition(curve, position, roadHalfWidth, 220, minClearance, minClearance);
  return {
    position,
    rotationY: frame.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
    frame
  };
}

function makeBasisMatrix(position, tangent, right, scale = new THREE.Vector3(1, 1, 1)) {
  const matrix = new THREE.Matrix4();
  matrix.makeBasis(right.clone().normalize(), UP, tangent.clone().setY(0).normalize().negate());
  matrix.scale(scale);
  matrix.setPosition(position);
  return matrix;
}

function addTransformedBox(target, geometry, matrix) {
  const sourcePosition = geometry.getAttribute("position");
  const sourceIndex = geometry.getIndex();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const baseIndex = target.positions.length / 3;

  for (let index = 0; index < sourcePosition.count; index += 1) {
    vertex.fromBufferAttribute(sourcePosition, index).applyMatrix4(matrix);
    target.positions.push(vertex.x, vertex.y, vertex.z);
  }

  const sourceNormal = geometry.getAttribute("normal");
  for (let index = 0; index < sourceNormal.count; index += 1) {
    normal.fromBufferAttribute(sourceNormal, index).applyMatrix3(normalMatrix).normalize();
    target.normals.push(normal.x, normal.y, normal.z);
  }

  for (let index = 0; index < sourceIndex.count; index += 1) {
    target.indices.push(baseIndex + sourceIndex.getX(index));
  }
}

function createMergedGeometry(parts) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(parts.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(parts.normals, 3));
  geometry.setIndex(parts.indices);
  return geometry;
}

function addBeachGround(group) {
  const material = createBeachMaterial({
    color: 0xe4c06c,
    roughness: 0.95
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), material);
  ground.name = "TropicalBeachPropsGround";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);
}

function createBeachSideBandGeometry(curve, trackDef, side, nearOffset, farOffset, y) {
  const vertices = [];
  const indices = [];
  const segments = trackDef.segments || 200;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).setY(0).normalize();
    const normal = getRightVector(tan);

    const nearP = p.clone().addScaledVector(normal, side * nearOffset);
    const farP = p.clone().addScaledVector(normal, side * farOffset);

    vertices.push(
      nearP.x, y, nearP.z,
      farP.x, y, farP.z
    );
  }

  for (let i = 0; i < segments; i++) {
    const current = i * 2;
    const next = (i + 1) * 2;
    if (side < 0) {
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    } else {
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBeachBand(group, curve, trackDef, side, nearOffset, farOffset, material, name, y) {
  const geometry = createBeachSideBandGeometry(curve, trackDef, side, nearOffset, farOffset, y);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBeachOceanPlane(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // Shore Sand (Spiaggia dorata)
  const sandMaterial = createBeachMaterial({ color: 0xe0c66f, roughness: 0.95 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 0.65, roadHalfWidth + 8.5, sandMaterial, "TropicalBeachOceanShore", -0.012);

  // Surf/Foam (Banda di schiuma/riva bianca)
  const surfMaterial = createBeachMaterial({ color: 0xf0f5e8, roughness: 0.50 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 8.5, roadHalfWidth + 12.5, surfMaterial, "TropicalBeachOceanSurf", -0.010);

  // Shallow Water (Acque basse turchesi)
  const shallowMaterial = createBeachMaterial({
    color: 0x30cfe0, emissive: 0x10a8c0, emissiveIntensity: 0.14, roughness: 0.44
  });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 12.5, roadHalfWidth + 150, shallowMaterial, "TropicalBeachOceanShallow", -0.014);

  // Deep Ocean (Acque profonde blu)
  const deepMaterial = createBeachMaterial({
    color: 0x005f8a, emissive: 0x003a5c, emissiveIntensity: 0.15, roughness: 0.35
  });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 150, roadHalfWidth + 1150, deepMaterial, "TropicalBeachOceanDeep", -0.018);
}


function addBeachEdgeStrips(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;
  const material = createBeachMaterial({
    color: 0xff6600,
    emissive: 0xff6600,
    emissiveIntensity: 1,
    roughness: 0.55
  });
  const segmentCount = trackDef.segments;
  const source = new THREE.BoxGeometry(0.12, 0.08, 1);
  const parts = [0, 1, 2, 3].map(() => ({ positions: [], normals: [], indices: [] }));
  const stripOffsets = [
    { side: -1, offset: roadHalfWidth + 0.05 },
    { side: -1, offset: roadHalfWidth - 0.45 },
    { side: 1, offset: roadHalfWidth - 0.45 },
    { side: 1, offset: roadHalfWidth + 0.05 }
  ];

  for (let index = 0; index < segmentCount; index += 1) {
    const a = index / segmentCount;
    const b = (index + 1) / segmentCount;
    const start = getRoadFrame(curve, a);
    const end = getRoadFrame(curve, b);
    const segLen = start.point.distanceTo(end.point);
    const midProgress = (a + b) * 0.5;
    const frame = getRoadFrame(curve, midProgress >= 1 ? midProgress - 1 : midProgress);

    stripOffsets.forEach(({ side, offset }, partIndex) => {
      const position = frame.point.clone().addScaledVector(frame.right, side * offset);
      position.y = 0.08;
      const matrix = makeBasisMatrix(position, frame.tangent, frame.right, new THREE.Vector3(1, 1, segLen));
      addTransformedBox(parts[partIndex], source, matrix);
    });
  }

  parts.forEach((part, index) => {
    const mesh = new THREE.Mesh(createMergedGeometry(part), material);
    mesh.name = `TropicalBeachEdgeStrip:${index}`;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  source.dispose();
}

function addBeachCenterDashes(group, curve, trackDef) {
  const material = createBeachMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    roughness: 0.48
  });
  const totalLength = curve.getLength();
  const dashCount = Math.floor(totalLength / 10);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.06, 3), material, dashCount);
  const matrix = new THREE.Matrix4();

  for (let index = 0; index < dashCount; index += 1) {
    const progress = ((index * 10) + 1.5) / totalLength;
    const frame = getRoadFrame(curve, progress % 1);
    const position = frame.point.clone();
    position.y = 0.07;
    matrix.copy(makeBasisMatrix(position, frame.tangent, frame.right));
    dashes.setMatrixAt(index, matrix);
  }

  dashes.name = "TropicalBeachCenterDashes";
  dashes.instanceMatrix.needsUpdate = true;
  dashes.receiveShadow = true;
  group.add(dashes);
}

function createTropicalPalm(seed = 0) {
  const palm = new THREE.Group();
  palm.name = "TropicalBeachPalm";

  const trunkMaterial = createBeachMaterial({ color: 0x6f4726, roughness: 0.9 });
  const trunkBandMaterial = createBeachMaterial({ color: 0xa87a44, roughness: 0.88 });
  const ribMaterial = createBeachMaterial({ color: 0x174d25, roughness: 0.82 });
  const leafMaterials = [
    createBeachMaterial({ color: 0x2d8f34, roughness: 0.78, metalness: 0 }),
    createBeachMaterial({ color: 0x3eaa43, roughness: 0.78, metalness: 0 }),
    createBeachMaterial({ color: 0x1f6f2b, roughness: 0.82, metalness: 0 })
  ];
  leafMaterials.forEach((material) => {
    material.side = THREE.DoubleSide;
  });
  ribMaterial.side = THREE.DoubleSide;

  const trunkHeight = 8.8 + (seed % 3) * 0.7;
  const segmentCount = 9;
  const lean = seed % 2 === 0 ? 0.075 : -0.075;
  const segmentHeight = trunkHeight / segmentCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const taper = 1 - index / segmentCount;
    const segment = markShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.17 + taper * 0.07, 0.27 + taper * 0.1, segmentHeight * 1.04, 8),
      trunkMaterial
    ));
    segment.position.set(lean * index * 0.34, segmentHeight * (index + 0.5), 0);
    segment.rotation.z = lean;
    palm.add(segment);

    if (index % 2 === 0) {
      const band = markShadow(new THREE.Mesh(
        new THREE.CylinderGeometry(0.19 + taper * 0.07, 0.2 + taper * 0.08, 0.12, 8),
        trunkBandMaterial
      ));
      band.position.copy(segment.position);
      band.rotation.z = lean;
      palm.add(band);
    }
  }

  const crown = new THREE.Group();
  crown.position.set(lean * segmentCount * 0.34, trunkHeight + 0.15, 0);

  const createFrond = (length, material, droop, leafletCount = 8) => {
    const frond = new THREE.Group();
    const rib = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, length), ribMaterial));
    rib.position.z = -length * 0.5;
    frond.add(rib);

    const leafletGeometry = new THREE.PlaneGeometry(0.22, length * 0.3);
    for (let index = 0; index < leafletCount; index += 1) {
      const progress = (index + 1) / (leafletCount + 1);
      const z = -progress * length;
      const span = Math.sin(progress * Math.PI);

      [-1, 1].forEach((side) => {
        const leaflet = markShadow(new THREE.Mesh(leafletGeometry, material));
        leaflet.position.set(side * (0.28 + span * 0.75), -progress * droop, z);
        leaflet.rotation.y = side * (Math.PI / 2.8);
        leaflet.rotation.z = side * (0.5 + progress * 0.28);
        leaflet.scale.set(0.8 + span * 0.65, 1, 1);
        frond.add(leaflet);
      });
    }

    return frond;
  };

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const length = 5.8 + pseudoRandom(seed + index * 0.7) * 1.2;
    const frond = createFrond(length, leafMaterials[index % leafMaterials.length], 1.1 + (index % 3) * 0.28, 7);
    frond.rotation.y = angle;
    frond.rotation.x = Math.PI / 3.6 + (index % 4) * 0.07;
    frond.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.12;
    frond.position.set(Math.cos(angle) * 0.34, 0.12, Math.sin(angle) * 0.34);
    crown.add(frond);
  }

  [0, 1, 2].forEach((index) => {
    const angle = (index / 4) * Math.PI * 2 + 0.35;
    const uprightFrond = createFrond(4.2, leafMaterials[(index + 1) % leafMaterials.length], 0.35, 6);
    uprightFrond.rotation.y = angle;
    uprightFrond.rotation.x = Math.PI / 5.4;
    uprightFrond.position.y = 0.45;
    crown.add(uprightFrond);
  });

  // Cluster of 3 brown coconuts nestled right under the fronds
  const coconutMaterial = createBeachMaterial({ color: 0x4d321d, roughness: 0.82 });
  const coconutGeo = new THREE.SphereGeometry(0.18, 6, 6);
  for (let c = 0; c < 3; c++) {
    const coconut = markShadow(new THREE.Mesh(coconutGeo, coconutMaterial));
    // Position coconuts around the center of the crown
    const angle = (c / 3) * Math.PI * 2 + (seed % 5) * 0.4;
    const r = 0.22;
    coconut.position.set(Math.cos(angle) * r, -0.1 - (c % 2) * 0.04, Math.sin(angle) * r);
    // Give them a slightly organic, non-perfectly-spherical shape
    coconut.scale.set(1.0, 1.15, 0.95);
    crown.add(coconut);
  }

  palm.add(crown);
  return palm;
}

function createTropicalBush(seed = 0) {
  const bush = new THREE.Group();
  bush.name = "TropicalBeachBush";

  const material = createBeachMaterial({
    color: seed % 2 === 0 ? 0x2f9b4b : 0x1f7a3a,
    roughness: 0.82
  });

  for (let index = 0; index < 4; index += 1) {
    const leaf = markShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + index * 0.08, 0), material));
    leaf.position.set((index - 1.5) * 0.45, 0.55 + index * 0.1, (pseudoRandom(seed + index) - 0.5) * 0.8);
    leaf.scale.set(1.25, 0.72, 0.9);
    bush.add(leaf);
  }

  return bush;
}

function createBeachChair(seed = 0) {
  const chair = new THREE.Group();
  chair.name = "BeachPlasticChair";

  const material = createBeachMaterial({
    color: 0xf5f5f5, // White plastic
    roughness: 0.45,
    metalness: 0.05
  });

  // Seat
  const seat = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), material));
  seat.position.y = 0.4;
  chair.add(seat);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 5);
  const legOffsets = [
    [-0.32, 0.2, -0.32],
    [0.32, 0.2, -0.32],
    [-0.32, 0.2, 0.32],
    [0.32, 0.2, 0.32]
  ];
  legOffsets.forEach(([lx, ly, lz]) => {
    const leg = markShadow(new THREE.Mesh(legGeo, material));
    leg.position.set(lx, ly, lz);
    leg.rotation.z = lx * -0.12;
    leg.rotation.x = lz * 0.12;
    chair.add(leg);
  });

  // Backrest frame
  const backFrameLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), material));
  backFrameLeft.position.set(-0.34, 0.75, 0.34);
  const backFrameRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), material));
  backFrameRight.position.set(0.34, 0.75, 0.34);
  const backTop = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.06), material));
  backTop.position.set(0, 1.1, 0.34);
  chair.add(backFrameLeft, backFrameRight, backTop);

  // Vertical slats
  const slatGeo = new THREE.BoxGeometry(0.05, 0.6, 0.03);
  [-0.2, 0, 0.2].forEach((sx) => {
    const slat = markShadow(new THREE.Mesh(slatGeo, material));
    slat.position.set(sx, 0.75, 0.34);
    chair.add(slat);
  });

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.05, 0.04, 0.6);
  const armSupportGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 5);
  [-0.36, 0.36].forEach((ax) => {
    const arm = markShadow(new THREE.Mesh(armGeo, material));
    arm.position.set(ax, 0.62, 0.06);
    const support = markShadow(new THREE.Mesh(armSupportGeo, material));
    support.position.set(ax, 0.525, -0.2);
    chair.add(arm, support);
  });

  return chair;
}

function createBeachPersonSittingWithStrawHat(seed = 0) {
  const person = new THREE.Group();
  person.name = "TropicalBeachPersonSitting";

  // Skin material
  const skinMaterial = createBeachMaterial({ color: 0xdcb38c, roughness: 0.6 });
  // Shirt material (white/cream)
  const shirtMaterial = createBeachMaterial({ color: 0xfefefa, roughness: 0.5 });
  // Pants/shorts material (beige/tan)
  const pantsMaterial = createBeachMaterial({ color: 0xcca070, roughness: 0.7 });
  // Hair/beard material (black)
  const blackMaterial = createBeachMaterial({ color: 0x111111, roughness: 0.8 });
  // Straw hat material (straw yellow)
  const strawMaterial = createBeachMaterial({ color: 0xd4b26f, roughness: 0.8 });

  // 1. Torso (Busto camicia bianca, reclinato)
  const torso = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), shirtMaterial));
  torso.position.set(0, 0.4, 0.05);
  torso.rotation.x = 0.12; // Reclined slightly back
  person.add(torso);

  // 2. Head (Testa color pelle, sopra il busto reclinato)
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMaterial));
  head.position.set(0, 0.92, 0.12);
  person.add(head);

  // Hair (Capelli ricci neri)
  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), blackMaterial));
  hair.position.set(0, 0.96, 0.14);
  hair.scale.set(1.02, 0.9, 1.02);
  person.add(hair);

  // Beard (Barba corta nera)
  const beard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), blackMaterial));
  beard.position.set(0, 0.82, 0.02);
  person.add(beard);

  // 3. Legs (Thighs extending horizontally forward)
  // Pantaloncini (shorts) part of thighs
  const thighLeftPants = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.35, 6), pantsMaterial));
  thighLeftPants.position.set(-0.18, 0.06, -0.175);
  thighLeftPants.rotation.x = Math.PI / 2;
  
  const thighRightPants = thighLeftPants.clone();
  thighRightPants.position.x = 0.18;
  person.add(thighLeftPants, thighRightPants);

  // Skin (knee) part of thighs
  const thighLeftSkin = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 6), skinMaterial));
  thighLeftSkin.position.set(-0.18, 0.06, -0.4);
  thighLeftSkin.rotation.x = Math.PI / 2;
  
  const thighRightSkin = thighLeftSkin.clone();
  thighRightSkin.position.x = 0.18;
  person.add(thighLeftSkin, thighRightSkin);

  // 4. Shins (Gambe che scendono verticalmente)
  const shinLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), skinMaterial));
  shinLeft.position.set(-0.18, -0.165, -0.5);
  
  const shinRight = shinLeft.clone();
  shinRight.position.x = 0.18;
  person.add(shinLeft, shinRight);

  // Feet (Piedi orizzontali)
  const footLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMaterial));
  footLeft.position.set(-0.18, -0.38, -0.54);
  footLeft.rotation.y = 0.1;
  
  const footRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMaterial));
  footRight.position.set(0.18, -0.38, -0.54);
  footRight.rotation.y = -0.1;
  person.add(footLeft, footRight);

  // 5. Arms (Braccia che si appoggiano sui braccioli)
  // Upper arms (sloping down and slightly forward)
  const upperArmLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.45, 6), shirtMaterial));
  upperArmLeft.position.set(-0.34, 0.5, -0.02);
  upperArmLeft.rotation.x = 0.35;
  upperArmLeft.rotation.z = 0.08;
  
  const upperArmRight = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.45, 6), shirtMaterial));
  upperArmRight.position.set(0.34, 0.5, -0.02);
  upperArmRight.rotation.x = 0.35;
  upperArmRight.rotation.z = -0.08;
  person.add(upperArmLeft, upperArmRight);

  // Forearms (resting flat on armrests: x = +/-0.36, y = 0.22)
  const forearmLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 6), skinMaterial));
  forearmLeft.position.set(-0.36, 0.24, -0.28);
  forearmLeft.rotation.x = Math.PI / 2;
  
  const forearmRight = forearmLeft.clone();
  forearmRight.position.x = 0.36;
  person.add(forearmLeft, forearmRight);

  // Hands (on front of armrest)
  const handLeft = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), skinMaterial));
  handLeft.position.set(-0.36, 0.24, -0.47);
  const handRight = handLeft.clone();
  handRight.position.x = 0.36;
  person.add(handLeft, handRight);

  // 6. STRAW HAT (Cappellaccio di paglia gigante)
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.08, 0.12);
  hatGroup.rotation.x = 0.15;
  hatGroup.rotation.z = -0.1;

  // Hat Crown (Cupola centrale)
  const crown = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.28, 8), strawMaterial));
  crown.position.y = 0.12;
  hatGroup.add(crown);

  // Hat Brim (Tesa larga e piatta)
  const brim = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 16), strawMaterial));
  hatGroup.add(brim);

  // Frayed Straw Strands (Fili di paglia sporgenti dalla tesa)
  const strandGeo = new THREE.CylinderGeometry(0.008, 0.004, 0.6, 4);
  const strandCount = 18;
  for (let i = 0; i < strandCount; i++) {
    const angle = (i / strandCount) * Math.PI * 2;
    const strand = markShadow(new THREE.Mesh(strandGeo, strawMaterial));
    
    // Position at the edge of the brim
    const radius = 0.86;
    strand.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
    
    // Rotate to point outwards with some random variations
    strand.rotation.z = angle + Math.PI / 2 + (pseudoRandom(seed + i) * 0.3 - 0.15);
    strand.rotation.y = pseudoRandom(seed + i * 2) * 0.4 - 0.2;
    
    hatGroup.add(strand);
  }

  person.add(hatGroup);

  // Proportional scale to fit chair seat nicely
  person.scale.setScalar(0.9);

  return person;
}

function addChairsUnderPalm(group, palmPosition, palmRotationY, index) {
  // 1. Two chairs, scaled to 2.8x (slightly smaller than 3.5x as requested)
  const chair1 = createBeachChair(index * 2);
  const chair2 = createBeachChair(index * 2 + 1);

  chair1.scale.setScalar(2.8);
  chair2.scale.setScalar(2.8);

  const angle = palmRotationY;
  // Spacing offsets optimized for 2.8x scale
  const dx1 = Math.sin(angle) * 3.0 + Math.cos(angle) * -2.0;
  const dz1 = Math.cos(angle) * 3.0 - Math.sin(angle) * -2.0;

  const dx2 = Math.sin(angle) * 3.0 + Math.cos(angle) * 2.0;
  const dz2 = Math.cos(angle) * 3.0 - Math.sin(angle) * 2.0;

  chair1.position.set(palmPosition.x + dx1, palmPosition.y - 0.05, palmPosition.z + dz1);
  chair1.rotation.y = angle + Math.PI + 0.15;

  chair2.position.set(palmPosition.x + dx2, palmPosition.y - 0.05, palmPosition.z + dz2);
  chair2.rotation.y = angle + Math.PI - 0.15;

  group.add(chair1, chair2);

  // 2. The sitting person on chair1
  const person = createBeachPersonSittingWithStrawHat(index);
  // Place on seat: y = 0.43 (slightly above y=0.4 seat mesh), z = 0.05
  person.position.set(0, 0.43, 0.05);
  chair1.add(person);
}

function addBeachTropicalPlants(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // 20 palme/cespugli distribuiti attorno alla pista, tenendoli vicini sul lato interno
  for (let index = 0; index < 20; index += 1) {
    const side = -1;
    const progress = (index + 0.3) / 20;
    const offset = side * (roadHalfWidth + 4.5 + (index % 4) * 2.5); // Offset tra roadHalfWidth + 4.5 e roadHalfWidth + 12
    const { position, rotationY } = safePlace(curve, progress, side, offset, roadHalfWidth, 4.5);
    const useBush = index % 5 === 0;
    const plant = useBush ? createTropicalBush(index) : createTropicalPalm(index);
    plant.position.copy(position);
    plant.rotation.y = rotationY + (index % 5) * 0.22;
    // Scale: palme 1.1–1.6x, cespugli 1.2–1.8x
    const baseScale = useBush ? 1.4 : 1.1;
    plant.scale.setScalar(baseScale + pseudoRandom(index + 4.1) * 0.5);
    group.add(plant);

    if (!useBush && (index === 2 || index === 8)) {
      addChairsUnderPalm(group, position, rotationY, index);
      if (index === 2) {
        addHouseBehindPalm(group, curve, progress, offset, roadHalfWidth, rotationY, index);
      }
    }
  }
}

function addHouseBehindPalm(group, curve, progress, palmOffset, roadHalfWidth, palmRotationY, index) {
  // Compute position behind the palm.
  // The palm has a negative offset (inside loop, side = -1).
  // So we move it further away by subtracting 25 meters to accommodate the larger 3.2x scale.
  const houseOffset = palmOffset - 25.0;
  
  // Use safePlace to sample coordinates and height correctly.
  // Using side = -1, minClearance = 12.0 for safety.
  const { position, rotationY } = safePlace(curve, progress, -1, houseOffset, roadHalfWidth, 12.0);
  
  const house = createBeachHouse(index);
  house.position.copy(position);
  // Scale up the house to 3.2x to make it beautifully proportioned
  house.scale.setScalar(3.2);
  // Rotate 180 degrees (add Math.PI) so the front porch faces the track/road
  house.rotation.y = rotationY + Math.PI;
  
  group.add(house);
}

function createBeachHouse(seed = 0) {
  const house = new THREE.Group();
  house.name = "TropicalBeachHouse";

  // Materials
  const wallMaterial = createBeachMaterial({ color: 0xfa9b93, roughness: 0.8 }); // Pink/peach plaster
  const roofMaterial = createBeachMaterial({ color: 0xfa9b93, roughness: 0.8 }); // Pink/peach roof
  const trimMaterial = createBeachMaterial({ color: 0xfad02c, roughness: 0.6, metalness: 0.1 }); // Bright yellow trim
  const floorMaterial = createBeachMaterial({ color: 0xdcdcdc, roughness: 0.7 }); // Light grey concrete floor
  const grassMaterial = createBeachMaterial({ color: 0x3d7042, roughness: 0.9 }); // Dark grass green base
  const doorMaterial = createBeachMaterial({ color: 0x5c3b21, roughness: 0.85 }); // Dark brown door
  const windowBackMaterial = createBeachMaterial({ color: 0x2b2b2b, roughness: 0.9 }); // Dark glass/shutter background
  const slatMaterial = createBeachMaterial({ color: 0xf0f0f0, roughness: 0.6 }); // White horizontal slats
  const metalMaterial = createBeachMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.6 }); // Metallic staircase

  // 1. Platform / Grass Base
  const base = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.3, 6.0), grassMaterial));
  base.position.set(0, 0.15, 0);
  house.add(base);

  // 2. Porch Floor
  const floor = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.15, 1.8), floorMaterial));
  floor.position.set(0, 0.375, -1.8);
  house.add(floor);

  // 3. Main Room Box (Peach/Pink walls)
  const room = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.8, 3.4), wallMaterial));
  room.position.set(0, 1.7, 0.8);
  house.add(room);

  // 4. Porch Columns (Pillars)
  const colGeo = new THREE.BoxGeometry(0.2, 2.7, 0.2);
  const colXPositions = [-3.5, -1.2, 1.2, 3.5];
  colXPositions.forEach((cx) => {
    const col = markShadow(new THREE.Mesh(colGeo, wallMaterial));
    col.position.set(cx, 1.65, -2.6);
    house.add(col);
  });

  // 5. Arches (Horizontal header beam + diagonal corner brackets)
  const header = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 0.2), wallMaterial));
  header.position.set(0, 2.85, -2.6);
  house.add(header);

  const bracketGeo = new THREE.BoxGeometry(0.25, 0.25, 0.22);
  const bracketXOffsets = [-3.25, -1.45, -0.95, 0.95, 1.45, 3.25];
  bracketXOffsets.forEach((bx, idx) => {
    const bracket = markShadow(new THREE.Mesh(bracketGeo, wallMaterial));
    bracket.position.set(bx, 2.65, -2.6);
    bracket.rotation.z = (idx % 2 === 0) ? -Math.PI / 4 : Math.PI / 4;
    house.add(bracket);
  });

  // 6. Roof Slab
  const roof = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 5.6), roofMaterial));
  roof.position.set(0, 3.1, -0.3);
  house.add(roof);

  // Yellow Roof Trim / Fascia
  const frontTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.22, 0.3, 0.05), trimMaterial));
  frontTrim.position.set(0, 3.15, -3.12);
  const leftTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 5.62), trimMaterial));
  leftTrim.position.set(-4.11, 3.15, -0.3);
  const rightTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 5.62), trimMaterial));
  rightTrim.position.set(4.11, 3.15, -0.3);
  house.add(frontTrim, leftTrim, rightTrim);

  // 7. Door (dark brown wooden door)
  const door = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.08), doorMaterial));
  door.position.set(0.2, 1.3, -0.9);
  house.add(door);

  // Door handle (gold sphere)
  const handle = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), trimMaterial));
  handle.position.set(0.55, 1.3, -0.85);
  house.add(handle);

  // 8. Front Windows (two windows, left and right of door)
  const frameGeo = new THREE.BoxGeometry(1.6, 1.1, 0.08);
  const glassGeo = new THREE.BoxGeometry(1.4, 0.9, 0.04);
  const slatGeo = new THREE.BoxGeometry(1.4, 0.05, 0.02);

  [-2.35, 2.35].forEach((wx) => {
    // Window Frame (Yellow)
    const frame = markShadow(new THREE.Mesh(frameGeo, trimMaterial));
    frame.position.set(wx, 1.5, -0.9);
    house.add(frame);

    // Glass/Backplane (Dark)
    const glass = markShadow(new THREE.Mesh(glassGeo, windowBackMaterial));
    glass.position.set(wx, 1.5, -0.91);
    house.add(glass);

    // Horizontal louvers/slats
    for (let s = 0; s < 5; s++) {
      const slat = markShadow(new THREE.Mesh(slatGeo, slatMaterial));
      slat.position.set(wx, 1.2 + s * 0.15, -0.89);
      house.add(slat);
    }
  });

  // 9. Side Window (Left side)
  const sideFrame = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.6), trimMaterial));
  sideFrame.position.set(-3.8, 1.5, 0.8);
  house.add(sideFrame);
  const sideGlass = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.4), windowBackMaterial));
  sideGlass.position.set(-3.81, 1.5, 0.8);
  house.add(sideGlass);
  const sideSlatGeo = new THREE.BoxGeometry(0.02, 0.05, 1.4);
  for (let s = 0; s < 5; s++) {
    const slat = markShadow(new THREE.Mesh(sideSlatGeo, slatMaterial));
    slat.position.set(-3.79, 1.2 + s * 0.15, 0.8);
    house.add(slat);
  }

  // 10. Spiral Staircase on the Left
  const post = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), metalMaterial));
  post.position.set(-4.1, 1.9, 1.2);
  house.add(post);

  const stairs = new THREE.Group();
  const stepGeo = new THREE.BoxGeometry(0.65, 0.04, 0.22);
  const stairCount = 15;
  for (let i = 0; i < stairCount; i++) {
    const theta = i * (Math.PI * 1.5 / (stairCount - 1));
    const h = (i / (stairCount - 1)) * 2.8;
    const step = markShadow(new THREE.Mesh(stepGeo, metalMaterial));
    step.position.set(
      Math.cos(theta) * 0.32,
      h + 0.02,
      Math.sin(theta) * 0.32
    );
    step.rotation.y = -theta;
    stairs.add(step);
  }
  stairs.position.set(-4.1, 0.3, 1.2);
  house.add(stairs);

  // 11. Ornamental Bushes in Front
  const bushPositions = [
    [-3.2, 0.3, -2.8],
    [3.2, 0.3, -2.8],
    [-0.8, 0.3, -2.8]
  ];
  bushPositions.forEach(([bx, by, bz], bidx) => {
    const bush = createTropicalBush(seed + bidx + 50);
    bush.position.set(bx, by, bz);
    bush.scale.setScalar(0.7);
    house.add(bush);
  });

  return house;
}

function createBeachHutStrict() {
  const hut = new THREE.Group();
  hut.name = "TropicalBeachHutStrict";
  const baseMaterial = createBeachMaterial({ color: 0xd4a055, roughness: 0.82 });
  const wallMaterial = createBeachMaterial({ color: 0xc8955a, roughness: 0.82 });
  const roofMaterial = createBeachMaterial({ color: 0x8b4513, roughness: 0.78 });
  const awningMaterial = createBeachMaterial({
    color: 0xff6600,
    emissive: 0xff6600,
    emissiveIntensity: 0.2,
    roughness: 0.62
  });

  const base = markShadow(new THREE.Mesh(new THREE.BoxGeometry(12, 3, 10), baseMaterial));
  const frontWall = markShadow(new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.4), wallMaterial));
  const backWall = markShadow(new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.4), wallMaterial));
  const roof = markShadow(new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 12), roofMaterial));
  const awning = markShadow(new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 4), awningMaterial));
  const poleMaterial = createBeachMaterial({ color: 0xd4c8a0, roughness: 0.7 });
  const poleGeometry = new THREE.CylinderGeometry(0.25, 0.25, 6, 5);

  base.position.y = 1.5;
  frontWall.position.set(0, 5, -5.2);
  backWall.position.set(0, 5, 5.2);
  roof.position.y = 7.5;
  awning.position.set(0, 6, -7);
  hut.add(base, frontWall, backWall, roof, awning);

  [-4, 4].forEach((x) => {
    const pole = markShadow(new THREE.Mesh(poleGeometry, poleMaterial));
    pole.position.set(x, 3, -7);
    hut.add(pole);
  });

  return hut;
}

function addBeachHutsStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  [0.20, 0.55, 0.80].forEach((progress, index) => {
    const side = -1;
    const { position, rotationY } = safePlace(curve, progress, side, side * (roadHalfWidth + 8.5), roadHalfWidth, 6.0);
    const hut = createBeachHutStrict();
    hut.position.copy(position);
    hut.rotation.y = rotationY;
    group.add(hut);
  });
}

function addBeachUmbrellasStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;
  const colors = [0xff4444, 0xffffff, 0xffaa00, 0x4488ff];
  const poleMaterial = createBeachMaterial({ color: 0xc8c8b0, roughness: 0.68 });
  const poleGeometry = new THREE.CylinderGeometry(0.12, 0.12, 4, 5);

  for (let index = 0; index < 10; index += 1) {
    const progress = (index + 0.5) * 0.1;
    const offset = roadHalfWidth + 6 + (index % 3) * 2.0;
    const { position, rotationY } = safePlace(curve, progress, -1, -(roadHalfWidth + 6 + (index % 3) * 2.0), roadHalfWidth, 5.0);
    const umbrella = new THREE.Group();
    umbrella.name = "TropicalBeachUmbrellaStrict";
    umbrella.position.copy(position);
    umbrella.rotation.y = rotationY;

    const pole = markShadow(new THREE.Mesh(poleGeometry, poleMaterial));
    pole.position.y = 2;
    const canopy = markShadow(new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 1.5, 7),
      createBeachMaterial({ color: colors[index % colors.length], roughness: 0.7 })
    ));
    canopy.position.y = 4.5;
    umbrella.add(pole, canopy);
    group.add(umbrella);
  }
}

function addBeachLampPostsStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;
  const poleMaterial = createBeachMaterial({ color: 0xd4c8a0, roughness: 0.62 });
  const topMaterial = createBeachMaterial({
    color: 0xffd080,
    emissive: 0xffd080,
    emissiveIntensity: 0.7,
    roughness: 0.36
  });
  const poleGeometry = new THREE.CylinderGeometry(0.2, 0.25, 7, 6);
  const topGeometry = new THREE.SphereGeometry(0.5, 5, 4);

  for (let index = 0; index < 16; index += 1) {
    const side = -1;
    const progress = (index + 0.25) / 16;
    const { position, rotationY } = safePlace(curve, progress, side, side * (roadHalfWidth + 2.5), roadHalfWidth, 2.0);
    const lamp = new THREE.Group();
    lamp.name = "TropicalBeachLampPostStrict";
    lamp.position.copy(position);
    lamp.rotation.y = rotationY;

    const pole = markShadow(new THREE.Mesh(poleGeometry, poleMaterial));
    const top = markShadow(new THREE.Mesh(topGeometry, topMaterial));
    pole.position.y = 3.5;
    top.position.y = 7.3;
    const light = new THREE.PointLight(0xffd080, 20, 18, 2);
    light.position.y = 7.5;

    lamp.add(pole, top, light);
    group.add(lamp);
  }
}

function createBeachCloud(seed = 0) {
  const cloud = new THREE.Group();
  cloud.name = "TropicalBeachCloud";

  const material = new THREE.MeshStandardMaterial({
    color: 0xf7fbff,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    fog: false
  });
  const geometry = new THREE.SphereGeometry(1, 8, 6);
  const puffCount = 4 + (seed % 3);

  for (let index = 0; index < puffCount; index += 1) {
    const puff = new THREE.Mesh(geometry, material);
    const side = index - (puffCount - 1) * 0.5;
    puff.position.set(side * 4.2, (index % 2) * 0.7, pseudoRandom(seed + index) * 1.4);
    puff.scale.set(
      3.6 + pseudoRandom(seed + index * 1.7) * 1.7,
      1.0 + pseudoRandom(seed + index * 2.3) * 0.45,
      1.3 + pseudoRandom(seed + index * 3.1) * 0.6
    );
    puff.castShadow = false;
    puff.receiveShadow = false;
    cloud.add(puff);
  }

  return cloud;
}

function addBeachClouds(group) {
  const cloudPositions = [
    [-180, 48, -155, 0.25, 1.25],
    [-70, 58, -235, -0.12, 1.55],
    [92, 52, -190, 0.18, 1.35],
    [190, 46, -70, -0.28, 1.45],
    [-210, 54, 80, 0.08, 1.65],
    [42, 62, 142, -0.2, 1.35],
    [230, 56, 190, 0.14, 1.5]
  ];

  cloudPositions.forEach(([x, y, z, rotationY, scale], index) => {
    const cloud = createBeachCloud(index);
    cloud.position.set(x, y, z);
    cloud.rotation.y = rotationY;
    cloud.scale.setScalar(scale);
    group.add(cloud);
  });
}

export function buildBeachProps(group, curve, trackDef) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "TropicalBeachProps";

  addBeachGround(propsGroup);
  addBeachOceanPlane(propsGroup, curve, trackDef);
  addBeachClouds(propsGroup);
  // addBeachCenterDashes(propsGroup, curve, trackDef);
  addBeachTropicalPlants(propsGroup, curve, trackDef);
  addBeachHutsStrict(propsGroup, curve, trackDef);
  addBeachUmbrellasStrict(propsGroup, curve, trackDef);
  // addBeachLampPostsStrict(propsGroup, curve, trackDef);

  group.add(propsGroup);
  group.userData.disposeProps = () => {
    propsGroup.traverse((child) => {
      child.geometry?.dispose();

      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material?.dispose();
      }
    });
  };
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
