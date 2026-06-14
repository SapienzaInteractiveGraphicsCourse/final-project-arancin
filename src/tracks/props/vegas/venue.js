import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { addInstancedPart } from "../common/instancing.js";
import {
  clampPropPosition,
  getHeading,
  getRightVector,
  markShadow,
  pseudoRandom
} from "../shared.js";

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
  addInstancedPart(stand, geometry, material, matrices, `VegasGrandstandSpectator${name}`, {
    receiveShadow: false
  });
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

export function addVegasF1Venue(group, curve, definition) {
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

