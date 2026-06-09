import * as THREE from "three";
import { createFlatStandardMaterial } from "./trackMaterials.js";
import crowdTextureUrl from "../assets/textures/grandstand_crowd.png";

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
  
  let currentOffset = initialOffset;
  let position = point.clone().addScaledVector(normal, side * currentOffset);
  
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let tooClose = false;
    for (let index = 0; index <= 120; index += 1) {
      const trackPoint = curve.getPointAt(index / 120);
      const distSq = (position.x - trackPoint.x) ** 2 + (position.z - trackPoint.z) ** 2;
      if (distSq < (roadHalfWidth + minClearance) ** 2) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      return position;
    }
    
    currentOffset += 20;
    position = point.clone().addScaledVector(normal, side * currentOffset);
  }
  
  return position;
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
    const width = 10 + pseudoRandom(buildingIndex + 8.6) * 5;
    const depth = 10 + pseudoRandom(buildingIndex + 13.1) * 5;
    
    // Position them further out so they are in the background and don't intersect other props
    const skylineOffset = definition.roadWidth * 0.5 + 40 + pseudoRandom(buildingIndex + 21.5) * 15;
    const heading = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    
    // Dynamically calculate a safe position that is guaranteed not to overlap ANY part of the track
    const position = getSafeRoadsidePosition(curve, progress, side, skylineOffset, definition.roadWidth * 0.5, 25);

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
      const light = new THREE.PointLight(color, 1.25, 17, 1.7);
      light.position.set(0, 2.7, 0);
      arch.add(light);
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
  const progressPoints = [0.01, 0.28, 0.45, 0.59, 0.74, 0.87];
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
    const light = new THREE.PointLight(color, 10, 15, 1.8);
    light.name = `VegasBillboardLight:${index}`;
    light.position.set(0, 6, 1.2);
    sign.add(light);
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
  pants: null
};

function getSpectatorMaterials(shirtColors, skinColors) {
  if (spectatorMaterialCache.shirts.length === 0) {
    spectatorMaterialCache.shirts = shirtColors.map((color) => new THREE.MeshBasicMaterial({ color }));
    spectatorMaterialCache.skins = skinColors.map((color) => new THREE.MeshBasicMaterial({ color }));
    spectatorMaterialCache.pants = new THREE.MeshBasicMaterial({ color: 0x18202a });
  }
  return spectatorMaterialCache;
}

function addSeatedSpectators(stand, width, rows, seed) {
  const shirtColors = [0xffd23a, 0x32f6ff, 0xff2bd6, 0x48ff78, 0xf4f2e8, 0x6aa7ff, 0xff7a59];
  const skinColors = [0xf0c7a0, 0xd49a6a, 0x8b5a3c, 0xf4d2b5];
  
  const mats = getSpectatorMaterials(shirtColors, skinColors);
  const shirtMaterials = mats.shirts;
  const skinMaterials = mats.skins;
  const pantsMaterial = mats.pants;

  const torsoGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.68, 8);
  const headGeometry = new THREE.SphereGeometry(0.22, 12, 12);
  const legGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.62, 8);
  const armGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.46, 8);

  const seatsPerRow = Math.max(7, Math.floor(width / 1.45));
  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = skinMaterials.map(() => []);
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
      const scaleNoise = 1.04 + pseudoRandom(seed * 23 + row * 13 + seat) * 0.18;

      variedScale.set(scaleNoise, scaleNoise, scaleNoise);
      
      matrix.compose(new THREE.Vector3(x, y + 0.04, z), torsoQuaternion, variedScale);
      torsoMatrices[shirtIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x, y + 0.58, z + 0.03), headQuaternion, variedScale);
      headMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.29, y + 0.04, z + 0.03), leftArmQuaternion, variedScale);
      leftArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.29, y + 0.04, z + 0.03), rightArmQuaternion, variedScale);
      rightArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.13, y - 0.28, z + 0.38), legQuaternion, variedScale);
      leftLegMatrices.push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.13, y - 0.28, z + 0.38), legQuaternion, variedScale);
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
      .addScaledVector(normal, side * (definition.roadWidth * 0.5 + 15))
      .addScaledVector(tangent, pseudoRandom(index + 2.2) * 8 - 4);
    clampPropPosition(curve, position, roadHalfWidth);

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

    const light = new THREE.PointLight(lampColor, 25, 20, 2);
    light.name = `VegasStreetLampLight:${index}`;
    light.position.copy(head.position);

    lamp.add(pole, head, light);
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

  const light = new THREE.PointLight(color, 12, 15, 2);
  light.position.set(0, -lineCount, 2.2);
  sign.add(light);
  parent.add(sign);
}

function buildCaesarsPalace(group, curve, roadHalfWidth) {
  const palace = new THREE.Group();
  palace.name = "VegasSkyline:CaesarsPalace";
  const transform = getRoadsideTransform(curve, 0.3, -1, roadHalfWidth + 110, roadHalfWidth, 45);
  palace.position.copy(transform.position);
  palace.rotation.y = transform.rotationY;
  palace.scale.set(0.6, 0.6, 0.6);

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
  const transform = getRoadsideTransform(curve, 0.6, -1, roadHalfWidth + 120, roadHalfWidth, 50);
  bellagio.position.copy(transform.position);
  bellagio.rotation.y = transform.rotationY;
  bellagio.scale.set(0.5, 0.5, 0.5);

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
  const transform = getRoadsideTransform(curve, 0, -1, roadHalfWidth + 40, roadHalfWidth, 25);
  signGroup.position.copy(transform.position);
  signGroup.rotation.y = transform.rotationY;

  const goldMaterial = createVegasMaterial({
    color: 0xd4af37,
    emissive: 0xffd700,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.12
  });
  const frameMaterial = createVegasMaterial({
    color: 0xff2090,
    emissive: 0xff2090,
    emissiveIntensity: 1,
    roughness: 0.18
  });
  const poleMaterial = createVegasMaterial({ color: 0xa9a9b4, roughness: 0.42, metalness: 0.28 });

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), goldMaterial);
  panel.position.set(0, 12, 0.04);
  panel.rotation.z = Math.PI / 4;
  signGroup.add(panel);

  const frameParts = [
    [0, 16.95, 10, Math.PI / 4],
    [0, 7.05, 10, Math.PI / 4],
    [-4.95, 12, 10, -Math.PI / 4],
    [4.95, 12, 10, -Math.PI / 4]
  ];
  frameParts.forEach(([x, y, length, rotationZ]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(length, 0.28, 0.28), frameMaterial);
    frame.position.set(x, y, 0.1);
    frame.rotation.z = rotationZ;
    signGroup.add(frame);
  });

  [-3.2, 3.2].forEach((x) => {
    const pole = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 5), poleMaterial));
    pole.position.set(x, 3, -0.05);
    signGroup.add(pole);
  });

  group.add(signGroup);
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
  disableDecorativeCastShadows(propsGroup);
  group.add(propsGroup);
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
