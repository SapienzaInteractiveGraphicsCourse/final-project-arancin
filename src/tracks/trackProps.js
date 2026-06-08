import * as THREE from "three";
import { createFlatStandardMaterial } from "./trackMaterials.js";

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
  const columns = face === "front" ? 4 : 3;
  const rows = face === "front" ? 8 : 6;
  const windowWidth = face === "front" ? Math.min(0.7, block.width / (columns * 2.1)) : 0.075;
  const windowDepth = face === "front" ? 0.075 : Math.min(0.65, block.depth / (columns * 2.1));
  const windowHeight = Math.min(0.38, block.height / (rows * 3.6));
  const xStep = block.width / (columns + 1);
  const zStep = block.depth / (columns + 1);
  const yStep = block.height / (rows + 1);
  const litMaterial = createWindowMaterial(neonColors[seed % neonColors.length], true);
  const darkMaterial = createWindowMaterial(0x070811, false);
  const geometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth);
  const litMatrices = [];
  const darkMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const noise = pseudoRandom(seed + row * 9.7 + column * 3.1 + (face === "front" ? 0 : 17));
      const lit = noise > 0.42;
      const position = new THREE.Vector3();

      if (face === "front") {
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
      (lit ? litMatrices : darkMatrices).push(matrix.clone());
    }
  }

  [
    { matrices: litMatrices, material: litMaterial, name: "LitWindows" },
    { matrices: darkMatrices, material: darkMaterial, name: "DarkWindows" }
  ].forEach(({ matrices, material, name }) => {
    if (matrices.length === 0) {
      return;
    }

    const windows = new THREE.InstancedMesh(geometry, material, matrices.length);
    windows.name = name;
    windows.receiveShadow = true;
    matrices.forEach((windowMatrix, index) => windows.setMatrixAt(index, windowMatrix));
    windows.instanceMatrix.needsUpdate = true;
    group.add(windows);
  });
}

function addVerticalEdgeHighlights(group, block, material) {
  const edgeGeometry = new THREE.BoxGeometry(0.12, block.height * 1.02, 0.12);
  const x = block.width * 0.5 + 0.04;
  const z = block.depth * 0.5 + 0.04;
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
    roughness: 0.52,
    metalness: 0.12,
    emissive: 0x050006,
    emissiveIntensity: 0.08
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

    if (blockIndex === 1) {
      addWindowGrid(group, block, neonColors, index * 31 + blockIndex * 7, "front");
      addNeonFacadeStrips(group, block, neonColors, index * 17 + blockIndex);
    }
    if (blockIndex === 1 && index % 4 === 0) {
      addWindowGrid(group, block, neonColors, index * 43 + blockIndex * 11, "side");
    }
  });

  addVerticalEdgeHighlights(group, blocks[1], edgeMaterial);
  addRoofDetail(group, height * 1.04, width, depth, neonColor, index);

  if ([0, 12, 28, 44].includes(index)) {
    addSkyLaser(group, height * 1.06, neonColors[(index + 1) % neonColors.length], index);
  }

  if (height > 7.2) {
    addMegaScreen(group, blocks[1], neonColors[(index + 1) % neonColors.length], "front", index);
  }
  if (index % 2 === 0 && height > 9) {
    addMegaScreen(group, blocks[0], neonColors[(index + 2) % neonColors.length], "side", index + 1);
  }

  return group;
}

function generateCitySkyline(curve, group, definition) {
  const colors = definition.palette.neon;
  const bodyColors = [0x050508, 0x07070b, 0x090812, 0x08050c];
  const sampleCount = 30;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const progressJitter = pseudoRandom(index + 19.4) * 16 - 8;

    [-1, 1].forEach((side) => {
      const buildingIndex = index * 2 + (side > 0 ? 1 : 0);
      const height = 34 + pseudoRandom(buildingIndex + 4.2) * 82;
      const width = 8 + pseudoRandom(buildingIndex + 8.6) * 10;
      const depth = 8 + pseudoRandom(buildingIndex + 13.1) * 12;
      const skylineOffset = definition.roadWidth * 0.5 + 16 + pseudoRandom(buildingIndex + 21.5) * 22;
      const heading = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const position = point
        .clone()
        .addScaledVector(normal, side * skylineOffset)
        .addScaledVector(tangent, progressJitter);

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
    });
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

function createVegasBillboard({ position, rotationY, color, arrowColor, index }) {
  const billboard = new THREE.Group();
  billboard.name = `VegasNeonBillboard:${index}`;
  billboard.position.copy(position);
  billboard.rotation.y = rotationY;

  const poleMaterial = createFlatStandardMaterial({
    color: 0x151820,
    roughness: 0.48,
    metalness: 0.42
  });
  const panelBodyMaterial = createFlatStandardMaterial({
    color: 0x11131c,
    roughness: 0.35,
    metalness: 0.24
  });
  const panelFaceMaterial = createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.9,
    roughness: 0.18,
    metalness: 0.06
  });
  const arrowMaterial = createFlatStandardMaterial({
    color: arrowColor,
    emissive: arrowColor,
    emissiveIntensity: 3.2,
    roughness: 0.16,
    metalness: 0.04
  });

  const pole = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 6), poleMaterial));
  pole.position.y = 1.3;

  const panelBody = markShadow(new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.25, 0.16), panelBodyMaterial));
  panelBody.position.y = 3.05;

  const panelFace = new THREE.Mesh(new THREE.BoxGeometry(3.06, 1.02, 0.035), panelFaceMaterial);
  panelFace.position.set(0, 3.05, 0.095);
  panelFace.receiveShadow = true;

  const arrowStem = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.045), arrowMaterial);
  arrowStem.position.set(-0.22, 3.05, 0.125);
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3), arrowMaterial);
  arrowHead.position.set(0.65, 3.05, 0.13);
  arrowHead.rotation.z = -Math.PI * 0.5;
  arrowHead.rotation.y = Math.PI * 0.5;

  billboard.add(pole, panelBody, panelFace, arrowStem, arrowHead);
  return billboard;
}

function addVegasBillboards(group, curve, definition) {
  const colors = [0x48ff78, 0x32f6ff, 0xff2bd6, 0xffd23a];
  const arrowColors = [0xffd23a, 0xffffff, 0x32f6ff, 0x48ff78];
  const progressPoints = [0.05, 0.12, 0.2, 0.29, 0.38, 0.47, 0.56, 0.65, 0.74, 0.83, 0.91];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const position = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 4.6));
    const billboard = createVegasBillboard({
      position,
      rotationY: 0,
      color: colors[index % colors.length],
      arrowColor: arrowColors[index % arrowColors.length],
      index
    });

    billboard.lookAt(point.x, billboard.position.y, point.z);
    billboard.rotateY(Math.PI);
    group.add(billboard);
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
  const colors = [0x48ff78, 0x32f6ff];
  const progressPoints = [0.08, 0.13, 0.18, 0.24, 0.32, 0.39, 0.47, 0.57, 0.66, 0.73, 0.81, 0.88, 0.94];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const basePosition = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 2.9));

    for (let palmIndex = 0; palmIndex < 5; palmIndex += 1) {
      const offset = tangent.clone().multiplyScalar((palmIndex - 2) * 1.55);
      const palm = createNeonPalm({
        position: basePosition.clone().add(offset).addScaledVector(normal, side * (palmIndex % 2) * 0.82),
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

function addSeatedSpectators(stand, width, rows, seed) {
  const shirtColors = [0xffd23a, 0x32f6ff, 0xff2bd6, 0x48ff78, 0xf4f2e8, 0x6aa7ff, 0xff7a59];
  const skinColors = [0xf0c7a0, 0xd49a6a, 0x8b5a3c, 0xf4d2b5];
  const shirtMaterials = shirtColors.map((color) => createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.1,
    roughness: 0.74
  }));
  const skinMaterials = skinColors.map((color) => createFlatStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0
  }));
  const pantsMaterial = createFlatStandardMaterial({
    color: 0x18202a,
    roughness: 0.76,
    metalness: 0.02
  });
  const torsoGeometry = new THREE.BoxGeometry(0.34, 0.48, 0.22);
  const headGeometry = new THREE.DodecahedronGeometry(0.16, 0);
  const legGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.48);
  const armGeometry = new THREE.BoxGeometry(0.08, 0.32, 0.08);
  const seatsPerRow = Math.max(9, Math.floor(width / 1.05));
  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = skinMaterials.map(() => []);
  const leftArmMatrices = skinMaterials.map(() => []);
  const rightArmMatrices = skinMaterials.map(() => []);
  const leftLegMatrices = [];
  const rightLegMatrices = [];
  const matrix = new THREE.Matrix4();
  const torsoQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0));
  const headQuaternion = new THREE.Quaternion();
  const legQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, 0, 0));
  const leftArmQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0.26));
  const rightArmQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, -0.26));
  const torsoScale = new THREE.Vector3(1, 1, 1);
  const variedScale = new THREE.Vector3();

  for (let row = 0; row < rows; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const noise = pseudoRandom(seed * 19 + row * 7.3 + seat * 2.1);

      if (noise < 0.12) {
        continue;
      }

      const jitter = (pseudoRandom(seed * 11 + row * 5.1 + seat * 3.7) - 0.5) * 0.08;
      const x = (seat / (seatsPerRow - 1) - 0.5) * width * 0.9 + jitter;
      const y = 0.73 + row * 0.62;
      const z = 0.08 - row * 1.15;
      const shirtIndex = (seat + row + seed) % shirtMaterials.length;
      const skinIndex = (seat * 2 + row + seed) % skinMaterials.length;
      const scaleNoise = 0.92 + pseudoRandom(seed * 23 + row * 13 + seat) * 0.16;

      variedScale.set(scaleNoise, scaleNoise, scaleNoise);
      matrix.compose(new THREE.Vector3(x, y + 0.05, z), torsoQuaternion, variedScale);
      torsoMatrices[shirtIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x, y + 0.45, z + 0.02), headQuaternion, variedScale);
      headMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.2, y + 0.04, z + 0.02), leftArmQuaternion, variedScale);
      leftArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.2, y + 0.04, z + 0.02), rightArmQuaternion, variedScale);
      rightArmMatrices[skinIndex].push(matrix.clone());

      matrix.compose(new THREE.Vector3(x - 0.09, y - 0.2, z + 0.28), legQuaternion, variedScale);
      leftLegMatrices.push(matrix.clone());

      matrix.compose(new THREE.Vector3(x + 0.09, y - 0.2, z + 0.28), legQuaternion, variedScale);
      rightLegMatrices.push(matrix.clone());
    }
  }

  torsoMatrices.forEach((matrices, materialIndex) => {
    if (matrices.length === 0) {
      return;
    }

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
  if (matrices.length === 0) {
    return;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = `VegasGrandstandSpectator${name}`;
  mesh.receiveShadow = true;
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
  group.add(createPaddockBuilding({
    position: paddockPoint.clone().addScaledVector(paddockNormal, definition.roadWidth * 0.5 + 54),
    rotationY: getHeading(paddockTangent) - Math.PI / 2
  }));

  [0.34, 0.43, 0.52, 0.62, 0.72, 0.82, 0.93].forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    group.add(createSkyBeam({
      position: point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 62)),
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
  const coolWhite = 0xbfeaff;
  const tunnelStart = 0.01;
  const tunnelEnd = 0.17;
  const samples = [];

  for (let index = 0; index < 34; index += 1) {
    const progress = index / 34;

    if (progress >= tunnelStart && progress <= tunnelEnd) {
      continue;
    }

    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    samples.push({
      base: point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 1.65)),
      normal,
      heading: getHeading(tangent),
      side
    });
  }

  const metalMaterial = createFlatStandardMaterial({
    color: 0x151820,
    roughness: 0.42,
    metalness: 0.44
  });
  const lampMaterial = createFlatStandardMaterial({
    color: coolWhite,
    emissive: coolWhite,
    emissiveIntensity: 2.6,
    roughness: 0.2,
    metalness: 0.08
  });
  const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), metalMaterial, samples.length);
  const armMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 0.08, 0.08), metalMaterial, samples.length);
  const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.18, 0.28), lampMaterial, samples.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  stemMesh.name = "VegasInstancedLampStems";
  armMesh.name = "VegasInstancedLampArms";
  lampMesh.name = "VegasInstancedLampHeads";
  [stemMesh, armMesh, lampMesh].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  samples.forEach((sample, index) => {
    const armDirection = -sample.side;
    const armOffset = sample.normal.clone().multiplyScalar(armDirection * 0.48);
    const lampOffset = sample.normal.clone().multiplyScalar(armDirection * 1.04);

    quaternion.setFromEuler(new THREE.Euler(0, sample.heading, 0));
    matrix.compose(new THREE.Vector3(sample.base.x, 1.2, sample.base.z), quaternion, scale);
    stemMesh.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new THREE.Euler(0, sample.heading, armDirection * 0.18));
    matrix.compose(
      new THREE.Vector3(sample.base.x + armOffset.x, 2.42, sample.base.z + armOffset.z),
      quaternion,
      scale
    );
    armMesh.setMatrixAt(index, matrix);

    matrix.compose(
      new THREE.Vector3(sample.base.x + lampOffset.x, 2.28, sample.base.z + lampOffset.z),
      quaternion,
      scale
    );
    lampMesh.setMatrixAt(index, matrix);

    if (index % 4 === 0) {
      const light = new THREE.PointLight(coolWhite, 0.55, 9, 1.7);
      light.position.set(sample.base.x + lampOffset.x, 2.28, sample.base.z + lampOffset.z);
      group.add(light);
    }
  });

  [stemMesh, armMesh, lampMesh].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
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

  addVegasTunnel(propsGroup, curve, definition, 0.36, 0, 18, 0.009);
  addStripCasinoWalls(propsGroup, curve, definition);
  addDistributedCityBlocks(propsGroup, curve, definition);
  addVegasLandmarks(propsGroup, curve, definition);
  addVegasF1Venue(propsGroup, curve, definition);
  addVegasLightPosts(propsGroup, curve, definition);
  addNeonPalms(propsGroup, curve, definition);
  addCasinoDice(propsGroup, curve, definition);
  addLuxorPyramid(propsGroup, curve, definition);
  propsGroup.add(createVegasSign(curve, definition));
  disableDecorativeCastShadows(propsGroup);
  group.add(propsGroup);
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
