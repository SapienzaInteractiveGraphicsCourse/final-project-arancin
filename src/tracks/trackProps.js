import * as THREE from "three";
import { createFlatStandardMaterial } from "./trackMaterials.js";

function getRightVector(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
}

function getHeading(tangent) {
  return Math.atan2(tangent.x, tangent.z);
}

function createVegasBuilding({ position, rotationY, height, width, depth, color, neonColor }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotationY;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    createFlatStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.08
    })
  );
  body.position.y = height * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const panelMaterial = createFlatStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 1.7,
    roughness: 0.3
  });

  for (let row = 0; row < 4; row += 1) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, 0.22, 0.08), panelMaterial);
    panel.position.set(0, height * (0.28 + row * 0.15), depth * 0.5 + 0.05);
    group.add(panel);
  }

  return group;
}

function addVegasBuildings(group, curve, definition) {
  const colors = definition.palette.neon;
  const bodyColors = [0x1b2132, 0x242033, 0x172937, 0x29253b];

  for (let index = 0; index < 14; index += 1) {
    const progress = (index + 0.35) / 14;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);
    const side = index % 2 === 0 ? 1 : -1;
    const distance = definition.roadWidth * 0.5 + 18 + (index % 3) * 4;
    const position = point.clone().addScaledVector(normal, side * distance);
    const building = createVegasBuilding({
      position,
      rotationY: getHeading(tangent) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
      height: 5.5 + (index % 4) * 1.5,
      width: 3.8 + (index % 3) * 0.7,
      depth: 3.2 + (index % 2) * 0.8,
      color: bodyColors[index % bodyColors.length],
      neonColor: colors[index % colors.length]
    });

    group.add(building);
  }
}

function addVegasTunnel(group, curve, definition, baseProgress, tunnelIndex) {
  const colors = definition.palette.neon;
  const tunnel = new THREE.Group();
  tunnel.name = `${definition.name}:NeonTunnel:${tunnelIndex}`;

  for (let segment = 0; segment < 8; segment += 1) {
    const progress = (baseProgress + segment * 0.006) % 1;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const color = colors[(segment + tunnelIndex) % colors.length];
    const material = createFlatStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.1,
      roughness: 0.22
    });
    const arch = new THREE.Group();
    arch.position.copy(point);
    arch.rotation.y = getHeading(tangent);

    const span = definition.roadWidth + 2.2;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.3), material);
    left.position.set(-span * 0.5, 1.6, 0);
    const right = left.clone();
    right.position.x = span * 0.5;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(span, 0.22, 0.3), material);
    roof.position.set(0, 3.2, 0);
    arch.add(left, right, roof);

    if (segment % 2 === 0) {
      const light = new THREE.PointLight(color, 0.65, 11, 1.8);
      light.position.set(0, 2.4, 0);
      arch.add(light);
    }

    tunnel.add(arch);
  }

  group.add(tunnel);
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
        emissiveIntensity: 2.2,
        roughness: 0.26
      })
    );
    lamp.position.y = 2.35;

    const light = new THREE.PointLight(color, 0.4, 8, 1.9);
    light.position.y = 2.35;
    pole.add(stem, lamp, light);
    group.add(pole);
  }
}

function addVegasProps(group, curve, definition) {
  addVegasBuildings(group, curve, definition);
  addVegasTunnel(group, curve, definition, 0.18, 0);
  addVegasTunnel(group, curve, definition, 0.62, 1);
  addVegasLightPosts(group, curve, definition);
}

export function addTrackProps(group, curve, definition) {
  if (definition.id === "vegas") {
    addVegasProps(group, curve, definition);
  }
}
