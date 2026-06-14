import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, getRightVector, optimizeStaticDecorativeProps, pseudoRandom, UP } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples, createMonacoRibbonMesh, createMonacoVerticalRibbonMesh } from "./common.js";
import { MONACO_GROUND_Y, MONACO_ROAD_Y } from "./constants.js";

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

export function addMonacoOuterPort(group, curve, definition) {
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
  const quaySections = [
    { start: 0, end: 1, side: -1 }
  ];
  const marinaSections = [
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

  quaySections.forEach((section, sectionIndex) => {
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
  });

  marinaSections.forEach((section, sectionIndex) => {
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
