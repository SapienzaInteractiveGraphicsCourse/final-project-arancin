import * as THREE from "three";
import {
  createSplineCenterline,
  createTrackCurve,
  getMinimapBounds,
  headingFromLookahead,
  offsetProgress,
  samplePathAtProgress
} from "./centerline.js";
import { addTrackProps } from "./trackProps.js";
import { createTrackMaterials } from "./trackMaterials.js";

const ROAD_Y = 0.045;
const GROUND_Y = -0.025;
const SPAWN_Y = ROAD_Y + 0.1;
const EDGE_WIDTH = 0.1;
const NEON_EDGE_Y = 0.08;
const NEON_EDGE_WIDTH = 0.5;
const NEON_EDGE_LENGTH = 4;
const NEON_EDGE_INTERVAL = 6;
const ROAD_UV_SCALE = 8;
const BARRIER_SAMPLE_STEP = 2;
const CENTER_DASH_LENGTH = 3.5;
const CENTER_DASH_WIDTH = 0.5;
const CENTER_DASH_HEIGHT = 0.06;
const CENTER_DASH_INTERVAL = 12;
const CURB_SAMPLE_STEP = 3;
const CURB_WIDTH = 0.62;
const CURB_LENGTH = 1.35;
const CURVE_THRESHOLD = 0.075;
const UP = new THREE.Vector3(0, 1, 0);

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
      distance: cumulativeDistance,
      roadHalfWidth: roadWidth * 0.5
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
    const edge = sample.center.clone().addScaledVector(sample.normal, side * sample.roadHalfWidth);
    const inner = edge.clone().addScaledVector(sample.normal, -side * width * 0.5);
    const outer = edge.clone().addScaledVector(sample.normal, side * width * 0.5);
    inner.y = ROAD_Y + 0.02;
    outer.y = ROAD_Y + 0.02;

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

function createNeonEdgeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.15,
    flatShading: true,
    roughness: 0.24,
    metalness: 0.04
  });
}

function addSegmentedNeonRoadEdges(group, edgeSamples, definition) {
  const totalDistance = edgeSamples[edgeSamples.length - 1].distance;
  const segmentCount = Math.floor(totalDistance / NEON_EDGE_INTERVAL);
  const geometry = new THREE.BoxGeometry(NEON_EDGE_WIDTH, 0.035, NEON_EDGE_LENGTH);
  const materials = [
    createNeonEdgeMaterial(0xffffff),
    createNeonEdgeMaterial(0xff2020)
  ];
  const matrices = [[], []];
  const matrix = new THREE.Matrix4();

  [-1, 1].forEach((side) => {
    for (let index = 0; index < segmentCount; index += 1) {
      const sample = sampleEdgeByDistance(edgeSamples, index * NEON_EDGE_INTERVAL + NEON_EDGE_LENGTH * 0.5);
      const position = sample.center
        .clone()
        .addScaledVector(sample.normal, side * sample.roadHalfWidth);
      const right = sample.normal.clone().multiplyScalar(side);
      const tangent = sample.tangent.clone().setY(0).normalize();
      const materialIndex = Math.floor(index / 3) % 2;

      position.y = NEON_EDGE_Y;
      matrix.makeBasis(right, UP, tangent.negate());
      matrix.setPosition(position);
      matrices[materialIndex].push(matrix.clone());
    }
  });

  matrices.forEach((materialMatrices, materialIndex) => {
    if (materialMatrices.length === 0) {
      return;
    }

    const mesh = new THREE.InstancedMesh(geometry, materials[materialIndex], materialMatrices.length);
    mesh.name = `${definition.name}:SegmentedNeonRoadEdge:${materialIndex}`;
    mesh.receiveShadow = true;
    materialMatrices.forEach((segmentMatrix, index) => mesh.setMatrixAt(index, segmentMatrix));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  });
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

function sampleEdgeByDistance(edgeSamples, distance) {
  for (let index = 1; index < edgeSamples.length; index += 1) {
    const previous = edgeSamples[index - 1];
    const current = edgeSamples[index];

    if (current.distance >= distance) {
      const span = current.distance - previous.distance;
      const alpha = span === 0 ? 0 : (distance - previous.distance) / span;
      const center = previous.center.clone().lerp(current.center, alpha);
      const tangent = previous.tangent.clone().lerp(current.tangent, alpha).normalize();
      const normal = previous.normal.clone().lerp(current.normal, alpha).normalize();
      const roadHalfWidth = THREE.MathUtils.lerp(previous.roadHalfWidth, current.roadHalfWidth, alpha);

      return { center, tangent, normal, roadHalfWidth };
    }
  }

  const last = edgeSamples[edgeSamples.length - 1];
  return {
    center: last.center.clone(),
    tangent: last.tangent.clone(),
    normal: last.normal.clone(),
    roadHalfWidth: last.roadHalfWidth
  };
}

function addCenterLineDashes(group, edgeSamples, definition, material) {
  const totalDistance = edgeSamples[edgeSamples.length - 1].distance;
  const dashCount = Math.floor(totalDistance / CENTER_DASH_INTERVAL);
  const geometry = new THREE.BoxGeometry(CENTER_DASH_WIDTH, CENTER_DASH_HEIGHT, CENTER_DASH_LENGTH);
  const dashes = new THREE.InstancedMesh(geometry, material, dashCount);
  const matrix = new THREE.Matrix4();

  dashes.name = `${definition.name}:CenterLineDashes`;
  dashes.receiveShadow = true;

  for (let index = 0; index < dashCount; index += 1) {
    const sample = sampleEdgeByDistance(edgeSamples, index * CENTER_DASH_INTERVAL + CENTER_DASH_INTERVAL * 0.5);
    const position = sample.center;
    const tangent = sample.tangent.clone().setY(0).normalize();
    const right = getRightVector(tangent);

    position.y = ROAD_Y + 0.06;
    matrix.makeBasis(right, UP, tangent.clone().negate());
    matrix.setPosition(position);
    dashes.setMatrixAt(index, matrix);
  }

  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);
}

function getCurveSide(edgeSamples, index) {
  const previous = edgeSamples[Math.max(0, index - 2)];
  const next = edgeSamples[Math.min(edgeSamples.length - 1, index + 2)];
  const turn = previous.tangent.x * next.tangent.z - previous.tangent.z * next.tangent.x;

  if (Math.abs(turn) < CURVE_THRESHOLD) {
    return 0;
  }

  return turn > 0 ? 1 : -1;
}

function addApexCurbs(group, edgeSamples, definition, materials) {
  if (definition.id !== "monaco") {
    return;
  }

  const curbGeometry = new THREE.BoxGeometry(CURB_WIDTH, 0.035, CURB_LENGTH);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const redMatrices = [];
  const whiteMatrices = [];

  for (let index = 3; index < edgeSamples.length - 3; index += CURB_SAMPLE_STEP) {
    const progress = index / (edgeSamples.length - 1);
    if (progress < 0.05 || progress > 0.95) {
      continue;
    }

    const curveSide = getCurveSide(edgeSamples, index);

    if (curveSide === 0) {
      continue;
    }

    const sample = edgeSamples[index];
    const insideSide = -curveSide;
    const position = sample.center
      .clone()
      .addScaledVector(sample.normal, insideSide * (sample.roadHalfWidth - CURB_WIDTH * 0.5));
    position.y = ROAD_Y + 0.055;

    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), getHeading(sample.tangent));
    matrix.compose(position, quaternion, scale);

    if ((index / CURB_SAMPLE_STEP) % 2 < 1) {
      redMatrices.push(matrix.clone());
    } else {
      whiteMatrices.push(matrix.clone());
    }
  }

  [
    { matrices: redMatrices, material: materials.curbRed, name: "ApexCurbRed" },
    { matrices: whiteMatrices, material: materials.curbWhite, name: "ApexCurbWhite" }
  ].forEach(({ matrices, material, name }) => {
    if (matrices.length === 0) {
      return;
    }

    const curbs = new THREE.InstancedMesh(curbGeometry, material, matrices.length);
    curbs.name = `${definition.name}:${name}`;
    curbs.receiveShadow = true;
    matrices.forEach((curbMatrix, curbIndex) => curbs.setMatrixAt(curbIndex, curbMatrix));
    curbs.instanceMatrix.needsUpdate = true;
    group.add(curbs);
  });
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
  startLine.position.y = ROAD_Y + 0.055;
  startLine.rotation.y = checkpoint.rotationY;

  const columns = 12;
  const rows = 4;
  const tileWidth = checkpoint.size.x / columns;
  const tileDepth = 0.36;

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const material = (column + row) % 2 === 0 ? materials.startWhite : materials.startDark;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(tileWidth, 0.025, tileDepth), material);
      tile.position.set((column - (columns - 1) * 0.5) * tileWidth, 0, (row - 1) * tileDepth);
      tile.receiveShadow = true;
      startLine.add(tile);
    }
  }

  group.add(startLine);

  // Add starting grid slots/boxes behind the finish line
  const tangent = checkpoint.tangent.clone().setY(0).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  const gridPositions = [
    { dist: 4.8, side: 1 },
    { dist: 8.8, side: -1 },
    { dist: 12.8, side: 1 },
    { dist: 16.8, side: -1 }
  ];

  gridPositions.forEach(({ dist, side }, idx) => {
    const gridPos = checkpoint.position.clone()
      .addScaledVector(tangent, -dist)
      .addScaledVector(normal, side * (checkpoint.size.x * 0.22));
    gridPos.y = ROAD_Y + 0.051;

    const slotGroup = new THREE.Group();
    slotGroup.name = `StartGridSlot:${idx}`;
    slotGroup.position.copy(gridPos);
    slotGroup.rotation.y = checkpoint.rotationY;

    const bracketMaterial = materials.startWhite;
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 0.08), bracketMaterial);
    line.receiveShadow = true;
    slotGroup.add(line);

    const sideLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.4), bracketMaterial);
    sideLeft.position.set(-0.8, 0, 0.2);
    sideLeft.receiveShadow = true;
    const sideRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.4), bracketMaterial);
    sideRight.position.set(0.8, 0, 0.2);
    sideRight.receiveShadow = true;

    slotGroup.add(sideLeft, sideRight);
    group.add(slotGroup);
  });

  const checkpointMarker = new THREE.Group();
  checkpointMarker.name = "StartFinishCheckpointGate";
  checkpointMarker.position.copy(checkpoint.position);
  checkpointMarker.position.y = ROAD_Y + 0.09;
  checkpointMarker.rotation.y = checkpoint.rotationY;

  const marker = new THREE.Mesh(new THREE.BoxGeometry(checkpoint.size.x, 0.035, 0.34), materials.checkpoint);
  checkpointMarker.add(marker);
  checkpoint.gate = checkpointMarker;
  group.add(checkpointMarker);
}

function addStartGantry(group, checkpoint, materials) {
  const gantry = new THREE.Group();
  gantry.name = "StartGantry";
  gantry.position.copy(checkpoint.position);
  gantry.rotation.y = checkpoint.rotationY;

  const span = checkpoint.size.x + 3.2;
  const postHeight = 4.2;
  const postGeometry = new THREE.CylinderGeometry(0.24, 0.32, postHeight, 8);
  const topGeometry = new THREE.BoxGeometry(span, 0.58, 0.48);
  const signGeometry = new THREE.BoxGeometry(4.7, 1.28, 0.08);
  const leftPost = new THREE.Mesh(postGeometry, materials.startGantry);
  const rightPost = new THREE.Mesh(postGeometry, materials.startGantry);
  const top = new THREE.Mesh(topGeometry, materials.startGantry);
  const sign = new THREE.Mesh(signGeometry, materials.startSign);

  leftPost.position.set(-span * 0.5, postHeight * 0.5, 0);
  rightPost.position.set(span * 0.5, postHeight * 0.5, 0);
  top.position.set(0, postHeight, 0);
  
  // Shift sign to the grid-facing side (z = -0.28) and rotate by PI so it faces the player
  sign.position.set(0, postHeight - 0.02, -0.28);
  sign.rotation.y = Math.PI;

  [leftPost, rightPost, top, sign].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  gantry.add(leftPost, rightPost, top, sign);

  // Add dynamic F1 starting light lamps under the gantry crossbar facing the starting grid
  const lightsGroup = new THREE.Group();
  lightsGroup.name = "GantryStartLights";
  lightsGroup.position.set(0, postHeight - 0.44, -0.25);

  const lampGeom = new THREE.SphereGeometry(0.16, 12, 12);
  const backboard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.48, 0.08), materials.startGantry);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  lightsGroup.add(backboard);

  const lamps = [];
  for (let i = 0; i < 3; i++) {
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x1f1f24,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.22,
      metalness: 0.1,
      flatShading: true
    });
    const lamp = new THREE.Mesh(lampGeom, lampMat);
    lamp.position.set((i - 1) * 0.46, 0, 0.05);
    lamp.castShadow = true;
    lamp.receiveShadow = true;
    lightsGroup.add(lamp);
    lamps.push(lampMat);
  }
  lightsGroup.userData.lamps = lamps;
  gantry.add(lightsGroup);

  group.add(gantry);
}

function addCheckpointGates(group, checkpoints, material) {
  checkpoints.forEach((checkpoint) => {
    if (checkpoint.id === 0) {
      return;
    }

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

  group.add(ground, road);

  if (definition.id === "vegas") {
    addSegmentedNeonRoadEdges(group, roadData.edgeSamples, definition);
  } else {
    const leftEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, -1), materials.roadEdge);
    leftEdge.name = `${definition.name}:LeftRoadEdge`;
    leftEdge.receiveShadow = true;

    const rightEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, 1), materials.roadEdge);
    rightEdge.name = `${definition.name}:RightRoadEdge`;
    rightEdge.receiveShadow = true;

    group.add(leftEdge, rightEdge);
  }
  addCenterLineDashes(group, roadData.edgeSamples, definition, materials.centerLine);
  addApexCurbs(group, roadData.edgeSamples, definition, materials);
  const barrierMeshes = addBarriers(group, roadData.edgeSamples, definition, materials.barrier);
  const checkpoints = createCheckpoints(curve, definition);
  addStartLine(group, checkpoints[0], materials);
  addStartGantry(group, checkpoints[0], materials);
  addCheckpointGates(group, checkpoints, materials.checkpoint);
  const boostPads = addBoostPads(group, curve, definition, materials.boost);
  addTrackProps(group, curve, definition);

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
    particleProfile: definition.particleProfile,
    scene: definition.scene
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
