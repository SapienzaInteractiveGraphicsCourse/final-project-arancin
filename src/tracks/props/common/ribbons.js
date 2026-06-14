import * as THREE from "three";
import { getTrackFrame } from "./placement.js";

export function createTrackRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  nearOffset,
  farOffset,
  y,
  material,
  sampleStep = 1,
  receiveShadow = true
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const frame = getTrackFrame(curve, progress);
    const near = frame.point.clone().addScaledVector(frame.right, side * nearOffset);
    const far = frame.point.clone().addScaledVector(frame.right, side * farOffset);

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
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

export function createVerticalTrackRibbonMesh(curve, definition, {
  name,
  side,
  start,
  end,
  offset,
  yBottom,
  yTop,
  material,
  sampleStep = 2,
  receiveShadow = true
}) {
  const vertices = [];
  const indices = [];
  const steps = Math.max(2, Math.ceil((end - start) * definition.segments / sampleStep));

  for (let index = 0; index <= steps; index += 1) {
    const progress = start + (end - start) * (index / steps);
    const frame = getTrackFrame(curve, progress);
    const base = frame.point.clone().addScaledVector(frame.right, side * offset);

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
  mesh.receiveShadow = receiveShadow;
  return mesh;
}
