import * as THREE from "three";

export const UP = new THREE.Vector3(0, 1, 0);

export function getRightVector(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
}

export function getHeading(tangent) {
  return Math.atan2(tangent.x, tangent.z);
}

export function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

export function markShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function findClosestT(curve, pos, samples = 200) {
  let closestT = 0;
  let closestDistanceSq = Infinity;

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = curve.getPointAt(t);
    const distanceSq = (pos.x - point.x) ** 2 + (pos.z - point.z) ** 2;

    if (distanceSq < closestDistanceSq) {
      closestT = t;
      closestDistanceSq = distanceSq;
    }
  }

  return closestT;
}

export function clampPropPosition(curve, propPos, roadHalfWidth, samples = 200, clearance = 10, targetClearance = 12) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const closestT = findClosestT(curve, propPos, samples);
    const roadCenter = curve.getPointAt(closestT);
    const distFromCenter = new THREE.Vector2(
      propPos.x - roadCenter.x,
      propPos.z - roadCenter.z
    ).length();

    if (distFromCenter >= roadHalfWidth + clearance) {
      return propPos;
    }

    const outDir = new THREE.Vector3(
      propPos.x - roadCenter.x,
      0,
      propPos.z - roadCenter.z
    );

    if (outDir.lengthSq() < 0.0001) {
      const tangent = curve.getTangentAt(closestT).setY(0).normalize();
      outDir.copy(getRightVector(tangent));
    } else {
      outDir.normalize();
    }

    propPos.x = roadCenter.x + outDir.x * (roadHalfWidth + targetClearance);
    propPos.z = roadCenter.z + outDir.z * (roadHalfWidth + targetClearance);
  }

  return propPos;
}

export function getSafeRoadsidePosition(curve, progress, side, initialOffset, roadHalfWidth, minClearance = 20) {
  const point = curve.getPointAt(progress % 1.0);
  const tangent = curve.getTangentAt(progress % 1.0).setY(0).normalize();
  const normal = getRightVector(tangent);
  const safeClearance = Math.max(16, minClearance * 0.35);
  const absoluteMinClearance = roadHalfWidth + safeClearance;

  let bestPos = null;
  let bestDist = -1;

  for (const s of [side, -side]) {
    let currentOffset = initialOffset;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const testPos = point.clone().addScaledVector(normal, s * currentOffset);

      let minTrackDist = Infinity;
      for (let index = 0; index <= 120; index += 1) {
        const trackPoint = curve.getPointAt(index / 120);
        const dist = Math.sqrt((testPos.x - trackPoint.x) ** 2 + (testPos.z - trackPoint.z) ** 2);
        if (dist < minTrackDist) {
          minTrackDist = dist;
        }
      }

      if (minTrackDist >= absoluteMinClearance) {
        if (minTrackDist >= roadHalfWidth + minClearance) {
          return testPos;
        }

        if (minTrackDist > bestDist) {
          bestDist = minTrackDist;
          bestPos = testPos;
        }
      }

      currentOffset += 20;
    }
  }

  if (bestPos) {
    return bestPos;
  }

  for (const s of [side, -side]) {
    const safeNearPos = point.clone().addScaledVector(normal, s * (roadHalfWidth + safeClearance + 2));
    let minTrackDist = Infinity;
    for (let index = 0; index <= 120; index += 1) {
      const trackPoint = curve.getPointAt(index / 120);
      const dist = Math.sqrt((safeNearPos.x - trackPoint.x) ** 2 + (safeNearPos.z - trackPoint.z) ** 2);
      if (dist < minTrackDist) {
        minTrackDist = dist;
      }
    }
    if (minTrackDist >= roadHalfWidth + 6) {
      return safeNearPos;
    }
  }

  return point.clone().addScaledVector(normal, side * initialOffset);
}

export function optimizeStaticDecorativeProps(group, receiveShadowNames = []) {
  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      child.castShadow = false;
      child.receiveShadow = receiveShadowNames.some((name) => child.name.includes(name));
    }

    if (!child.isLight && !child.userData.spin) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
  });
}

function disposeMaterial(material, disposedTextures) {
  Object.values(material).forEach((value) => {
    if (value?.isTexture && !disposedTextures.has(value)) {
      value.dispose();
      disposedTextures.add(value);
    }
  });
  material.dispose();
}

function disposeObjectTree(root) {
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const disposedTextures = new Set();

  root.traverse((child) => {
    if (child.geometry && !disposedGeometries.has(child.geometry)) {
      child.geometry.dispose();
      disposedGeometries.add(child.geometry);
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material) => {
      if (material && !disposedMaterials.has(material)) {
        disposeMaterial(material, disposedTextures);
        disposedMaterials.add(material);
      }
    });
  });
}

export function attachPropsDisposer(group, propsGroup) {
  group.userData.disposeProps = () => disposeObjectTree(propsGroup);
}
