import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial } from "./common.js";

export function createTropicalPalm(seed = 0) {
  const palm = new THREE.Group();
  palm.name = "TropicalBeachPalm";

  const trunkMaterial = createBeachMaterial({ color: 0x6f4726, roughness: 0.9 });
  const trunkBandMaterial = createBeachMaterial({ color: 0xa87a44, roughness: 0.88 });
  const ribMaterial = createBeachMaterial({ color: 0x174d25, roughness: 0.82 });
  const leafMaterials = [
    createBeachMaterial({ color: 0x2d8f34, roughness: 0.78, metalness: 0 }),
    createBeachMaterial({ color: 0x3eaa43, roughness: 0.78, metalness: 0 }),
    createBeachMaterial({ color: 0x1f6f2b, roughness: 0.82, metalness: 0 })
  ];
  leafMaterials.forEach((material) => {
    material.side = THREE.DoubleSide;
  });
  ribMaterial.side = THREE.DoubleSide;

  const trunkHeight = 8.8 + (seed % 3) * 0.7;
  const segmentCount = 9;
  const lean = seed % 2 === 0 ? 0.075 : -0.075;
  const segmentHeight = trunkHeight / segmentCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const taper = 1 - index / segmentCount;
    const segment = markShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.17 + taper * 0.07, 0.27 + taper * 0.1, segmentHeight * 1.04, 8),
      trunkMaterial
    ));
    segment.position.set(lean * index * 0.34, segmentHeight * (index + 0.5), 0);
    segment.rotation.z = lean;
    palm.add(segment);

    if (index % 2 === 0) {
      const band = markShadow(new THREE.Mesh(
        new THREE.CylinderGeometry(0.19 + taper * 0.07, 0.2 + taper * 0.08, 0.12, 8),
        trunkBandMaterial
      ));
      band.position.copy(segment.position);
      band.rotation.z = lean;
      palm.add(band);
    }
  }

  const crown = new THREE.Group();
  crown.position.set(lean * segmentCount * 0.34, trunkHeight + 0.15, 0);

  const createFrond = (length, material, droop, leafletCount = 8) => {
    const frond = new THREE.Group();
    const rib = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, length), ribMaterial));
    rib.position.z = -length * 0.5;
    frond.add(rib);

    const leafletGeometry = new THREE.PlaneGeometry(0.22, length * 0.3);
    for (let index = 0; index < leafletCount; index += 1) {
      const progress = (index + 1) / (leafletCount + 1);
      const z = -progress * length;
      const span = Math.sin(progress * Math.PI);

      [-1, 1].forEach((side) => {
        const leaflet = markShadow(new THREE.Mesh(leafletGeometry, material));
        leaflet.position.set(side * (0.28 + span * 0.75), -progress * droop, z);
        leaflet.rotation.y = side * (Math.PI / 2.8);
        leaflet.rotation.z = side * (0.5 + progress * 0.28);
        leaflet.scale.set(0.8 + span * 0.65, 1, 1);
        frond.add(leaflet);
      });
    }

    return frond;
  };

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const length = 5.8 + pseudoRandom(seed + index * 0.7) * 1.2;
    const frond = createFrond(length, leafMaterials[index % leafMaterials.length], 1.1 + (index % 3) * 0.28, 7);
    frond.rotation.y = angle;
    frond.rotation.x = Math.PI / 3.6 + (index % 4) * 0.07;
    frond.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.12;
    frond.position.set(Math.cos(angle) * 0.34, 0.12, Math.sin(angle) * 0.34);
    crown.add(frond);
  }

  [0, 1, 2].forEach((index) => {
    const angle = (index / 4) * Math.PI * 2 + 0.35;
    const uprightFrond = createFrond(4.2, leafMaterials[(index + 1) % leafMaterials.length], 0.35, 6);
    uprightFrond.rotation.y = angle;
    uprightFrond.rotation.x = Math.PI / 5.4;
    uprightFrond.position.y = 0.45;
    crown.add(uprightFrond);
  });

  // Cluster of 3 brown coconuts nestled right under the fronds
  const coconutMaterial = createBeachMaterial({ color: 0x4d321d, roughness: 0.82 });
  const coconutGeo = new THREE.SphereGeometry(0.18, 6, 6);
  for (let c = 0; c < 3; c++) {
    const coconut = markShadow(new THREE.Mesh(coconutGeo, coconutMaterial));
    // Position coconuts around the center of the crown
    const angle = (c / 3) * Math.PI * 2 + (seed % 5) * 0.4;
    const r = 0.22;
    coconut.position.set(Math.cos(angle) * r, -0.1 - (c % 2) * 0.04, Math.sin(angle) * r);
    // Give them a slightly organic, non-perfectly-spherical shape
    coconut.scale.set(1.0, 1.15, 0.95);
    crown.add(coconut);
  }

  palm.add(crown);
  return palm;
}

export function createTropicalBush(seed = 0) {
  const bush = new THREE.Group();
  bush.name = "TropicalBeachBush";

  const material = createBeachMaterial({
    color: seed % 2 === 0 ? 0x2f9b4b : 0x1f7a3a,
    roughness: 0.82
  });

  for (let index = 0; index < 4; index += 1) {
    const leaf = markShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + index * 0.08, 0), material));
    leaf.position.set((index - 1.5) * 0.45, 0.55 + index * 0.1, (pseudoRandom(seed + index) - 0.5) * 0.8);
    leaf.scale.set(1.25, 0.72, 0.9);
    bush.add(leaf);
  }

  return bush;
}

