import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, optimizeStaticDecorativeProps, pseudoRandom } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples } from "./common.js";
import { MONACO_GROUND_Y } from "./constants.js";

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
  const awningMat = createFlatStandardMaterial({ color: [0xb91c1c, 0x0f4c81, 0xf4f1e7][seed % 3], roughness: 0.72 });
  const terraceMat = createFlatStandardMaterial({ color: 0xe8dfce, roughness: 0.78 });

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
  const awningGeo = new THREE.BoxGeometry(1.02, 0.09, 0.34);
  const windowMatrices = [];
  const balconyMatrices = [];
  const railMatrices = [];
  const awningMatrices = [];
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
      if ((seed + row + column) % 5 === 0) {
        matrix.makeTranslation(x, y + 0.62, depth * 0.5 + 0.23);
        awningMatrices.push(matrix.clone());
      }
    }
  }

  addMonacoInstancedPart(building, windowGeo, glassMat, windowMatrices, "MonacoPalaceWindows");
  addMonacoInstancedPart(building, balconyGeo, balconyMat, balconyMatrices, "MonacoPalaceBalconies");
  addMonacoInstancedPart(building, balconyRailGeo, balconyMat, railMatrices, "MonacoPalaceBalconyRails");
  addMonacoInstancedPart(building, awningGeo, awningMat, awningMatrices, "MonacoPalaceAwnings");

  if (seed % 3 !== 1) {
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(width * 0.52, 0.18, depth * 0.36), terraceMat);
    terrace.position.set((pseudoRandom(seed + 21) - 0.5) * width * 0.22, height + 0.72, depth * 0.16);
    terrace.receiveShadow = true;
    building.add(terrace);

    const terraceRail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.52, 0.4, 0.06), balconyMat);
    terraceRail.position.set(terrace.position.x, height + 0.98, depth * 0.35);
    terraceRail.receiveShadow = true;
    building.add(terraceRail);
  }

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

export function addMonacoHillsideBuildings(group, curve, definition) {
  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = "MonacoInnerTerracedBackdrop";
  const treesGroup = new THREE.Group();
  treesGroup.name = "MonacoInnerMediterraneanTrees";
  const grandstandSections = [
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
  const trackClearanceForBuildings = roadHalfWidth + barrierClearance + 14.7;
  const centerlineSamples = Array.from({ length: 240 }, (_, index) => curve.getPointAt(index / 240));
  const occupiedBuildingSpots = [];
  const occupiedTreeSpots = [];
  let seed = 0;
  let treeSeed = 0;

  const getTrackDistance = (position) => centerlineSamples.reduce((closest, point) => {
    const distance = Math.hypot(position.x - point.x, position.z - point.z);
    return Math.min(closest, distance);
  }, Infinity);

  const isSeparatedFrom = (position, radius, occupiedSpots, clearance) => occupiedSpots.every((spot) => (
    Math.hypot(position.x - spot.position.x, position.z - spot.position.z) > radius + spot.radius + clearance
  ));

  grandstandSections.forEach((section, sectionIndex) => {
    const treeSamples = collectMonacoSamples(curve, section.start, section.end, 5.2);
    treeSamples.forEach((sample, sampleIndex) => {
      const isCentralBuildableZone = sectionIndex === 1 || sectionIndex === 2;
      if (sampleIndex % 4 === 1 || sampleIndex % 6 === 4 || (isCentralBuildableZone && sampleIndex % 3 !== 0)) {
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
      occupiedTreeSpots.push({ position: position.clone(), radius: 2.8 * tree.scale.x });
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
    samples.forEach((sample, sampleIndex) => {
      if (sampleIndex % 2 === 1) {
        return;
      }
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
      occupiedTreeSpots.push({ position: position.clone(), radius: 3 * tree.scale.x });
      treeSeed += 1;
    });
  });

  const buildingSections = [
    { start: 0.04, end: 0.22, side: 1 },
    { start: 0.235, end: 0.29, side: 1 },
    { start: 0.30, end: 0.46, side: 1 },
    { start: 0.475, end: 0.55, side: 1 },
    { start: 0.56, end: 0.70, side: 1 },
    { start: 0.715, end: 0.77, side: 1 },
    { start: 0.78, end: 0.94, side: 1 }
  ];

  buildingSections.forEach((section) => {
    const buildingSamples = collectMonacoSamples(curve, section.start, section.end, 7);
    buildingSamples.forEach((sample, sampleIndex) => {
      const width = 6.8 + pseudoRandom(seed + 1) * 4.4;
      const depth = 4.7 + pseudoRandom(seed + 2) * 2.3;
      const height = 12.5 + pseudoRandom(seed + 3) * 13.5 + (sampleIndex % 3) * 1.7;
      const radius = width * 0.32;
      const offsetCandidates = [
        buildingOffset,
        buildingOffset - 2.8,
        buildingOffset + 2.8,
        buildingOffset - 5.1,
        buildingOffset + 4.8,
        buildingOffset - 6.4,
        buildingOffset + 6.2
      ];
      const position = offsetCandidates
        .map((offset) => sample.center
          .clone()
          .addScaledVector(sample.right, section.side * offset)
          .addScaledVector(sample.tangent, (pseudoRandom(seed + 9) - 0.5) * 0.75))
        .find((candidate) => (
          getTrackDistance(candidate) >= trackClearanceForBuildings &&
          isSeparatedFrom(candidate, radius, occupiedBuildingSpots, 0.35) &&
          isSeparatedFrom(candidate, depth * 0.5 + 0.8, occupiedTreeSpots, 0.35)
        ));

      if (!position) {
        seed += 1;
        return;
      }

      const building = createMonacoPalaceBuilding(seed, { width, depth, height });
      building.position.copy(position);
      building.position.y = MONACO_GROUND_Y + (sampleIndex % 2) * 0.18;
      building.rotation.y = getHeading(sample.tangent) + (section.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      building.scale.set(0.92 + pseudoRandom(seed + 12) * 0.12, 1, 0.9 + pseudoRandom(seed + 13) * 0.12);
      buildingsGroup.add(building);
      occupiedBuildingSpots.push({ position: position.clone(), radius });
      seed += 1;
    });
  });

  optimizeStaticDecorativeProps(buildingsGroup, []);
  optimizeStaticDecorativeProps(treesGroup, []);
  group.add(treesGroup);
  group.add(buildingsGroup);
}
