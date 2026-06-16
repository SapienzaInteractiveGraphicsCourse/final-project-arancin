import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, getRightVector, optimizeStaticDecorativeProps, pseudoRandom } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples, createMonacoRibbonMesh, createMonacoVerticalRibbonMesh } from "./common.js";
import { MONACO_GROUND_Y, MONACO_ROAD_Y } from "./constants.js";

const UP = new THREE.Vector3(0, 1, 0);
const SIMPLE_YACHT_PALETTE = [
  { hull: 0xffffff, stripe: 0x173b73, canvas: 0xf8fafc },
  { hull: 0xf6f9fb, stripe: 0x111827, canvas: 0xe7edf2 },
  { hull: 0xe9eff4, stripe: 0xb91c1c, canvas: 0xffffff },
  { hull: 0xfdfaf3, stripe: 0x0f766e, canvas: 0xf3ead5 },
  { hull: 0x121a24, stripe: 0xf4f7fb, canvas: 0xf8fafc },
  { hull: 0xf7f3e8, stripe: 0x244f86, canvas: 0xdfe9ef },
  { hull: 0xfafafa, stripe: 0x9a3412, canvas: 0xf4efe5 },
  { hull: 0xdfe7ef, stripe: 0x1f2937, canvas: 0xf8fafc }
];

const simpleYachtGeometries = {
  hull: new THREE.BoxGeometry(1, 1, 1),
  cabin: createMonacoRoundedBoxGeometry(1, 1, 1, 0.08, 0.018),
  deck: new THREE.BoxGeometry(1, 1, 1),
  stripe: new THREE.BoxGeometry(1, 1, 1),
  glass: new THREE.BoxGeometry(1, 1, 1),
  mast: new THREE.CylinderGeometry(0.018, 0.018, 1, 6)
};

const simpleYachtMaterials = {
  hulls: SIMPLE_YACHT_PALETTE.map(({ hull }) => createFlatStandardMaterial({
    color: hull,
    roughness: 0.28,
    metalness: 0.08
  })),
  stripes: SIMPLE_YACHT_PALETTE.map(({ stripe }) => createFlatStandardMaterial({
    color: stripe,
    roughness: 0.36
  })),
  canvases: SIMPLE_YACHT_PALETTE.map(({ canvas }) => createFlatStandardMaterial({
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

function createSimpleYachtBatch() {
  return {
    hulls: SIMPLE_YACHT_PALETTE.map(() => []),
    cabins: SIMPLE_YACHT_PALETTE.map(() => []),
    decks: [],
    stripes: SIMPLE_YACHT_PALETTE.map(() => []),
    glass: [],
    canvases: SIMPLE_YACHT_PALETTE.map(() => []),
    masts: []
  };
}

function composeSimpleYachtMatrix(basePosition, heading, localPosition, localScale) {
  const baseRotation = new THREE.Quaternion().setFromAxisAngle(UP, heading);
  const rotatedLocal = localPosition.clone().applyQuaternion(baseRotation);
  const position = basePosition.clone().add(rotatedLocal);
  return new THREE.Matrix4().compose(position, baseRotation, localScale);
}

function addSimpleYachtToBatch(batch, position, heading, scale, seed, large = false) {
  const variant = seed % SIMPLE_YACHT_PALETTE.length;
  const length = (large ? 15.5 : 9.8 + pseudoRandom(seed + 1) * 3.4) * scale;
  const width = (large ? 3.8 : 2.4 + pseudoRandom(seed + 2) * 1.0) * scale;
  const hullHeight = (large ? 0.95 : 0.66 + pseudoRandom(seed + 3) * 0.22) * scale;
  const cabinLength = length * (large ? 0.36 : 0.28 + pseudoRandom(seed + 4) * 0.12);
  const cabinWidth = width * (large ? 0.62 : 0.5 + pseudoRandom(seed + 5) * 0.14);
  const cabinHeight = (large ? 0.78 : 0.52 + pseudoRandom(seed + 6) * 0.22) * scale;
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
    new THREE.Vector3(0, hullHeight * 0.55, -length * 0.08),
    new THREE.Vector3(width * 0.72, 0.045 * scale, length * 0.52)
  ));
  batch.cabins[variant].push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.8 + cabinHeight * 0.5, length * 0.04),
    new THREE.Vector3(cabinWidth, cabinHeight, cabinLength)
  ));
  batch.glass.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(0, hullHeight * 0.92 + cabinHeight * 0.72, length * 0.04 + cabinLength * 0.5),
    new THREE.Vector3(cabinWidth * 0.86, cabinHeight * 0.28, 0.06 * scale)
  ));

  [-1, 1].forEach((side) => {
    batch.stripes[variant].push(composeSimpleYachtMatrix(
      basePosition,
      heading,
      new THREE.Vector3(side * width * 0.51, hullHeight * 0.08, -length * 0.04),
      new THREE.Vector3(0.04 * scale, 0.08 * scale, length * 0.72)
    ));
  });

  if (large || variant % 2 === 0) {
    batch.canvases[variant].push(composeSimpleYachtMatrix(
      basePosition,
      heading,
      new THREE.Vector3(0, hullHeight * 0.98 + cabinHeight + 0.16 * scale, -length * 0.08),
      new THREE.Vector3(cabinWidth * 0.78, 0.09 * scale, cabinLength * 0.62)
    ));
  }

  batch.masts.push(composeSimpleYachtMatrix(
    basePosition,
    heading,
    new THREE.Vector3(width * 0.12, hullHeight + cabinHeight + 0.66 * scale, -length * 0.12),
    new THREE.Vector3(scale, 1.1 * scale, scale)
  ));
}

function addYachtBerth(
  batch,
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
  addSimpleYachtToBatch(
    batch,
    position,
    Math.atan2(outward.x, outward.z),
    scaleBase + pseudoRandom(seed + 17) * scaleVariance,
    seed
  );
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
    { start: 0.055, end: 0.17, side: -1 },
    { start: 0.315, end: 0.405, side: -1 },
    { start: 0.61, end: 0.685, side: -1 },
    { start: 0.865, end: 0.935, side: -1 }
  ];
  const waterSections = [
    { start: 0, end: 1, side: -1 }
  ];
  const pierTopGeometry = new THREE.BoxGeometry(0.34, 0.09, 1);
  const pierSideGeometry = new THREE.BoxGeometry(0.08, 0.12, 1);
  const bollardGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10);
  const bollardMatrices = [];
  const yachtBatch = createSimpleYachtBatch();
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
    const samples = collectMonacoSamples(curve, section.start, section.end, 34);
    samples.forEach((sample, sampleIndex) => {
      const tangent = sample.tangent.clone().setY(0).normalize();
      const outward = sample.right.clone().multiplyScalar(section.side).setY(0).normalize();
      const pierLength = 18 + (sampleIndex % 2) * 3.4;
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

      const berthSide = (sampleIndex + sectionIndex) % 2 === 0 ? -1 : 1;
      addYachtBerth(
        yachtBatch,
        sample,
        section,
        quayFar,
        pierLength,
        tangent,
        outward,
        berthSide,
        sectionIndex * 1000 + sampleIndex * 23 + 3
      );
    });
  });

  addMonacoInstancedPart(portGroup, bollardGeometry, bollardMat, bollardMatrices, "MonacoHarborBollards");
  flushSimpleYachtBatch(portGroup, yachtBatch);
  optimizeStaticDecorativeProps(portGroup, ["MonacoContinuousSea", "MonacoHarborQuay"]);
  group.add(portGroup);
}
