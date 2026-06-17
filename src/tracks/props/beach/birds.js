import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";

const seagullMaterials = {
  body: new THREE.MeshStandardMaterial({
    color: 0xf5f1e6,
    emissive: 0xfff6dd,
    emissiveIntensity: 0.08,
    roughness: 0.56,
    metalness: 0,
    flatShading: true
  }),
  belly: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.06,
    roughness: 0.6,
    metalness: 0,
    flatShading: true
  }),
  wing: new THREE.MeshStandardMaterial({
    color: 0xd9dde3,
    emissive: 0xf4f6f8,
    emissiveIntensity: 0.05,
    roughness: 0.62,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide
  }),
  tip: new THREE.MeshStandardMaterial({
    color: 0x161d27,
    emissive: 0x161d27,
    emissiveIntensity: 0.04,
    roughness: 0.78,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide
  }),
  beak: new THREE.MeshStandardMaterial({
    color: 0xf5b642,
    emissive: 0xf5b642,
    emissiveIntensity: 0.08,
    roughness: 0.64,
    metalness: 0,
    flatShading: true
  }),
  eye: new THREE.MeshStandardMaterial({
    color: 0x101318,
    roughness: 0.5,
    metalness: 0,
    flatShading: true
  })
};

const seagullGeometries = {
  body: new THREE.CapsuleGeometry(0.17, 0.52, 4, 8),
  belly: new THREE.SphereGeometry(0.16, 8, 6),
  head: new THREE.SphereGeometry(0.13, 10, 7),
  beak: new THREE.ConeGeometry(0.045, 0.2, 6),
  eye: new THREE.SphereGeometry(0.018, 6, 4),
  tail: createTriangleGeometry([
    0, 0.02, -0.36,
    -0.16, 0, -0.64,
    0.16, 0, -0.64
  ]),
  innerWingLeft: createTriangleGeometry([
    0, 0, 0,
    -0.64, 0.025, 0.04,
    -0.34, -0.018, -0.22
  ]),
  outerWingLeft: createTriangleGeometry([
    -0.58, 0.018, 0.02,
    -1.16, 0.01, -0.08,
    -0.43, -0.025, -0.27
  ]),
  innerWingRight: createTriangleGeometry([
    0, 0, 0,
    0.64, 0.025, 0.04,
    0.34, -0.018, -0.22
  ]),
  outerWingRight: createTriangleGeometry([
    0.58, 0.018, 0.02,
    1.16, 0.01, -0.08,
    0.43, -0.025, -0.27
  ]),
  wingTip: new THREE.BoxGeometry(0.24, 0.018, 0.06)
};

function createTriangleGeometry(vertices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

function createWing(side) {
  const wing = new THREE.Group();
  wing.name = side < 0 ? "SeagullLeftWing" : "SeagullRightWing";
  wing.position.set(side * 0.13, 0.02, 0.04);
  wing.userData.dynamic = true;

  const inner = markShadow(new THREE.Mesh(
    side < 0 ? seagullGeometries.innerWingLeft : seagullGeometries.innerWingRight,
    seagullMaterials.wing
  ));
  inner.name = `${wing.name}:InnerFeather`;

  const outer = markShadow(new THREE.Mesh(
    side < 0 ? seagullGeometries.outerWingLeft : seagullGeometries.outerWingRight,
    seagullMaterials.wing
  ));
  outer.name = `${wing.name}:OuterFeather`;

  const tip = markShadow(new THREE.Mesh(
    seagullGeometries.wingTip,
    seagullMaterials.tip
  ));
  tip.name = `${wing.name}:BlackTip`;
  tip.position.set(side * 1.08, 0.012, -0.08);
  tip.rotation.y = side * 0.2;

  wing.add(inner, outer, tip);
  return wing;
}

function createSeagull(seed = 0) {
  const gull = new THREE.Group();
  gull.name = `TropicalBeachSeagull:${seed}`;

  const body = markShadow(new THREE.Mesh(seagullGeometries.body, seagullMaterials.body));
  body.name = "SeagullBody";
  body.rotation.x = Math.PI / 2;
  gull.add(body);

  const belly = markShadow(new THREE.Mesh(seagullGeometries.belly, seagullMaterials.belly));
  belly.name = "SeagullBelly";
  belly.position.set(0, -0.075, 0.02);
  belly.scale.set(0.82, 0.36, 1.18);
  gull.add(belly);

  const head = markShadow(new THREE.Mesh(seagullGeometries.head, seagullMaterials.belly));
  head.name = "SeagullHead";
  head.position.set(0, 0.025, 0.36);
  gull.add(head);

  const beak = markShadow(new THREE.Mesh(seagullGeometries.beak, seagullMaterials.beak));
  beak.name = "SeagullBeak";
  beak.position.set(0, 0.012, 0.51);
  beak.rotation.x = Math.PI / 2;
  gull.add(beak);

  [-1, 1].forEach((side) => {
    const eye = markShadow(new THREE.Mesh(seagullGeometries.eye, seagullMaterials.eye));
    eye.name = side < 0 ? "SeagullEyeLeft" : "SeagullEyeRight";
    eye.position.set(side * 0.055, 0.045, 0.465);
    gull.add(eye);
  });

  const tail = markShadow(new THREE.Mesh(seagullGeometries.tail, seagullMaterials.wing));
  tail.name = "SeagullTailFan";
  gull.add(tail);

  const leftWing = createWing(-1);
  const rightWing = createWing(1);
  gull.add(leftWing, rightWing);
  gull.userData.wings = { leftWing, rightWing };

  const lean = (pseudoRandom(seed + 8.5) - 0.5) * 0.08;
  gull.rotation.z = lean;

  return gull;
}

function placeSeagull(plan, seed) {
  const gull = createSeagull(seed);
  const phase = pseudoRandom(seed + 2.7) * Math.PI * 2;
  const scale = plan.scale * (0.92 + pseudoRandom(seed + 3.9) * 0.16);

  gull.scale.setScalar(scale);
  gull.userData.flight = {
    center: new THREE.Vector3(...plan.center),
    radiusX: plan.radiusX,
    radiusZ: plan.radiusZ,
    speed: plan.speed,
    phase,
    bobAmplitude: plan.bobAmplitude,
    bobSpeed: plan.bobSpeed,
    wingSpeed: plan.wingSpeed,
    wingAmplitude: plan.wingAmplitude
  };

  const flight = gull.userData.flight;
  gull.position.set(
    flight.center.x + Math.cos(flight.phase) * flight.radiusX,
    flight.center.y,
    flight.center.z + Math.sin(flight.phase) * flight.radiusZ
  );

  return gull;
}

export function addBeachSeagulls(group) {
  const birds = new THREE.Group();
  birds.name = "TropicalBeachSeagulls";

  const flightPlans = [
    { center: [-48, 7.4, -118], radiusX: 5.5, radiusZ: 3.2, speed: 0.034, scale: 1.22, bobAmplitude: 0.5, bobSpeed: 0.58, wingSpeed: 2.3, wingAmplitude: 0.34 },
    { center: [-30, 6.8, -96], radiusX: 4.4, radiusZ: 2.8, speed: 0.038, scale: 1.08, bobAmplitude: 0.42, bobSpeed: 0.62, wingSpeed: 2.55, wingAmplitude: 0.3 },
    { center: [-11, 8.0, -125], radiusX: 5.0, radiusZ: 3.4, speed: 0.032, scale: 1.18, bobAmplitude: 0.54, bobSpeed: 0.55, wingSpeed: 2.38, wingAmplitude: 0.36 },
    { center: [8, 6.5, -106], radiusX: 4.2, radiusZ: 2.6, speed: 0.041, scale: 1.04, bobAmplitude: 0.38, bobSpeed: 0.64, wingSpeed: 2.65, wingAmplitude: 0.28 },
    { center: [25, 7.7, -92], radiusX: 5.6, radiusZ: 3.5, speed: 0.035, scale: 1.16, bobAmplitude: 0.48, bobSpeed: 0.6, wingSpeed: 2.46, wingAmplitude: 0.34 },
    { center: [42, 6.9, -76], radiusX: 4.8, radiusZ: 3.0, speed: 0.039, scale: 1.08, bobAmplitude: 0.43, bobSpeed: 0.57, wingSpeed: 2.7, wingAmplitude: 0.3 },
    { center: [61, 8.2, -55], radiusX: 5.8, radiusZ: 3.2, speed: 0.031, scale: 1.2, bobAmplitude: 0.55, bobSpeed: 0.52, wingSpeed: 2.34, wingAmplitude: 0.35 },
    { center: [76, 7.0, -33], radiusX: 4.6, radiusZ: 2.9, speed: 0.037, scale: 1.06, bobAmplitude: 0.4, bobSpeed: 0.66, wingSpeed: 2.58, wingAmplitude: 0.29 },
    { center: [48, 9.0, -118], radiusX: 6.0, radiusZ: 3.8, speed: 0.03, scale: 1.24, bobAmplitude: 0.58, bobSpeed: 0.5, wingSpeed: 2.24, wingAmplitude: 0.38 },
    { center: [3, 8.8, -139], radiusX: 5.2, radiusZ: 3.6, speed: 0.033, scale: 1.14, bobAmplitude: 0.5, bobSpeed: 0.56, wingSpeed: 2.42, wingAmplitude: 0.33 },
    { center: [-63, 6.3, -78], radiusX: 4.0, radiusZ: 2.7, speed: 0.043, scale: 1.0, bobAmplitude: 0.36, bobSpeed: 0.7, wingSpeed: 2.76, wingAmplitude: 0.27 },
    { center: [88, 7.9, -72], radiusX: 5.4, radiusZ: 3.1, speed: 0.036, scale: 1.12, bobAmplitude: 0.46, bobSpeed: 0.59, wingSpeed: 2.5, wingAmplitude: 0.32 }
  ];

  flightPlans.forEach((plan, index) => {
    birds.add(placeSeagull(plan, index + 1));
  });

  group.add(birds);
}
