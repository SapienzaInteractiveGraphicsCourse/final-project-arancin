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
  const columns = Math.min(face === "front" ? 3 : 2, Math.max(2, Math.floor(block.width / 1.1)));
  const rows = Math.min(face === "front" ? 5 : 4, Math.max(3, Math.floor(block.height / 1.25)));
  const windowWidth = face === "front" ? Math.min(0.42, block.width / (columns * 1.7)) : 0.035;
  const windowDepth = face === "front" ? 0.035 : Math.min(0.36, block.depth / (columns * 1.7));
  const windowHeight = 0.18;
  const xStep = block.width / (columns + 1);
  const zStep = block.depth / (columns + 1);
  const yStep = block.height / (rows + 1);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const noise = pseudoRandom(seed + row * 9.7 + column * 3.1 + (face === "front" ? 0 : 17));
      const lit = noise > 0.34;
      const color = neonColors[Math.floor(noise * neonColors.length) % neonColors.length];
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth),
        createWindowMaterial(color, lit)
      );

      if (face === "front") {
        window.position.set(
          block.x + (column + 1) * xStep - block.width * 0.5,
          block.y - block.height * 0.5 + (row + 1) * yStep,
          block.z + block.depth * 0.5 + 0.028
        );
      } else {
        window.position.set(
          block.x + block.width * 0.5 + 0.028,
          block.y - block.height * 0.5 + (row + 1) * yStep,
          block.z + (column + 1) * zStep - block.depth * 0.5
        );
      }

      window.receiveShadow = true;
      group.add(window);
    }
  }
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

    addWindowGrid(group, block, neonColors, index * 31 + blockIndex * 7, "front");
    if (blockIndex < 2) {
      addWindowGrid(group, block, neonColors, index * 43 + blockIndex * 11, "side");
    }
  });

  addVerticalEdgeHighlights(group, blocks[1], edgeMaterial);
  addRoofDetail(group, height * 1.04, width, depth, neonColor, index);

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

  for (let index = 0; index < 10; index += 1) {
    const progress = (index + 0.35) / 10;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const heading = getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const clusterOffsets = [
      { along: 0, outward: 19, height: 10.5, scale: 1 },
      { along: -4.2, outward: 23.5, height: 7.2, scale: 0.72 },
      { along: 4.6, outward: 26.5, height: 8.4, scale: 0.8 }
    ];

    clusterOffsets.forEach((offset, clusterIndex) => {
      const buildingIndex = index * 3 + clusterIndex;
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

    if (segment % 3 === 0) {
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
  const progressPoints = [0.08, 0.22, 0.36, 0.52, 0.68, 0.82];

  progressPoints.forEach((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const position = point.clone().addScaledVector(normal, side * (definition.roadWidth * 0.5 + 5.4));
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

function addVegasLightPosts(group, curve, definition) {
  const colors = definition.palette.neon;

  for (let index = 0; index < 16; index += 1) {
    const progress = index / 16;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const color = colors[index % colors.length];
    const pole = new THREE.Group();
    pole.position.copy(point).addScaledVector(normal, side * (definition.roadWidth * 0.5 + 2.2));

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 2.3, 6),
      createFlatStandardMaterial({
        color: 0x8b96a6,
        roughness: 0.48,
        metalness: 0.3
      })
    );
    stem.position.y = 1.15;

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.24, 0.36),
      createFlatStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 3.2,
        roughness: 0.2,
        metalness: 0.08
      })
    );
    lamp.position.y = 2.35;

    stem.castShadow = true;
    stem.receiveShadow = true;
    lamp.castShadow = true;
    lamp.receiveShadow = true;

    const light = new THREE.PointLight(color, 0.72, 10, 1.75);
    light.position.y = 2.35;
    pole.add(stem, lamp, light);
    group.add(pole);
  }
}

function addVegasProps(group, curve, definition) {
  addVegasBuildings(group, curve, definition);
  addVegasTunnel(group, curve, definition, 0.01, 0, 20, 0.0075);
  addVegasBillboards(group, curve, definition);
  addVegasLightPosts(group, curve, definition);
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
