import * as THREE from "three";
import { clampPropPosition, getHeading, getRightVector, UP } from "../shared.js";

export function createBeachMaterial({
  color,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.85,
  metalness = 0.02
}) {
  const parameters = {
    color,
    roughness,
    metalness,
    flatShading: true
  };

  if (emissive !== undefined) {
    parameters.emissive = emissive;
    parameters.emissiveIntensity = emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(parameters);
}

export function getRoadFrame(curve, progress) {
  const p = progress >= 0.9999 ? 0.0 : progress;
  const point = curve.getPointAt(p);
  const tangent = curve.getTangentAt(p).setY(0).normalize();
  const right = getRightVector(tangent);

  return {
    point,
    tangent,
    right,
    heading: getHeading(tangent)
  };
}

export function safePlace(curve, progress, side, offset, roadHalfWidth, minClearance = 12) {
  const frame = getRoadFrame(curve, progress);
  const safeOffset = Math.max(Math.abs(offset), roadHalfWidth + minClearance);
  const position = frame.point.clone().addScaledVector(frame.right, side * safeOffset);
  clampPropPosition(curve, position, roadHalfWidth, 220, minClearance, minClearance);
  return {
    position,
    rotationY: frame.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
    frame
  };
}

export function makeBasisMatrix(position, tangent, right, scale = new THREE.Vector3(1, 1, 1)) {
  const matrix = new THREE.Matrix4();
  matrix.makeBasis(right.clone().normalize(), UP, tangent.clone().setY(0).normalize().negate());
  matrix.scale(scale);
  matrix.setPosition(position);
  return matrix;
}

export function addTransformedBox(target, geometry, matrix) {
  const sourcePosition = geometry.getAttribute("position");
  const sourceIndex = geometry.getIndex();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const baseIndex = target.positions.length / 3;

  for (let index = 0; index < sourcePosition.count; index += 1) {
    vertex.fromBufferAttribute(sourcePosition, index).applyMatrix4(matrix);
    target.positions.push(vertex.x, vertex.y, vertex.z);
  }

  const sourceNormal = geometry.getAttribute("normal");
  for (let index = 0; index < sourceNormal.count; index += 1) {
    normal.fromBufferAttribute(sourceNormal, index).applyMatrix3(normalMatrix).normalize();
    target.normals.push(normal.x, normal.y, normal.z);
  }

  for (let index = 0; index < sourceIndex.count; index += 1) {
    target.indices.push(baseIndex + sourceIndex.getX(index));
  }
}

export function createMergedGeometry(parts) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(parts.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(parts.normals, 3));
  geometry.setIndex(parts.indices);
  return geometry;
}

