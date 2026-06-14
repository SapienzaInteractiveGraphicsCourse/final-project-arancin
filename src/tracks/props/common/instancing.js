import * as THREE from "three";

export function addInstancedPart(
  group,
  geometry,
  material,
  matrices,
  name,
  {
    castShadow = false,
    receiveShadow = true
  } = {}
) {
  if (matrices.length === 0) {
    return null;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(mesh);
  return mesh;
}
