import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";

function createSeagull(seed = 0) {
  const gull = new THREE.Group();
  gull.name = `TropicalBeachSeagull:${seed}`;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f0e6,
    emissive: 0xf7f1dc,
    emissiveIntensity: 0.08,
    roughness: 0.58,
    metalness: 0,
    flatShading: true
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
    roughness: 0.55,
    metalness: 0,
    flatShading: true
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9dde2,
    emissive: 0xf2f4f7,
    emissiveIntensity: 0.06,
    roughness: 0.62,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide
  });
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: 0x18202b,
    emissive: 0x18202b,
    emissiveIntensity: 0.04,
    roughness: 0.78,
    metalness: 0,
    flatShading: true
  });
  const beakMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6b73c,
    emissive: 0xf6b73c,
    emissiveIntensity: 0.08,
    roughness: 0.65,
    metalness: 0,
    flatShading: true
  });

  const body = markShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.48, 4, 7), bodyMaterial));
  body.name = "SeagullBody";
  body.rotation.x = Math.PI / 2;
  gull.add(body);

  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), headMaterial));
  head.name = "SeagullHead";
  head.position.set(0, 0.02, 0.34);
  gull.add(head);

  const beak = markShadow(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), beakMaterial));
  beak.name = "SeagullBeak";
  beak.position.set(0, 0.015, 0.48);
  beak.rotation.x = Math.PI / 2;
  gull.add(beak);

  const tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0.02, -0.34,
    -0.14, 0.0, -0.58,
    0.14, 0.0, -0.58
  ], 3));
  tailGeometry.setIndex([0, 1, 2]);
  tailGeometry.computeVertexNormals();
  const tail = markShadow(new THREE.Mesh(tailGeometry, wingMaterial));
  tail.name = "SeagullTail";
  gull.add(tail);

  function createWing(side) {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "SeagullLeftWing" : "SeagullRightWing";
    wing.position.set(side * 0.12, 0.02, 0.05);
    wing.userData.dynamic = true;

    const innerGeometry = new THREE.BufferGeometry();
    innerGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, 0,
      side * 0.58, 0.015, 0.05,
      side * 0.34, -0.01, -0.18
    ], 3));
    innerGeometry.setIndex([0, 1, 2]);
    innerGeometry.computeVertexNormals();

    const outerGeometry = new THREE.BufferGeometry();
    outerGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      side * 0.52, 0.012, 0.04,
      side * 1.08, 0.02, -0.04,
      side * 0.44, -0.012, -0.22
    ], 3));
    outerGeometry.setIndex([0, 1, 2]);
    outerGeometry.computeVertexNormals();

    const inner = markShadow(new THREE.Mesh(innerGeometry, wingMaterial));
    inner.name = `${wing.name}:Inner`;
    const outer = markShadow(new THREE.Mesh(outerGeometry, wingMaterial));
    outer.name = `${wing.name}:Outer`;
    const tip = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.055), tipMaterial));
    tip.name = `${wing.name}:BlackTip`;
    tip.position.set(side * 1.02, 0.015, -0.06);
    tip.rotation.y = side * 0.18;

    wing.add(inner, outer, tip);
    return wing;
  }

  const leftWing = createWing(-1);
  const rightWing = createWing(1);

  gull.add(leftWing, rightWing);
  gull.userData.wings = { leftWing, rightWing };

  return gull;
}

function createSeagullGroup({ center, radiusX, radiusZ, speed, scale, count, seed }) {
  const flockGroup = new THREE.Group();
  flockGroup.name = `TropicalBeachVisibleSeagullFlock:${seed}`;
  flockGroup.userData.flockWings = [];

  for (let index = 0; index < count; index += 1) {
    const gull = createSeagull(seed * 10 + index);
    const row = Math.floor(index / 3);
    const column = index % 3;
    const lateral = (column - 1) * (2.8 + row * 0.35);
    const forward = row * -2.3 + (pseudoRandom(seed + index * 1.7) - 0.5) * 0.8;
    const height = (pseudoRandom(seed + index * 2.3) - 0.5) * 1.2;

    gull.position.set(lateral, height, forward);
    gull.scale.setScalar(scale * (0.92 + pseudoRandom(seed + index * 3.1) * 0.18));
    gull.rotation.y = (pseudoRandom(seed + index * 4.9) - 0.5) * 0.28;
    flockGroup.userData.flockWings.push(gull.userData.wings);
    flockGroup.add(gull);
  }

  flockGroup.userData.flight = {
    center: new THREE.Vector3(...center),
    radiusX,
    radiusZ,
    speed,
    phase: pseudoRandom(seed + 2.7) * Math.PI * 2,
    bobAmplitude: 0.7 + pseudoRandom(seed + 4.1) * 0.5,
    bobSpeed: 0.55 + pseudoRandom(seed + 6.3) * 0.25,
    wingSpeed: 2.65 + pseudoRandom(seed + 8.4) * 0.45,
    wingAmplitude: 0.44 + pseudoRandom(seed + 10.5) * 0.18
  };

  const flight = flockGroup.userData.flight;
  flockGroup.position.set(
    flight.center.x + Math.cos(flight.phase) * flight.radiusX,
    flight.center.y,
    flight.center.z + Math.sin(flight.phase) * flight.radiusZ
  );

  return flockGroup;
}

export function addBeachSeagullFlock(group) {
  const flock = new THREE.Group();
  flock.name = "TropicalBeachSeagullFlock";

  const flightPlans = [
    { center: [-24, 5.8, -104], radiusX: 8, radiusZ: 5, speed: 0.045, scale: 1.35, count: 7 },
    { center: [-8, 6.2, -114], radiusX: 10, radiusZ: 6, speed: 0.048, scale: 1.28, count: 6 },
    { center: [28, 6.6, -96], radiusX: 12, radiusZ: 7, speed: 0.043, scale: 1.22, count: 8 },
    { center: [62, 7.0, -52], radiusX: 14, radiusZ: 8, speed: 0.05, scale: 1.16, count: 5 }
  ];

  flightPlans.forEach((plan, index) => {
    flock.add(createSeagullGroup({ ...plan, seed: index }));
  });

  group.add(flock);
}
