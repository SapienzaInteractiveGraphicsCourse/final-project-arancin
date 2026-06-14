import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { isNearGrandstand } from "./billboards.js";
import { addDecorativePointLight } from "./lights.js";
import {
  clampPropPosition,
  getHeading,
  getRightVector,
  markShadow,
  pseudoRandom
} from "../shared.js";

export function addVegasTunnel(group, curve, definition, baseProgress, tunnelIndex, archCount = 18, progressStep = 0.008) {
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
      addDecorativePointLight(arch, color, 1.25, 17, 1.7, new THREE.Vector3(0, 2.7, 0));
    }

    tunnel.add(arch);
  }

  group.add(tunnel);
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

export function addNeonPalms(group, curve, definition) {
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

export function addCasinoDice(group, curve, definition) {
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
