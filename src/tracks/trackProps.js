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

function markShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWindowMaterial(color, lit) {
  return createFlatStandardMaterial({
    color: lit ? color : 0x070811,
    emissive: lit ? color : 0x000000,
    emissiveIntensity: lit ? 2.4 : 0,
    roughness: lit ? 0.22 : 0.7,
    metalness: lit ? 0.04 : 0.02
  });
}

function addWindowGrid(group, block, neonColors, seed, face) {
  const columns = face === "front" ? 3 : 2;
  const rows = face === "front" ? 4 : 3;
  const windowWidth = face === "front" ? Math.min(0.42, block.width / (columns * 1.7)) : 0.035;
  const windowDepth = face === "front" ? 0.035 : Math.min(0.36, block.depth / (columns * 1.7));
  const windowHeight = 0.18;
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
      const lit = noise > 0.34;
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
  const edgeGeometry = new THREE.BoxGeometry(0.055, block.height, 0.055);
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
    emissiveIntensity: 3.4,
    roughness: 0.14,
    metalness: 0.04
  });
  const frameMaterial = createFlatStandardMaterial({
    color: 0x080912,
    roughness: 0.36,
    metalness: 0.26
  });
  const frame = new THREE.Group();
  const screenWidth = side === "front" ? block.width * 0.58 : 0.08;
  const screenDepth = side === "front" ? 0.08 : block.depth * 0.58;
  const screenHeight = Math.min(block.height * 0.34, 1.9);
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
    roughness: 0.28,
    metalness: 0.34
  });

  const edgeMaterial = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 3,
    roughness: 0.2,
    metalness: 0.08
  });

  const baseHeight = height * 0.32;
  const towerHeight = height * 0.52;
  const crownHeight = height * 0.2;
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
      width: width * 0.72,
      height: towerHeight,
      depth: depth * 0.82
    },
    {
      x: (index % 2 === 0 ? -1 : 1) * width * 0.08,
      y: baseHeight + towerHeight + crownHeight * 0.5,
      z: 0,
      width: width * 0.46,
      height: crownHeight,
      depth: depth * 0.56
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

function addVegasBuildings(group, curve, definition) {
  const colors = definition.palette.neon;
  const bodyColors = [0x1b2132, 0x242033, 0x172937, 0x29253b];

  for (let index = 0; index < 18; index += 1) {
    const progress = (index + 0.35) / 18;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const heading = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const clusterOffsets = [
      { along: 0, outward: 7.2, height: 11.2, scale: 1 },
      { along: -4.4, outward: 10.2, height: 8.4, scale: 0.78 },
      { along: 4.8, outward: 13.2, height: 9.4, scale: 0.86 },
      { along: 8.8, outward: 16.4, height: 7.6, scale: 0.68 }
    ];

    clusterOffsets.forEach((offset, clusterIndex) => {
      const buildingIndex = index * clusterOffsets.length + clusterIndex;
      const position = point
        .clone()
        .addScaledVector(normal, side * (definition.roadWidth * 0.5 + offset.outward))
        .addScaledVector(tangent, offset.along);
      const building = createVegasBuilding({
        position,
        rotationY: heading + (clusterIndex - 1) * 0.06,
        height: offset.height + (index % 4) * 1.45,
        width: (4.2 + (index % 3) * 0.8) * offset.scale,
        depth: (3.6 + (index % 2) * 0.85) * offset.scale,
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
  billboard.rotation.y = rotationY + Math.PI;

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
      rotationY: getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
      color: colors[index % colors.length],
      arrowColor: arrowColors[index % arrowColors.length],
      index
    });

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
    color: 0x141018,
    roughness: 0.62,
    metalness: 0.08
  });
  const leafMaterial = createFlatStandardMaterial({
    color: 0x0f241f,
    emissive: color,
    emissiveIntensity: 1.9,
    roughness: 0.38
  });
  const ringMaterial = createFlatStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.8,
    roughness: 0.24
  });
  const trunk = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.5, 6), trunkMaterial));
  trunk.position.y = 1.25;
  trunk.rotation.z = 0.12;
  palm.add(trunk);

  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 4, 12), ringMaterial);
    ring.position.y = 0.55 + index * 0.48;
    ring.rotation.x = Math.PI / 2;
    palm.add(ring);
  }

  for (let index = 0; index < 5; index += 1) {
    const leaf = markShadow(new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.25, 4), leafMaterial));
    leaf.position.y = 2.65;
    leaf.rotation.z = Math.PI / 2;
    leaf.rotation.y = (index / 5) * Math.PI * 2;
    leaf.position.x = Math.cos(leaf.rotation.y) * 0.36;
    leaf.position.z = Math.sin(leaf.rotation.y) * 0.36;
    palm.add(leaf);
  }

  return palm;
}

function addNeonPalms(group, curve, definition) {
  const colors = [0x48ff78, 0x32f6ff];
  const progressPoints = [0.13, 0.18, 0.33, 0.39, 0.57, 0.7, 0.86, 0.94];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const basePosition = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 8.2));

    for (let palmIndex = 0; palmIndex < 3; palmIndex += 1) {
      const offset = tangent.clone().multiplyScalar((palmIndex - 1) * 1.7);
      const palm = createNeonPalm({
        position: basePosition.clone().add(offset).addScaledVector(normal, side * palmIndex * 0.7),
        rotationY: getHeading(tangent) + pseudoRandom(index + palmIndex) * 0.8,
        scale: 0.75 + pseudoRandom(index * 3 + palmIndex) * 0.35,
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

function addCasinoDice(group) {
  [
    { position: new THREE.Vector3(-118, 0, 72), rotationY: 0.6, scale: 1.5, color: 0xff2bd6 },
    { position: new THREE.Vector3(138, 0, 38), rotationY: -0.4, scale: 1.25, color: 0x32f6ff },
    { position: new THREE.Vector3(-18, 0, 144), rotationY: 0.25, scale: 1.15, color: 0xffd23a }
  ].forEach((die) => group.add(createHologramDie(die)));
}

function addLuxorPyramid(group) {
  const pyramid = new THREE.Group();
  pyramid.name = "VegasLuxorPyramid";
  pyramid.position.set(116, 0, 142);
  pyramid.rotation.y = Math.PI / 4;

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

  const body = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0, 24, 24, 4), pyramidMaterial));
  body.position.y = 12;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.6, 230, 8, 1, true), beamMaterial);
  beam.position.y = 128;
  pyramid.add(body, beam);
  group.add(pyramid);
}

function addWelcomeSign(group, curve, definition) {
  const progress = 0.025;
  const point = curve.getPointAt(progress);
  const tangent = curve.getTangentAt(progress).setY(0).normalize();
  const heading = getHeading(tangent);
  const sign = new THREE.Group();
  sign.name = "VegasWelcomeSign";
  sign.position.copy(point);
  sign.rotation.y = heading + Math.PI;

  const cyan = 0x32f6ff;
  const pink = 0xff2bd6;
  const metalMaterial = createFlatStandardMaterial({
    color: 0x151820,
    roughness: 0.44,
    metalness: 0.36
  });
  const panelMaterial = createFlatStandardMaterial({
    color: pink,
    emissive: pink,
    emissiveIntensity: 3.1,
    roughness: 0.18,
    metalness: 0.04
  });
  const trimMaterial = createFlatStandardMaterial({
    color: cyan,
    emissive: cyan,
    emissiveIntensity: 3,
    roughness: 0.2
  });
  const span = definition.roadWidth + 4.5;
  const left = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.1, 6), metalMaterial));
  const right = left.clone();
  const top = markShadow(new THREE.Mesh(new THREE.BoxGeometry(span, 0.24, 0.22), trimMaterial));
  const panel = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), panelMaterial);

  left.position.set(-span * 0.5, 2.05, 0);
  right.position.set(span * 0.5, 2.05, 0);
  top.position.set(0, 4.1, 0);
  panel.scale.set(1.55, 0.72, 0.12);
  panel.position.set(0, 3.72, 0.24);
  sign.add(left, right, top, panel);
  group.add(sign);
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

function addVegasProps(group, curve, definition) {
  addVegasBuildings(group, curve, definition);
  addVegasTunnel(group, curve, definition, 0.02, 0, 10, 0.014);
  addVegasBillboards(group, curve, definition);
  addVegasLightPosts(group, curve, definition);
  addNeonPalms(group, curve, definition);
  addCasinoDice(group);
  addLuxorPyramid(group);
  addWelcomeSign(group, curve, definition);
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
