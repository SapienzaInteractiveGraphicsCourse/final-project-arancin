import * as THREE from "three";
import { pseudoRandom } from "../shared.js";

function createBeachCloud(seed = 0) {
  const cloud = new THREE.Group();
  cloud.name = "TropicalBeachCloud";

  const material = new THREE.MeshStandardMaterial({
    color: 0xf7fbff,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    fog: false
  });
  const geometry = new THREE.SphereGeometry(1, 8, 6);
  const puffCount = 4 + (seed % 3);

  for (let index = 0; index < puffCount; index += 1) {
    const puff = new THREE.Mesh(geometry, material);
    const side = index - (puffCount - 1) * 0.5;
    puff.position.set(side * 4.2, (index % 2) * 0.7, pseudoRandom(seed + index) * 1.4);
    puff.scale.set(
      3.6 + pseudoRandom(seed + index * 1.7) * 1.7,
      1.0 + pseudoRandom(seed + index * 2.3) * 0.45,
      1.3 + pseudoRandom(seed + index * 3.1) * 0.6
    );
    puff.castShadow = false;
    puff.receiveShadow = false;
    cloud.add(puff);
  }

  return cloud;
}

export function addBeachClouds(group) {
  const cloudPositions = [
    [-180, 48, -155, 0.25, 1.25],
    [-70, 58, -235, -0.12, 1.55],
    [92, 52, -190, 0.18, 1.35],
    [190, 46, -70, -0.28, 1.45],
    [-210, 54, 80, 0.08, 1.65],
    [42, 62, 142, -0.2, 1.35],
    [230, 56, 190, 0.14, 1.5]
  ];

  cloudPositions.forEach(([x, y, z, rotationY, scale], index) => {
    const cloud = createBeachCloud(index);
    cloud.position.set(x, y, z);
    cloud.rotation.y = rotationY;
    cloud.scale.setScalar(scale);
    group.add(cloud);
  });
}

