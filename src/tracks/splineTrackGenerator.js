import * as THREE from "three";
import {
  createSplineCenterline,
  createTrackCurve,
  getMinimapBounds,
  headingFromLookahead,
  offsetProgress,
  samplePathAtProgress
} from "./centerline.js";
import { createTrackMaterials } from "./trackMaterials.js";

const ROAD_Y = 0.045;
const GROUND_Y = -0.025;
const SPAWN_Y = 0.42;
const EDGE_WIDTH = 0.22;
const ROAD_UV_SCALE = 8;
const BARRIER_SAMPLE_STEP = 2;

function getRightVector(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
}

function getHeading(tangent) {
  return Math.atan2(tangent.x, tangent.z);
}

function createRoadGeometry(curve, roadWidth, segments) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const edgeSamples = [];
  const roadSegments = [];
  let cumulativeDistance = 0;
  let previousCenter = null;

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const right = getRightVector(tangent);

    if (previousCenter) {
      cumulativeDistance += previousCenter.distanceTo(center);
    }

    const left = center.clone().addScaledVector(right, -roadWidth * 0.5);
    const rightPoint = center.clone().addScaledVector(right, roadWidth * 0.5);
    left.y = ROAD_Y;
    rightPoint.y = ROAD_Y;

    vertices.push(left.x, left.y, left.z, rightPoint.x, rightPoint.y, rightPoint.z);
    uvs.push(0, cumulativeDistance / ROAD_UV_SCALE, 1, cumulativeDistance / ROAD_UV_SCALE);
    edgeSamples.push({
      center: center.clone(),
      left,
      right: rightPoint,
      tangent: tangent.clone(),
      normal: right.clone(),
      progress,
      distance: cumulativeDistance
    });

    previousCenter = center;
  }

  for (let index = 0; index < segments; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);

    const start = edgeSamples[index].center.clone();
    const end = edgeSamples[index + 1].center.clone();
    roadSegments.push({
      start,
      end,
      center: start.clone().add(end).multiplyScalar(0.5),
      halfWidth: roadWidth * 0.5
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, edgeSamples, roadSegments };
}

function createEdgeRibbonGeometry(edgeSamples, side, width = EDGE_WIDTH) {
  const vertices = [];
  const uvs = [];
  const indices = [];

  edgeSamples.forEach((sample) => {
    const edge = side < 0 ? sample.left : sample.right;
    const inner = edge.clone().addScaledVector(sample.normal, -side * width * 0.5);
    const outer = edge.clone().addScaledVector(sample.normal, side * width * 0.5);
    inner.y = ROAD_Y + 0.015;
    outer.y = ROAD_Y + 0.015;

    vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    uvs.push(0, sample.distance / ROAD_UV_SCALE, 1, sample.distance / ROAD_UV_SCALE);
  });

  for (let index = 0; index < edgeSamples.length - 1; index += 1) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGround(definition, material) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(definition.groundSize, definition.groundSize, 1, 1),
    material
  );
  ground.name = `${definition.name}:Ground`;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  return ground;
}

function createBarrierSegment(material, start, end, height, thickness) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const visualLength = length + 0.08;
  const segment = new THREE.Mesh(new THREE.BoxGeometry(visualLength, height, thickness), material);

  segment.position.set((start.x + end.x) * 0.5, height * 0.5, (start.z + end.z) * 0.5);
  segment.rotation.y = -Math.atan2(dz, dx);
  segment.castShadow = true;
  segment.receiveShadow = true;
  segment.userData.collider = {
    center: segment.position.clone(),
    rotationY: segment.rotation.y,
    halfLength: visualLength * 0.5,
    halfThickness: thickness * 0.5
  };

  return segment;
}

function addBarriers(group, edgeSamples, definition, material) {
  const barrierMeshes = [];
  const offset = definition.barrierOffset ?? 0.85;
  const height = definition.barrierHeight ?? 0.68;
  const thickness = definition.barrierThickness ?? 0.44;

  for (let index = 0; index < edgeSamples.length - 1; index += BARRIER_SAMPLE_STEP) {
    const current = edgeSamples[index];
    const next = edgeSamples[Math.min(index + BARRIER_SAMPLE_STEP, edgeSamples.length - 1)];
    const leftStart = current.left.clone().addScaledVector(current.normal, -offset);
    const leftEnd = next.left.clone().addScaledVector(next.normal, -offset);
    const rightStart = current.right.clone().addScaledVector(current.normal, offset);
    const rightEnd = next.right.clone().addScaledVector(next.normal, offset);
    const left = createBarrierSegment(material, leftStart, leftEnd, height, thickness);
    const right = createBarrierSegment(material, rightStart, rightEnd, height, thickness);

    left.name = `${definition.name}:LeftBarrier`;
    right.name = `${definition.name}:RightBarrier`;
    barrierMeshes.push(left, right);
    group.add(left, right);
  }

  return barrierMeshes;
}

function createCheckpoints(curve, definition) {
  return definition.checkpointTs.map((progress, index) => {
    const position = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();

    return {
      id: index,
      name: index === 0 ? "Start" : `Sector ${index}`,
      position: new THREE.Vector3(position.x, 0, position.z),
      rotationY: getHeading(tangent),
      size: new THREE.Vector3(definition.roadWidth + 0.7, 3, 1.4),
      tangent
    };
  });
}

function addStartLine(group, checkpoint, materials) {
  const startLine = new THREE.Group();
  startLine.name = "StartFinishLine";
  startLine.position.copy(checkpoint.position);
  startLine.position.y = ROAD_Y + 0.04;
  startLine.rotation.y = checkpoint.rotationY;

  const columns = 10;
  const rows = 3;
  const tileWidth = checkpoint.size.x / columns;
  const tileDepth = 0.42;

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const material = (column + row) % 2 === 0 ? materials.startWhite : materials.startDark;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(tileWidth, 0.035, tileDepth), material);
      tile.position.set((column - (columns - 1) * 0.5) * tileWidth, 0, (row - 1) * tileDepth);
      tile.receiveShadow = true;
      startLine.add(tile);
    }
  }

  group.add(startLine);
}

function addCheckpointGates(group, checkpoints, material) {
  checkpoints.forEach((checkpoint) => {
    const gate = new THREE.Group();
    gate.name = `${checkpoint.name}CheckpointGate`;
    gate.position.set(checkpoint.position.x, 0, checkpoint.position.z);
    gate.rotation.y = checkpoint.rotationY;

    const span = checkpoint.size.x;
    const postHeight = checkpoint.size.y;
    const postGeometry = new THREE.BoxGeometry(0.2, postHeight, 0.2);
    const topGeometry = new THREE.BoxGeometry(span, 0.2, 0.2);
    const markerGeometry = new THREE.BoxGeometry(span, 0.035, 0.34);

    const leftPost = new THREE.Mesh(postGeometry, material);
    leftPost.position.set(-span * 0.5, postHeight * 0.5, 0);
    const rightPost = new THREE.Mesh(postGeometry, material);
    rightPost.position.set(span * 0.5, postHeight * 0.5, 0);
    const top = new THREE.Mesh(topGeometry, material);
    top.position.set(0, postHeight, 0);
    const marker = new THREE.Mesh(markerGeometry, material);
    marker.position.set(0, ROAD_Y + 0.035, 0);

    gate.add(leftPost, rightPost, top, marker);
    checkpoint.gate = gate;
    group.add(gate);
  });
}

function addBoostPads(group, curve, definition, material) {
  return definition.boostTs.map((progress, index) => {
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const heading = getHeading(tangent);
    const padGroup = new THREE.Group();
    padGroup.name = `${definition.name}:BoostPad:${index}`;
    padGroup.position.set(point.x, ROAD_Y + 0.045, point.z);
    padGroup.rotation.y = heading;

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.045, 1.1), material);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 3), material);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = Math.PI / 2;
    arrow.position.y = 0.045;
    padGroup.add(base, arrow);
    group.add(padGroup);

    return {
      position: new THREE.Vector3(point.x, 0.38, point.z),
      radius: 1.35,
      heading
    };
  });
}

function createSpawn(centerline, definition) {
  const startProgress = definition.checkpointTs[0] ?? 0;
  const spawnProgress = offsetProgress(centerline, startProgress, definition.spawnOffsetMeters ?? -4);
  const sample = samplePathAtProgress(centerline, spawnProgress);

  return {
    position: new THREE.Vector3(sample.x, SPAWN_Y, sample.z),
    heading: headingFromLookahead(centerline, spawnProgress, 2.5)
  };
}

function disposeObjectTree(group) {
  group.traverse((child) => {
    child.geometry?.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}

export function createSplineTrack(definition) {
  const group = new THREE.Group();
  group.name = `${definition.name} Track`;

  const curve = createTrackCurve(definition);
  const materials = createTrackMaterials(definition);
  const roadHalfWidth = definition.roadWidth * 0.5;
  const centerline = createSplineCenterline(curve, definition.segments);
  const roadData = createRoadGeometry(curve, definition.roadWidth, definition.segments);
  const spawn = createSpawn(centerline, definition);

  const ground = createGround(definition, materials.ground);
  const road = new THREE.Mesh(roadData.geometry, materials.road);
  road.name = `${definition.name}:Road`;
  road.receiveShadow = true;

  const leftEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, -1), materials.roadEdge);
  leftEdge.name = `${definition.name}:LeftRoadEdge`;
  leftEdge.receiveShadow = true;

  const rightEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, 1), materials.roadEdge);
  rightEdge.name = `${definition.name}:RightRoadEdge`;
  rightEdge.receiveShadow = true;

  group.add(ground, road, leftEdge, rightEdge);
  const barrierMeshes = addBarriers(group, roadData.edgeSamples, definition, materials.barrier);
  const checkpoints = createCheckpoints(curve, definition);
  addStartLine(group, checkpoints[0], materials);
  addCheckpointGates(group, checkpoints, materials.checkpoint);
  const boostPads = addBoostPads(group, curve, definition, materials.boost);

  group.userData.trackInfo = {
    id: definition.id,
    name: definition.name,
    spawn,
    roadSegments: roadData.roadSegments,
    roadHalfWidth,
    centerline,
    checkpoints,
    boostPads,
    barrierColliders: barrierMeshes.map((mesh) => mesh.userData.collider),
    minimapBounds: getMinimapBounds(centerline, roadHalfWidth + 8),
    lightingMode: definition.lightingMode,
    skyboxTheme: definition.skyboxTheme,
    particleProfile: definition.particleProfile
  };

  return {
    group,
    spawn,
    trackInfo: group.userData.trackInfo,
    dispose() {
      disposeObjectTree(group);
    }
  };
}
