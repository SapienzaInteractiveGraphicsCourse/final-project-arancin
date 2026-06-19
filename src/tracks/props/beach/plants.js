import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial } from "./common.js";

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

