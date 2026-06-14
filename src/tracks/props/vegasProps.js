import * as THREE from "three";
import { createFlatStandardMaterial } from "../trackMaterials.js";
import {
  buildVegasBillboards,
  colorToHexStr,
  createBillboardMaterial,
  getCachedVegasCanvasTexture
} from "./vegas/billboards.js";
import { addDecorativePointLight } from "./vegas/lights.js";
import { buildVegasSkyline } from "./vegas/skyline.js";
import {
  addCasinoDice,
  addNeonPalms,
  addVegasTunnel
} from "./vegas/trackside.js";
import { addVegasF1Venue } from "./vegas/venue.js";
import { addInstancedPart } from "./common/instancing.js";
import { getRoadsidePlacement } from "./common/placement.js";
import {
  clampPropPosition,
  getHeading,
  getRightVector,
  markShadow,
  pseudoRandom
} from "./shared.js";

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
  const columns = Math.max(3, Math.floor((isFront ? block.width : block.depth) / 2.8));
  const rows = Math.max(4, Math.floor(block.height / 4.2));

  const windowWidth = isFront ? Math.min(0.5, block.width / (columns * 2.2)) : 0.08;
  const windowDepth = isFront ? 0.08 : Math.min(0.5, block.depth / (columns * 2.2));
  const windowHeight = Math.min(0.45, block.height / (rows * 2.8));

  const xStep = block.width / (columns + 1);
  const zStep = block.depth / (columns + 1);
  const yStep = block.height / (rows + 1);

  const colorsList = (neonColors && neonColors.length > 0) ? neonColors : [0xff2bd6, 0x32f6ff, 0xffd23a, 0x48ff78];
  const colorIndex = Math.floor(pseudoRandom(seed + 0.41) * colorsList.length) % colorsList.length;
  const litMaterial = getCachedWindowMaterial(colorsList[colorIndex], true);
  const geometry = getCachedWindowGeometry(windowWidth, windowHeight, windowDepth);

  const litMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const noise = pseudoRandom(seed + row * 9.7 + column * 3.1 + (isFront ? 0 : 17));
      if (noise < 0.42) {
        continue;
      }
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
      litMatrices.push(matrix.clone());
    }
  }

  if (litMatrices.length > 0) {
    addInstancedPart(group, geometry, litMaterial, litMatrices, `LitWindows_${colorIndex}`);
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
  const sampleCount = 16;

  for (let index = 0; index < sampleCount; index += 1) {
    // Alternate left and right side of the track
    const side = index % 2 === 0 ? 1 : -1;

    // Spaced out progress with a small jitter to keep it natural but prevent overlap
    const progressJitter = (pseudoRandom(index + 13.7) * 0.4 - 0.2) / sampleCount;
    const progress = ((index + 0.5) / sampleCount + progressJitter + 1.0) % 1.0;

    const buildingIndex = index;

    // Wider, taller, and more proportioned buildings
    const height = 32 + pseudoRandom(buildingIndex + 4.2) * 33;
    const width = 8 + pseudoRandom(buildingIndex + 8.6) * 4;
    const depth = 8 + pseudoRandom(buildingIndex + 13.1) * 4;

    // Position them further out so they are in the background and don't intersect other props
    const skylineOffset = definition.roadWidth * 0.5 + 82 + pseudoRandom(buildingIndex + 21.5) * 32;

    // Dynamically calculate a safe position that is guaranteed not to overlap ANY part of the track
    const { position, rotationY } = getRoadsidePlacement(
      curve,
      progress,
      side,
      skylineOffset,
      definition.roadWidth * 0.5,
      {
        minClearance: 62,
        strategy: "search"
      }
    );

    const building = createVegasBuilding({
      position,
      rotationY,
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

export function buildVegasProps(group, curve, definition) {
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
