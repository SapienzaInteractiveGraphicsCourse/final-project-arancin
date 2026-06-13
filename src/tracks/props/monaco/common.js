import * as THREE from "three";
import { getRightVector } from "../shared.js";

export function createMonacoRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  nearOffset,
  farOffset,
  y,
  material,
  sampleStep = 1
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    const near = center.clone().addScaledVector(right, side * nearOffset);
    const far = center.clone().addScaledVector(right, side * farOffset);

    vertices.push(near.x, y, near.z, far.x, y, far.z);
  }

  for (let index = 0; index < steps; index += 1) {
    const current = index * 2;
    const next = current + 2;
    if (side > 0) {
      indices.push(current, next, current + 1, current + 1, next, next + 1);
    } else {
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

export function createMonacoVerticalRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  offset,
  yBottom,
  yTop,
  material,
  sampleStep = 2
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    const base = center.clone().addScaledVector(right, side * offset);

    vertices.push(base.x, yBottom, base.z, base.x, yTop, base.z);
  }

  for (let index = 0; index < steps; index += 1) {
    const current = index * 2;
    const next = current + 2;
    if (side > 0) {
      indices.push(current, next, current + 1, current + 1, next, next + 1);
    } else {
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

export function collectMonacoSamples(curve, start, end, spacingMeters) {
  const samples = [];
  const totalLength = curve.getLength();
  const step = Math.max(0.002, spacingMeters / totalLength);

  for (let progress = start; progress <= end; progress += step) {
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);
    samples.push({ center, tangent, right, progress });
  }

  return samples;
}

export function addMonacoInstancedPart(group, geometry, material, matrices, name) {
  if (matrices.length === 0) {
    return;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
}

