import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, getRightVector, optimizeStaticDecorativeProps, pseudoRandom } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples, createMonacoRibbonMesh, createMonacoVerticalRibbonMesh } from "./common.js";
import { MONACO_GROUND_Y, MONACO_ROAD_Y } from "./constants.js";

const UP = new THREE.Vector3(0, 1, 0);
const YACHT_VARIANTS = [
  { hull: 0xf8fafc, accent: 0x173b73, canvas: 0xffffff, length: 8.8, width: 2.35, cabin: 0.34 },
  { hull: 0x26354a, accent: 0xe8edf2, canvas: 0xd8e6ef, length: 10.4, width: 2.65, cabin: 0.38 },
  { hull: 0xf7f1e4, accent: 0x0f766e, canvas: 0xf3ead5, length: 8.2, width: 2.2, cabin: 0.3 },
  { hull: 0xe9eef4, accent: 0xb91c1c, canvas: 0xf9fafb, length: 11.6, width: 2.85, cabin: 0.4 }
];

const simpleYachtGeometries = {
  hull: createMonacoYachtHullGeometry(),
  cabin: createMonacoRoundedBoxGeometry(1, 1, 1, 0.16, 0.025),
  deck: new THREE.BoxGeometry(1, 1, 1),
  stripe: new THREE.BoxGeometry(1, 1, 1),
  glass: new THREE.BoxGeometry(1, 1, 1),
  rail: new THREE.CylinderGeometry(0.018, 0.018, 1, 8),
  radar: new THREE.CylinderGeometry(0.16, 0.16, 0.045, 16),
  mast: new THREE.CylinderGeometry(0.018, 0.018, 1, 6)
};

const simpleYachtMaterials = {
  hulls: YACHT_VARIANTS.map(({ hull }) => createFlatStandardMaterial({
    color: hull,
    roughness: 0.28,
    metalness: 0.08
  })),
  stripes: YACHT_VARIANTS.map(({ accent }) => createFlatStandardMaterial({
    color: accent,
    roughness: 0.36
  })),
  canvases: YACHT_VARIANTS.map(({ canvas }) => createFlatStandardMaterial({
    color: canvas,
    roughness: 0.72
  })),
  deck: createFlatStandardMaterial({ color: 0xc79b67, roughness: 0.64 }),
  glass: createFlatStandardMaterial({
    color: 0x0d2f4f,
    roughness: 0.08,
    metalness: 0.34,
    transparent: true,
    opacity: 0.68
  }),
  steel: createFlatStandardMaterial({ color: 0xc9d2d8, roughness: 0.24, metalness: 0.72 })
};

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

function createMonacoYachtHullGeometry() {
  const ringDefs = [
    { z: -0.5, halfWidth: 0.08, top: 0.34, chine: -0.1, keel: -0.34 },
    { z: -0.32, halfWidth: 0.42, top: 0.42, chine: -0.14, keel: -0.38 },
    { z: 0.05, halfWidth: 0.5, top: 0.44, chine: -0.16, keel: -0.42 },
    { z: 0.34, halfWidth: 0.36, top: 0.38, chine: -0.13, keel: -0.34 },
    { z: 0.5, halfWidth: 0.06, top: 0.25, chine: -0.08, keel: -0.22 }
  ];
  const vertices = [];
  const indices = [];

  ringDefs.forEach(({ z, halfWidth, top, chine, keel }) => {
    vertices.push(
      -halfWidth, top, z,
      halfWidth, top, z,
      -halfWidth * 0.82, chine, z,
      halfWidth * 0.82, chine, z,
      0, keel, z
    );
  });

  for (let ring = 0; ring < ringDefs.length - 1; ring += 1) {
    const current = ring * 5;
    const next = current + 5;
    indices.push(
      current, next, current + 1,
      current + 1, next, next + 1,
      current, current + 2, next,
      current + 2, next + 2, next,
      current + 1, next + 1, current + 3,
      current + 3, next + 1, next + 3,
      current + 2, current + 4, next + 2,
      current + 4, next + 4, next + 2,
      current + 4, current + 3, next + 4,
      current + 3, next + 3, next + 4
    );
  }

  indices.push(
    0, 1, 2,
    1, 3, 2,
    2, 3, 4
  );
  const last = (ringDefs.length - 1) * 5;
  indices.push(
    last, last + 2, last + 1,
    last + 1, last + 2, last + 3,
    last + 2, last + 4, last + 3
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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

function createSimpleYachtBatch() {
  return {
    hulls: YACHT_VARIANTS.map(() => []),
    cabins: YACHT_VARIANTS.map(() => []),
    decks: [],
    stripes: YACHT_VARIANTS.map(() => []),
    glass: [],
    rails: [],
    radars: [],
    canvases: YACHT_VARIANTS.map(() => []),
    masts: []
  };
}

function composeSimpleYachtMatrix(basePosition, heading, localPosition, localScale) {
  const baseRotation = new THREE.Quaternion().setFromAxisAngle(UP, heading);
  const rotatedLocal = localPosition.clone().applyQuaternion(baseRotation);
  const position = basePosition.clone().add(rotatedLocal);
  return new THREE.Matrix4().compose(position, baseRotation, localScale);
}

function getSimpleYachtDimensions(seed, scale, large = false) {
  const variant = seed % YACHT_VARIANTS.length;
  const config = YACHT_VARIANTS[variant];
  const yachtScale = scale * (large ? 1.05 : 1);
  return {
    variant,
    yachtScale,
    length: config.length * yachtScale,
    width: config.width * yachtScale,
    hullHeight: (0.86 + pseudoRandom(seed + 3) * 0.16) * yachtScale,
    cabinLength: config.length * yachtScale * config.cabin,
    cabinWidth: config.width * yachtScale * (0.48 + pseudoRandom(seed + 5) * 0.08),
    cabinHeight: (0.82 + pseudoRandom(seed + 6) * 0.2) * yachtScale
  };
}

function canPlaceYacht(placedYachts, position, length, width) {
  return placedYachts.every((placed) => {
    const distance = position.distanceTo(placed.position);
    const lateralClearance = Math.max(width, placed.width) * 1.55;
    const bowClearance = Math.min(length, placed.length) * 0.48;
    return distance > Math.max(lateralClearance, bowClearance);
  });
}

function addSimpleYachtToBatch(batch, position, heading, scale, seed, large = false) {
  const { variant, yachtScale, length, width, hullHeight, cabinLength, cabinWidth, cabinHeight } = getSimpleYachtDimensions(seed, scale, large);
  const basePosition = position.clone();
  basePosition.y += hullHeight * 0.5;

  batch.hulls[variant].push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(width, hullHeight, length)
  ));
  batch.decks.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.44, -length * 0.06),
    new THREE.Vector3(width * 0.68, 0.06 * yachtScale, length * 0.62)
  ));
  batch.cabins[variant].push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.58 + cabinHeight * 0.5, length * 0.04),
    new THREE.Vector3(cabinWidth, cabinHeight, cabinLength)
  ));
  batch.glass.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.67 + cabinHeight * 0.68, length * 0.04 + cabinLength * 0.5),
    new THREE.Vector3(cabinWidth * 0.82, cabinHeight * 0.25, 0.08 * yachtScale)
  ));

  [-1, 1].forEach((side) => {
    batch.stripes[variant].push(composeSimpleYachtMatrix(
      basePosition,
      heading,
      new THREE.Vector3(side * width * 0.43, hullHeight * 0.03, -length * 0.02),
      new THREE.Vector3(0.055 * yachtScale, 0.12 * yachtScale, length * 0.76)
    ));

    [-0.3, -0.05, 0.2, 0.42].forEach((zOffset) => {
      batch.rails.push(composeSimpleYachtMatrix(
        basePosition,
        heading,
        new THREE.Vector3(side * width * 0.39, hullHeight * 0.58, length * zOffset),
        new THREE.Vector3(yachtScale, 0.58 * yachtScale, yachtScale)
      ));
    });
  });

  batch.canvases[variant].push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.64 + cabinHeight + 0.16 * yachtScale, -length * 0.04),
    new THREE.Vector3(cabinWidth * 0.72, 0.1 * yachtScale, cabinLength * 0.58)
  ));

  batch.radars.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.72 + cabinHeight + 0.36 * yachtScale, length * 0.02),
    new THREE.Vector3(1.4 * yachtScale, yachtScale, 0.42 * yachtScale)
  ));

  batch.masts.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(width * 0.13, hullHeight * 0.62 + cabinHeight + 0.8 * yachtScale, -length * 0.12),
    new THREE.Vector3(yachtScale, 1.45 * yachtScale, yachtScale)
  ));
}

function addYachtBerth(
  batch,
  placedYachts,
  sample,
  section,
  quayFar,
  pierLength,
  tangent,
  outward,
  side,
  seed,
  {
    distanceRatio = 0.64,
    sideOffset = 5.1,
    scaleBase = 0.7,
    scaleVariance = 0.12
  } = {}
) {
  const berthDistance = quayFar + pierLength * distanceRatio;
  const berthSideOffset = side * sideOffset;
  const position = sample.center
    .clone()
    .addScaledVector(sample.right, section.side * berthDistance)
    .addScaledVector(tangent, berthSideOffset);

  position.y = MONACO_GROUND_Y + 0.02;
  const scale = scaleBase + pseudoRandom(seed + 17) * scaleVariance;
  const { length, width } = getSimpleYachtDimensions(seed, scale, false);
  if (!canPlaceYacht(placedYachts, position, length, width)) {
    return;
  }

  addSimpleYachtToBatch(
    batch,
    position,
    Math.atan2(outward.x, outward.z),
    scale,
    seed
  );
  placedYachts.push({ position: position.clone(), length, width });
}

function flushSimpleYachtBatch(group, batch) {
  batch.hulls.forEach((matrices, index) => {
    addMonacoInstancedPart(group, simpleYachtGeometries.hull, simpleYachtMaterials.hulls[index], matrices, `MonacoSimpleYachtHulls:${index}`);
  });
  addMonacoInstancedPart(group, simpleYachtGeometries.deck, simpleYachtMaterials.deck, batch.decks, "MonacoSimpleYachtDecks");
  batch.cabins.forEach((matrices, index) => {
    addMonacoInstancedPart(group, simpleYachtGeometries.cabin, simpleYachtMaterials.hulls[index], matrices, `MonacoSimpleYachtCabins:${index}`);
  });
  batch.stripes.forEach((matrices, index) => {
    addMonacoInstancedPart(group, simpleYachtGeometries.stripe, simpleYachtMaterials.stripes[index], matrices, `MonacoSimpleYachtStripes:${index}`);
  });
  addMonacoInstancedPart(group, simpleYachtGeometries.glass, simpleYachtMaterials.glass, batch.glass, "MonacoSimpleYachtGlass");
  addMonacoInstancedPart(group, simpleYachtGeometries.rail, simpleYachtMaterials.steel, batch.rails, "MonacoSimpleYachtRails");
  addMonacoInstancedPart(group, simpleYachtGeometries.radar, simpleYachtMaterials.steel, batch.radars, "MonacoSimpleYachtRadars");
  batch.canvases.forEach((matrices, index) => {
    addMonacoInstancedPart(group, simpleYachtGeometries.deck, simpleYachtMaterials.canvases[index], matrices, `MonacoSimpleYachtCanopies:${index}`);
  });
  addMonacoInstancedPart(group, simpleYachtGeometries.mast, simpleYachtMaterials.steel, batch.masts, "MonacoSimpleYachtMasts");
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
  const quayMat = createFlatStandardMaterial({ color: 0xd7d0c4, roughness: 0.78, metalness: 0.04 });
  const quayEdgeMat = createFlatStandardMaterial({ color: 0x8c8378, roughness: 0.86 });
  const pierMat = createFlatStandardMaterial({ color: 0xc5b59a, roughness: 0.68, metalness: 0.03 });
  const pierEdgeMat = createFlatStandardMaterial({ color: 0x756b5c, roughness: 0.78 });
  const bollardMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.48 });

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierClearance = (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5);
  const quayNear = roadHalfWidth + barrierClearance + 1.8;
  const quayFar = quayNear + 4.6;
  const waterFar = quayFar + 360;
  const quaySections = [
    { start: 0, end: 1, side: -1 }
  ];
  const marinaSections = [
    { start: 0.255, end: 0.475, side: -1 },
    { start: 0.53, end: 0.755, side: -1 },
    { start: 0.79, end: 0.975, side: -1 }
  ];
  const waterSections = [
    { start: 0, end: 1, side: -1 }
  ];
  const pierTopGeometry = new THREE.BoxGeometry(0.34, 0.09, 1);
  const pierSideGeometry = new THREE.BoxGeometry(0.08, 0.12, 1);
  const bollardGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10);
  const bollardMatrices = [];
  const yachtBatch = createSimpleYachtBatch();
  const placedYachts = [];
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
    const samples = collectMonacoSamples(curve, section.start, section.end, 12.5);
    samples.forEach((sample, sampleIndex) => {
      const tangent = sample.tangent.clone().setY(0).normalize();
      const outward = sample.right.clone().multiplyScalar(section.side).setY(0).normalize();
      const pierLength = 17.5 + (sampleIndex % 2) * 1.8;
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

      [-1, 1].forEach((berthSide) => {
        if ((sampleIndex + sectionIndex + berthSide) % 6 === 0) {
          return;
        }

        addYachtBerth(
          yachtBatch,
          placedYachts,
          sample,
          section,
          quayFar,
          pierLength,
          tangent,
          outward,
          berthSide,
          sectionIndex * 1000 + sampleIndex * 59 + (berthSide > 0 ? 17 : 5),
          {
            distanceRatio: 0.68 + ((sampleIndex + sectionIndex) % 3) * 0.08,
            sideOffset: 3.25,
            scaleBase: 0.82 + ((sampleIndex + sectionIndex) % 3) * 0.04,
            scaleVariance: 0.1
          }
        );
      });
    });
  });

  addMonacoInstancedPart(portGroup, bollardGeometry, bollardMat, bollardMatrices, "MonacoHarborBollards");
  flushSimpleYachtBatch(portGroup, yachtBatch);
  optimizeStaticDecorativeProps(portGroup, ["MonacoContinuousSea", "MonacoHarborQuay"]);
  group.add(portGroup);
}
