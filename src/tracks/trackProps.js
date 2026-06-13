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

function optimizeStaticDecorativeProps(group, receiveShadowNames = []) {
  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      child.castShadow = false;
      child.receiveShadow = receiveShadowNames.some((name) => child.name.includes(name));
    }

    if (!child.isLight && !child.userData.spin) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
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
  const p = progress >= 0.9999 ? 0.0 : progress;
  const point = curve.getPointAt(p);
  const tangent = curve.getTangentAt(p).setY(0).normalize();
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
    const sampleT = t >= 0.9999 ? 0.0 : t;
    const p = curve.getPointAt(sampleT);
    const tan = curve.getTangentAt(sampleT).setY(0).normalize();
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

// Like createBeachSideBandGeometry but adds a per-vertex 'aShoreT' attribute:
// 0.0 = near shore edge, 1.0 = far ocean edge — used for gradient coloring.
function createBeachGradientBandGeometry(curve, trackDef, side, nearOffset, farOffset, y) {
  const vertices = [];
  const shoreT  = [];   // gradient attribute
  const indices = [];
  const segments = trackDef.segments || 200;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sampleT = t >= 0.9999 ? 0.0 : t;
    const p = curve.getPointAt(sampleT);
    const tan = curve.getTangentAt(sampleT).setY(0).normalize();
    const normal = getRightVector(tan);

    const nearP = p.clone().addScaledVector(normal, side * nearOffset);
    const farP  = p.clone().addScaledVector(normal, side * farOffset);

    vertices.push(nearP.x, y, nearP.z);  // near vertex
    shoreT.push(0.0);
    vertices.push(farP.x,  y, farP.z);   // far vertex
    shoreT.push(1.0);
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
  geometry.setAttribute("aShoreT",  new THREE.Float32BufferAttribute(shoreT, 1));
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

  // Shore Sand (widened)
  const sandMaterial = createBeachMaterial({ color: 0xe0c66f, roughness: 0.95 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 0.65, roadHalfWidth + 14.0, sandMaterial, "TropicalBeachOceanShore", -0.012);

  // Surf/Foam
  const surfMaterial = createBeachMaterial({ color: 0xf0f5e8, roughness: 0.50 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 14.0, roadHalfWidth + 18.0, surfMaterial, "TropicalBeachOceanSurf", -0.010);

  // Gradient ocean: turquoise (riva) → mid blue → deep blue (largo)
  // Uses a static ShaderMaterial with per-vertex aShoreT attribute (0=riva, 1=largo)
  const gradientShader = new THREE.ShaderMaterial({
    uniforms: {
      uColorA: { value: new THREE.Color(0x2ddde8) }, // turchese chiaro
      uColorB: { value: new THREE.Color(0x0772b0) }, // blu intermedio
      uColorC: { value: new THREE.Color(0x003a6e) }, // blu profondo
    },
    vertexShader: /* glsl */`
      attribute float aShoreT;
      varying float vT;
      void main() {
        vT = aShoreT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      varying float vT;
      void main() {
        // Two-stop blend: A -> B at t=0..0.45, B -> C at t=0.4..1.0
        vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.45, vT));
        col = mix(col, uColorC, smoothstep(0.4, 1.0, vT));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const oceanGeo = createBeachGradientBandGeometry(
    curve, trackDef, 1,
    roadHalfWidth + 18.0, roadHalfWidth + 1155,
    -0.014
  );
  const oceanMesh = new THREE.Mesh(oceanGeo, gradientShader);
  oceanMesh.name = "TropicalBeachGradientOcean";
  oceanMesh.receiveShadow = false;
  group.add(oceanMesh);
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

function createBeachGirl(type = "swimsuit", seed = 0) {
  const girl = new THREE.Group();
  girl.name = `BeachGirl_${type}_${seed}`;

  // Skin colors
  const skinColors = [0xdcb38c, 0xe8be9b, 0xbe8c5f, 0xcb9c7a];
  // Hair colors
  const hairColors = [0x111111, 0x4a3728, 0xd4af37, 0xb85a1c];
  // Swimsuit colors
  const swimColors = [0xff3366, 0x33ff66, 0x33ccff, 0xffcc00, 0xff6600, 0xe60067];
  // Top/Shorts colors
  const topColors = [0xfefefa, 0xffdd44, 0xff8833, 0x88ffcc, 0xffaaaa];
  const shortsColors = [0x2a52be, 0x333333, 0x4e5d6c];

  const skinMat = createBeachMaterial({ color: skinColors[seed % skinColors.length], roughness: 0.6 });
  const hairMat = createBeachMaterial({ color: hairColors[(seed * 3) % hairColors.length], roughness: 0.8 });

  // Head and Hair
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8), skinMat));
  head.position.set(0, 1.48, 0);
  girl.add(head);

  // Hair base
  const hairBase = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat));
  hairBase.position.set(0, 1.50, -0.04);
  hairBase.scale.set(1.02, 0.9, 1.02);
  girl.add(hairBase);

  // Ponytail/Long hair hanging down
  const hairHang = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.08), hairMat));
  hairHang.position.set(0, 1.22, -0.15);
  hairHang.rotation.x = 0.08;
  girl.add(hairHang);

  // Torso
  if (type === "swimsuit") {
    const swimMat = createBeachMaterial({ color: swimColors[(seed * 7) % swimColors.length], roughness: 0.6 });
    // Bikini Top
    const bikiniTop = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.22), swimMat));
    bikiniTop.position.set(0, 1.15, 0);
    // Midriff (Skin)
    const midriff = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.18), skinMat));
    midriff.position.set(0, 0.94, 0);
    // Bikini Bottom
    const bikiniBottom = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.22), swimMat));
    bikiniBottom.position.set(0, 0.74, 0);
    girl.add(bikiniTop, midriff, bikiniBottom);
  } else {
    const topMat = createBeachMaterial({ color: topColors[(seed * 7) % topColors.length], roughness: 0.5 });
    const shortsMat = createBeachMaterial({ color: shortsColors[(seed * 11) % shortsColors.length], roughness: 0.7 });
    
    // Top
    const top = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.22), topMat));
    top.position.set(0, 1.08, 0);
    // Denim Shorts
    const shorts = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.24), shortsMat));
    shorts.position.set(0, 0.76, 0);
    girl.add(top, shorts);
  }

  // Walk cycle phase (varies by seed)
  const walkPhase = (seed % 3) * 0.35 + 0.15;
  const swingAngle = Math.sin(walkPhase) * 0.4;

  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-0.13, 0.64, 0);
  const legL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.64, 6), skinMat));
  legL.position.y = -0.32;
  const footL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), skinMat));
  footL.position.set(0, -0.64, 0.04);
  legLGroup.add(legL, footL);
  legLGroup.rotation.x = -swingAngle;
  girl.add(legLGroup);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.position.set(0.13, 0.64, 0);
  const legR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.64, 6), skinMat));
  legR.position.y = -0.32;
  const footR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), skinMat));
  footR.position.set(0, -0.64, 0.04);
  legRGroup.add(legR, footR);
  legRGroup.rotation.x = swingAngle;
  girl.add(legRGroup);

  // Left Arm
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.25, 1.20, 0);
  const armL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.56, 6), skinMat));
  armL.position.y = -0.28;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat));
  handL.position.set(0, -0.56, 0);
  armLGroup.add(armL, handL);
  armLGroup.rotation.x = swingAngle;
  girl.add(armLGroup);

  // Right Arm
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.25, 1.20, 0);
  const armR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.56, 6), skinMat));
  armR.position.y = -0.28;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat));
  handR.position.set(0, -0.56, 0);
  armRGroup.add(armR, handR);
  armRGroup.rotation.x = -swingAngle;
  girl.add(armRGroup);

  return girl;
}

function createBeachBoy(type = "swimsuit", seed = 0) {
  const boy = new THREE.Group();
  boy.name = `BeachBoy_${type}_${seed}`;

  // Skin colors
  const skinColors = [0xdcb38c, 0xe8be9b, 0xbe8c5f, 0xcb9c7a];
  // Hair colors
  const hairColors = [0x111111, 0x4a3728, 0xd4af37, 0xb85a1c];
  // Swim shorts colors
  const swimColors = [0x11cc22, 0xff5500, 0x0088ff, 0xffbb00, 0xff3366, 0x9933ff];
  // Shirt/Shorts colors
  const shirtColors = [0xfefefa, 0xff5566, 0x33ddff, 0xffcc33, 0x77ff77];
  const shortsColors = [0xcca070, 0x333333, 0x4a7fc4];

  const skinMat = createBeachMaterial({ color: skinColors[seed % skinColors.length], roughness: 0.6 });
  const hairMat = createBeachMaterial({ color: hairColors[(seed * 5) % hairColors.length], roughness: 0.8 });

  // Head and Short Hair
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8), skinMat));
  head.position.set(0, 1.50, 0);
  boy.add(head);

  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat));
  hair.position.set(0, 1.53, 0);
  hair.scale.set(1.03, 0.82, 1.03);
  boy.add(hair);

  // Torso
  if (type === "swimsuit") {
    const swimMat = createBeachMaterial({ color: swimColors[(seed * 7) % swimColors.length], roughness: 0.7 });
    // Bare Chest (Skin)
    const chest = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.24), skinMat));
    chest.position.set(0, 1.14, 0);
    // Swim Trunks
    const trunks = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.26), swimMat));
    trunks.position.set(0, 0.80, 0);
    boy.add(chest, trunks);
  } else {
    const shirtMat = createBeachMaterial({ color: shirtColors[(seed * 7) % shirtColors.length], roughness: 0.5 });
    const shortsMat = createBeachMaterial({ color: shortsColors[(seed * 11) % shortsColors.length], roughness: 0.7 });
    
    // T-shirt
    const shirt = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.26), shirtMat));
    shirt.position.set(0, 1.15, 0);
    // Shorts
    const shorts = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.26), shortsMat));
    shorts.position.set(0, 0.79, 0);
    boy.add(shirt, shorts);
  }

  // Walk cycle phase
  const walkPhase = (seed % 3) * 0.35 + 0.32;
  const swingAngle = Math.sin(walkPhase) * 0.4;

  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-0.13, 0.66, 0);
  const legL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.66, 6), skinMat));
  legL.position.y = -0.33;
  const footL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), skinMat));
  footL.position.set(0, -0.66, 0.04);
  legLGroup.add(legL, footL);
  legLGroup.rotation.x = -swingAngle;
  boy.add(legLGroup);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.position.set(0.13, 0.66, 0);
  const legR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.66, 6), skinMat));
  legR.position.y = -0.33;
  const footR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), skinMat));
  footR.position.set(0, -0.66, 0.04);
  legRGroup.add(legR, footR);
  legRGroup.rotation.x = swingAngle;
  boy.add(legRGroup);

  // Left Arm
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.27, 1.22, 0);
  const armL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 6), skinMat));
  armL.position.y = -0.29;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat));
  handL.position.set(0, -0.58, 0);
  armLGroup.add(armL, handL);
  armLGroup.rotation.x = swingAngle;
  boy.add(armLGroup);

  // Right Arm
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.27, 1.22, 0);
  const armR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 6), skinMat));
  armR.position.y = -0.29;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat));
  handR.position.set(0, -0.58, 0);
  armRGroup.add(armR, handR);
  armRGroup.rotation.x = -swingAngle;
  boy.add(armRGroup);

  return boy;
}

function addBeachPeople(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // 1. Swimsuit girls on the beach (side = +1)
  for (let index = 0; index < 12; index += 1) {
    const progress = (index + 0.25) / 12;
    const depthOffset = (index % 3 === 0) ? 7.5 : (index % 3 === 1) ? 14.5 : 19.0;
    const { position, rotationY } = safePlace(curve, progress, +1, +(roadHalfWidth + depthOffset), roadHalfWidth, 4.5);

    const girl = createBeachGirl("swimsuit", index);
    girl.position.copy(position);
    girl.scale.setScalar(2.5);

    if (depthOffset === 7.5) {
      girl.rotation.y = rotationY + (index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (depthOffset === 14.5) {
      girl.position.y -= 0.22;
      girl.rotation.y = rotationY + (index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      girl.position.y -= 1.1;
      girl.rotation.y = rotationY + Math.PI + (pseudoRandom(index) * 0.4 - 0.2);
    }
    group.add(girl);
  }

  // 2. Swimsuit boys on the beach (side = +1)
  for (let index = 0; index < 10; index += 1) {
    const progress = (index + 0.75) / 10;
    const depthOffset = (index % 3 === 0) ? 8.5 : (index % 3 === 1) ? 15.5 : 18.0;
    const { position, rotationY } = safePlace(curve, progress, +1, +(roadHalfWidth + depthOffset), roadHalfWidth, 4.5);

    const boy = createBeachBoy("swimsuit", index);
    boy.position.copy(position);
    boy.scale.setScalar(2.5); // matches girls

    if (depthOffset === 8.5) {
      boy.rotation.y = rotationY + (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
    } else if (depthOffset === 15.5) {
      boy.position.y -= 0.22;
      boy.rotation.y = rotationY + (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
    } else {
      boy.position.y -= 1.0;
      boy.rotation.y = rotationY + Math.PI + (pseudoRandom(index * 2) * 0.4 - 0.2);
    }
    group.add(boy);
  }

  // 3. People walking towards the bars (side = -1)
  const barProgresses = [0.20, 0.55, 0.80];
  barProgresses.forEach((barP, barIdx) => {
    const barFrame = safePlace(curve, barP, -1, -(roadHalfWidth + 16.0), roadHalfWidth, 6.0);
    
    // Girl A: approaching from the left, standing outside the counter
    const pA = barP - 0.016;
    const frameA = safePlace(curve, pA, -1, -(roadHalfWidth + 5.8), roadHalfWidth, 4.5);
    const girlA = createBeachGirl("shorts_top", barIdx * 10 + 1);
    girlA.position.copy(frameA.position);
    girlA.scale.setScalar(2.6);
    const dirA = barFrame.position.clone().sub(frameA.position).normalize();
    girlA.rotation.y = Math.atan2(dirA.x, dirA.z);
    group.add(girlA);

    // Girl B: approaching from the right, standing outside the counter
    const pB = barP + 0.014;
    const frameB = safePlace(curve, pB, -1, -(roadHalfWidth + 6.6), roadHalfWidth, 4.5);
    const girlB = createBeachGirl("shorts_top", barIdx * 10 + 2);
    girlB.position.copy(frameB.position);
    girlB.scale.setScalar(2.6);
    const dirB = barFrame.position.clone().sub(frameB.position).normalize();
    girlB.rotation.y = Math.atan2(dirB.x, dirB.z);
    group.add(girlB);

    // Boy C: approaching from the front-left, standing outside the counter
    const pC = barP - 0.008;
    const frameC = safePlace(curve, pC, -1, -(roadHalfWidth + 7.2), roadHalfWidth, 4.5);
    const boyC = createBeachBoy("shorts_shirt", barIdx * 10 + 3);
    boyC.position.copy(frameC.position);
    boyC.scale.setScalar(2.6); // matches girls
    const dirC = barFrame.position.clone().sub(frameC.position).normalize();
    boyC.rotation.y = Math.atan2(dirC.x, dirC.z);
    group.add(boyC);
  });
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

  // Helper to check if a progress value is near a bar kiosk to prevent overlapping palms
  const isNearBar = (p) => {
    const bars = [0.20, 0.55, 0.80];
    return bars.some(barP => Math.abs(p - barP) < 0.04);
  };

  // 20 palme/cespugli distribuiti attorno alla pista, tenendoli vicini sul lato interno
  for (let index = 0; index < 20; index += 1) {
    const side = -1;
    const progress = (index + 0.3) / 20;
    if (isNearBar(progress)) continue;
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

    if (!useBush && index === 2) {
      addChairsUnderPalm(group, position, rotationY, index);
      addHouseBehindPalm(group, curve, progress, offset, roadHalfWidth, rotationY, index);
    }
  }

  // Add 45 more palms/bushes on the inside (side = -1) to make the inner ring dense
  for (let index = 0; index < 45; index += 1) {
    const side = -1;
    const progress = (index + 0.75) / 45;
    if (isNearBar(progress)) continue;
    const offset = side * (roadHalfWidth + 5.0 + (index % 3) * 3.5);
    const { position, rotationY } = safePlace(curve, progress, side, offset, roadHalfWidth, 4.5);
    const useBush = index % 4 === 0;
    const plant = useBush ? createTropicalBush(index + 100) : createTropicalPalm(index + 100);
    plant.position.copy(position);
    plant.rotation.y = rotationY + (index % 5) * 0.3;
    const baseScale = useBush ? 1.35 : 1.05;
    plant.scale.setScalar(baseScale + pseudoRandom(index + 9.9) * 0.5);
    group.add(plant);
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

// Bartender: standing man with straw hat, holding a coconut in his raised right hand
function createBarBartender() {
  const person = new THREE.Group();
  person.name = "TropicalBeachBartender";

  const skinMat  = createBeachMaterial({ color: 0xdcb38c, roughness: 0.6 });
  const shirtMat = createBeachMaterial({ color: 0xfefefa, roughness: 0.5 });
  const shortsMat= createBeachMaterial({ color: 0x4a7fc4, roughness: 0.7 });
  const blackMat = createBeachMaterial({ color: 0x111111, roughness: 0.8 });
  const strawMat = createBeachMaterial({ color: 0xd4b26f, roughness: 0.8 });
  const coconutMat = createBeachMaterial({ color: 0x5c3d1e, roughness: 0.9 });

  // --- Torso ---
  const torso = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat));
  torso.position.set(0, 1.05, 0);
  person.add(torso);

  // --- Head ---
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), skinMat));
  head.position.set(0, 1.62, 0);
  person.add(head);

  // Hair
  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), blackMat));
  hair.position.set(0, 1.66, 0);
  hair.scale.set(1.02, 0.88, 1.02);
  person.add(hair);

  // Beard
  const beard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.10), blackMat));
  beard.position.set(0, 1.54, 0.09);
  person.add(beard);

  // --- Straw hat ---
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.78, 0);
  const crown = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.25, 8), strawMat));
  crown.position.y = 0.10;
  const brim = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.80, 0.02, 16), strawMat));
  // Frayed strands
  const strandGeo = new THREE.CylinderGeometry(0.007, 0.003, 0.5, 4);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const strand = markShadow(new THREE.Mesh(strandGeo, strawMat));
    strand.position.set(Math.cos(angle) * 0.76, 0.01, Math.sin(angle) * 0.76);
    strand.rotation.z = angle + Math.PI / 2 + (pseudoRandom(i) * 0.3 - 0.15);
    hatGroup.add(strand);
  }
  hatGroup.add(crown, brim);
  person.add(hatGroup);

  // --- Legs ---
  [-0.16, 0.16].forEach((lx) => {
    const thigh = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.42, 6), shortsMat));
    thigh.position.set(lx, 0.53, 0);
    const shin = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 6), skinMat));
    shin.position.set(lx, 0.10, 0);
    const foot = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMat));
    foot.position.set(lx, -0.10, 0.05);
    person.add(thigh, shin, foot);
  });

  // --- Left arm (relaxed, slightly forward on counter) ---
  const upperArmL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 6), shirtMat));
  upperArmL.position.set(-0.32, 1.02, 0);
  upperArmL.rotation.z = 0.25;
  const forearmL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.34, 6), skinMat));
  forearmL.position.set(-0.38, 0.75, -0.08);
  forearmL.rotation.x = 0.3;
  forearmL.rotation.z = 0.1;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), skinMat));
  handL.position.set(-0.40, 0.62, -0.18);
  person.add(upperArmL, forearmL, handL);

  // --- Right arm (raised, holding coconut) ---
  const upperArmR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 6), shirtMat));
  upperArmR.position.set(0.32, 1.12, 0);
  upperArmR.rotation.z = -0.65; // raised outward
  upperArmR.rotation.x = -0.2;
  const forearmR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 6), skinMat));
  forearmR.position.set(0.50, 1.22, -0.10);
  forearmR.rotation.z = -0.5;
  forearmR.rotation.x = -0.4;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), skinMat));
  handR.position.set(0.60, 1.35, -0.22);
  person.add(upperArmR, forearmR, handR);

  // --- Coconut held in right hand ---
  const coconut = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), coconutMat));
  coconut.scale.set(1.0, 1.15, 1.0);
  coconut.position.set(0.60, 1.45, -0.28);
  // Straw/drinking straw sticking out
  const straw = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5),
    createBeachMaterial({ color: 0xff8800, roughness: 0.5 })
  ));
  straw.position.set(0.60, 1.60, -0.30);
  straw.rotation.z = 0.3;
  person.add(coconut, straw);

  person.scale.setScalar(1.4);
  return person;
}

function createBeachHutStrict(seed = 0) {
  const hut = new THREE.Group();
  hut.name = "TropicalBeachBarKiosk";

  // Materials
  const slatMat = createBeachMaterial({ color: 0xc68a4c, roughness: 0.85 }); // Warm natural light wood slats
  const trimMat = createBeachMaterial({ color: 0x4d301c, roughness: 0.88 }); // Darker wood countertop/trim
  const poleMat = createBeachMaterial({ color: 0x4d301c, roughness: 0.9 }); // Dark log poles
  const roofMat = createBeachMaterial({ color: 0x8c6239, roughness: 0.95 }); // Thatched palm roof
  const letterMat = createBeachMaterial({ color: 0xfad02c, roughness: 0.5 }); // Yellow sign letters
  const kayakYellowMat = createBeachMaterial({ color: 0xffd700, roughness: 0.6 }); // Yellow kayak
  const kayakOrangeMat = createBeachMaterial({ color: 0xff4500, roughness: 0.6 }); // Orange-red kayak

  // 1. Semi-circular slatted bar counter
  const slatGeo = new THREE.BoxGeometry(0.32, 1.4, 0.1);
  for (let i = 0; i < 24; i++) {
    const angle = -Math.PI * 0.6 + (i / 23) * Math.PI * 1.2;
    const x = Math.sin(angle) * 2.8;
    const z = -Math.cos(angle) * 2.8; // Z negative is front
    const slat = markShadow(new THREE.Mesh(slatGeo, slatMat));
    slat.position.set(x, 0.7, z);
    slat.rotation.y = -angle;
    hut.add(slat);
  }

  // 2. Curved Countertop and Bottom Trim segments
  const counterGeo = new THREE.BoxGeometry(0.95, 0.08, 0.45);
  const baseTrimGeo = new THREE.BoxGeometry(0.95, 0.1, 0.25);
  for (let j = 0; j < 10; j++) {
    const angleStart = -Math.PI * 0.6 + (j / 10) * Math.PI * 1.2;
    const angleEnd = -Math.PI * 0.6 + ((j + 1) / 10) * Math.PI * 1.2;
    const angleMid = (angleStart + angleEnd) / 2;
    const x = Math.sin(angleMid) * 2.8;
    const z = -Math.cos(angleMid) * 2.8;

    // Countertop
    const counterSegment = markShadow(new THREE.Mesh(counterGeo, trimMat));
    counterSegment.position.set(x, 1.44, z);
    counterSegment.rotation.y = -angleMid;
    hut.add(counterSegment);

    // Bottom Base Trim
    const baseSegment = markShadow(new THREE.Mesh(baseTrimGeo, trimMat));
    baseSegment.position.set(x, 0.05, z);
    baseSegment.rotation.y = -angleMid;
    hut.add(baseSegment);
  }

  // 3. Timber poles/posts
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6);
  const postPositions = [
    [-2.2, 1.6, -0.8],
    [2.2, 1.6, -0.8],
    [-1.8, 1.6, 1.4],
    [1.8, 1.6, 1.4]
  ];
  postPositions.forEach(([px, py, pz]) => {
    const post = markShadow(new THREE.Mesh(poleGeo, poleMat));
    post.position.set(px, py, pz);
    hut.add(post);
  });

  // 4. Horizontal timber beams at top
  const beamLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.3), poleMat));
  beamLeft.position.set(-2.0, 3.14, 0.3);
  const beamRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.3), poleMat));
  beamRight.position.set(2.0, 3.14, 0.3);
  const beamBack = markShadow(new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.12, 0.12), poleMat));
  beamBack.position.set(0, 3.14, 1.4);
  const beamFront = markShadow(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 0.12), poleMat));
  beamFront.position.set(0, 3.14, -0.8);
  hut.add(beamLeft, beamRight, beamBack, beamFront);

  // 5. Thatched Roof — full 360° disc so orientation does not matter
  const roof = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.6, 0.4, 16),
    roofMat
  ));
  roof.position.set(0, 3.3, 0.0);
  hut.add(roof);

  // 6. Sign Board "BAR" — placed on the back-local face (z=+2.55)
  // The kiosk is spawned with rotation.y += Math.PI which flips the X axis.
  // Place sign at z=-2.55 (front of counter in local) with lz=-0.06 (protrudes toward road).
  // Pre-mirror ALL letter x coordinates so that after the kiosk PI flip they read correctly.
  const signGroup = new THREE.Group();
  signGroup.position.set(0, 2.55, -3.2);
  signGroup.rotation.x = 0.04;
  hut.add(signGroup);
  signGroup.rotation.y = Math.PI; // cancels kiosk +PI flip → letters in natural orientation

  // Board: wide warm-wood plank
  const signBoard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 0.08), trimMat));
  signGroup.add(signBoard);

  // Two small hanging chains/brackets at top corners
  const chainGeo = new THREE.BoxGeometry(0.04, 0.22, 0.04);
  [-0.88, 0.88].forEach((cx) => {
    const chain = markShadow(new THREE.Mesh(chainGeo, poleMat));
    chain.position.set(cx, 0.42, 0);
    signGroup.add(chain);
  });

  // Letters in natural reading order (B left, A centre, R right).
  // lz = +0.06 protrudes toward the road (sign faces outward after rotation.y=PI).
  const lz = +0.06;
  const ly = 0;
  const th = 0.05;

  // === B ===
  const bGroup = new THREE.Group();
  bGroup.position.set(-0.52, ly, 0);
  // Vertical stem (left side)
  const bV = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, th), letterMat));
  bV.position.set(-0.15, 0, lz);
  // Top / middle / bottom horizontals
  const bH1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH1.position.set(-0.04, 0.185, lz);
  const bH2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH2.position.set(-0.04, 0, lz);
  const bH3 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH3.position.set(-0.04, -0.185, lz);
  // Top and bottom bump connectors (right side)
  const bC1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.185, th), letterMat));
  bC1.position.set(0.065, 0.093, lz);
  const bC2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.185, th), letterMat));
  bC2.position.set(0.065, -0.093, lz);
  bGroup.add(bV, bH1, bH2, bH3, bC1, bC2);
  signGroup.add(bGroup);

  // === A ===
  const aGroup = new THREE.Group();
  aGroup.position.set(0, ly, 0);
  // Left diagonal (leans right)
  const aL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, th), letterMat));
  aL.position.set(-0.10, 0, lz);
  aL.rotation.z = -0.22;
  // Right diagonal (leans left)
  const aR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, th), letterMat));
  aR.position.set(0.10, 0, lz);
  aR.rotation.z = 0.22;
  // Crossbar
  const aC = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  aC.position.set(0, -0.04, lz);
  aGroup.add(aL, aR, aC);
  signGroup.add(aGroup);

  // === R ===
  const rGroup = new THREE.Group();
  rGroup.position.set(+0.52, ly, 0);
  // Vertical stem (left side)
  const rV = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, th), letterMat));
  rV.position.set(-0.10, 0, lz);
  // Top horizontal
  const rH1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, th), letterMat));
  rH1.position.set(-0.01, 0.185, lz);
  // Middle horizontal
  const rH2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, th), letterMat));
  rH2.position.set(-0.01, 0.02, lz);
  // Top-right loop connector
  const rC1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.165, th), letterMat));
  rC1.position.set(0.055, 0.103, lz);
  // Diagonal leg (bottom-right)
  const rLeg2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, th), letterMat));
  rLeg2.position.set(0.072, -0.13, lz);
  rLeg2.rotation.z = 0.5;
  rGroup.add(rV, rH1, rH2, rC1, rLeg2);
  signGroup.add(rGroup);

  // 7. Decorative Kayaks next to the bar (Yellow & Orange-Red)
  const kayakGeo = new THREE.SphereGeometry(1.0, 8, 8);
  const kayak1 = markShadow(new THREE.Mesh(kayakGeo, kayakYellowMat));
  kayak1.scale.set(0.35, 0.18, 2.4);
  kayak1.position.set(3.4, 0.1, -0.2);
  kayak1.rotation.set(0.05, 0.35, 0.0);
  
  const kayak2 = markShadow(new THREE.Mesh(kayakGeo, kayakOrangeMat));
  kayak2.scale.set(0.35, 0.18, 2.4);
  kayak2.position.set(4.0, 0.1, -0.6);
  kayak2.rotation.set(-0.05, 0.25, 0.0);

  hut.add(kayak1, kayak2);

  // 8. Bartender — standing behind the counter, holding a coconut
  const bartender = createBarBartender();
  // z = +1.2 = bartender side (inside the bar, opposite to road-facing counter)
  // After kiosk +PI rotation this becomes the interior behind the counter
  bartender.position.set(0, 0, 0.5);
  bartender.rotation.y = Math.PI; // face toward the road/customer side
  hut.add(bartender);

  return hut;
}

function addBeachHutsStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  [0.20, 0.55, 0.80].forEach((progress, index) => {
    const side = -1;
    const { position, rotationY } = safePlace(curve, progress, side, side * (roadHalfWidth + 16.0), roadHalfWidth, 6.0);
    const hut = createBeachHutStrict(index);
    hut.position.copy(position);
    hut.rotation.y = rotationY + Math.PI; // +Math.PI so open counter faces the road
    hut.scale.setScalar(2.0);
    group.add(hut);
  });
}

function createThatchedUmbrellaWithLoungers(index) {
  const group = new THREE.Group();
  group.name = "TropicalBeachUmbrellaStrict";

  // --- Pole (bamboo-tan cylinder) ---
  const poleMat = createBeachMaterial({ color: 0xb89050, roughness: 0.75 });
  const pole = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 4.8, 6),
    poleMat
  ));
  pole.position.y = 2.4;
  // Slight tilt for a natural beach look
  pole.rotation.z = (index % 2 === 0 ? 0.06 : -0.06);
  group.add(pole);

  // --- Canopy: straw thatched layers (3 stacked cones, decreasing size) ---
  const strawMat = createBeachMaterial({ color: 0xd4a843, roughness: 0.92 });
  const strawDarkMat = createBeachMaterial({ color: 0xb8883a, roughness: 0.95 });

  // Bottom layer — widest
  const canopy1 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(3.8, 0.7, 12), strawMat));
  canopy1.position.y = 4.8;
  // Middle layer
  const canopy2 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(2.8, 0.65, 12), strawDarkMat));
  canopy2.position.y = 5.3;
  // Top layer — smallest cap
  const canopy3 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 10), strawMat));
  canopy3.position.y = 5.8;
  // Tip sphere
  const tip = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), strawDarkMat));
  tip.position.y = 6.1;
  group.add(canopy1, canopy2, canopy3, tip);

  // --- Sun Loungers (sdraio) — two on either side of the pole ---
  const woodMat  = createBeachMaterial({ color: 0x8b5a2b, roughness: 0.80 });
  const fabricMat = createBeachMaterial({ color: 0x4a8fc4, roughness: 0.65 }); // beach-blue
  const fabricMat2 = createBeachMaterial({ color: 0xd4af37, roughness: 0.65 }); // golden

  function makeLounger(side, mat) {
    const lounger = new THREE.Group();

    // Main flat bed
    const bed = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.10, 2.0), mat));
    bed.position.y = 0.30;
    // Raised headrest
    const headrest = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.30, 0.60), mat));
    headrest.position.set(0, 0.45, -0.75);
    headrest.rotation.x = -0.4;

    // Two wooden side rails
    [-0.35, 0.35].forEach((rx) => {
      const rail = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 2.0), woodMat));
      rail.position.set(rx, 0.25, 0);
      lounger.add(rail);
    });
    // Four legs
    [[-0.3, -0.8], [-0.3, 0.7], [0.3, -0.8], [0.3, 0.7]].forEach(([lx, lz]) => {
      const leg = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), woodMat));
      leg.position.set(lx, 0.15, lz);
      lounger.add(leg);
    });

    lounger.add(bed, headrest);
    // Position to one side of the umbrella
    lounger.position.set(side * 1.4, 0, 0.2);
    return lounger;
  }

  const lounger1 = makeLounger(-1, index % 2 === 0 ? fabricMat : fabricMat2);
  lounger1.scale.setScalar(2.0);
  lounger1.rotation.y = Math.PI;

  const lounger2 = makeLounger(+1, index % 2 === 0 ? fabricMat2 : fabricMat);
  lounger2.scale.setScalar(2.0);
  lounger2.rotation.y = Math.PI;

  group.add(lounger1, lounger2);

  return group;
}

function addBeachUmbrellasStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // Place 30 thatched umbrella+lounger sets on the SEA SIDE (side=+1)
  for (let index = 0; index < 30; index += 1) {
    const progress = (index + 0.5) / 30;
    // Alternate between depth rows on the beach, keeping them closer to the road to avoid the water
    const depthOffset = (index % 4 === 0) ? 5.2 : (index % 4 === 1) ? 7.0 : (index % 4 === 2) ? 8.8 : 10.5;
    const { position, rotationY } = safePlace(
      curve, progress, +1,
      +(roadHalfWidth + depthOffset),
      roadHalfWidth, 5.0
    );
    const umbrellaGroup = createThatchedUmbrellaWithLoungers(index);
    umbrellaGroup.position.copy(position);
    umbrellaGroup.rotation.y = rotationY;
    group.add(umbrellaGroup);
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
  addBeachPeople(propsGroup, curve, trackDef);
  // addBeachLampPostsStrict(propsGroup, curve, trackDef);

  optimizeStaticDecorativeProps(propsGroup, [
    "TropicalBeachPropsGround",
    "TropicalBeachOceanShore",
    "TropicalBeachOceanSurf"
  ]);

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

const MONACO_ROAD_Y = 0.045;
const MONACO_GROUND_Y = -0.025;

function createDetailedMonacoYacht(seed) {
  const yacht = new THREE.Group();
  const rng = (offset) => pseudoRandom(seed * 73 + offset);

  // ── Dimensioni Yacht casuali ──
  const yachtType = Math.floor(rng(1) * 3); // 3 tipi diversi di Yacht
  
  // Colori armoniosi
  const stripeColors = [0x0f172a, 0x1e3a8a, 0xb91c1c, 0x047857, 0xf59e0b];
  const stripeColor = stripeColors[Math.floor(rng(2) * stripeColors.length)];
  const hullColor = rng(3) > 0.3 ? 0xffffff : 0xf1f5f9; // bianco o grigio chiarissimo
  
  const hullMat = createFlatStandardMaterial({ color: hullColor, roughness: 0.2, metalness: 0.1 });
  const teakMat = createFlatStandardMaterial({ color: 0xd97706, roughness: 0.6 }); // Finto legno teak
  const cabinMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const glassMat = createFlatStandardMaterial({ color: 0x0f172a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.75 });
  const stripeMat = createFlatStandardMaterial({ color: stripeColor, roughness: 0.3 });
  const canopyMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
  const steelMat = createFlatStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });

  if (yachtType === 0) {
    // ── TIPO 0: Yacht di lusso standard (2 ponti) ──
    const L = 12 + rng(4) * 2; // lunghezza
    const W = 4 + rng(5) * 0.8; // larghezza
    const H = 1.4; // altezza scafo

    // Scafo
    const hullGeo = new THREE.BoxGeometry(W, H, L);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = H * 0.5;
    hull.castShadow = true;
    hull.receiveShadow = true;
    yacht.add(hull);

    // Prua appuntita
    const bowGeo = new THREE.BoxGeometry(W, H, 3);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, H * 0.5, L * 0.5 + 1.2);
    bow.scale.set(1, 1, 0.8);
    yacht.add(bow);

    // Linea colorata sullo scafo
    const stripeGeo = new THREE.BoxGeometry(W * 1.02, 0.18, L + 2.5);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, H * 0.35, 0.5);
    yacht.add(stripe);

    // Ponte principale (Teak aft deck)
    const aftDeckGeo = new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.4);
    const aftDeck = new THREE.Mesh(aftDeckGeo, teakMat);
    aftDeck.position.set(0, H + 0.01, -L * 0.25);
    yacht.add(aftDeck);

    // Cabina 1° livello
    const cabW = W * 0.8;
    const cabL = L * 0.6;
    const cabH = 1.2;
    const cabin1Geo = new THREE.BoxGeometry(cabW, cabH, cabL);
    const cabin1 = new THREE.Mesh(cabin1Geo, cabinMat);
    cabin1.position.set(0, H + cabH * 0.5, L * 0.1);
    cabin1.castShadow = true;
    yacht.add(cabin1);

    // Finestrini oscurati cabina
    const winGeo = new THREE.BoxGeometry(cabW * 1.02, 0.5, cabL * 0.8);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(0, H + cabH * 0.6, L * 0.15);
    yacht.add(win);

    // Flybridge (2° livello)
    const flyW = cabW * 0.85;
    const flyL = cabL * 0.7;
    const flyH = 0.8;
    const flyGeo = new THREE.BoxGeometry(flyW, flyH, flyL);
    const fly = new THREE.Mesh(flyGeo, cabinMat);
    fly.position.set(0, H + cabH + flyH * 0.5, L * 0.05);
    yacht.add(fly);

    // Parabrezza flybridge
    const windshieldGeo = new THREE.BoxGeometry(flyW * 1.02, 0.3, 1.2);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, H + cabH + flyH + 0.15, L * 0.2);
    yacht.add(windshield);

    // Tenda parasole (Canopy) sopra il flybridge
    const canopyW = flyW * 1.1;
    const canopyL = flyL * 0.6;
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(canopyW, canopyL), canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, H + cabH + flyH + 1.1, L * 0.0);
    yacht.add(canopy);

    // Supporti tenda (pilastri d'acciaio)
    [-1, 1].forEach((xs) => {
      [-1, 1].forEach((zs) => {
        const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4);
        const pole = new THREE.Mesh(poleGeo, steelMat);
        pole.position.set(xs * (canopyW * 0.45), H + cabH + flyH + 0.55, L * 0.0 + zs * (canopyL * 0.45));
        yacht.add(pole);
      });
    });

    // Antenna e Radar arch
    const archGeo = new THREE.BoxGeometry(flyW, 0.6, 0.3);
    const arch = new THREE.Mesh(archGeo, steelMat);
    arch.position.set(0, H + cabH + flyH + 0.3, -L * 0.15);
    yacht.add(arch);

    const radGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
    const radar = new THREE.Mesh(radGeo, cabinMat);
    radar.position.set(0, H + cabH + flyH + 0.65, -L * 0.15);
    yacht.add(radar);

  } else if (yachtType === 1) {
    // ── TIPO 1: Superyacht a 3 ponti (Grande) ──
    const L = 16 + rng(4) * 3;
    const W = 5 + rng(5) * 1.0;
    const H = 1.6;

    // Scafo
    const hullGeo = new THREE.BoxGeometry(W, H, L);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = H * 0.5;
    hull.castShadow = true;
    yacht.add(hull);

    // Prua pronunciata
    const bowGeo = new THREE.BoxGeometry(W, H, 4.5);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, H * 0.5, L * 0.5 + 1.8);
    bow.scale.set(1, 1.1, 0.8);
    yacht.add(bow);

    // Linea colorata
    const stripeGeo = new THREE.BoxGeometry(W * 1.02, 0.22, L + 4.0);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, H * 0.4, 0.5);
    yacht.add(stripe);

    // 1° Ponte (Coperta principale)
    const deck1Geo = new THREE.BoxGeometry(W * 0.85, 1.2, L * 0.65);
    const deck1 = new THREE.Mesh(deck1Geo, cabinMat);
    deck1.position.set(0, H + 0.6, L * 0.05);
    deck1.castShadow = true;
    yacht.add(deck1);

    // Finestrini ponte 1
    const win1Geo = new THREE.BoxGeometry(W * 0.88, 0.45, L * 0.5);
    const win1 = new THREE.Mesh(win1Geo, glassMat);
    win1.position.set(0, H + 0.6, L * 0.08);
    yacht.add(win1);

    // 2° Ponte (Upper deck)
    const deck2Geo = new THREE.BoxGeometry(W * 0.75, 1.1, L * 0.5);
    const deck2 = new THREE.Mesh(deck2Geo, cabinMat);
    deck2.position.set(0, H + 1.2 + 0.55, -L * 0.05);
    yacht.add(deck2);

    // Finestrini ponte 2
    const win2Geo = new THREE.BoxGeometry(W * 0.78, 0.45, L * 0.4);
    const win2 = new THREE.Mesh(win2Geo, glassMat);
    win2.position.set(0, H + 1.2 + 0.55, -L * 0.03);
    yacht.add(win2);

    // 3° Ponte (Sun deck / Pilot house)
    const deck3Geo = new THREE.BoxGeometry(W * 0.65, 0.9, L * 0.3);
    const deck3 = new THREE.Mesh(deck3Geo, cabinMat);
    deck3.position.set(0, H + 2.3 + 0.45, -L * 0.1);
    yacht.add(deck3);

    // Grande Flybridge Canopy
    const canopyW = W * 0.8;
    const canopyL = L * 0.35;
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(canopyW, canopyL), canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, H + 3.2 + 0.9, -L * 0.05);
    yacht.add(canopy);

    // Supporti Canopy
    [-1, 1].forEach((xs) => {
      [-1, 1].forEach((zs) => {
        const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4);
        const pole = new THREE.Mesh(poleGeo, steelMat);
        pole.position.set(xs * (canopyW * 0.44), H + 3.2 + 0.45, -L * 0.05 + zs * (canopyL * 0.44));
        yacht.add(pole);
      });
    });

    // Zona pranzo a poppa (Teak deck con tavolo e divanetti)
    const mainAftGeo = new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.3);
    const mainAft = new THREE.Mesh(mainAftGeo, teakMat);
    mainAft.position.set(0, H + 0.01, -L * 0.33);
    yacht.add(mainAft);

    // Tavolo da pranzo
    const tableGeo = new THREE.BoxGeometry(W * 0.3, 0.4, 1.2);
    const table = new THREE.Mesh(tableGeo, cabinMat);
    table.position.set(0, H + 0.22, -L * 0.33);
    yacht.add(table);

    // Persone sul ponte (spettatori extra sullo yacht!)
    const visitorCount = 2 + Math.floor(rng(12) * 4);
    for (let v = 0; v < visitorCount; v++) {
      const vSeed = seed * 43 + v * 99;
      const visitor = createMonacoSpectator(vSeed);
      visitor.scale.set(1.4, 1.4, 1.4); // Proporzionati sullo yacht
      
      // Posizione casuale sul ponte
      const vx = (pseudoRandom(vSeed * 3) - 0.5) * W * 0.6;
      const vz = -L * 0.25 - pseudoRandom(vSeed * 7) * L * 0.12;
      visitor.position.set(vx, H + 0.05, vz);
      visitor.rotation.y = pseudoRandom(vSeed * 11) * Math.PI * 2;
      yacht.add(visitor);
    }

  } else {
    // ── TIPO 2: Sleek Sport Yacht (Catamarano / Moderno) ──
    const L = 11 + rng(6) * 1.5;
    const W = 4.5 + rng(4) * 0.6;
    const H = 1.1;

    // Doppio scafo (Catamaran style)
    [-1, 1].forEach((hullSide) => {
      const hullGeo = new THREE.BoxGeometry(W * 0.35, H, L);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.set(hullSide * W * 0.3, H * 0.5, 0);
      hull.castShadow = true;
      yacht.add(hull);

      const bowGeo = new THREE.BoxGeometry(W * 0.35, H, 2.5);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(hullSide * W * 0.3, H * 0.5, L * 0.5 + 1.0);
      bow.scale.set(1, 1, 0.7);
      yacht.add(bow);
    });

    // Piattaforma di collegamento (Deck principale)
    const platformGeo = new THREE.BoxGeometry(W * 0.95, 0.3, L * 0.85);
    const platform = new THREE.Mesh(platformGeo, hullMat);
    platform.position.set(0, H - 0.15, -0.5);
    yacht.add(platform);

    const platformTeakGeo = new THREE.BoxGeometry(W * 0.9, 0.04, L * 0.75);
    const platformTeak = new THREE.Mesh(platformTeakGeo, teakMat);
    platformTeak.position.set(0, H, -0.5);
    yacht.add(platformTeak);

    // Cabina futuristica aerodinamica
    const cabW = W * 0.75;
    const cabL = L * 0.5;
    const cabH = 1.0;
    const cabGeo = new THREE.BoxGeometry(cabW, cabH, cabL);
    const cab = new THREE.Mesh(cabGeo, cabinMat);
    cab.position.set(0, H + cabH * 0.5, L * 0.05);
    yacht.add(cab);

    // Grandi vetrate scure avvolgenti
    const domeGeo = new THREE.BoxGeometry(cabW * 1.03, 0.55, cabL * 0.6);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.set(0, H + cabH * 0.55, L * 0.12);
    yacht.add(dome);

    // Antenna inclinata sportiva
    const mastGeo = new THREE.CylinderGeometry(0.015, 0.03, 2.2, 4);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(0, H + cabH + 0.9, -L * 0.15);
    mast.rotation.x = -0.3; // inclinata all'indietro per look sportivo
    yacht.add(mast);

    // Bandiera dello yacht
    const flagGeo = new THREE.PlaneGeometry(0.3, 0.2);
    const flagMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, H + cabH + 1.9, -L * 0.3);
    flag.rotation.y = (pseudoRandom(seed * 19) - 0.5) * 0.4;
    yacht.add(flag);
  }

  return yacht;
}

function addMonacoOuterHarbor(group, curve, definition) {
  const roadHW = definition.roadWidth * 0.5;
  const barrierOff = definition.barrierOffset + definition.barrierThickness * 0.5;
  
  // Banchina inizia leggermente fuori dalla barriera stradale
  const quayStartDist = roadHW + barrierOff + 0.1;
  const QUAY_W = 4.0; // Larghezza camminamento
  const quayEndDist = quayStartDist + QUAY_W;
  
  const waterColor = 0x075e8a; // Blu mare intenso e saturo, come in foto
  const waterMat = createFlatStandardMaterial({
    color: waterColor,
    roughness: 0.05, // Molto lucido per riflessi dell'acqua
    metalness: 0.1,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide
  });

  const quayColor = 0xdad5cb; // Cemento banchina chiaro
  const quayMat = createFlatStandardMaterial({
    color: quayColor,
    roughness: 0.85,
    metalness: 0.05
  });

  const darkQuayMat = createFlatStandardMaterial({
    color: 0x8e8a80, // Bordo che va in acqua
    roughness: 0.9
  });

  // Sezioni del porto esterno (lato -1 = sinistra/esterno)
  const harborSections = [
    { tStart: 0.02, tEnd: 0.16, side: -1, waterWidth: 10.0, yachtScale: 0.75 }, // Rettilineo partenza
    { tStart: 0.66, tEnd: 0.85, side: -1, waterWidth: 35.0, yachtScale: 1.25 }, // Rettilineo posteriore (Risalita/Rascasse)
  ];

  const segments = definition.segments;

  harborSections.forEach((sec, secIdx) => {
    const iStart = Math.floor(sec.tStart * segments);
    const iEnd = Math.ceil(sec.tEnd * segments);
    const samplePoints = [];

    for (let i = iStart; i <= iEnd; i++) {
      const t = i / segments;
      const center = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).setY(0).normalize();
      const right = getRightVector(tangent);
      samplePoints.push({ center, tangent, right, t });
    }

    const quayGroup = new THREE.Group();
    quayGroup.name = `MonacoOuterHarbor_${secIdx}`;

    for (let s = 0; s < samplePoints.length - 1; s++) {
      const p1 = samplePoints[s];
      const p2 = samplePoints[s + 1];

      // Coordinate banchina
      const q1_in = p1.center.clone().addScaledVector(p1.right, sec.side * quayStartDist);
      const q2_in = p2.center.clone().addScaledVector(p2.right, sec.side * quayStartDist);
      const q1_out = p1.center.clone().addScaledVector(p1.right, sec.side * quayEndDist);
      const q2_out = p2.center.clone().addScaledVector(p2.right, sec.side * quayEndDist);

      // Mesh banchina (quad)
      const qVerts = new Float32Array([
        q1_in.x, MONACO_ROAD_Y - 0.01, q1_in.z,
        q2_in.x, MONACO_ROAD_Y - 0.01, q2_in.z,
        q1_out.x, MONACO_ROAD_Y - 0.01, q1_out.z,
        q2_in.x, MONACO_ROAD_Y - 0.01, q2_in.z,
        q2_out.x, MONACO_ROAD_Y - 0.01, q2_out.z,
        q1_out.x, MONACO_ROAD_Y - 0.01, q1_out.z,
      ]);
      const qGeo = new THREE.BufferGeometry();
      qGeo.setAttribute('position', new THREE.BufferAttribute(qVerts, 3));
      qGeo.computeVertexNormals();
      const qMesh = new THREE.Mesh(qGeo, quayMat);
      qMesh.receiveShadow = true;
      qMesh.castShadow = true;
      quayGroup.add(qMesh);

      // Alzata verticale banchina
      const borderY = MONACO_ROAD_Y - 0.01;
      const waterY = MONACO_GROUND_Y + 0.01; // Appena sopra il terreno di fondo per coprirlo
      const bVerts = new Float32Array([
        q1_out.x, borderY, q1_out.z,
        q2_out.x, borderY, q2_out.z,
        q1_out.x, waterY,  q1_out.z,
        q2_out.x, borderY, q2_out.z,
        q2_out.x, waterY,  q2_out.z,
        q1_out.x, waterY,  q1_out.z,
      ]);
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.BufferAttribute(bVerts, 3));
      bGeo.computeVertexNormals();
      const bMesh = new THREE.Mesh(bGeo, darkQuayMat);
      bMesh.receiveShadow = true;
      quayGroup.add(bMesh);

      // Mesh Acqua
      const w1_out = p1.center.clone().addScaledVector(p1.right, sec.side * (quayEndDist + sec.waterWidth));
      const w2_out = p2.center.clone().addScaledVector(p2.right, sec.side * (quayEndDist + sec.waterWidth));

      const wVerts = new Float32Array([
        q1_out.x, waterY, q1_out.z,
        q2_out.x, waterY, q2_out.z,
        w1_out.x, waterY, w1_out.z,
        q2_out.x, waterY, q2_out.z,
        w2_out.x, waterY, w2_out.z,
        w1_out.x, waterY, w1_out.z,
      ]);
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.BufferAttribute(wVerts, 3));
      wGeo.computeVertexNormals();
      const wMesh = new THREE.Mesh(wGeo, waterMat);
      wMesh.receiveShadow = true;
      quayGroup.add(wMesh);
    }

    // Posizionamento Yacht
    let distSinceLastYacht = 999;
    for (let s = 0; s < samplePoints.length; s++) {
      const p = samplePoints[s];
      if (s > 0) {
        distSinceLastYacht += p.center.distanceTo(samplePoints[s - 1].center);
      }

      const yachtSeed = secIdx * 5000 + s;
      const targetSpacing = (5.5 + pseudoRandom(yachtSeed * 29) * 3.0) * sec.yachtScale;

      if (distSinceLastYacht >= targetSpacing) {
        // Posizione scafo basata sulla scala dello yacht
        const yachtLength = 12.0 * sec.yachtScale;
        const yachtDist = quayEndDist + (yachtLength * 0.5) + 0.3;
        const yachtPos = p.center.clone().addScaledVector(p.right, sec.side * yachtDist);
        yachtPos.y = MONACO_GROUND_Y + 0.015; // Livello galleggiamento acqua

        const yacht = createDetailedMonacoYacht(yachtSeed);
        yacht.scale.set(sec.yachtScale, sec.yachtScale, sec.yachtScale);
        yacht.position.copy(yachtPos);

        // Ruota perpendicolarmente alla pista (prua verso il mare)
        const outwardDir = p.right.clone().multiplyScalar(sec.side).setY(0).normalize();
        yacht.rotation.y = Math.atan2(outwardDir.x, outwardDir.z);

        // Oscillazione realistica da galleggiamento
        yacht.rotation.y += (pseudoRandom(yachtSeed * 17) - 0.5) * 0.04;
        yacht.rotation.x = (pseudoRandom(yachtSeed * 3) - 0.5) * 0.015;
        yacht.rotation.z = (pseudoRandom(yachtSeed * 7) - 0.5) * 0.015;

        quayGroup.add(yacht);
        distSinceLastYacht = 0;
      }
    }

    group.add(quayGroup);
  });
}

function addMonacoTribune(group, curve, definition) {
  const structureMat = createFlatStandardMaterial({
    color: 0xcccccc,
    roughness: 0.85,
    metalness: 0.05
  });

  const seatColors = [0xd92d2d, 0x2f80ed, 0xf2c94c, 0xffffff, 0x27ae60];

  // 1. Grandstand at z = -72, facing the start/finish line (z = -60)
  const stand1 = new THREE.Group();
  stand1.name = "MonacoGrandstandStart";
  stand1.position.set(0, MONACO_GROUND_Y, -72);

  const width = 45;
  const depth = 5;
  const heightSteps = 4;

  for (let step = 0; step < heightSteps; step += 1) {
    const stepHeight = 0.55 * (step + 1);
    const stepDepth = depth / heightSteps;
    const stepZ = (step * stepDepth) - (depth * 0.5) + (stepDepth * 0.5);

    const stepGeo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
    const stepMesh = new THREE.Mesh(stepGeo, structureMat);
    stepMesh.position.set(0, stepHeight * 0.5, stepZ);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    stand1.add(stepMesh);

    const seatGeo = new THREE.BoxGeometry(0.55, 0.34, 0.55);
    const seatsPerRow = Math.floor(width / 0.95);
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const seatX = (seat - (seatsPerRow - 1) * 0.5) * 0.95 + (pseudoRandom(step * 7 + seat) * 0.2 - 0.1);
      const seatColor = seatColors[Math.floor(pseudoRandom(step * 17 + seat * 11) * seatColors.length)];
      const seatMat = createFlatStandardMaterial({ color: seatColor, roughness: 0.6 });
      const seatMesh = new THREE.Mesh(seatGeo, seatMat);
      seatMesh.position.set(seatX, stepHeight + 0.17, stepZ + (pseudoRandom(seat * 13) * 0.2 - 0.1));
      seatMesh.castShadow = true;
      stand1.add(seatMesh);
    }
  }

  const canopyMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const canopyGeo = new THREE.BoxGeometry(width + 2, 0.18, depth + 1);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 3.4, 0.5);
  canopy.rotation.x = -0.06;
  canopy.castShadow = true;
  stand1.add(canopy);

  const pillarMat = createFlatStandardMaterial({ color: 0x1f2430, roughness: 0.6, metalness: 0.4 });
  const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6);
  const pillarCount = 5;
  for (let p = 0; p < pillarCount; p += 1) {
    const px = (p - (pillarCount - 1) * 0.5) * (width / (pillarCount - 1));
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 1.7, -depth * 0.5 + 0.25);
    pillar.castShadow = true;
    stand1.add(pillar);
  }

  group.add(stand1);

  // 2. Grandstand at z = 54, facing the bottom straight (z = 42)
  const stand2 = stand1.clone();
  stand2.name = "MonacoGrandstandBottom";
  stand2.position.set(-5, MONACO_GROUND_Y, 54);
  stand2.rotation.y = Math.PI; // Face opposite direction
  group.add(stand2);
}

function createMonacoBuilding(index, height, width, depth) {
  const building = new THREE.Group();
  building.name = `MonacoBuilding_${index}`;

  const bodyColors = [0xf4efe2, 0xebe3cd, 0xecdcb9, 0xfcfbf7, 0xe5dcc4];
  const bodyColor = bodyColors[index % bodyColors.length];
  const bodyMat = createFlatStandardMaterial({
    color: bodyColor,
    roughness: 0.72,
    metalness: 0.05
  });

  const glassMat = createFlatStandardMaterial({
    color: 0x2b3e4e,
    roughness: 0.15,
    metalness: 0.8
  });

  const roofMat = createFlatStandardMaterial({
    color: 0x8b8e93,
    roughness: 0.9
  });

  // Corpo principale (Main block)
  const blockGeo = new THREE.BoxGeometry(width, height, depth);
  const block = new THREE.Mesh(blockGeo, bodyMat);
  block.position.y = height * 0.5;
  block.castShadow = true;
  block.receiveShadow = true;
  building.add(block);

  // Tetto (Roof)
  const roofGeo = new THREE.BoxGeometry(width * 1.01, 0.16, depth * 1.01);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height + 0.08;
  roof.castShadow = true;
  building.add(roof);

  // Finestre (Windows)
  const windowRows = Math.floor(height / 2.8);
  const windowCols = Math.floor(width / 2.2);
  const wWidth = 0.8;
  const wHeight = 1.35;
  const wDepth = 0.08;

  const windowGeo = new THREE.BoxGeometry(wWidth, wHeight, wDepth);
  const winMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let r = 0; r < windowRows; r += 1) {
    for (let c = 0; c < windowCols; c += 1) {
      const wx = (c - (windowCols - 1) * 0.5) * 2.2;
      const wy = (r + 0.5) * 2.8 + 0.4;
      
      // Front face
      matrix.makeTranslation(wx, wy, depth * 0.5 + 0.03);
      winMatrices.push(matrix.clone());

      // Back face
      matrix.makeTranslation(wx, wy, -depth * 0.5 - 0.03);
      winMatrices.push(matrix.clone());
    }
  }

  if (winMatrices.length > 0) {
    const windows = new THREE.InstancedMesh(windowGeo, glassMat, winMatrices.length);
    windows.name = "Windows";
    winMatrices.forEach((winMatrix, idx) => windows.setMatrixAt(idx, winMatrix));
    windows.instanceMatrix.needsUpdate = true;
    building.add(windows);
  }

  if (height > 12) {
    const penGeo = new THREE.BoxGeometry(width * 0.44, 1.8, depth * 0.44);
    const penthouse = new THREE.Mesh(penGeo, bodyMat);
    penthouse.position.set(0, height + 1.06, 0);
    penthouse.castShadow = true;
    building.add(penthouse);
  }

  return building;
}

function addMonacoBuildings(group, curve, definition) {
  // Monaco hillside town on the left/inside area (x = -65)
  const leftX = -65;
  const startZ = -70;
  const endZ = 50;
  const spacing = 18;
  const buildingCount = Math.floor((endZ - startZ) / spacing) + 1;

  for (let i = 0; i < buildingCount; i += 1) {
    const z = startZ + i * spacing + (pseudoRandom(i) * 3 - 1.5);
    const height = 18 + pseudoRandom(i + 3) * 20;
    const width = 12 + pseudoRandom(i * 5) * 5;
    const depth = 12 + pseudoRandom(i * 11) * 5;

    const b = createMonacoBuilding(i, height, width, depth);
    b.position.set(leftX - pseudoRandom(i) * 8, MONACO_GROUND_Y, z);
    b.rotation.y = pseudoRandom(i) * 0.15 - 0.075;
    group.add(b);
  }
}

// ─── MONACO SPECTATORS & GRANDSTANDS ────────────────────────────────────────

/**
 * Crea uno spettatore realistico seduto con arti articolati.
 * Altezza seduto ≈ STEP_H (0.55m) per proporzioni corrette sui gradoni.
 *
 * Anatomia (dal basso):
 *   • Coscia (thigh) – piega 90° in avanti (seduto)
 *   • Stinco (shin)  – penzola verticale o leggermente in avanti
 *   • Busto (torso)  – seduto dritto
 *   • Collo
 *   • Testa (sfera)
 *   • Braccia superiori + avambracci
 *   • Accessori: cappello rosso, occhiali da sole, bandiera
 */
function createMonacoSpectator(seed) {
  const person = new THREE.Group();
  const rng = (offset) => pseudoRandom(seed * 97 + offset);

  // ── Colori ──
  const shirtColors = [0xd92d2d, 0x1a5276, 0x1e8449, 0xf39c12, 0x7d3c98, 0xe8e8e8, 0x2e4057, 0xc0392b, 0xff6b35, 0x34495e];
  const shirtColor = shirtColors[Math.floor(rng(1) * shirtColors.length)];
  const pantsColors = [0x2c3e50, 0x1a1a2e, 0x4a4a4a, 0x1b2631, 0x3d405b];
  const pantsColor = pantsColors[Math.floor(rng(9) * pantsColors.length)];
  const shoeColor = 0x222222;
  const skinColors = [0xf5cba7, 0xe8b89a, 0xc68642, 0x8d5524, 0xfadcb8];
  const skinColor = skinColors[Math.floor(rng(3) * skinColors.length)];

  const hatColors = [0xd92d2d, 0xd92d2d, 0xd92d2d, 0xc0392b, 0xb71c1c, 0xffd700];
  const hatColor = hatColors[Math.floor(rng(2) * hatColors.length)];
  const hasHat = rng(8) > 0.4;
  const hasSunglasses = rng(4) > 0.5;
  const hasFlag = rng(5) > 0.65;

  const skinMat = createFlatStandardMaterial({ color: skinColor, roughness: 0.85 });
  const shirtMat = createFlatStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = createFlatStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const shoeMat = createFlatStandardMaterial({ color: shoeColor, roughness: 0.9 });

  // ── Dimensioni proporzionate al gradone (STEP_H = 0.55m) ──
  // Altezza seduto totale ≈ 0.50m (busto+testa), gambe piegate davanti
  const TORSO_H = 0.22;
  const TORSO_W = 0.18;
  const TORSO_D = 0.12;
  const HEAD_R = 0.07;
  const NECK_H = 0.03;
  const UPPER_ARM_L = 0.11;
  const FOREARM_L = 0.10;
  const ARM_R = 0.028;
  const THIGH_L = 0.18;
  const SHIN_L = 0.17;
  const LEG_R = 0.035;
  const SHOE_H = 0.04;

  // Punto base = superficie del gradone (y=0)

  // ── Cosce (orizzontali, sedute sul gradone) ──
  const thighGeo = new THREE.CylinderGeometry(LEG_R, LEG_R * 0.9, THIGH_L, 5);
  [-1, 1].forEach((side) => {
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.rotation.z = Math.PI * 0.5; // orizzontale
    thigh.position.set(side * 0.06, 0.04, THIGH_L * 0.5 + 0.02);
    person.add(thigh);
  });

  // ── Stinchi (pendono dal bordo del gradone) ──
  const shinGeo = new THREE.CylinderGeometry(LEG_R * 0.85, LEG_R * 0.7, SHIN_L, 5);
  [-1, 1].forEach((side) => {
    const shin = new THREE.Mesh(shinGeo, pantsMat);
    shin.position.set(side * 0.06, -SHIN_L * 0.5 + 0.01, THIGH_L + 0.02);
    person.add(shin);

    // Scarpa
    const shoeGeo = new THREE.BoxGeometry(0.05, SHOE_H, 0.08);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(side * 0.06, -SHIN_L + 0.01 - SHOE_H * 0.5 + 0.01, THIGH_L + 0.04);
    person.add(shoe);
  });

  // ── Busto ──
  const torsoGeo = new THREE.BoxGeometry(TORSO_W, TORSO_H, TORSO_D);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, TORSO_H * 0.5 + 0.05, 0);
  torso.castShadow = true;
  person.add(torso);

  // ── Collo ──
  const neckGeo = new THREE.CylinderGeometry(0.025, 0.03, NECK_H, 5);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, TORSO_H + 0.05 + NECK_H * 0.5, 0);
  person.add(neck);

  // ── Testa ──
  const headGeo = new THREE.SphereGeometry(HEAD_R, 8, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  const headY = TORSO_H + 0.05 + NECK_H + HEAD_R;
  head.position.set(0, headY, 0);
  head.castShadow = true;
  person.add(head);

  // ── Braccia (busto → giù + avanti) ──
  const upperArmGeo = new THREE.CylinderGeometry(ARM_R, ARM_R * 0.85, UPPER_ARM_L, 5);
  const forearmGeo = new THREE.CylinderGeometry(ARM_R * 0.8, ARM_R * 0.65, FOREARM_L, 5);

  const armAngle = rng(10) * 0.3 + 0.05; // leggera variazione posa
  [-1, 1].forEach((side) => {
    // Upper arm
    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    const shoulderY = TORSO_H + 0.02;
    upperArm.position.set(side * (TORSO_W * 0.5 + ARM_R), shoulderY - UPPER_ARM_L * 0.4, 0);
    upperArm.rotation.z = side * armAngle;
    person.add(upperArm);

    // Forearm (skin)
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.set(
      side * (TORSO_W * 0.5 + ARM_R + Math.sin(armAngle) * UPPER_ARM_L * 0.4),
      shoulderY - UPPER_ARM_L * 0.8 - FOREARM_L * 0.35,
      0.03
    );
    forearm.rotation.z = side * (armAngle * 0.5);
    person.add(forearm);

    // Mano (piccola sfera)
    const handGeo = new THREE.SphereGeometry(0.022, 4, 4);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(
      side * (TORSO_W * 0.5 + ARM_R + Math.sin(armAngle) * UPPER_ARM_L * 0.5),
      shoulderY - UPPER_ARM_L * 0.8 - FOREARM_L * 0.75,
      0.04
    );
    person.add(hand);
  });

  // ── Cappello (rosso Ferrari, 60%) ──
  if (hasHat) {
    const hatMat = createFlatStandardMaterial({ color: hatColor, roughness: 0.75 });
    const brimGeo = new THREE.CylinderGeometry(HEAD_R + 0.04, HEAD_R + 0.04, 0.015, 8);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.set(0, headY + HEAD_R * 0.7, 0);
    person.add(brim);

    const crownGeo = new THREE.CylinderGeometry(HEAD_R * 0.65, HEAD_R * 0.9, HEAD_R * 0.9, 8);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.set(0, headY + HEAD_R * 0.7 + HEAD_R * 0.45, 0);
    person.add(crown);
  }

  // ── Occhiali da sole (50%) ──
  if (hasSunglasses) {
    const glassMat = createFlatStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.7 });
    const lensGeo = new THREE.BoxGeometry(0.04, 0.022, 0.015);
    [-1, 1].forEach((s) => {
      const lens = new THREE.Mesh(lensGeo, glassMat);
      lens.position.set(s * 0.032, headY - 0.005, HEAD_R * 0.85);
      person.add(lens);
    });
    const bridgeGeo = new THREE.BoxGeometry(0.07, 0.008, 0.015);
    const bridge = new THREE.Mesh(bridgeGeo, glassMat);
    bridge.position.set(0, headY - 0.005, HEAD_R * 0.85);
    person.add(bridge);
  }

  // ── Bandiera Ferrari (35%) ──
  if (hasFlag) {
    const poleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 4);
    const poleMat = createFlatStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    const flagHandSide = rng(7) > 0.5 ? 1 : -1;
    pole.position.set(flagHandSide * 0.16, headY + 0.18, 0.04);
    pole.rotation.z = flagHandSide * 0.15;
    person.add(pole);

    // Bandiera rossa Ferrari
    const flagGeo = new THREE.PlaneGeometry(0.26, 0.18);
    const flagMat = createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.7, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(flagHandSide * (0.16 + 0.14), headY + 0.35, 0.04);
    flag.rotation.y = (rng(11) - 0.5) * 0.4;
    person.add(flag);
  }

  return person;
}

/**
 * Spalti continui che seguono il lato INTERNO della curva (spline).
 * Campiona il percorso e costruisce tribune a gradoni lungo tratti ampi,
 * come nel vero GP di Monaco.
 */
function addMonacoGrandstands(group, curve, definition) {
  const ROWS = 6;
  const STEP_H = 0.55;
  const STEP_D = 0.70;
  const SEAT_SPACING = 0.50;
  const STAND_INSET = 3.5;  // distanza dal bordo della barriera interna verso il centro

  const roadHW = definition.roadWidth * 0.5;
  const barrierOff = definition.barrierOffset + definition.barrierThickness * 0.5;
  // Distanza dal centro della pista al lato interno dello spalto
  const standDist = roadHW + barrierOff + STAND_INSET;

  const concreteMat = createFlatStandardMaterial({ color: 0xc8c2b8, roughness: 0.92 });
  const concreteDarkMat = createFlatStandardMaterial({ color: 0x9e9a90, roughness: 0.95 });

  // Sezioni continue di spalti: range [tStart, tEnd] sulla spline, lato (1 = destra/interno)
  // Scegliamo tratti lunghi interni che corrispondono alla foto reale di Monaco
  const sections = [
    { tStart: 0.02, tEnd: 0.18, side: 1 },   // lungo il rettilineo partenza + Sainte-Dévote
    { tStart: 0.22, tEnd: 0.42, side: 1 },   // Massenet → Casino
    { tStart: 0.48, tEnd: 0.62, side: 1 },   // Mirabeau → Hairpin
    { tStart: 0.68, tEnd: 0.85, side: 1 },   // Risalita → Jink → Rascasse
  ];

  const segments = definition.segments;

  sections.forEach((sec, secIdx) => {
    const standGroup = new THREE.Group();
    standGroup.name = `MonacoGrandstand_${secIdx}`;

    // Campiona punti lungo il tratto di curva con maggiore densità per gradini più lisci e più spettatori
    const densityMultiplier = 3;
    const iStart = Math.floor(sec.tStart * segments * densityMultiplier);
    const iEnd = Math.ceil(sec.tEnd * segments * densityMultiplier);
    const samplePoints = [];

    for (let i = iStart; i <= iEnd; i++) {
      const t = i / (segments * densityMultiplier);
      const center = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).setY(0).normalize();
      const right = getRightVector(tangent);
      samplePoints.push({ center, tangent, right, t });
    }

    // Ogni ~SEAT_SPACING lungo la curva = 1 posto
    // Calcoliamo una striscia di gradoni che segue la curva

    for (let row = 0; row < ROWS; row++) {
      const rowDist = standDist + row * STEP_D;
      const rowY = MONACO_ROAD_Y + row * STEP_H;

      // Costruiamo un ribbon di gradone continuo lungo i sample points
      for (let s = 0; s < samplePoints.length - 1; s++) {
        const p1 = samplePoints[s];
        const p2 = samplePoints[s + 1];

        // Posizione interna alla pista (lato sinistro = -right)
        const pos1 = p1.center.clone().addScaledVector(p1.right, sec.side * rowDist);
        const pos2 = p2.center.clone().addScaledVector(p2.right, sec.side * rowDist);
        const pos1outer = p1.center.clone().addScaledVector(p1.right, sec.side * (rowDist + STEP_D * 0.85));
        const pos2outer = p2.center.clone().addScaledVector(p2.right, sec.side * (rowDist + STEP_D * 0.85));

        // Gradone come quad (BufferGeometry di 2 triangoli)
        const stepVerts = new Float32Array([
          pos1.x, rowY,            pos1.z,
          pos2.x, rowY,            pos2.z,
          pos1outer.x, rowY,       pos1outer.z,
          pos2.x, rowY,            pos2.z,
          pos2outer.x, rowY,       pos2outer.z,
          pos1outer.x, rowY,       pos1outer.z,
        ]);
        const stepGeo = new THREE.BufferGeometry();
        stepGeo.setAttribute('position', new THREE.BufferAttribute(stepVerts, 3));
        stepGeo.computeVertexNormals();
        const stepMesh = new THREE.Mesh(stepGeo, row % 2 === 0 ? concreteMat : concreteDarkMat);
        stepMesh.receiveShadow = true;
        standGroup.add(stepMesh);

        // Alzata verticale (fronte del gradone)
        const riserVerts = new Float32Array([
          pos1.x, rowY,           pos1.z,
          pos2.x, rowY,           pos2.z,
          pos1.x, rowY - STEP_H,  pos1.z,
          pos2.x, rowY,           pos2.z,
          pos2.x, rowY - STEP_H,  pos2.z,
          pos1.x, rowY - STEP_H,  pos1.z,
        ]);
        const riserGeo = new THREE.BufferGeometry();
        riserGeo.setAttribute('position', new THREE.BufferAttribute(riserVerts, 3));
        riserGeo.computeVertexNormals();
        const riserMesh = new THREE.Mesh(riserGeo, concreteDarkMat);
        standGroup.add(riserMesh);
      }

      // Spettatori su questa fila – disposti a intervalli di distanza costanti per densità uniforme
      let distSinceLast = 999;

      for (let s = 0; s < samplePoints.length; s++) {
        const p = samplePoints[s];
        if (s > 0) {
          distSinceLast += p.center.distanceTo(samplePoints[s - 1].center);
        }

        const spectatorSeed = secIdx * 10000 + row * 1000 + s;
        // Spaziatura target fitta per spettatori grandi (scala 1.75)
        const targetSpacing = 0.55 + pseudoRandom(spectatorSeed * 77) * 0.2;

        if (distSinceLast >= targetSpacing) {
          // 85% di probabilità di occupare il posto per creare piccole variazioni naturali
          if (pseudoRandom(spectatorSeed * 131) > 0.15) {
            const seatPos = p.center.clone().addScaledVector(p.right, sec.side * (rowDist + STEP_D * 0.3));
            seatPos.y = rowY + 0.01;

            const spectator = createMonacoSpectator(spectatorSeed);
            // Ingrandiamo gli spettatori a 1.75x
            spectator.scale.set(1.75, 1.75, 1.75);
            spectator.position.copy(seatPos);

            // Ruota per guardare verso la pista
            const toTrack = p.center.clone().sub(seatPos).setY(0).normalize();
            spectator.rotation.y = Math.atan2(toTrack.x, toTrack.z);
            spectator.rotation.y += (pseudoRandom(spectatorSeed * 13) - 0.5) * 0.25;

            standGroup.add(spectator);
          }
          distSinceLast = 0;
        }
      }
    }

    // Parete di fondo dietro l'ultima fila (muro dello spalto)
    for (let s = 0; s < samplePoints.length - 1; s++) {
      const p1 = samplePoints[s];
      const p2 = samplePoints[s + 1];
      const backDist = standDist + ROWS * STEP_D;
      const backH = ROWS * STEP_H + 0.6;

      const b1 = p1.center.clone().addScaledVector(p1.right, sec.side * backDist);
      const b2 = p2.center.clone().addScaledVector(p2.right, sec.side * backDist);

      const wallVerts = new Float32Array([
        b1.x, MONACO_ROAD_Y + backH, b1.z,
        b2.x, MONACO_ROAD_Y + backH, b2.z,
        b1.x, MONACO_ROAD_Y,         b1.z,
        b2.x, MONACO_ROAD_Y + backH, b2.z,
        b2.x, MONACO_ROAD_Y,         b2.z,
        b1.x, MONACO_ROAD_Y,         b1.z,
      ]);
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.BufferAttribute(wallVerts, 3));
      wallGeo.computeVertexNormals();
      const wallMesh = new THREE.Mesh(wallGeo, concreteDarkMat);
      standGroup.add(wallMesh);
    }

    group.add(standGroup);
  });
}

function addMonacoLampPosts(group, curve, definition) {
  const postMat = createFlatStandardMaterial({
    color: 0x475569,
    roughness: 0.58,
    metalness: 0.36
  });

  const lampMat = createFlatStandardMaterial({
    color: 0xfffacd,
    emissive: 0xfffacd,
    emissiveIntensity: 1.5,
    roughness: 0.1
  });

  const totalLength = curve.getLength();
  const interval = 16;
  const count = Math.floor(totalLength / interval);

  const postHeight = 3.6;
  const armLength = 1.1;

  for (let i = 0; i < count; i += 1) {
    const progress = (i * interval) / totalLength;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    const side = i % 2 === 0 ? 1 : -1;
    const offset = definition.roadWidth * 0.5 + (definition.barrierOffset ?? 0.85) + 0.42;

    const pos = point.clone().addScaledVector(normal, side * offset);
    pos.y = MONACO_ROAD_Y;

    const heading = getHeading(tangent);

    const postGroup = new THREE.Group();
    postGroup.name = `LampPost_${i}`;
    postGroup.position.copy(pos);
    postGroup.rotation.y = heading;

    // Palo verticale (Vertical post)
    const verticalGeo = new THREE.CylinderGeometry(0.08, 0.12, postHeight, 5);
    const vertical = new THREE.Mesh(verticalGeo, postMat);
    vertical.position.y = postHeight * 0.5;
    vertical.castShadow = true;
    postGroup.add(vertical);

    // Braccio orizzontale (Horizontal arm)
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, armLength);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(-side * armLength * 0.5, postHeight - 0.04, 0);
    arm.rotation.y = Math.PI / 2;
    arm.castShadow = true;
    postGroup.add(arm);

    // Corpo lampada (Lamp fixture)
    const fixtureGeo = new THREE.BoxGeometry(0.24, 0.12, 0.34);
    const fixture = new THREE.Mesh(fixtureGeo, postMat);
    fixture.position.set(-side * armLength, postHeight - 0.1, 0);
    fixture.castShadow = true;
    postGroup.add(fixture);

    const bulbGeo = new THREE.BoxGeometry(0.18, 0.06, 0.26);
    const bulb = new THREE.Mesh(bulbGeo, lampMat);
    bulb.position.set(-side * armLength, postHeight - 0.15, 0);
    postGroup.add(bulb);

    group.add(postGroup);
  }
}

function addMonacoKerbs(group, curve, definition) {
  const roadWidth = definition.roadWidth;
  const segments = definition.segments;

  // Generiamo gli stessi identici campioni della strada per un allineamento perfetto
  const edgeSamples = [];
  let cumulativeDistance = 0;
  let previousCenter = null;

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);

    if (previousCenter) {
      cumulativeDistance += previousCenter.distanceTo(center);
    }

    edgeSamples.push({
      center: center.clone(),
      normal: right,
      roadHalfWidth: roadWidth * 0.5,
      distance: cumulativeDistance
    });

    previousCenter = center;
  }

  // Costruiamo i vertici e gli indici per le mesh rosse e bianche
  const redVertices = [];
  const redIndices = [];
  const redUvs = [];
  let redVertCount = 0;

  const whiteVertices = [];
  const whiteIndices = [];
  const whiteUvs = [];
  let whiteVertCount = 0;

  // Larghezza del cordolo sul bordo della pista (completamente sull'asfalto, mai oltre il bordo)
  // Bordo esterno = esattamente al bordo della strada
  // Bordo interno = 1.6m verso il centro della pista
  const KERB_WIDTH = 1.6;
  const ROAD_UV_SCALE = 8;

  // Ciclo su entrambi i lati: sinistra (-1) e destra (1)
  [-1, 1].forEach((side) => {
    for (let i = 0; i < edgeSamples.length - 1; i++) {
      const sample1 = edgeSamples[i];
      const sample2 = edgeSamples[i + 1];

      // "outer" = esattamente al bordo della strada (mai oltre → mai sotto il muro)
      // "inner" = KERB_WIDTH verso il centro
      const outerDist1 = sample1.roadHalfWidth;
      const innerDist1 = sample1.roadHalfWidth - KERB_WIDTH;
      const outerDist2 = sample2.roadHalfWidth;
      const innerDist2 = sample2.roadHalfWidth - KERB_WIDTH;

      const inner1 = sample1.center.clone().addScaledVector(sample1.normal, side * innerDist1);
      const outer1 = sample1.center.clone().addScaledVector(sample1.normal, side * outerDist1);
      const inner2 = sample2.center.clone().addScaledVector(sample2.normal, side * innerDist2);
      const outer2 = sample2.center.clone().addScaledVector(sample2.normal, side * outerDist2);

      // Piatto sull'asfalto, leggermente rialzato per non z-fight
      const Y = MONACO_ROAD_Y + 0.015;
      inner1.y = Y;
      outer1.y = Y;
      inner2.y = Y;
      outer2.y = Y;

      // Alterniamo il colore a ogni segmento
      if (i % 2 === 0) {
        redVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        redUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        redIndices.push(
          redVertCount, redVertCount + 2, redVertCount + 1,
          redVertCount + 1, redVertCount + 2, redVertCount + 3
        );
        redVertCount += 4;
      } else {
        whiteVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        whiteUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        whiteIndices.push(
          whiteVertCount, whiteVertCount + 2, whiteVertCount + 1,
          whiteVertCount + 1, whiteVertCount + 2, whiteVertCount + 3
        );
        whiteVertCount += 4;
      }
    }
  });

  const redMat = createFlatStandardMaterial({
    color: 0xd92d2d, // Rosso vivace Monaco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const whiteMat = createFlatStandardMaterial({
    color: 0xfafafa, // Bianco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  if (redVertices.length > 0) {
    const redGeo = new THREE.BufferGeometry();
    redGeo.setAttribute("position", new THREE.Float32BufferAttribute(redVertices, 3));
    redGeo.setAttribute("uv", new THREE.Float32BufferAttribute(redUvs, 2));
    redGeo.setIndex(redIndices);
    redGeo.computeVertexNormals();

    const redMesh = new THREE.Mesh(redGeo, redMat);
    redMesh.name = "MonacoKerbsRed";
    redMesh.receiveShadow = true;
    redMesh.castShadow = true;
    group.add(redMesh);
  }

  if (whiteVertices.length > 0) {
    const whiteGeo = new THREE.BufferGeometry();
    whiteGeo.setAttribute("position", new THREE.Float32BufferAttribute(whiteVertices, 3));
    whiteGeo.setAttribute("uv", new THREE.Float32BufferAttribute(whiteUvs, 2));
    whiteGeo.setIndex(whiteIndices);
    whiteGeo.computeVertexNormals();

    const whiteMesh = new THREE.Mesh(whiteGeo, whiteMat);
    whiteMesh.name = "MonacoKerbsWhite";
    whiteMesh.receiveShadow = true;
    whiteMesh.castShadow = true;
    group.add(whiteMesh);
  }
}

function createMonacoRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  nearOffset,
  farOffset,
  y,
  material,
  sampleStep = 1
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    const near = center.clone().addScaledVector(right, side * nearOffset);
    const far = center.clone().addScaledVector(right, side * farOffset);

    vertices.push(near.x, y, near.z, far.x, y, far.z);
  }

  for (let index = 0; index < steps; index += 1) {
    const current = index * 2;
    const next = current + 2;
    if (side > 0) {
      indices.push(current, next, current + 1, current + 1, next, next + 1);
    } else {
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function createMonacoVerticalRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  offset,
  yBottom,
  yTop,
  material,
  sampleStep = 2
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    const base = center.clone().addScaledVector(right, side * offset);

    vertices.push(base.x, yBottom, base.z, base.x, yTop, base.z);
  }

  for (let index = 0; index < steps; index += 1) {
    const current = index * 2;
    const next = current + 2;
    if (side > 0) {
      indices.push(current, next, current + 1, current + 1, next, next + 1);
    } else {
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function collectMonacoSamples(curve, start, end, spacingMeters) {
  const samples = [];
  const totalLength = curve.getLength();
  const step = Math.max(0.002, spacingMeters / totalLength);

  for (let progress = start; progress <= end; progress += step) {
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    samples.push({ center, tangent, right, progress });
  }

  return samples;
}

function addMonacoInstancedPart(group, geometry, material, matrices, name) {
  if (matrices.length === 0) {
    return;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addMonacoSeatedCrowd(group, curve, definition, sections, baseOffset) {
  const shirtMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.78 }),
    createFlatStandardMaterial({ color: 0xf3f0e8, roughness: 0.8 }),
    createFlatStandardMaterial({ color: 0x1f5f9e, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0xf2c94c, roughness: 0.75 }),
    createFlatStandardMaterial({ color: 0x2f80ed, roughness: 0.8 }),
    createFlatStandardMaterial({ color: 0x111827, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0x16a34a, roughness: 0.78 })
  ];
  const skinMaterials = [
    createFlatStandardMaterial({ color: 0xf2c09a, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0xc68642, roughness: 0.84 }),
    createFlatStandardMaterial({ color: 0x8d5524, roughness: 0.86 })
  ];
  const capMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.72 }),
    createFlatStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
    createFlatStandardMaterial({ color: 0x1f2937, roughness: 0.78 }),
    createFlatStandardMaterial({ color: 0xffd21f, roughness: 0.74 })
  ];
  const pantsMaterial = createFlatStandardMaterial({ color: 0x1f2937, roughness: 0.86 });
  const lightPantsMaterial = createFlatStandardMaterial({ color: 0xd8d2c6, roughness: 0.84 });
  const shoeMaterial = createFlatStandardMaterial({ color: 0x15191f, roughness: 0.72 });
  const ferrariFlagMat = createFlatStandardMaterial({
    color: 0xd71920,
    roughness: 0.58,
    side: THREE.DoubleSide
  });
  const ferrariFlagAccentMat = createFlatStandardMaterial({
    color: 0xffd21f,
    roughness: 0.62,
    side: THREE.DoubleSide
  });
  const flagPoleMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.52, metalness: 0.42 });

  const torsoGeometry = new THREE.BoxGeometry(0.26, 0.38, 0.16);
  const headGeometry = new THREE.SphereGeometry(0.12, 10, 8);
  const capGeometry = new THREE.CylinderGeometry(0.13, 0.14, 0.05, 10);
  const armGeometry = new THREE.BoxGeometry(0.06, 0.24, 0.06);
  const legGeometry = new THREE.BoxGeometry(0.1, 0.09, 0.36);
  const shoeGeometry = new THREE.BoxGeometry(0.11, 0.055, 0.16);
  const flagGeometry = new THREE.PlaneGeometry(0.42, 0.28);
  const flagAccentGeometry = new THREE.PlaneGeometry(0.14, 0.08);
  const flagPoleGeometry = new THREE.CylinderGeometry(0.014, 0.014, 0.72, 7);

  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = skinMaterials.map(() => []);
  const capMatrices = capMaterials.map(() => []);
  const armMatrices = skinMaterials.map(() => []);
  const darkLegMatrices = [];
  const lightLegMatrices = [];
  const shoeMatrices = [];
  const ferrariFlagMatrices = [];
  const ferrariFlagAccentMatrices = [];
  const flagPoleMatrices = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const torsoQuaternion = new THREE.Quaternion();
  const leftArmQuaternion = new THREE.Quaternion();
  const rightArmQuaternion = new THREE.Quaternion();
  const leftLegQuaternion = new THREE.Quaternion();
  const rightLegQuaternion = new THREE.Quaternion();
  const flagQuaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const personScale = new THREE.Vector3();
  const flagScale = new THREE.Vector3(1, 1, 1);

  sections.forEach((section, sectionIndex) => {
    const samples = collectMonacoSamples(curve, section.start, section.end, 0.58);

    samples.forEach((sample, sampleIndex) => {
      const toTrack = sample.center.clone().sub(
        sample.center.clone().addScaledVector(sample.right, section.side * baseOffset)
      ).setY(0).normalize();
      const rotationY = Math.atan2(toTrack.x, toTrack.z);
      quaternion.setFromAxisAngle(UP, rotationY);

      for (let row = 0; row < 7; row += 1) {
        const seed = sectionIndex * 10000 + sampleIndex * 17 + row * 101;
        const rowCrowding = row < 2 ? 0.95 : row < 5 ? 0.985 : 0.92;
        const microGap = pseudoRandom(sectionIndex * 500 + Math.floor(sampleIndex / 5) * 37 + row * 19);
        if (pseudoRandom(seed) > rowCrowding && microGap < 0.45) {
          continue;
        }
        if (microGap < 0.012) {
          continue;
        }

        const seatOffset = baseOffset + row * 0.72 + 0.34 + (pseudoRandom(seed + 1) - 0.5) * 0.08;
        const rowY = MONACO_ROAD_Y + 0.17 + row * 0.36;
        const jitter = (pseudoRandom(seed + 2) - 0.5) * 0.16;
        const base = sample.center
          .clone()
          .addScaledVector(sample.right, section.side * seatOffset)
          .addScaledVector(sample.tangent, jitter);
        const shirtIndex = seed % torsoMatrices.length;
        const skinIndex = seed % headMatrices.length;
        const heightScale = 1.02 + pseudoRandom(seed + 4) * 0.14;
        const widthScale = 0.92 + pseudoRandom(seed + 5) * 0.12;
        personScale.set(widthScale, heightScale, widthScale);

        torsoQuaternion.copy(quaternion).multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18 - pseudoRandom(seed + 6) * 0.12, 0, (pseudoRandom(seed + 7) - 0.5) * 0.12))
        );

        const torsoPosition = base.clone();
        torsoPosition.y = rowY + 0.28;
        matrix.compose(torsoPosition, torsoQuaternion, personScale);
        torsoMatrices[shirtIndex].push(matrix.clone());

        const headPosition = base.clone();
        headPosition.y = rowY + 0.58;
        matrix.compose(headPosition, quaternion, personScale);
        headMatrices[skinIndex].push(matrix.clone());

        if (pseudoRandom(seed + 8) > 0.28) {
          const capPosition = base.clone();
          capPosition.y = rowY + 0.7;
          matrix.compose(capPosition, quaternion, personScale);
          capMatrices[seed % capMatrices.length].push(matrix.clone());
        }

        const cheering = pseudoRandom(seed + 9) > 0.82;
        leftArmQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cheering ? -0.9 : 0.34, 0, cheering ? 0.72 : 0.38)));
        rightArmQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cheering ? -0.7 : 0.28, 0, cheering ? -0.72 : -0.38)));

        const leftArmPosition = base.clone().addScaledVector(sample.tangent, -0.12);
        leftArmPosition.y = rowY + (cheering ? 0.44 : 0.28);
        matrix.compose(leftArmPosition, leftArmQuaternion, personScale);
        armMatrices[skinIndex].push(matrix.clone());

        const rightArmPosition = base.clone().addScaledVector(sample.tangent, 0.12);
        rightArmPosition.y = rowY + (cheering ? 0.46 : 0.28);
        matrix.compose(rightArmPosition, rightArmQuaternion, personScale);
        armMatrices[skinIndex].push(matrix.clone());

        leftLegQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0.08)));
        rightLegQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, -0.08)));
        [-1, 1].forEach((legSide) => {
          const legPosition = base
            .clone()
            .addScaledVector(toTrack, 0.23)
            .addScaledVector(sample.tangent, legSide * 0.075);
          legPosition.y = rowY + 0.105;
          matrix.compose(legPosition, legSide < 0 ? leftLegQuaternion : rightLegQuaternion, personScale);
          (pseudoRandom(seed + 10) > 0.34 ? darkLegMatrices : lightLegMatrices).push(matrix.clone());

          const shoePosition = base
            .clone()
            .addScaledVector(toTrack, 0.4)
            .addScaledVector(sample.tangent, legSide * 0.075);
          shoePosition.y = rowY + 0.07;
          matrix.compose(shoePosition, quaternion, personScale);
          shoeMatrices.push(matrix.clone());
        });

        if ((shirtIndex === 0 || seed % 29 === 0) && row > 2 && sampleIndex % 6 === 2 && pseudoRandom(seed + 12) > 0.86) {
          const flagBase = base
            .clone()
            .addScaledVector(sample.tangent, 0.18)
            .addScaledVector(toTrack, -0.04);
          flagBase.y = rowY + 0.62;
          matrix.compose(flagBase, quaternion, scale);
          flagPoleMatrices.push(matrix.clone());

          const flagPosition = flagBase.clone().addScaledVector(sample.tangent, 0.16);
          flagPosition.y += 0.24;
          flagQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (pseudoRandom(seed + 13) - 0.5) * 0.18)));
          matrix.compose(flagPosition, flagQuaternion, flagScale);
          ferrariFlagMatrices.push(matrix.clone());

          const accentPosition = flagPosition.clone().addScaledVector(toTrack, 0.006);
          accentPosition.y += 0.01;
          matrix.compose(accentPosition, flagQuaternion, flagScale);
          ferrariFlagAccentMatrices.push(matrix.clone());
        }
      }
    });
  });

  torsoMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, torsoGeometry, shirtMaterials[index], matrices, `MonacoCrowdTorso:${index}`);
  });
  headMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, headGeometry, skinMaterials[index], matrices, `MonacoCrowdHead:${index}`);
  });
  capMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, capGeometry, capMaterials[index], matrices, `MonacoCrowdCap:${index}`);
  });
  armMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, armGeometry, skinMaterials[index], matrices, `MonacoCrowdArms:${index}`);
  });
  addMonacoInstancedPart(group, legGeometry, pantsMaterial, darkLegMatrices, "MonacoCrowdDarkSeatedLegs");
  addMonacoInstancedPart(group, legGeometry, lightPantsMaterial, lightLegMatrices, "MonacoCrowdLightSeatedLegs");
  addMonacoInstancedPart(group, shoeGeometry, shoeMaterial, shoeMatrices, "MonacoCrowdShoes");
  addMonacoInstancedPart(group, flagPoleGeometry, flagPoleMat, flagPoleMatrices, "MonacoCrowdFerrariFlagPoles");
  addMonacoInstancedPart(group, flagGeometry, ferrariFlagMat, ferrariFlagMatrices, "MonacoCrowdFerrariFlags");
  addMonacoInstancedPart(group, flagAccentGeometry, ferrariFlagAccentMat, ferrariFlagAccentMatrices, "MonacoCrowdFerrariFlagAccents");
}

function addMonacoContinuousInnerGrandstands(group, curve, definition) {
  const grandstandGroup = new THREE.Group();
  grandstandGroup.name = "MonacoInnerContinuousGrandstands";

  const concreteMat = createFlatStandardMaterial({ color: 0xbeb7ad, roughness: 0.94 });
  const riserMat = createFlatStandardMaterial({ color: 0x7f7a72, roughness: 0.96 });
  const roofMat = createFlatStandardMaterial({ color: 0xf6f3ea, roughness: 0.46, metalness: 0.04 });
  const backWallMat = createFlatStandardMaterial({ color: 0x9f998f, roughness: 0.96 });

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierClearance = (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5);
  const baseOffset = roadHalfWidth + barrierClearance + 2.4;
  const sections = [
    { start: 0.02, end: 0.24, side: 1 },
    { start: 0.27, end: 0.48, side: 1 },
    { start: 0.50, end: 0.72, side: 1 },
    { start: 0.74, end: 0.96, side: 1 }
  ];

  sections.forEach((section, sectionIndex) => {
    for (let row = 0; row < 7; row += 1) {
      const nearOffset = baseOffset + row * 0.72;
      const farOffset = nearOffset + 0.68;
      const y = MONACO_ROAD_Y + row * 0.36;
      grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
        name: `MonacoGrandstandTier:${sectionIndex}:${row}`,
        side: section.side,
        start: section.start,
        end: section.end,
        nearOffset,
        farOffset,
        y,
        material: row % 2 === 0 ? concreteMat : riserMat,
        sampleStep: 2
      }));
    }

    grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoGrandstandBackWall:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      nearOffset: baseOffset + 7 * 0.72 + 0.2,
      farOffset: baseOffset + 7 * 0.72 + 0.85,
      y: MONACO_ROAD_Y + 2.78,
      material: backWallMat,
      sampleStep: 2
    }));

    grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoGrandstandCanopy:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      nearOffset: baseOffset - 0.2,
      farOffset: baseOffset + 7 * 0.72 + 1.2,
      y: MONACO_ROAD_Y + 3.5,
      material: roofMat,
      sampleStep: 3
    }));
  });

  addMonacoSeatedCrowd(grandstandGroup, curve, definition, sections, baseOffset + 0.28);
  optimizeStaticDecorativeProps(grandstandGroup, []);
  group.add(grandstandGroup);
}

function createMonacoBalconyCrowd(building, balconyPoints, seed, depth) {
  const shirtMaterials = [
    createFlatStandardMaterial({ color: 0xd63232, roughness: 0.72 }),
    createFlatStandardMaterial({ color: 0x2563eb, roughness: 0.72 }),
    createFlatStandardMaterial({ color: 0xf2c94c, roughness: 0.72 }),
    createFlatStandardMaterial({ color: 0xf4f1e7, roughness: 0.72 })
  ];
  const skinMat = createFlatStandardMaterial({ color: 0xd7a273, roughness: 0.76 });
  const torsoGeo = new THREE.BoxGeometry(0.16, 0.3, 0.1);
  const headGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = [];
  const matrix = new THREE.Matrix4();

  balconyPoints.forEach((point, index) => {
    if (pseudoRandom(seed * 19 + index * 7) < 0.42) {
      return;
    }

    const x = point.x + (pseudoRandom(seed + index) - 0.5) * 0.22;
    const torsoY = point.y - 0.33;
    const z = depth * 0.5 + 0.42;
    matrix.makeTranslation(x, torsoY, z);
    torsoMatrices[(seed + index) % torsoMatrices.length].push(matrix.clone());
    matrix.makeTranslation(x, torsoY + 0.22, z + 0.01);
    headMatrices.push(matrix.clone());
  });

  torsoMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(building, torsoGeo, shirtMaterials[index], matrices, `MonacoBalconyCrowdTorso:${index}`);
  });
  addMonacoInstancedPart(building, headGeo, skinMat, headMatrices, "MonacoBalconyCrowdHeads");
}

function createMonacoPalaceBuilding(seed, options = {}) {
  const building = new THREE.Group();
  building.name = `MonacoPalaceBuilding:${seed}`;
  const wallColors = [0xf7f0df, 0xf0dfc0, 0xf8f5ec, 0xe7d2aa, 0xf3e4c4];
  const roofColors = [0xb35a3c, 0xc06b44, 0x8f4e38, 0xd0a75c];
  const wallMat = createFlatStandardMaterial({ color: wallColors[seed % wallColors.length], roughness: 0.78 });
  const roofMat = createFlatStandardMaterial({ color: roofColors[seed % roofColors.length], roughness: 0.82 });
  const glassMat = createFlatStandardMaterial({ color: 0x22364a, roughness: 0.25, metalness: 0.25 });
  const balconyMat = createFlatStandardMaterial({ color: 0xd8d2c6, roughness: 0.7, metalness: 0.12 });

  const width = options.width ?? (7 + pseudoRandom(seed + 1) * 4.5);
  const depth = options.depth ?? (5.5 + pseudoRandom(seed + 2) * 2.4);
  const height = options.height ?? (12 + pseudoRandom(seed + 3) * 14);
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  body.position.y = height * 0.5;
  body.receiveShadow = true;
  building.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.08, 0.55, depth * 1.08), roofMat);
  roof.position.y = height + 0.28;
  roof.receiveShadow = true;
  building.add(roof);

  const rows = Math.max(3, Math.floor(height / 3));
  const columns = Math.max(2, Math.floor(width / 2.2));
  const windowGeo = new THREE.BoxGeometry(0.62, 1.05, 0.08);
  const balconyGeo = new THREE.BoxGeometry(1.12, 0.08, 0.28);
  const balconyRailGeo = new THREE.BoxGeometry(1.12, 0.34, 0.055);
  const windowMatrices = [];
  const balconyMatrices = [];
  const railMatrices = [];
  const balconyPoints = [];
  const matrix = new THREE.Matrix4();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column - (columns - 1) * 0.5) * (width / (columns + 0.25));
      const y = 1.6 + row * ((height - 2.4) / rows);
      matrix.makeTranslation(x, y, depth * 0.5 + 0.045);
      windowMatrices.push(matrix.clone());
      matrix.makeTranslation(x, y - 0.68, depth * 0.5 + 0.18);
      balconyMatrices.push(matrix.clone());
      matrix.makeTranslation(x, y - 0.48, depth * 0.5 + 0.33);
      railMatrices.push(matrix.clone());
      balconyPoints.push({ x, y });
    }
  }

  addMonacoInstancedPart(building, windowGeo, glassMat, windowMatrices, "MonacoPalaceWindows");
  addMonacoInstancedPart(building, balconyGeo, balconyMat, balconyMatrices, "MonacoPalaceBalconies");
  addMonacoInstancedPart(building, balconyRailGeo, balconyMat, railMatrices, "MonacoPalaceBalconyRails");
  createMonacoBalconyCrowd(building, balconyPoints, seed, depth);
  return building;
}

function createMonacoMediterraneanTree(seed) {
  const tree = new THREE.Group();
  tree.name = `MonacoMediterraneanTree:${seed}`;
  const trunkMat = createFlatStandardMaterial({ color: 0x7a5233, roughness: 0.86 });
  const leafMat = createFlatStandardMaterial({
    color: [0x1f5b3a, 0x2d6a42, 0x365f32][seed % 3],
    roughness: 0.84
  });
  const trunkHeight = 1.6 + pseudoRandom(seed + 1) * 0.7;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, trunkHeight, 7), trunkMat);
  trunk.position.y = trunkHeight * 0.5;
  trunk.castShadow = true;
  tree.add(trunk);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95 + pseudoRandom(seed + 2) * 0.35, 12, 8), leafMat);
  canopy.scale.set(1.45, 0.62, 1.05);
  canopy.position.y = trunkHeight + 0.45;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  tree.add(canopy);

  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.62 + pseudoRandom(seed + 3) * 0.22, 10, 7), leafMat);
  upper.scale.set(1.2, 0.55, 0.95);
  upper.position.set((pseudoRandom(seed + 4) - 0.5) * 0.38, trunkHeight + 0.92, (pseudoRandom(seed + 5) - 0.5) * 0.35);
  upper.castShadow = true;
  tree.add(upper);

  return tree;
}

function addMonacoHillsideBuildings(group, curve, definition) {
  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = "MonacoInnerTerracedBackdrop";
  const treesGroup = new THREE.Group();
  treesGroup.name = "MonacoInnerMediterraneanTrees";
  const sections = [
    { start: 0.04, end: 0.22, side: 1 },
    { start: 0.30, end: 0.46, side: 1 },
    { start: 0.56, end: 0.70, side: 1 },
    { start: 0.78, end: 0.94, side: 1 }
  ];
  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierClearance = (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5);
  const grandstandBackOffset = roadHalfWidth + barrierClearance + 2.4 + 7 * 0.72 + 1.2;
  const treeOffset = grandstandBackOffset + 5.2;
  const buildingOffset = grandstandBackOffset + 24;
  const trackClearanceForBuildings = roadHalfWidth + barrierClearance + 7.5;
  const centerlineSamples = Array.from({ length: 160 }, (_, index) => curve.getPointAt(index / 160));
  const blockedGrandstandBuildingSeeds = new Set([0, 1, 2, 3]);
  let seed = 0;
  let treeSeed = 0;

  sections.forEach((section) => {
    const buildingSamples = collectMonacoSamples(curve, section.start, section.end, 8.6);
    buildingSamples.forEach((sample, sampleIndex) => {
      if (blockedGrandstandBuildingSeeds.has(seed)) {
        seed += 1;
        return;
      }

      const height = 13 + pseudoRandom(seed + 3) * 12 + (sampleIndex % 3) * 2.1;
      const building = createMonacoPalaceBuilding(seed, {
        width: 7.4 + pseudoRandom(seed + 1) * 3.1,
        depth: 5.2 + pseudoRandom(seed + 2) * 1.9,
        height
      });
      const position = sample.center
        .clone()
        .addScaledVector(sample.right, section.side * buildingOffset);
      const minTrackDistance = centerlineSamples.reduce((closest, point) => {
        const distance = Math.hypot(position.x - point.x, position.z - point.z);
        return Math.min(closest, distance);
      }, Infinity);
      if (minTrackDistance < trackClearanceForBuildings) {
        seed += 1;
        return;
      }
      building.position.copy(position);
      building.position.y = MONACO_GROUND_Y + (sampleIndex % 2) * 0.22;
      building.rotation.y = getHeading(sample.tangent) + (section.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      building.scale.set(0.92 + pseudoRandom(seed + 12) * 0.12, 1, 0.9 + pseudoRandom(seed + 13) * 0.12);
      buildingsGroup.add(building);
      seed += 1;
    });

    const treeSamples = collectMonacoSamples(curve, section.start, section.end, 5.2);
    treeSamples.forEach((sample, sampleIndex) => {
      if (sampleIndex % 4 === 1) {
        return;
      }
      const tree = createMonacoMediterraneanTree(treeSeed);
      const position = sample.center
        .clone()
        .addScaledVector(sample.right, section.side * (treeOffset + pseudoRandom(treeSeed + 4) * 2.6))
        .addScaledVector(sample.tangent, (pseudoRandom(treeSeed + 5) - 0.5) * 1.6);
      tree.position.copy(position);
      tree.position.y = MONACO_GROUND_Y;
      tree.rotation.y = pseudoRandom(treeSeed + 6) * Math.PI * 2;
      tree.scale.setScalar(0.85 + pseudoRandom(treeSeed + 7) * 0.45);
      treesGroup.add(tree);
      treeSeed += 1;
    });
  });

  const gapSections = [
    { start: 0.23, end: 0.29, side: 1 },
    { start: 0.47, end: 0.55, side: 1 },
    { start: 0.71, end: 0.77, side: 1 },
    { start: 0.95, end: 0.99, side: 1 }
  ];
  gapSections.forEach((section) => {
    const samples = collectMonacoSamples(curve, section.start, section.end, 3.8);
    samples.forEach((sample) => {
      const tree = createMonacoMediterraneanTree(treeSeed);
      const position = sample.center
        .clone()
        .addScaledVector(sample.right, section.side * (treeOffset - 1.2 + pseudoRandom(treeSeed + 3) * 5.6))
        .addScaledVector(sample.tangent, (pseudoRandom(treeSeed + 8) - 0.5) * 1.4);
      tree.position.copy(position);
      tree.position.y = MONACO_GROUND_Y;
      tree.rotation.y = pseudoRandom(treeSeed + 6) * Math.PI * 2;
      tree.scale.setScalar(0.92 + pseudoRandom(treeSeed + 7) * 0.55);
      treesGroup.add(tree);
      treeSeed += 1;
    });
  });

  optimizeStaticDecorativeProps(buildingsGroup, []);
  optimizeStaticDecorativeProps(treesGroup, []);
  group.add(treesGroup);
  group.add(buildingsGroup);
}

function createMonacoRoundedBoxGeometry(width, height, depth, radius = 0.12, bevelSize = 0.035) {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const r = Math.min(radius, halfWidth * 0.92, halfHeight * 0.92);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness: bevelSize,
    bevelSegments: 2,
    curveSegments: 8
  });
  geometry.translate(0, 0, -depth * 0.5);
  return geometry;
}

function createMonacoHarborYacht(seed) {
  const yacht = new THREE.Group();
  yacht.name = `MonacoHarborYacht:${seed}`;
  const variant = seed % 8;
  const palette = [
    { hull: 0xffffff, stripe: 0x173b73, canvas: 0xf8fafc },
    { hull: 0xf6f9fb, stripe: 0x111827, canvas: 0xe7edf2 },
    { hull: 0xe9eff4, stripe: 0xb91c1c, canvas: 0xffffff },
    { hull: 0xfdfaf3, stripe: 0x0f766e, canvas: 0xf3ead5 },
    { hull: 0x121a24, stripe: 0xf4f7fb, canvas: 0xf8fafc },
    { hull: 0xf7f3e8, stripe: 0x244f86, canvas: 0xdfe9ef },
    { hull: 0xfafafa, stripe: 0x9a3412, canvas: 0xf4efe5 },
    { hull: 0xdfe7ef, stripe: 0x1f2937, canvas: 0xf8fafc }
  ][variant];
  const hullMat = createFlatStandardMaterial({
    color: palette.hull,
    roughness: 0.22,
    metalness: 0.1
  });
  const undersideMat = createFlatStandardMaterial({ color: 0x0f2f44, roughness: 0.34, metalness: 0.08 });
  const stripeMat = createFlatStandardMaterial({
    color: palette.stripe,
    roughness: 0.36
  });
  const glassMat = createFlatStandardMaterial({
    color: 0x0d2f4f,
    roughness: 0.08,
    metalness: 0.38,
    transparent: true,
    opacity: 0.72
  });
  const deckMat = createFlatStandardMaterial({ color: 0xc79b67, roughness: 0.64 });
  const deckLineMat = createFlatStandardMaterial({ color: 0xf2dfbd, roughness: 0.58 });
  const steelMat = createFlatStandardMaterial({ color: 0xc9d2d8, roughness: 0.24, metalness: 0.72 });
  const fenderMat = createFlatStandardMaterial({ color: 0xeff4f7, roughness: 0.48 });
  const canvasMat = createFlatStandardMaterial({ color: palette.canvas, roughness: 0.74 });

  const variantDimensions = [
    { length: 8.4, width: 2.35, height: 0.7, bow: 0.5, stern: 0.5 },
    { length: 13.8, width: 3.25, height: 0.92, bow: 0.56, stern: 0.62 },
    { length: 11.2, width: 2.95, height: 0.84, bow: 0.5, stern: 0.58 },
    { length: 9.7, width: 3.85, height: 0.62, bow: 0.44, stern: 0.52 },
    { length: 14.8, width: 3.45, height: 0.88, bow: 0.52, stern: 0.66 },
    { length: 10.4, width: 2.55, height: 0.72, bow: 0.6, stern: 0.48 },
    { length: 12.6, width: 3.05, height: 0.82, bow: 0.54, stern: 0.56 },
    { length: 7.8, width: 2.25, height: 0.64, bow: 0.64, stern: 0.42 }
  ][variant];
  const length = variantDimensions.length * (0.94 + pseudoRandom(seed + 1) * 0.12);
  const width = variantDimensions.width * (0.94 + pseudoRandom(seed + 2) * 0.12);
  const hullHeight = variantDimensions.height * (0.95 + pseudoRandom(seed + 3) * 0.12);
  const bowTaper = variantDimensions.bow;
  const sternBeam = variantDimensions.stern;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, length * 0.5);
  hullShape.quadraticCurveTo(width * bowTaper, length * 0.38, width * 0.54, length * 0.12);
  hullShape.quadraticCurveTo(width * 0.56, -length * 0.28, width * sternBeam, -length * 0.47);
  hullShape.quadraticCurveTo(width * 0.18, -length * 0.59, 0, -length * 0.56);
  hullShape.quadraticCurveTo(-width * 0.18, -length * 0.59, -width * sternBeam, -length * 0.47);
  hullShape.quadraticCurveTo(-width * 0.56, -length * 0.28, -width * 0.54, length * 0.12);
  hullShape.quadraticCurveTo(-width * bowTaper, length * 0.38, 0, length * 0.5);
  hullShape.closePath();

  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, {
    depth: hullHeight,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.16,
    bevelSegments: 4,
    curveSegments: 10
  });
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.translate(0, hullHeight * 0.5, 0);
  const hull = new THREE.Mesh(hullGeometry, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  yacht.add(hull);

  const underside = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * 0.46, 0.22, length * 0.72, 0.14, 0.025), undersideMat);
  underside.position.y = 0.2;
  yacht.add(underside);

  [-1, 1].forEach((side) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, length * 0.68), stripeMat);
    stripe.position.set(side * width * 0.5, hullHeight * 0.58, -length * 0.04);
    yacht.add(stripe);
  });

  const deck = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * (variant === 3 ? 0.82 : 0.74), 0.05, length * 0.5, 0.16, 0.02), deckMat);
  deck.position.set(0, hullHeight + 0.035, variant === 5 ? -length * 0.02 : -length * 0.1);
  yacht.add(deck);

  for (let line = -1; line <= 1; line += 1) {
    const deckLine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, length * 0.46), deckLineMat);
    deckLine.position.set(line * width * 0.18, hullHeight + 0.075, -length * 0.1);
    yacht.add(deckLine);
  }

  const bowDeck = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * 0.48, 0.045, length * 0.2, 0.12, 0.018), deckMat);
  bowDeck.position.set(0, hullHeight + 0.05, length * 0.28);
  yacht.add(bowDeck);

  const cabinLength = length * [0.28, 0.38, 0.32, 0.22, 0.42, 0.26, 0.34, 0.24][variant];
  const cabinWidth = width * [0.55, 0.62, 0.58, 0.46, 0.64, 0.52, 0.6, 0.5][variant];
  const cabinHeight = [0.66, 0.92, 0.8, 0.58, 0.86, 0.7, 0.82, 0.56][variant] + pseudoRandom(seed + 4) * 0.12;
  const cabin = new THREE.Mesh(createMonacoRoundedBoxGeometry(cabinWidth, cabinHeight, cabinLength, 0.18, 0.035), hullMat);
  cabin.position.set(0, hullHeight + cabinHeight * 0.5 + 0.08, [0.06, -0.02, 0.03, -0.08, -0.04, 0.11, 0, 0.14][variant] * length);
  cabin.castShadow = true;
  yacht.add(cabin);

  if (variant !== 3 && variant !== 7) {
    const upperDeck = new THREE.Mesh(createMonacoRoundedBoxGeometry(cabinWidth * (variant === 1 || variant === 4 ? 0.86 : 0.74), 0.16, cabinLength * 0.62, 0.14, 0.025), canvasMat);
    upperDeck.position.set(0, hullHeight + cabinHeight + 0.22, cabin.position.z - cabinLength * 0.12);
    yacht.add(upperDeck);
  }

  if (variant === 1 || variant === 4 || variant === 6) {
    const secondDeck = new THREE.Mesh(createMonacoRoundedBoxGeometry(cabinWidth * 0.72, 0.46, cabinLength * 0.46, 0.14, 0.025), hullMat);
    secondDeck.position.set(0, hullHeight + cabinHeight + 0.32, cabin.position.z - cabinLength * 0.08);
    secondDeck.castShadow = true;
    yacht.add(secondDeck);

    const flybridgeGlass = new THREE.Mesh(createMonacoRoundedBoxGeometry(cabinWidth * 0.58, 0.18, cabinLength * 0.14, 0.04, 0.01), glassMat);
    flybridgeGlass.position.set(0, secondDeck.position.y + 0.08, secondDeck.position.z + cabinLength * 0.24);
    yacht.add(flybridgeGlass);
  }

  if (variant === 3) {
    [-1, 1].forEach((side) => {
      const ama = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * 0.23, 0.18, length * 0.62, 0.12, 0.025), undersideMat);
      ama.position.set(side * width * 0.38, hullHeight + 0.1, -length * 0.02);
      yacht.add(ama);
    });
  }

  const windshield = new THREE.Mesh(createMonacoRoundedBoxGeometry(cabinWidth * 0.88, 0.32, cabinLength * 0.18, 0.05, 0.012), glassMat);
  windshield.position.set(0, hullHeight + cabinHeight * 0.72 + 0.1, cabin.position.z + cabinLength * 0.5);
  yacht.add(windshield);

  const sideWindowGeometry = createMonacoRoundedBoxGeometry(0.055, 0.3, cabinLength * 0.42, 0.035, 0.008);
  [-1, 1].forEach((side) => {
    const sideWindow = new THREE.Mesh(sideWindowGeometry, glassMat);
    sideWindow.position.set(side * (cabinWidth * 0.5 + 0.045), hullHeight + cabinHeight * 0.62 + 0.08, cabin.position.z);
    yacht.add(sideWindow);

    if (variant === 1 || variant === 4 || variant === 6) {
      const aftWindow = new THREE.Mesh(createMonacoRoundedBoxGeometry(0.052, 0.24, cabinLength * 0.2, 0.03, 0.007), glassMat);
      aftWindow.position.set(side * (cabinWidth * 0.5 + 0.05), hullHeight + cabinHeight * 0.45, cabin.position.z - cabinLength * 0.33);
      yacht.add(aftWindow);
    }
  });

  const railGeometry = new THREE.CylinderGeometry(0.018, 0.018, length * 0.76, 8);
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(railGeometry, steelMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * width * 0.43, hullHeight + 0.32, length * 0.02);
    yacht.add(rail);

    for (let index = 0; index < 5; index += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 7), steelMat);
      post.position.set(side * width * 0.43, hullHeight + 0.22, -length * 0.34 + index * length * 0.17);
      yacht.add(post);
    }
  });

  const radarArch = new THREE.Mesh(new THREE.TorusGeometry(width * [0.18, 0.26, 0.22, 0.16, 0.3, 0.18, 0.24, 0.15][variant], 0.02, 6, 18, Math.PI), steelMat);
  radarArch.position.set(0, hullHeight + cabinHeight + 0.44, cabin.position.z - cabinLength * 0.34);
  radarArch.rotation.z = Math.PI;
  if (variant !== 7) {
    yacht.add(radarArch);
  }

  const radarDish = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), steelMat);
  radarDish.scale.set(1.6, 0.35, 0.75);
  radarDish.position.set(-width * 0.12, hullHeight + cabinHeight + 0.58, -length * 0.14);
  yacht.add(radarDish);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 1.25, 7), steelMat);
  antenna.position.set(width * 0.16, hullHeight + cabinHeight + 1.05, cabin.position.z - cabinLength * 0.24);
  antenna.rotation.x = variant === 5 ? -0.46 : -0.2;
  yacht.add(antenna);

  if (variant === 0 || variant === 2 || variant === 5 || variant === 7) {
    const aftCanopy = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * 0.55, 0.07, length * 0.16, 0.1, 0.018), canvasMat);
    aftCanopy.position.set(0, hullHeight + cabinHeight * 0.72, -length * 0.32);
    yacht.add(aftCanopy);

    [-1, 1].forEach((side) => {
      const canopyPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 6), steelMat);
      canopyPost.position.set(side * width * 0.24, hullHeight + cabinHeight * 0.48, -length * 0.32);
      yacht.add(canopyPost);
    });
  }

  if (variant === 4) {
    const tender = new THREE.Mesh(createMonacoRoundedBoxGeometry(width * 0.42, 0.18, length * 0.14, 0.09, 0.02), canvasMat);
    tender.position.set(0, hullHeight + 0.16, -length * 0.44);
    yacht.add(tender);
  }

  [-1, 1].forEach((side) => {
    for (let index = 0; index < 3; index += 1) {
      const fender = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fenderMat);
      fender.scale.set(0.7, 1.25, 0.7);
      fender.position.set(side * (width * 0.5 + 0.05), hullHeight * 0.54, -length * 0.28 + index * length * 0.22);
      yacht.add(fender);
    }
  });

  return yacht;
}

function createMonacoContinuousWaterMesh(curve, definition, sections, nearOffset, farOffset, y, material) {
  const vertices = [];
  const indices = [];

  sections.forEach((section) => {
    const sectionStart = vertices.length / 3 / 2;
    const steps = Math.max(3, Math.ceil((section.end - section.start) * definition.segments / 1.5));

    for (let index = 0; index <= steps; index += 1) {
      const progress = section.start + (section.end - section.start) * (index / steps);
      const center = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress).setY(0).normalize();
      const right = getRightVector(tangent);
      const near = center.clone().addScaledVector(right, section.side * nearOffset);
      const far = center.clone().addScaledVector(right, section.side * farOffset);
      vertices.push(near.x, y, near.z, far.x, y, far.z);
    }

    for (let index = 0; index < steps; index += 1) {
      const current = (sectionStart + index) * 2;
      const next = current + 2;
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "MonacoContinuousSea";
  mesh.receiveShadow = false;
  return mesh;
}

function createMonacoWaterHighlightMesh(curve, definition, sections, offset, y, material) {
  const geometry = new THREE.BoxGeometry(0.08, 0.012, 3.8);
  const matrices = [];
  const matrix = new THREE.Matrix4();

  sections.forEach((section, sectionIndex) => {
    const samples = collectMonacoSamples(curve, section.start, section.end, 4.8);
    samples.forEach((sample, sampleIndex) => {
      if ((sampleIndex + sectionIndex) % 2 === 1) {
        return;
      }
      const position = sample.center
        .clone()
        .addScaledVector(sample.right, section.side * (offset + pseudoRandom(sectionIndex * 19 + sampleIndex) * 26))
        .addScaledVector(sample.tangent, (pseudoRandom(sampleIndex + 3) - 0.5) * 1.2);
      position.y = y;
      const right = sample.right.clone().multiplyScalar(section.side);
      const tangent = sample.tangent.clone().setY(0).normalize();
      matrix.makeBasis(right, UP, tangent.clone().negate());
      matrix.setPosition(position);
      matrices.push(matrix.clone());
    });
  });

  return { geometry, matrices, material };
}

function addMonacoOuterPort(group, curve, definition) {
  const portGroup = new THREE.Group();
  portGroup.name = "MonacoOuterPortAndYachts";
  const waterMat = createFlatStandardMaterial({
    color: 0x056f9f,
    emissive: 0x04364f,
    emissiveIntensity: 0.22,
    roughness: 0.045,
    metalness: 0.28,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });
  const waterHighlightMat = createFlatStandardMaterial({
    color: 0xa7ecff,
    emissive: 0x6dd7ff,
    emissiveIntensity: 0.28,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.46
  });
  const quayMat = createFlatStandardMaterial({ color: 0xd7d0c4, roughness: 0.78, metalness: 0.04 });
  const quayEdgeMat = createFlatStandardMaterial({ color: 0x8c8378, roughness: 0.86 });
  const pierMat = createFlatStandardMaterial({ color: 0xc5b59a, roughness: 0.68, metalness: 0.03 });
  const pierEdgeMat = createFlatStandardMaterial({ color: 0x756b5c, roughness: 0.78 });
  const bollardMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.48 });

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierClearance = (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5);
  const quayNear = roadHalfWidth + barrierClearance + 1.8;
  const quayFar = quayNear + 4.6;
  const waterFar = quayFar + 96;
  const sections = [
    { start: 0.012, end: 0.238, side: -1 },
    { start: 0.252, end: 0.502, side: -1 },
    { start: 0.518, end: 0.744, side: -1 },
    { start: 0.758, end: 0.988, side: -1 }
  ];
  const waterSections = [
    { start: 0, end: 1, side: -1 }
  ];
  const pierTopGeometry = new THREE.BoxGeometry(0.34, 0.09, 1);
  const pierSideGeometry = new THREE.BoxGeometry(0.08, 0.12, 1);
  const bollardGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10);
  const bollardMatrices = [];
  const matrix = new THREE.Matrix4();

  portGroup.add(createMonacoContinuousWaterMesh(
    curve,
    definition,
    waterSections,
    quayNear + 0.3,
    waterFar,
    MONACO_GROUND_Y + 0.018,
    waterMat
  ));

  const waterHighlights = createMonacoWaterHighlightMesh(
    curve,
    definition,
    waterSections,
    quayFar + 5,
    MONACO_GROUND_Y + 0.032,
    waterHighlightMat
  );
  addMonacoInstancedPart(
    portGroup,
    waterHighlights.geometry,
    waterHighlights.material,
    waterHighlights.matrices,
    "MonacoSeaReflectionStreaks"
  );

  sections.forEach((section, sectionIndex) => {
    portGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoHarborQuay:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      nearOffset: quayNear,
      farOffset: quayFar,
      y: MONACO_ROAD_Y - 0.02,
      material: quayMat,
      sampleStep: 2
    }));

    portGroup.add(createMonacoVerticalRibbonMesh(curve, definition, {
      name: `MonacoHarborQuayEdge:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      offset: quayFar,
      yBottom: MONACO_GROUND_Y + 0.02,
      yTop: MONACO_ROAD_Y - 0.02,
      material: quayEdgeMat,
      sampleStep: 2
    }));

    const samples = collectMonacoSamples(curve, section.start, section.end, 8.8);
    samples.forEach((sample, sampleIndex) => {
      const tangent = sample.tangent.clone().setY(0).normalize();
      const outward = sample.right.clone().multiplyScalar(section.side).setY(0).normalize();
      const pierLength = 16 + pseudoRandom(sectionIndex * 43 + sampleIndex) * 16;
      const pierDistance = quayFar + pierLength * 0.5;
      const basePosition = sample.center.clone().addScaledVector(sample.right, section.side * pierDistance);
      basePosition.y = MONACO_ROAD_Y - 0.07;
      const pierHeading = getHeading(tangent) + (section.side > 0 ? -Math.PI / 2 : Math.PI / 2);

      const pier = new THREE.Mesh(pierTopGeometry, pierMat);
      pier.name = `MonacoHarborFingerPier:${sectionIndex}:${sampleIndex}`;
      pier.position.copy(basePosition);
      pier.rotation.y = pierHeading;
      pier.scale.z = pierLength;
      pier.castShadow = true;
      pier.receiveShadow = true;
      portGroup.add(pier);

      [-1, 1].forEach((side) => {
        const edge = new THREE.Mesh(pierSideGeometry, pierEdgeMat);
        edge.name = `MonacoHarborFingerPierEdge:${sectionIndex}:${sampleIndex}:${side}`;
        edge.position.copy(basePosition).addScaledVector(tangent, side * 0.23);
        edge.rotation.y = pierHeading;
        edge.scale.z = pierLength;
        edge.castShadow = true;
        edge.receiveShadow = true;
        portGroup.add(edge);
      });

      [0.22, 0.52, 0.82].forEach((fraction) => {
        [-1, 1].forEach((side) => {
          const bollardPosition = sample.center
            .clone()
            .addScaledVector(sample.right, section.side * (quayFar + pierLength * fraction))
            .addScaledVector(tangent, side * 0.24);
          bollardPosition.y = MONACO_ROAD_Y + 0.04;
          matrix.makeTranslation(bollardPosition.x, bollardPosition.y, bollardPosition.z);
          bollardMatrices.push(matrix.clone());
        });
      });

      const boatRows = 2;
      for (let row = 0; row < boatRows; row += 1) {
        [-1, 1].forEach((side) => {
          const skipNoise = pseudoRandom(sectionIndex * 9000 + sampleIndex * 31 + row * 7 + side * 3);
          if (skipNoise < 0.2) {
            return;
          }

          const yachtSeed = sectionIndex * 10000 + sampleIndex * 137 + row * 41 + (side > 0 ? 19 : 7) + 5;
          const yacht = createMonacoHarborYacht(yachtSeed);
          const rowDistance = quayFar + 13 + row * 9.2 + pseudoRandom(sampleIndex * 17 + row) * 1.8;
          const position = sample.center
            .clone()
            .addScaledVector(sample.right, section.side * rowDistance)
            .addScaledVector(tangent, side * (3.65 + row * 0.35 + pseudoRandom(row + sampleIndex + 30) * 0.95));
          position.y = MONACO_GROUND_Y + 0.02;
          yacht.position.copy(position);
          yacht.rotation.y = Math.atan2(outward.x, outward.z) + (side > 0 ? 0.05 : -0.05) + (pseudoRandom(sampleIndex + row + 9) - 0.5) * 0.12;
          yacht.scale.setScalar(0.9 + pseudoRandom(sampleIndex * 29 + row * 11 + sectionIndex) * 0.5);
          portGroup.add(yacht);
        });
      }

      if (sampleIndex % 8 === 2) {
        const largeYachtSeed = sectionIndex * 20000 + sampleIndex * 211 + 77;
        const largeYacht = createMonacoHarborYacht(largeYachtSeed);
        const position = sample.center
          .clone()
          .addScaledVector(sample.right, section.side * (quayFar + pierLength + 13 + pseudoRandom(sampleIndex) * 9))
          .addScaledVector(tangent, (pseudoRandom(sampleIndex + 13) - 0.5) * 4.8);
        position.y = MONACO_GROUND_Y + 0.025;
        largeYacht.position.copy(position);
        largeYacht.rotation.y = Math.atan2(outward.x, outward.z) + (pseudoRandom(sampleIndex + 22) - 0.5) * 0.18;
        largeYacht.scale.setScalar(1.55 + pseudoRandom(sampleIndex + 31) * 0.65);
        portGroup.add(largeYacht);
      }
    });
  });

  addMonacoInstancedPart(portGroup, bollardGeometry, bollardMat, bollardMatrices, "MonacoHarborBollards");
  optimizeStaticDecorativeProps(portGroup, ["MonacoContinuousSea", "MonacoHarborQuay"]);
  group.add(portGroup);
}

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

function addMonacoFerrariTracksideFlags(group, curve, definition, barrierOffset) {
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

function addMonacoTracksideVisuals(group, curve, definition) {
  const tracksideGroup = new THREE.Group();
  tracksideGroup.name = "MonacoTracksideVisuals";

  const armcoMat = createFlatStandardMaterial({ color: 0xbfc5c9, roughness: 0.42, metalness: 0.65 });
  const postMat = createFlatStandardMaterial({ color: 0x4b5563, roughness: 0.58, metalness: 0.42 });
  const netMat = createFlatStandardMaterial({
    color: 0x7d8790,
    roughness: 0.7,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide
  });
  netMat.depthWrite = false;
  const lampMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.45 });
  const lampGlowMat = createFlatStandardMaterial({
    color: 0xfff0b8,
    emissive: 0xfff0b8,
    emissiveIntensity: 0.75,
    roughness: 0.22
  });
  const sponsorMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.55 }),
    createFlatStandardMaterial({ color: 0x0f3d68, roughness: 0.55 }),
    createFlatStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    createFlatStandardMaterial({ color: 0xf2c94c, roughness: 0.5 })
  ];

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierOffset = roadHalfWidth + (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5) * 0.5 + 0.18;
  const armcoGeometry = new THREE.BoxGeometry(0.16, 0.52, 2.8);
  const postGeometry = new THREE.BoxGeometry(0.14, 1.3, 0.14);
  const sponsorGeometry = new THREE.BoxGeometry(3.2, 1.0, 0.08);
  const lampPoleGeometry = new THREE.CylinderGeometry(0.055, 0.075, 3.8, 6);
  const lampArmGeometry = new THREE.BoxGeometry(1.15, 0.06, 0.06);
  const lampHeadGeometry = new THREE.BoxGeometry(0.45, 0.16, 0.28);
  const armcoMatrices = [];
  const postMatrices = [];
  const sponsorMatrices = sponsorMaterials.map(() => []);
  const lampPoleMatrices = [];
  const lampArmMatrices = [];
  const lampHeadMatrices = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  [-1, 1].forEach((side) => {
    const samples = collectMonacoSamples(curve, 0, 0.998, 3.1);
    samples.forEach((sample, index) => {
      const right = sample.right.clone().multiplyScalar(side);
      const tangent = sample.tangent.clone().setY(0).normalize();
      const position = sample.center.clone().addScaledVector(sample.right, side * barrierOffset);
      position.y = MONACO_ROAD_Y + 0.42;
      matrix.makeBasis(right, UP, tangent.clone().negate());
      matrix.setPosition(position);
      armcoMatrices.push(matrix.clone());

      if (index % 2 === 0) {
        const postPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 0.12));
        postPosition.y = MONACO_ROAD_Y + 0.65;
        matrix.makeBasis(right, UP, tangent.clone().negate());
        matrix.setPosition(postPosition);
        postMatrices.push(matrix.clone());
      }

      if (index % 7 === 0) {
        const sponsorPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 0.18));
        sponsorPosition.y = MONACO_ROAD_Y + 0.95;
        matrix.makeBasis(right, UP, tangent.clone().negate());
        matrix.setPosition(sponsorPosition);
        sponsorMatrices[(index + (side > 0 ? 1 : 0)) % sponsorMatrices.length].push(matrix.clone());
      }

      if (index % 13 === 0) {
        const lampPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 1.2));
        lampPosition.y = MONACO_ROAD_Y + 1.9;
        quaternion.setFromAxisAngle(UP, getHeading(tangent));
        matrix.compose(lampPosition, quaternion, scale);
        lampPoleMatrices.push(matrix.clone());

        const armPosition = lampPosition.clone();
        armPosition.y += 1.7;
        armPosition.addScaledVector(sample.right, -side * 0.42);
        matrix.compose(armPosition, quaternion, scale);
        lampArmMatrices.push(matrix.clone());

        const headPosition = armPosition.clone().addScaledVector(sample.right, -side * 0.58);
        matrix.compose(headPosition, quaternion, scale);
        lampHeadMatrices.push(matrix.clone());
      }
    });

    [
      [0.02, 0.24],
      [0.28, 0.48],
      [0.52, 0.72],
      [0.76, 0.96]
    ].forEach(([start, end], sectionIndex) => {
      tracksideGroup.add(createMonacoVerticalRibbonMesh(curve, definition, {
        name: `MonacoCatchFence:${side}:${sectionIndex}`,
        side,
        start,
        end,
        offset: barrierOffset + 0.36,
        yBottom: MONACO_ROAD_Y + 0.58,
        yTop: MONACO_ROAD_Y + 2.65,
        material: netMat,
        sampleStep: 4
      }));
    });
  });

  addMonacoInstancedPart(tracksideGroup, armcoGeometry, armcoMat, armcoMatrices, "MonacoArmcoRails");
  addMonacoInstancedPart(tracksideGroup, postGeometry, postMat, postMatrices, "MonacoArmcoPosts");
  sponsorMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(tracksideGroup, sponsorGeometry, sponsorMaterials[index], matrices, `MonacoSponsorBoards:${index}`);
  });
  addMonacoInstancedPart(tracksideGroup, lampPoleGeometry, lampMat, lampPoleMatrices, "MonacoTrackLampPoles");
  addMonacoInstancedPart(tracksideGroup, lampArmGeometry, lampMat, lampArmMatrices, "MonacoTrackLampArms");
  addMonacoInstancedPart(tracksideGroup, lampHeadGeometry, lampGlowMat, lampHeadMatrices, "MonacoTrackLampHeads");
  addMonacoFerrariTracksideFlags(tracksideGroup, curve, definition, barrierOffset);

  optimizeStaticDecorativeProps(tracksideGroup, ["MonacoCatchFence"]);
  group.add(tracksideGroup);
}

function addMonacoLoopScenery(group, curve, definition) {
  addMonacoTracksideVisuals(group, curve, definition);
  addMonacoContinuousInnerGrandstands(group, curve, definition);
  addMonacoHillsideBuildings(group, curve, definition);
  addMonacoOuterPort(group, curve, definition);
}

export function buildMonacoProps(group, curve, definition) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "MonacoProps";

  addMonacoLampPosts(propsGroup, curve, definition);
  addMonacoKerbs(propsGroup, curve, definition);
  addMonacoLoopScenery(propsGroup, curve, definition);

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

const MONACO_ROAD_Y = 0.045;
const MONACO_GROUND_Y = -0.025;

function createDetailedMonacoYacht(seed) {
  const yacht = new THREE.Group();
  const rng = (offset) => pseudoRandom(seed * 73 + offset);

  // ── Dimensioni Yacht casuali ──
  const yachtType = Math.floor(rng(1) * 3); // 3 tipi diversi di Yacht
  
  // Colori armoniosi
  const stripeColors = [0x0f172a, 0x1e3a8a, 0xb91c1c, 0x047857, 0xf59e0b];
  const stripeColor = stripeColors[Math.floor(rng(2) * stripeColors.length)];
  const hullColor = rng(3) > 0.3 ? 0xffffff : 0xf1f5f9; // bianco o grigio chiarissimo
  
  const hullMat = createFlatStandardMaterial({ color: hullColor, roughness: 0.2, metalness: 0.1 });
  const teakMat = createFlatStandardMaterial({ color: 0xd97706, roughness: 0.6 }); // Finto legno teak
  const cabinMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const glassMat = createFlatStandardMaterial({ color: 0x0f172a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.75 });
  const stripeMat = createFlatStandardMaterial({ color: stripeColor, roughness: 0.3 });
  const canopyMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
  const steelMat = createFlatStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.8 });

  if (yachtType === 0) {
    // ── TIPO 0: Yacht di lusso standard (2 ponti) ──
    const L = 12 + rng(4) * 2; // lunghezza
    const W = 4 + rng(5) * 0.8; // larghezza
    const H = 1.4; // altezza scafo

    // Scafo
    const hullGeo = new THREE.BoxGeometry(W, H, L);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = H * 0.5;
    hull.castShadow = true;
    hull.receiveShadow = true;
    yacht.add(hull);

    // Prua appuntita
    const bowGeo = new THREE.BoxGeometry(W, H, 3);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, H * 0.5, L * 0.5 + 1.2);
    bow.scale.set(1, 1, 0.8);
    yacht.add(bow);

    // Linea colorata sullo scafo
    const stripeGeo = new THREE.BoxGeometry(W * 1.02, 0.18, L + 2.5);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, H * 0.35, 0.5);
    yacht.add(stripe);

    // Ponte principale (Teak aft deck)
    const aftDeckGeo = new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.4);
    const aftDeck = new THREE.Mesh(aftDeckGeo, teakMat);
    aftDeck.position.set(0, H + 0.01, -L * 0.25);
    yacht.add(aftDeck);

    // Cabina 1° livello
    const cabW = W * 0.8;
    const cabL = L * 0.6;
    const cabH = 1.2;
    const cabin1Geo = new THREE.BoxGeometry(cabW, cabH, cabL);
    const cabin1 = new THREE.Mesh(cabin1Geo, cabinMat);
    cabin1.position.set(0, H + cabH * 0.5, L * 0.1);
    cabin1.castShadow = true;
    yacht.add(cabin1);

    // Finestrini oscurati cabina
    const winGeo = new THREE.BoxGeometry(cabW * 1.02, 0.5, cabL * 0.8);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(0, H + cabH * 0.6, L * 0.15);
    yacht.add(win);

    // Flybridge (2° livello)
    const flyW = cabW * 0.85;
    const flyL = cabL * 0.7;
    const flyH = 0.8;
    const flyGeo = new THREE.BoxGeometry(flyW, flyH, flyL);
    const fly = new THREE.Mesh(flyGeo, cabinMat);
    fly.position.set(0, H + cabH + flyH * 0.5, L * 0.05);
    yacht.add(fly);

    // Parabrezza flybridge
    const windshieldGeo = new THREE.BoxGeometry(flyW * 1.02, 0.3, 1.2);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, H + cabH + flyH + 0.15, L * 0.2);
    yacht.add(windshield);

    // Tenda parasole (Canopy) sopra il flybridge
    const canopyW = flyW * 1.1;
    const canopyL = flyL * 0.6;
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(canopyW, canopyL), canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, H + cabH + flyH + 1.1, L * 0.0);
    yacht.add(canopy);

    // Supporti tenda (pilastri d'acciaio)
    [-1, 1].forEach((xs) => {
      [-1, 1].forEach((zs) => {
        const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4);
        const pole = new THREE.Mesh(poleGeo, steelMat);
        pole.position.set(xs * (canopyW * 0.45), H + cabH + flyH + 0.55, L * 0.0 + zs * (canopyL * 0.45));
        yacht.add(pole);
      });
    });

    // Antenna e Radar arch
    const archGeo = new THREE.BoxGeometry(flyW, 0.6, 0.3);
    const arch = new THREE.Mesh(archGeo, steelMat);
    arch.position.set(0, H + cabH + flyH + 0.3, -L * 0.15);
    yacht.add(arch);

    const radGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
    const radar = new THREE.Mesh(radGeo, cabinMat);
    radar.position.set(0, H + cabH + flyH + 0.65, -L * 0.15);
    yacht.add(radar);

  } else if (yachtType === 1) {
    // ── TIPO 1: Superyacht a 3 ponti (Grande) ──
    const L = 16 + rng(4) * 3;
    const W = 5 + rng(5) * 1.0;
    const H = 1.6;

    // Scafo
    const hullGeo = new THREE.BoxGeometry(W, H, L);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = H * 0.5;
    hull.castShadow = true;
    yacht.add(hull);

    // Prua pronunciata
    const bowGeo = new THREE.BoxGeometry(W, H, 4.5);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, H * 0.5, L * 0.5 + 1.8);
    bow.scale.set(1, 1.1, 0.8);
    yacht.add(bow);

    // Linea colorata
    const stripeGeo = new THREE.BoxGeometry(W * 1.02, 0.22, L + 4.0);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, H * 0.4, 0.5);
    yacht.add(stripe);

    // 1° Ponte (Coperta principale)
    const deck1Geo = new THREE.BoxGeometry(W * 0.85, 1.2, L * 0.65);
    const deck1 = new THREE.Mesh(deck1Geo, cabinMat);
    deck1.position.set(0, H + 0.6, L * 0.05);
    deck1.castShadow = true;
    yacht.add(deck1);

    // Finestrini ponte 1
    const win1Geo = new THREE.BoxGeometry(W * 0.88, 0.45, L * 0.5);
    const win1 = new THREE.Mesh(win1Geo, glassMat);
    win1.position.set(0, H + 0.6, L * 0.08);
    yacht.add(win1);

    // 2° Ponte (Upper deck)
    const deck2Geo = new THREE.BoxGeometry(W * 0.75, 1.1, L * 0.5);
    const deck2 = new THREE.Mesh(deck2Geo, cabinMat);
    deck2.position.set(0, H + 1.2 + 0.55, -L * 0.05);
    yacht.add(deck2);

    // Finestrini ponte 2
    const win2Geo = new THREE.BoxGeometry(W * 0.78, 0.45, L * 0.4);
    const win2 = new THREE.Mesh(win2Geo, glassMat);
    win2.position.set(0, H + 1.2 + 0.55, -L * 0.03);
    yacht.add(win2);

    // 3° Ponte (Sun deck / Pilot house)
    const deck3Geo = new THREE.BoxGeometry(W * 0.65, 0.9, L * 0.3);
    const deck3 = new THREE.Mesh(deck3Geo, cabinMat);
    deck3.position.set(0, H + 2.3 + 0.45, -L * 0.1);
    yacht.add(deck3);

    // Grande Flybridge Canopy
    const canopyW = W * 0.8;
    const canopyL = L * 0.35;
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(canopyW, canopyL), canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, H + 3.2 + 0.9, -L * 0.05);
    yacht.add(canopy);

    // Supporti Canopy
    [-1, 1].forEach((xs) => {
      [-1, 1].forEach((zs) => {
        const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4);
        const pole = new THREE.Mesh(poleGeo, steelMat);
        pole.position.set(xs * (canopyW * 0.44), H + 3.2 + 0.45, -L * 0.05 + zs * (canopyL * 0.44));
        yacht.add(pole);
      });
    });

    // Zona pranzo a poppa (Teak deck con tavolo e divanetti)
    const mainAftGeo = new THREE.BoxGeometry(W * 0.9, 0.05, L * 0.3);
    const mainAft = new THREE.Mesh(mainAftGeo, teakMat);
    mainAft.position.set(0, H + 0.01, -L * 0.33);
    yacht.add(mainAft);

    // Tavolo da pranzo
    const tableGeo = new THREE.BoxGeometry(W * 0.3, 0.4, 1.2);
    const table = new THREE.Mesh(tableGeo, cabinMat);
    table.position.set(0, H + 0.22, -L * 0.33);
    yacht.add(table);

    // Persone sul ponte (spettatori extra sullo yacht!)
    const visitorCount = 2 + Math.floor(rng(12) * 4);
    for (let v = 0; v < visitorCount; v++) {
      const vSeed = seed * 43 + v * 99;
      const visitor = createMonacoSpectator(vSeed);
      visitor.scale.set(1.4, 1.4, 1.4); // Proporzionati sullo yacht
      
      // Posizione casuale sul ponte
      const vx = (pseudoRandom(vSeed * 3) - 0.5) * W * 0.6;
      const vz = -L * 0.25 - pseudoRandom(vSeed * 7) * L * 0.12;
      visitor.position.set(vx, H + 0.05, vz);
      visitor.rotation.y = pseudoRandom(vSeed * 11) * Math.PI * 2;
      yacht.add(visitor);
    }

  } else {
    // ── TIPO 2: Sleek Sport Yacht (Catamarano / Moderno) ──
    const L = 11 + rng(6) * 1.5;
    const W = 4.5 + rng(4) * 0.6;
    const H = 1.1;

    // Doppio scafo (Catamaran style)
    [-1, 1].forEach((hullSide) => {
      const hullGeo = new THREE.BoxGeometry(W * 0.35, H, L);
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.set(hullSide * W * 0.3, H * 0.5, 0);
      hull.castShadow = true;
      yacht.add(hull);

      const bowGeo = new THREE.BoxGeometry(W * 0.35, H, 2.5);
      const bow = new THREE.Mesh(bowGeo, hullMat);
      bow.position.set(hullSide * W * 0.3, H * 0.5, L * 0.5 + 1.0);
      bow.scale.set(1, 1, 0.7);
      yacht.add(bow);
    });

    // Piattaforma di collegamento (Deck principale)
    const platformGeo = new THREE.BoxGeometry(W * 0.95, 0.3, L * 0.85);
    const platform = new THREE.Mesh(platformGeo, hullMat);
    platform.position.set(0, H - 0.15, -0.5);
    yacht.add(platform);

    const platformTeakGeo = new THREE.BoxGeometry(W * 0.9, 0.04, L * 0.75);
    const platformTeak = new THREE.Mesh(platformTeakGeo, teakMat);
    platformTeak.position.set(0, H, -0.5);
    yacht.add(platformTeak);

    // Cabina futuristica aerodinamica
    const cabW = W * 0.75;
    const cabL = L * 0.5;
    const cabH = 1.0;
    const cabGeo = new THREE.BoxGeometry(cabW, cabH, cabL);
    const cab = new THREE.Mesh(cabGeo, cabinMat);
    cab.position.set(0, H + cabH * 0.5, L * 0.05);
    yacht.add(cab);

    // Grandi vetrate scure avvolgenti
    const domeGeo = new THREE.BoxGeometry(cabW * 1.03, 0.55, cabL * 0.6);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.set(0, H + cabH * 0.55, L * 0.12);
    yacht.add(dome);

    // Antenna inclinata sportiva
    const mastGeo = new THREE.CylinderGeometry(0.015, 0.03, 2.2, 4);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(0, H + cabH + 0.9, -L * 0.15);
    mast.rotation.x = -0.3; // inclinata all'indietro per look sportivo
    yacht.add(mast);

    // Bandiera dello yacht
    const flagGeo = new THREE.PlaneGeometry(0.3, 0.2);
    const flagMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, H + cabH + 1.9, -L * 0.3);
    flag.rotation.y = (pseudoRandom(seed * 19) - 0.5) * 0.4;
    yacht.add(flag);
  }

  return yacht;
}

function addMonacoOuterHarbor(group, curve, definition) {
  const roadHW = definition.roadWidth * 0.5;
  const barrierOff = definition.barrierOffset + definition.barrierThickness * 0.5;
  
  // Banchina inizia leggermente fuori dalla barriera stradale
  const quayStartDist = roadHW + barrierOff + 0.1;
  const QUAY_W = 4.0; // Larghezza camminamento
  const quayEndDist = quayStartDist + QUAY_W;
  
  const waterColor = 0x075e8a; // Blu mare intenso e saturo, come in foto
  const waterMat = createFlatStandardMaterial({
    color: waterColor,
    roughness: 0.05, // Molto lucido per riflessi dell'acqua
    metalness: 0.1,
    transparent: true,
    opacity: 0.93,
    side: THREE.DoubleSide
  });

  const quayColor = 0xdad5cb; // Cemento banchina chiaro
  const quayMat = createFlatStandardMaterial({
    color: quayColor,
    roughness: 0.85,
    metalness: 0.05
  });

  const darkQuayMat = createFlatStandardMaterial({
    color: 0x8e8a80, // Bordo che va in acqua
    roughness: 0.9
  });

  // Sezioni del porto esterno (lato -1 = sinistra/esterno)
  const harborSections = [
    { tStart: 0.02, tEnd: 0.16, side: -1, waterWidth: 10.0, yachtScale: 0.75 }, // Rettilineo partenza
    { tStart: 0.66, tEnd: 0.85, side: -1, waterWidth: 35.0, yachtScale: 1.25 }, // Rettilineo posteriore (Risalita/Rascasse)
  ];

  const segments = definition.segments;

  harborSections.forEach((sec, secIdx) => {
    const iStart = Math.floor(sec.tStart * segments);
    const iEnd = Math.ceil(sec.tEnd * segments);
    const samplePoints = [];

    for (let i = iStart; i <= iEnd; i++) {
      const t = i / segments;
      const center = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).setY(0).normalize();
      const right = getRightVector(tangent);
      samplePoints.push({ center, tangent, right, t });
    }

    const quayGroup = new THREE.Group();
    quayGroup.name = `MonacoOuterHarbor_${secIdx}`;

    for (let s = 0; s < samplePoints.length - 1; s++) {
      const p1 = samplePoints[s];
      const p2 = samplePoints[s + 1];

      // Coordinate banchina
      const q1_in = p1.center.clone().addScaledVector(p1.right, sec.side * quayStartDist);
      const q2_in = p2.center.clone().addScaledVector(p2.right, sec.side * quayStartDist);
      const q1_out = p1.center.clone().addScaledVector(p1.right, sec.side * quayEndDist);
      const q2_out = p2.center.clone().addScaledVector(p2.right, sec.side * quayEndDist);

      // Mesh banchina (quad)
      const qVerts = new Float32Array([
        q1_in.x, MONACO_ROAD_Y - 0.01, q1_in.z,
        q2_in.x, MONACO_ROAD_Y - 0.01, q2_in.z,
        q1_out.x, MONACO_ROAD_Y - 0.01, q1_out.z,
        q2_in.x, MONACO_ROAD_Y - 0.01, q2_in.z,
        q2_out.x, MONACO_ROAD_Y - 0.01, q2_out.z,
        q1_out.x, MONACO_ROAD_Y - 0.01, q1_out.z,
      ]);
      const qGeo = new THREE.BufferGeometry();
      qGeo.setAttribute('position', new THREE.BufferAttribute(qVerts, 3));
      qGeo.computeVertexNormals();
      const qMesh = new THREE.Mesh(qGeo, quayMat);
      qMesh.receiveShadow = true;
      qMesh.castShadow = true;
      quayGroup.add(qMesh);

      // Alzata verticale banchina
      const borderY = MONACO_ROAD_Y - 0.01;
      const waterY = MONACO_GROUND_Y + 0.01; // Appena sopra il terreno di fondo per coprirlo
      const bVerts = new Float32Array([
        q1_out.x, borderY, q1_out.z,
        q2_out.x, borderY, q2_out.z,
        q1_out.x, waterY,  q1_out.z,
        q2_out.x, borderY, q2_out.z,
        q2_out.x, waterY,  q2_out.z,
        q1_out.x, waterY,  q1_out.z,
      ]);
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.BufferAttribute(bVerts, 3));
      bGeo.computeVertexNormals();
      const bMesh = new THREE.Mesh(bGeo, darkQuayMat);
      bMesh.receiveShadow = true;
      quayGroup.add(bMesh);

      // Mesh Acqua
      const w1_out = p1.center.clone().addScaledVector(p1.right, sec.side * (quayEndDist + sec.waterWidth));
      const w2_out = p2.center.clone().addScaledVector(p2.right, sec.side * (quayEndDist + sec.waterWidth));

      const wVerts = new Float32Array([
        q1_out.x, waterY, q1_out.z,
        q2_out.x, waterY, q2_out.z,
        w1_out.x, waterY, w1_out.z,
        q2_out.x, waterY, q2_out.z,
        w2_out.x, waterY, w2_out.z,
        w1_out.x, waterY, w1_out.z,
      ]);
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.BufferAttribute(wVerts, 3));
      wGeo.computeVertexNormals();
      const wMesh = new THREE.Mesh(wGeo, waterMat);
      wMesh.receiveShadow = true;
      quayGroup.add(wMesh);
    }

    // Posizionamento Yacht
    let distSinceLastYacht = 999;
    for (let s = 0; s < samplePoints.length; s++) {
      const p = samplePoints[s];
      if (s > 0) {
        distSinceLastYacht += p.center.distanceTo(samplePoints[s - 1].center);
      }

      const yachtSeed = secIdx * 5000 + s;
      const targetSpacing = (5.5 + pseudoRandom(yachtSeed * 29) * 3.0) * sec.yachtScale;

      if (distSinceLastYacht >= targetSpacing) {
        // Posizione scafo basata sulla scala dello yacht
        const yachtLength = 12.0 * sec.yachtScale;
        const yachtDist = quayEndDist + (yachtLength * 0.5) + 0.3;
        const yachtPos = p.center.clone().addScaledVector(p.right, sec.side * yachtDist);
        yachtPos.y = MONACO_GROUND_Y + 0.015; // Livello galleggiamento acqua

        const yacht = createDetailedMonacoYacht(yachtSeed);
        yacht.scale.set(sec.yachtScale, sec.yachtScale, sec.yachtScale);
        yacht.position.copy(yachtPos);

        // Ruota perpendicolarmente alla pista (prua verso il mare)
        const outwardDir = p.right.clone().multiplyScalar(sec.side).setY(0).normalize();
        yacht.rotation.y = Math.atan2(outwardDir.x, outwardDir.z);

        // Oscillazione realistica da galleggiamento
        yacht.rotation.y += (pseudoRandom(yachtSeed * 17) - 0.5) * 0.04;
        yacht.rotation.x = (pseudoRandom(yachtSeed * 3) - 0.5) * 0.015;
        yacht.rotation.z = (pseudoRandom(yachtSeed * 7) - 0.5) * 0.015;

        quayGroup.add(yacht);
        distSinceLastYacht = 0;
      }
    }

    group.add(quayGroup);
  });
}

function addMonacoTribune(group, curve, definition) {
  const structureMat = createFlatStandardMaterial({
    color: 0xcccccc,
    roughness: 0.85,
    metalness: 0.05
  });

  const seatColors = [0xd92d2d, 0x2f80ed, 0xf2c94c, 0xffffff, 0x27ae60];

  // 1. Grandstand at z = -72, facing the start/finish line (z = -60)
  const stand1 = new THREE.Group();
  stand1.name = "MonacoGrandstandStart";
  stand1.position.set(0, MONACO_GROUND_Y, -72);

  const width = 45;
  const depth = 5;
  const heightSteps = 4;

  for (let step = 0; step < heightSteps; step += 1) {
    const stepHeight = 0.55 * (step + 1);
    const stepDepth = depth / heightSteps;
    const stepZ = (step * stepDepth) - (depth * 0.5) + (stepDepth * 0.5);

    const stepGeo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
    const stepMesh = new THREE.Mesh(stepGeo, structureMat);
    stepMesh.position.set(0, stepHeight * 0.5, stepZ);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    stand1.add(stepMesh);

    const seatGeo = new THREE.BoxGeometry(0.55, 0.34, 0.55);
    const seatsPerRow = Math.floor(width / 0.95);
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const seatX = (seat - (seatsPerRow - 1) * 0.5) * 0.95 + (pseudoRandom(step * 7 + seat) * 0.2 - 0.1);
      const seatColor = seatColors[Math.floor(pseudoRandom(step * 17 + seat * 11) * seatColors.length)];
      const seatMat = createFlatStandardMaterial({ color: seatColor, roughness: 0.6 });
      const seatMesh = new THREE.Mesh(seatGeo, seatMat);
      seatMesh.position.set(seatX, stepHeight + 0.17, stepZ + (pseudoRandom(seat * 13) * 0.2 - 0.1));
      seatMesh.castShadow = true;
      stand1.add(seatMesh);
    }
  }

  const canopyMat = createFlatStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const canopyGeo = new THREE.BoxGeometry(width + 2, 0.18, depth + 1);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 3.4, 0.5);
  canopy.rotation.x = -0.06;
  canopy.castShadow = true;
  stand1.add(canopy);

  const pillarMat = createFlatStandardMaterial({ color: 0x1f2430, roughness: 0.6, metalness: 0.4 });
  const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6);
  const pillarCount = 5;
  for (let p = 0; p < pillarCount; p += 1) {
    const px = (p - (pillarCount - 1) * 0.5) * (width / (pillarCount - 1));
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 1.7, -depth * 0.5 + 0.25);
    pillar.castShadow = true;
    stand1.add(pillar);
  }

  group.add(stand1);

  // 2. Grandstand at z = 54, facing the bottom straight (z = 42)
  const stand2 = stand1.clone();
  stand2.name = "MonacoGrandstandBottom";
  stand2.position.set(-5, MONACO_GROUND_Y, 54);
  stand2.rotation.y = Math.PI; // Face opposite direction
  group.add(stand2);
}

function createMonacoBuilding(index, height, width, depth) {
  const building = new THREE.Group();
  building.name = `MonacoBuilding_${index}`;

  const bodyColors = [0xf4efe2, 0xebe3cd, 0xecdcb9, 0xfcfbf7, 0xe5dcc4];
  const bodyColor = bodyColors[index % bodyColors.length];
  const bodyMat = createFlatStandardMaterial({
    color: bodyColor,
    roughness: 0.72,
    metalness: 0.05
  });

  const glassMat = createFlatStandardMaterial({
    color: 0x2b3e4e,
    roughness: 0.15,
    metalness: 0.8
  });

  const roofMat = createFlatStandardMaterial({
    color: 0x8b8e93,
    roughness: 0.9
  });

  // Corpo principale (Main block)
  const blockGeo = new THREE.BoxGeometry(width, height, depth);
  const block = new THREE.Mesh(blockGeo, bodyMat);
  block.position.y = height * 0.5;
  block.castShadow = true;
  block.receiveShadow = true;
  building.add(block);

  // Tetto (Roof)
  const roofGeo = new THREE.BoxGeometry(width * 1.01, 0.16, depth * 1.01);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height + 0.08;
  roof.castShadow = true;
  building.add(roof);

  // Finestre (Windows)
  const windowRows = Math.floor(height / 2.8);
  const windowCols = Math.floor(width / 2.2);
  const wWidth = 0.8;
  const wHeight = 1.35;
  const wDepth = 0.08;

  const windowGeo = new THREE.BoxGeometry(wWidth, wHeight, wDepth);
  const winMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let r = 0; r < windowRows; r += 1) {
    for (let c = 0; c < windowCols; c += 1) {
      const wx = (c - (windowCols - 1) * 0.5) * 2.2;
      const wy = (r + 0.5) * 2.8 + 0.4;
      
      // Front face
      matrix.makeTranslation(wx, wy, depth * 0.5 + 0.03);
      winMatrices.push(matrix.clone());

      // Back face
      matrix.makeTranslation(wx, wy, -depth * 0.5 - 0.03);
      winMatrices.push(matrix.clone());
    }
  }

  if (winMatrices.length > 0) {
    const windows = new THREE.InstancedMesh(windowGeo, glassMat, winMatrices.length);
    windows.name = "Windows";
    winMatrices.forEach((winMatrix, idx) => windows.setMatrixAt(idx, winMatrix));
    windows.instanceMatrix.needsUpdate = true;
    building.add(windows);
  }

  if (height > 12) {
    const penGeo = new THREE.BoxGeometry(width * 0.44, 1.8, depth * 0.44);
    const penthouse = new THREE.Mesh(penGeo, bodyMat);
    penthouse.position.set(0, height + 1.06, 0);
    penthouse.castShadow = true;
    building.add(penthouse);
  }

  return building;
}

function addMonacoBuildings(group, curve, definition) {
  // Monaco hillside town on the left/inside area (x = -65)
  const leftX = -65;
  const startZ = -70;
  const endZ = 50;
  const spacing = 18;
  const buildingCount = Math.floor((endZ - startZ) / spacing) + 1;

  for (let i = 0; i < buildingCount; i += 1) {
    const z = startZ + i * spacing + (pseudoRandom(i) * 3 - 1.5);
    const height = 18 + pseudoRandom(i + 3) * 20;
    const width = 12 + pseudoRandom(i * 5) * 5;
    const depth = 12 + pseudoRandom(i * 11) * 5;

    const b = createMonacoBuilding(i, height, width, depth);
    b.position.set(leftX - pseudoRandom(i) * 8, MONACO_GROUND_Y, z);
    b.rotation.y = pseudoRandom(i) * 0.15 - 0.075;
    group.add(b);
  }
}

// ─── MONACO SPECTATORS & GRANDSTANDS ────────────────────────────────────────

/**
 * Crea uno spettatore realistico seduto con arti articolati.
 * Altezza seduto ≈ STEP_H (0.55m) per proporzioni corrette sui gradoni.
 *
 * Anatomia (dal basso):
 *   • Coscia (thigh) – piega 90° in avanti (seduto)
 *   • Stinco (shin)  – penzola verticale o leggermente in avanti
 *   • Busto (torso)  – seduto dritto
 *   • Collo
 *   • Testa (sfera)
 *   • Braccia superiori + avambracci
 *   • Accessori: cappello rosso, occhiali da sole, bandiera
 */
function createMonacoSpectator(seed) {
  const person = new THREE.Group();
  const rng = (offset) => pseudoRandom(seed * 97 + offset);

  // ── Colori ──
  const shirtColors = [0xd92d2d, 0x1a5276, 0x1e8449, 0xf39c12, 0x7d3c98, 0xe8e8e8, 0x2e4057, 0xc0392b, 0xff6b35, 0x34495e];
  const shirtColor = shirtColors[Math.floor(rng(1) * shirtColors.length)];
  const pantsColors = [0x2c3e50, 0x1a1a2e, 0x4a4a4a, 0x1b2631, 0x3d405b];
  const pantsColor = pantsColors[Math.floor(rng(9) * pantsColors.length)];
  const shoeColor = 0x222222;
  const skinColors = [0xf5cba7, 0xe8b89a, 0xc68642, 0x8d5524, 0xfadcb8];
  const skinColor = skinColors[Math.floor(rng(3) * skinColors.length)];

  const hatColors = [0xd92d2d, 0xd92d2d, 0xd92d2d, 0xc0392b, 0xb71c1c, 0xffd700];
  const hatColor = hatColors[Math.floor(rng(2) * hatColors.length)];
  const hasHat = rng(8) > 0.4;
  const hasSunglasses = rng(4) > 0.5;
  const hasFlag = rng(5) > 0.65;

  const skinMat = createFlatStandardMaterial({ color: skinColor, roughness: 0.85 });
  const shirtMat = createFlatStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = createFlatStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const shoeMat = createFlatStandardMaterial({ color: shoeColor, roughness: 0.9 });

  // ── Dimensioni proporzionate al gradone (STEP_H = 0.55m) ──
  // Altezza seduto totale ≈ 0.50m (busto+testa), gambe piegate davanti
  const TORSO_H = 0.22;
  const TORSO_W = 0.18;
  const TORSO_D = 0.12;
  const HEAD_R = 0.07;
  const NECK_H = 0.03;
  const UPPER_ARM_L = 0.11;
  const FOREARM_L = 0.10;
  const ARM_R = 0.028;
  const THIGH_L = 0.18;
  const SHIN_L = 0.17;
  const LEG_R = 0.035;
  const SHOE_H = 0.04;

  // Punto base = superficie del gradone (y=0)

  // ── Cosce (orizzontali, sedute sul gradone) ──
  const thighGeo = new THREE.CylinderGeometry(LEG_R, LEG_R * 0.9, THIGH_L, 5);
  [-1, 1].forEach((side) => {
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.rotation.z = Math.PI * 0.5; // orizzontale
    thigh.position.set(side * 0.06, 0.04, THIGH_L * 0.5 + 0.02);
    person.add(thigh);
  });

  // ── Stinchi (pendono dal bordo del gradone) ──
  const shinGeo = new THREE.CylinderGeometry(LEG_R * 0.85, LEG_R * 0.7, SHIN_L, 5);
  [-1, 1].forEach((side) => {
    const shin = new THREE.Mesh(shinGeo, pantsMat);
    shin.position.set(side * 0.06, -SHIN_L * 0.5 + 0.01, THIGH_L + 0.02);
    person.add(shin);

    // Scarpa
    const shoeGeo = new THREE.BoxGeometry(0.05, SHOE_H, 0.08);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(side * 0.06, -SHIN_L + 0.01 - SHOE_H * 0.5 + 0.01, THIGH_L + 0.04);
    person.add(shoe);
  });

  // ── Busto ──
  const torsoGeo = new THREE.BoxGeometry(TORSO_W, TORSO_H, TORSO_D);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, TORSO_H * 0.5 + 0.05, 0);
  torso.castShadow = true;
  person.add(torso);

  // ── Collo ──
  const neckGeo = new THREE.CylinderGeometry(0.025, 0.03, NECK_H, 5);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, TORSO_H + 0.05 + NECK_H * 0.5, 0);
  person.add(neck);

  // ── Testa ──
  const headGeo = new THREE.SphereGeometry(HEAD_R, 8, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  const headY = TORSO_H + 0.05 + NECK_H + HEAD_R;
  head.position.set(0, headY, 0);
  head.castShadow = true;
  person.add(head);

  // ── Braccia (busto → giù + avanti) ──
  const upperArmGeo = new THREE.CylinderGeometry(ARM_R, ARM_R * 0.85, UPPER_ARM_L, 5);
  const forearmGeo = new THREE.CylinderGeometry(ARM_R * 0.8, ARM_R * 0.65, FOREARM_L, 5);

  const armAngle = rng(10) * 0.3 + 0.05; // leggera variazione posa
  [-1, 1].forEach((side) => {
    // Upper arm
    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    const shoulderY = TORSO_H + 0.02;
    upperArm.position.set(side * (TORSO_W * 0.5 + ARM_R), shoulderY - UPPER_ARM_L * 0.4, 0);
    upperArm.rotation.z = side * armAngle;
    person.add(upperArm);

    // Forearm (skin)
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.set(
      side * (TORSO_W * 0.5 + ARM_R + Math.sin(armAngle) * UPPER_ARM_L * 0.4),
      shoulderY - UPPER_ARM_L * 0.8 - FOREARM_L * 0.35,
      0.03
    );
    forearm.rotation.z = side * (armAngle * 0.5);
    person.add(forearm);

    // Mano (piccola sfera)
    const handGeo = new THREE.SphereGeometry(0.022, 4, 4);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(
      side * (TORSO_W * 0.5 + ARM_R + Math.sin(armAngle) * UPPER_ARM_L * 0.5),
      shoulderY - UPPER_ARM_L * 0.8 - FOREARM_L * 0.75,
      0.04
    );
    person.add(hand);
  });

  // ── Cappello (rosso Ferrari, 60%) ──
  if (hasHat) {
    const hatMat = createFlatStandardMaterial({ color: hatColor, roughness: 0.75 });
    const brimGeo = new THREE.CylinderGeometry(HEAD_R + 0.04, HEAD_R + 0.04, 0.015, 8);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.set(0, headY + HEAD_R * 0.7, 0);
    person.add(brim);

    const crownGeo = new THREE.CylinderGeometry(HEAD_R * 0.65, HEAD_R * 0.9, HEAD_R * 0.9, 8);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.set(0, headY + HEAD_R * 0.7 + HEAD_R * 0.45, 0);
    person.add(crown);
  }

  // ── Occhiali da sole (50%) ──
  if (hasSunglasses) {
    const glassMat = createFlatStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.7 });
    const lensGeo = new THREE.BoxGeometry(0.04, 0.022, 0.015);
    [-1, 1].forEach((s) => {
      const lens = new THREE.Mesh(lensGeo, glassMat);
      lens.position.set(s * 0.032, headY - 0.005, HEAD_R * 0.85);
      person.add(lens);
    });
    const bridgeGeo = new THREE.BoxGeometry(0.07, 0.008, 0.015);
    const bridge = new THREE.Mesh(bridgeGeo, glassMat);
    bridge.position.set(0, headY - 0.005, HEAD_R * 0.85);
    person.add(bridge);
  }

  // ── Bandiera Ferrari (35%) ──
  if (hasFlag) {
    const poleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 4);
    const poleMat = createFlatStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    const flagHandSide = rng(7) > 0.5 ? 1 : -1;
    pole.position.set(flagHandSide * 0.16, headY + 0.18, 0.04);
    pole.rotation.z = flagHandSide * 0.15;
    person.add(pole);

    // Bandiera rossa Ferrari
    const flagGeo = new THREE.PlaneGeometry(0.26, 0.18);
    const flagMat = createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.7, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(flagHandSide * (0.16 + 0.14), headY + 0.35, 0.04);
    flag.rotation.y = (rng(11) - 0.5) * 0.4;
    person.add(flag);
  }

  return person;
}

/**
 * Spalti continui che seguono il lato INTERNO della curva (spline).
 * Campiona il percorso e costruisce tribune a gradoni lungo tratti ampi,
 * come nel vero GP di Monaco.
 */
function addMonacoGrandstands(group, curve, definition) {
  const ROWS = 6;
  const STEP_H = 0.55;
  const STEP_D = 0.70;
  const SEAT_SPACING = 0.50;
  const STAND_INSET = 3.5;  // distanza dal bordo della barriera interna verso il centro

  const roadHW = definition.roadWidth * 0.5;
  const barrierOff = definition.barrierOffset + definition.barrierThickness * 0.5;
  // Distanza dal centro della pista al lato interno dello spalto
  const standDist = roadHW + barrierOff + STAND_INSET;

  const concreteMat = createFlatStandardMaterial({ color: 0xc8c2b8, roughness: 0.92 });
  const concreteDarkMat = createFlatStandardMaterial({ color: 0x9e9a90, roughness: 0.95 });

  // Sezioni continue di spalti: range [tStart, tEnd] sulla spline, lato (1 = destra/interno)
  // Scegliamo tratti lunghi interni che corrispondono alla foto reale di Monaco
  const sections = [
    { tStart: 0.02, tEnd: 0.18, side: 1 },   // lungo il rettilineo partenza + Sainte-Dévote
    { tStart: 0.22, tEnd: 0.42, side: 1 },   // Massenet → Casino
    { tStart: 0.48, tEnd: 0.62, side: 1 },   // Mirabeau → Hairpin
    { tStart: 0.68, tEnd: 0.85, side: 1 },   // Risalita → Jink → Rascasse
  ];

  const segments = definition.segments;

  sections.forEach((sec, secIdx) => {
    const standGroup = new THREE.Group();
    standGroup.name = `MonacoGrandstand_${secIdx}`;

    // Campiona punti lungo il tratto di curva con maggiore densità per gradini più lisci e più spettatori
    const densityMultiplier = 3;
    const iStart = Math.floor(sec.tStart * segments * densityMultiplier);
    const iEnd = Math.ceil(sec.tEnd * segments * densityMultiplier);
    const samplePoints = [];

    for (let i = iStart; i <= iEnd; i++) {
      const t = i / (segments * densityMultiplier);
      const center = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).setY(0).normalize();
      const right = getRightVector(tangent);
      samplePoints.push({ center, tangent, right, t });
    }

    // Ogni ~SEAT_SPACING lungo la curva = 1 posto
    // Calcoliamo una striscia di gradoni che segue la curva

    for (let row = 0; row < ROWS; row++) {
      const rowDist = standDist + row * STEP_D;
      const rowY = MONACO_ROAD_Y + row * STEP_H;

      // Costruiamo un ribbon di gradone continuo lungo i sample points
      for (let s = 0; s < samplePoints.length - 1; s++) {
        const p1 = samplePoints[s];
        const p2 = samplePoints[s + 1];

        // Posizione interna alla pista (lato sinistro = -right)
        const pos1 = p1.center.clone().addScaledVector(p1.right, sec.side * rowDist);
        const pos2 = p2.center.clone().addScaledVector(p2.right, sec.side * rowDist);
        const pos1outer = p1.center.clone().addScaledVector(p1.right, sec.side * (rowDist + STEP_D * 0.85));
        const pos2outer = p2.center.clone().addScaledVector(p2.right, sec.side * (rowDist + STEP_D * 0.85));

        // Gradone come quad (BufferGeometry di 2 triangoli)
        const stepVerts = new Float32Array([
          pos1.x, rowY,            pos1.z,
          pos2.x, rowY,            pos2.z,
          pos1outer.x, rowY,       pos1outer.z,
          pos2.x, rowY,            pos2.z,
          pos2outer.x, rowY,       pos2outer.z,
          pos1outer.x, rowY,       pos1outer.z,
        ]);
        const stepGeo = new THREE.BufferGeometry();
        stepGeo.setAttribute('position', new THREE.BufferAttribute(stepVerts, 3));
        stepGeo.computeVertexNormals();
        const stepMesh = new THREE.Mesh(stepGeo, row % 2 === 0 ? concreteMat : concreteDarkMat);
        stepMesh.receiveShadow = true;
        standGroup.add(stepMesh);

        // Alzata verticale (fronte del gradone)
        const riserVerts = new Float32Array([
          pos1.x, rowY,           pos1.z,
          pos2.x, rowY,           pos2.z,
          pos1.x, rowY - STEP_H,  pos1.z,
          pos2.x, rowY,           pos2.z,
          pos2.x, rowY - STEP_H,  pos2.z,
          pos1.x, rowY - STEP_H,  pos1.z,
        ]);
        const riserGeo = new THREE.BufferGeometry();
        riserGeo.setAttribute('position', new THREE.BufferAttribute(riserVerts, 3));
        riserGeo.computeVertexNormals();
        const riserMesh = new THREE.Mesh(riserGeo, concreteDarkMat);
        standGroup.add(riserMesh);
      }

      // Spettatori su questa fila – disposti a intervalli di distanza costanti per densità uniforme
      let distSinceLast = 999;

      for (let s = 0; s < samplePoints.length; s++) {
        const p = samplePoints[s];
        if (s > 0) {
          distSinceLast += p.center.distanceTo(samplePoints[s - 1].center);
        }

        const spectatorSeed = secIdx * 10000 + row * 1000 + s;
        // Spaziatura target fitta per spettatori grandi (scala 1.75)
        const targetSpacing = 0.55 + pseudoRandom(spectatorSeed * 77) * 0.2;

        if (distSinceLast >= targetSpacing) {
          // 85% di probabilità di occupare il posto per creare piccole variazioni naturali
          if (pseudoRandom(spectatorSeed * 131) > 0.15) {
            const seatPos = p.center.clone().addScaledVector(p.right, sec.side * (rowDist + STEP_D * 0.3));
            seatPos.y = rowY + 0.01;

            const spectator = createMonacoSpectator(spectatorSeed);
            // Ingrandiamo gli spettatori a 1.75x
            spectator.scale.set(1.75, 1.75, 1.75);
            spectator.position.copy(seatPos);

            // Ruota per guardare verso la pista
            const toTrack = p.center.clone().sub(seatPos).setY(0).normalize();
            spectator.rotation.y = Math.atan2(toTrack.x, toTrack.z);
            spectator.rotation.y += (pseudoRandom(spectatorSeed * 13) - 0.5) * 0.25;

            standGroup.add(spectator);
          }
          distSinceLast = 0;
        }
      }
    }

    // Parete di fondo dietro l'ultima fila (muro dello spalto)
    for (let s = 0; s < samplePoints.length - 1; s++) {
      const p1 = samplePoints[s];
      const p2 = samplePoints[s + 1];
      const backDist = standDist + ROWS * STEP_D;
      const backH = ROWS * STEP_H + 0.6;

      const b1 = p1.center.clone().addScaledVector(p1.right, sec.side * backDist);
      const b2 = p2.center.clone().addScaledVector(p2.right, sec.side * backDist);

      const wallVerts = new Float32Array([
        b1.x, MONACO_ROAD_Y + backH, b1.z,
        b2.x, MONACO_ROAD_Y + backH, b2.z,
        b1.x, MONACO_ROAD_Y,         b1.z,
        b2.x, MONACO_ROAD_Y + backH, b2.z,
        b2.x, MONACO_ROAD_Y,         b2.z,
        b1.x, MONACO_ROAD_Y,         b1.z,
      ]);
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.BufferAttribute(wallVerts, 3));
      wallGeo.computeVertexNormals();
      const wallMesh = new THREE.Mesh(wallGeo, concreteDarkMat);
      standGroup.add(wallMesh);
    }

    group.add(standGroup);
  });
}

function addMonacoLampPosts(group, curve, definition) {
  const postMat = createFlatStandardMaterial({
    color: 0x475569,
    roughness: 0.58,
    metalness: 0.36
  });

  const lampMat = createFlatStandardMaterial({
    color: 0xfffacd,
    emissive: 0xfffacd,
    emissiveIntensity: 1.5,
    roughness: 0.1
  });

  const totalLength = curve.getLength();
  const interval = 16;
  const count = Math.floor(totalLength / interval);

  const postHeight = 3.6;
  const armLength = 1.1;

  for (let i = 0; i < count; i += 1) {
    const progress = (i * interval) / totalLength;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    const side = i % 2 === 0 ? 1 : -1;
    const offset = definition.roadWidth * 0.5 + (definition.barrierOffset ?? 0.85) + 0.42;

    const pos = point.clone().addScaledVector(normal, side * offset);
    pos.y = MONACO_ROAD_Y;

    const heading = getHeading(tangent);

    const postGroup = new THREE.Group();
    postGroup.name = `LampPost_${i}`;
    postGroup.position.copy(pos);
    postGroup.rotation.y = heading;

    // Palo verticale (Vertical post)
    const verticalGeo = new THREE.CylinderGeometry(0.08, 0.12, postHeight, 5);
    const vertical = new THREE.Mesh(verticalGeo, postMat);
    vertical.position.y = postHeight * 0.5;
    vertical.castShadow = true;
    postGroup.add(vertical);

    // Braccio orizzontale (Horizontal arm)
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, armLength);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(-side * armLength * 0.5, postHeight - 0.04, 0);
    arm.rotation.y = Math.PI / 2;
    arm.castShadow = true;
    postGroup.add(arm);

    // Corpo lampada (Lamp fixture)
    const fixtureGeo = new THREE.BoxGeometry(0.24, 0.12, 0.34);
    const fixture = new THREE.Mesh(fixtureGeo, postMat);
    fixture.position.set(-side * armLength, postHeight - 0.1, 0);
    fixture.castShadow = true;
    postGroup.add(fixture);

    const bulbGeo = new THREE.BoxGeometry(0.18, 0.06, 0.26);
    const bulb = new THREE.Mesh(bulbGeo, lampMat);
    bulb.position.set(-side * armLength, postHeight - 0.15, 0);
    postGroup.add(bulb);

    group.add(postGroup);
  }
}

function addMonacoKerbs(group, curve, definition) {
  const roadWidth = definition.roadWidth;
  const segments = definition.segments;

  // Generiamo gli stessi identici campioni della strada per un allineamento perfetto
  const edgeSamples = [];
  let cumulativeDistance = 0;
  let previousCenter = null;

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);

    if (previousCenter) {
      cumulativeDistance += previousCenter.distanceTo(center);
    }

    edgeSamples.push({
      center: center.clone(),
      normal: right,
      roadHalfWidth: roadWidth * 0.5,
      distance: cumulativeDistance
    });

    previousCenter = center;
  }

  // Costruiamo i vertici e gli indici per le mesh rosse e bianche
  const redVertices = [];
  const redIndices = [];
  const redUvs = [];
  let redVertCount = 0;

  const whiteVertices = [];
  const whiteIndices = [];
  const whiteUvs = [];
  let whiteVertCount = 0;

  // Larghezza del cordolo sul bordo della pista (completamente sull'asfalto, mai oltre il bordo)
  // Bordo esterno = esattamente al bordo della strada
  // Bordo interno = 1.6m verso il centro della pista
  const KERB_WIDTH = 1.6;
  const ROAD_UV_SCALE = 8;

  // Ciclo su entrambi i lati: sinistra (-1) e destra (1)
  [-1, 1].forEach((side) => {
    for (let i = 0; i < edgeSamples.length - 1; i++) {
      const sample1 = edgeSamples[i];
      const sample2 = edgeSamples[i + 1];

      // "outer" = esattamente al bordo della strada (mai oltre → mai sotto il muro)
      // "inner" = KERB_WIDTH verso il centro
      const outerDist1 = sample1.roadHalfWidth;
      const innerDist1 = sample1.roadHalfWidth - KERB_WIDTH;
      const outerDist2 = sample2.roadHalfWidth;
      const innerDist2 = sample2.roadHalfWidth - KERB_WIDTH;

      const inner1 = sample1.center.clone().addScaledVector(sample1.normal, side * innerDist1);
      const outer1 = sample1.center.clone().addScaledVector(sample1.normal, side * outerDist1);
      const inner2 = sample2.center.clone().addScaledVector(sample2.normal, side * innerDist2);
      const outer2 = sample2.center.clone().addScaledVector(sample2.normal, side * outerDist2);

      // Piatto sull'asfalto, leggermente rialzato per non z-fight
      const Y = MONACO_ROAD_Y + 0.015;
      inner1.y = Y;
      outer1.y = Y;
      inner2.y = Y;
      outer2.y = Y;

      // Alterniamo il colore a ogni segmento
      if (i % 2 === 0) {
        redVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        redUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        redIndices.push(
          redVertCount, redVertCount + 2, redVertCount + 1,
          redVertCount + 1, redVertCount + 2, redVertCount + 3
        );
        redVertCount += 4;
      } else {
        whiteVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        whiteUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        whiteIndices.push(
          whiteVertCount, whiteVertCount + 2, whiteVertCount + 1,
          whiteVertCount + 1, whiteVertCount + 2, whiteVertCount + 3
        );
        whiteVertCount += 4;
      }
    }
  });

  const redMat = createFlatStandardMaterial({
    color: 0xd92d2d, // Rosso vivace Monaco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const whiteMat = createFlatStandardMaterial({
    color: 0xfafafa, // Bianco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  if (redVertices.length > 0) {
    const redGeo = new THREE.BufferGeometry();
    redGeo.setAttribute("position", new THREE.Float32BufferAttribute(redVertices, 3));
    redGeo.setAttribute("uv", new THREE.Float32BufferAttribute(redUvs, 2));
    redGeo.setIndex(redIndices);
    redGeo.computeVertexNormals();

    const redMesh = new THREE.Mesh(redGeo, redMat);
    redMesh.name = "MonacoKerbsRed";
    redMesh.receiveShadow = true;
    redMesh.castShadow = true;
    group.add(redMesh);
  }

  if (whiteVertices.length > 0) {
    const whiteGeo = new THREE.BufferGeometry();
    whiteGeo.setAttribute("position", new THREE.Float32BufferAttribute(whiteVertices, 3));
    whiteGeo.setAttribute("uv", new THREE.Float32BufferAttribute(whiteUvs, 2));
    whiteGeo.setIndex(whiteIndices);
    whiteGeo.computeVertexNormals();

    const whiteMesh = new THREE.Mesh(whiteGeo, whiteMat);
    whiteMesh.name = "MonacoKerbsWhite";
    whiteMesh.receiveShadow = true;
    whiteMesh.castShadow = true;
    group.add(whiteMesh);
  }
}

export function buildMonacoProps(group, curve, definition) {
  const propsGroup = new THREE.Group();
  propsGroup.name = "MonacoProps";

  // Lampioni, cordoli, spalti con spettatori, e porto con yacht
  addMonacoLampPosts(propsGroup, curve, definition);
  addMonacoKerbs(propsGroup, curve, definition);
  addMonacoGrandstands(propsGroup, curve, definition);
  addMonacoOuterHarbor(propsGroup, curve, definition);

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
  } else if (definition.id === "monaco") {
    buildMonacoProps(group, curve, definition);
  }
}

