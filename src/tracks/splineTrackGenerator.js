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

function noopTrackProps() {}

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

function sampleEdgeByLoopDistance(edgeSamples, distance) {
  const totalDistance = edgeSamples[edgeSamples.length - 1].distance;
  const wrappedDistance = ((distance % totalDistance) + totalDistance) % totalDistance;

  return sampleEdgeByDistance(edgeSamples, wrappedDistance);
}

function addCenterLineDashes(group, edgeSamples, definition, material) {
  const totalDistance = edgeSamples[edgeSamples.length - 1].distance;
  const dashCount = Math.max(1, Math.round(totalDistance / CENTER_DASH_INTERVAL));
  const geometry = new THREE.BoxGeometry(CENTER_DASH_WIDTH, CENTER_DASH_HEIGHT, CENTER_DASH_LENGTH);
  const dashes = new THREE.InstancedMesh(geometry, material, dashCount);
  const matrix = new THREE.Matrix4();
  const spacing = totalDistance / dashCount;

  dashes.name = `${definition.name}:CenterLineDashes`;
  dashes.receiveShadow = true;

  for (let index = 0; index < dashCount; index += 1) {
    const sample = sampleEdgeByLoopDistance(edgeSamples, index * spacing + spacing * 0.5);
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
  if (definition.id === "monaco" || definition.id === "beach" || definition.id === "vegas") {
    return;
  }

  const isVegas = definition.id === "vegas";
  const curbWidth = isVegas ? 0.12 : CURB_WIDTH;
  const curbHeight = isVegas ? 0.02 : 0.035;
  const curbLength = isVegas ? CURB_LENGTH * 0.85 : CURB_LENGTH;
  
  const curbGeometry = new THREE.BoxGeometry(curbWidth, curbHeight, curbLength);
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
      .addScaledVector(sample.normal, insideSide * (sample.roadHalfWidth - curbWidth * 0.5));
    position.y = ROAD_Y + (isVegas ? 0.02 : 0.055);

    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), getHeading(sample.tangent));
    matrix.compose(position, quaternion, scale);

    if ((index / CURB_SAMPLE_STEP) % 2 < 1) {
      redMatrices.push(matrix.clone());
    } else {
      whiteMatrices.push(matrix.clone());
    }
  }

  if (isVegas) {
    const neonCurbMaterial = new THREE.MeshStandardMaterial({
      color: 0x32f6ff,
      emissive: 0x32f6ff,
      emissiveIntensity: 2.8,
      roughness: 0.2,
      metalness: 0.1
    });
    const allMatrices = redMatrices.concat(whiteMatrices);
    if (allMatrices.length > 0) {
      const curbs = new THREE.InstancedMesh(curbGeometry, neonCurbMaterial, allMatrices.length);
      curbs.name = `${definition.name}:ApexCurbNeon`;
      allMatrices.forEach((curbMatrix, i) => curbs.setMatrixAt(i, curbMatrix));
      curbs.instanceMatrix.needsUpdate = true;
      group.add(curbs);
    }
  } else {
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
}

function createBarrierCollider(start, end, height, thickness) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const visualLength = length + 0.08;

  return {
    center: new THREE.Vector3((start.x + end.x) * 0.5, height * 0.5, (start.z + end.z) * 0.5),
    rotationY: -Math.atan2(dz, dx),
    halfLength: visualLength * 0.5,
    halfThickness: thickness * 0.5
  };
}

function createBarrierRibbonGeometry(edgeSamples, side, offset, height, thickness) {
  const vertices = [];
  const indices = [];
  const sampleCount = edgeSamples.length;

  edgeSamples.forEach((sample) => {
    const base = (side < 0 ? sample.left : sample.right)
      .clone()
      .addScaledVector(sample.normal, side * offset);
    const outer = base.clone().addScaledVector(sample.normal, side * thickness);
    base.y = ROAD_Y;
    outer.y = ROAD_Y;

    vertices.push(
      base.x, ROAD_Y, base.z,
      outer.x, ROAD_Y, outer.z,
      base.x, ROAD_Y + height, base.z,
      outer.x, ROAD_Y + height, outer.z
    );
  });

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const current = index * 4;
    const next = (index + 1) * 4;

    indices.push(
      current, next, current + 2,
      current + 2, next, next + 2,
      current + 1, current + 3, next + 1,
      current + 3, next + 3, next + 1,
      current + 2, next + 2, current + 3,
      current + 3, next + 2, next + 3
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBeachShoulderGeometry(edgeSamples, side, width) {
  const vertices = [];
  const indices = [];

  edgeSamples.forEach((sample) => {
    const roadEdge = side < 0 ? sample.left.clone() : sample.right.clone();
    const shoulderEdge = roadEdge.clone().addScaledVector(sample.normal, side * width);
    roadEdge.y = ROAD_Y + 0.012;
    shoulderEdge.y = ROAD_Y + 0.012;

    vertices.push(
      roadEdge.x, roadEdge.y, roadEdge.z,
      shoulderEdge.x, shoulderEdge.y, shoulderEdge.z
    );
  });

  for (let index = 0; index < edgeSamples.length - 1; index += 1) {
    const current = index * 2;
    const next = (index + 1) * 2;
    indices.push(current, next, current + 1, current + 1, next, next + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBarriers(group, edgeSamples, definition, material) {
  const colliders = [];
  const matrices = [];
  const offset = definition.barrierOffset ?? 0.85;
  const height = definition.barrierHeight ?? 0.68;
  const thickness = definition.barrierThickness ?? 0.44;
  const geometry = new THREE.BoxGeometry(1, height, thickness);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let index = 0; index < edgeSamples.length - 1; index += BARRIER_SAMPLE_STEP) {
    const current = edgeSamples[index];
    const next = edgeSamples[Math.min(index + BARRIER_SAMPLE_STEP, edgeSamples.length - 1)];
    const leftStart = current.left.clone().addScaledVector(current.normal, -offset);
    const leftEnd = next.left.clone().addScaledVector(next.normal, -offset);
    const rightStart = current.right.clone().addScaledVector(current.normal, offset);
    const rightEnd = next.right.clone().addScaledVector(next.normal, offset);
    const left = createBarrierCollider(leftStart, leftEnd, height, thickness);
    const right = createBarrierCollider(rightStart, rightEnd, height, thickness);

    [left, right].forEach((collider) => {
      quaternion.setFromAxisAngle(UP, collider.rotationY);
      scale.set(collider.halfLength * 2, 1, 1);
      matrix.compose(collider.center, quaternion, scale);
      matrices.push(matrix.clone());
      colliders.push(collider);
    });
  }

  if (definition.id === "beach") {
    const shoulderMaterial = material.clone();
    shoulderMaterial.color.setHex(0xe0c66f);
    shoulderMaterial.side = THREE.DoubleSide;
    const barrierMaterial = material.clone();
    barrierMaterial.side = THREE.DoubleSide;
    const shoulderWidth = offset;

    [-1, 1].forEach((side) => {
      if (shoulderWidth > 0) {
        const shoulder = new THREE.Mesh(
          createBeachShoulderGeometry(edgeSamples, side, shoulderWidth),
          shoulderMaterial
        );
        shoulder.name = `${definition.name}:BarrierShoulder:${side}`;
        shoulder.receiveShadow = true;
        group.add(shoulder);
      }

      const barrier = new THREE.Mesh(
        createBarrierRibbonGeometry(edgeSamples, side, offset, height, thickness),
        barrierMaterial
      );
      barrier.name = `${definition.name}:BarrierRibbon:${side}`;
      barrier.receiveShadow = true;
      group.add(barrier);
    });
    return colliders;
  }

  const barriers = new THREE.InstancedMesh(geometry, material, matrices.length);
  barriers.name = `${definition.name}:Barriers`;
  barriers.castShadow = false;
  barriers.receiveShadow = true;
  matrices.forEach((barrierMatrix, index) => barriers.setMatrixAt(index, barrierMatrix));
  barriers.instanceMatrix.needsUpdate = true;
  group.add(barriers);

  return colliders;
}

function createCheckpoints(curve, definition) {
  return definition.checkpointTs.map((progress, index) => {
    const position = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();

    return {
      id: index,
      name: index === 0 ? "Start" : `Sector ${index}`,
      order: index,
      progress,
      isStartFinish: index === 0,
      position: new THREE.Vector3(position.x, 0, position.z),
      rotationY: getHeading(tangent),
      size: new THREE.Vector3(definition.roadWidth + 0.7, 3, 1.4),
      tangent
    };
  });
}

function addStartLine(group, checkpoint, materials, curve, roadHalfWidth) {
  const startLine = new THREE.Group();
  startLine.name = "StartFinishLine";
  startLine.position.copy(checkpoint.position);
  startLine.position.y = ROAD_Y + 0.055;
  startLine.rotation.y = checkpoint.rotationY;

  const columns = 12;
  const rows = 4;
  const tileWidth = checkpoint.size.x / columns;
  const tileDepth = 0.36;
  const tileGeometry = new THREE.BoxGeometry(tileWidth, 0.025, tileDepth);
  const whiteMatrices = [];
  const darkMatrices = [];
  const matrix = new THREE.Matrix4();

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      matrix.makeTranslation((column - (columns - 1) * 0.5) * tileWidth, 0, (row - 1) * tileDepth);
      if ((column + row) % 2 === 0) {
        whiteMatrices.push(matrix.clone());
      } else {
        darkMatrices.push(matrix.clone());
      }
    }
  }

  [
    { matrices: whiteMatrices, material: materials.startWhite, name: "StartLineWhiteTiles" },
    { matrices: darkMatrices, material: materials.startDark, name: "StartLineDarkTiles" }
  ].forEach(({ matrices, material, name }) => {
    const tiles = new THREE.InstancedMesh(tileGeometry, material, matrices.length);
    tiles.name = name;
    tiles.receiveShadow = true;
    matrices.forEach((tileMatrix, tileIndex) => tiles.setMatrixAt(tileIndex, tileMatrix));
    tiles.instanceMatrix.needsUpdate = true;
    startLine.add(tiles);
  });

  group.add(startLine);

  // Add starting grid slots/boxes behind the finish line.
  // Sample the curve at each slot distance so slots follow the track curvature.
  const startT = checkpoint.progress ?? 0;
  const totalLength = curve.getLength();
  const gridDistances = [4.8, 8.8, 12.8, 16.8];
  const gridSides = [1, -1, 1, -1];

  gridDistances.forEach((dist, idx) => {
    // Walk backwards along the curve by 'dist' meters
    const backT = ((startT - dist / totalLength) + 1) % 1;
    const slotPoint = curve.getPointAt(backT);
    const slotTangent = curve.getTangentAt(backT).setY(0).normalize();
    const slotNormal = new THREE.Vector3(-slotTangent.z, 0, slotTangent.x);
    const side = gridSides[idx];
    const sideOffset = side * roadHalfWidth * 0.44;

    const slotPos = slotPoint.clone().addScaledVector(slotNormal, sideOffset);
    slotPos.y = ROAD_Y + 0.051;

    const slotGroup = new THREE.Group();
    slotGroup.name = `StartGridSlot:${idx}`;
    slotGroup.position.copy(slotPos);
    slotGroup.rotation.y = getHeading(slotTangent);

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

    createBoostPadVisual(padGroup, material, definition);
    group.add(padGroup);

    return {
      position: new THREE.Vector3(point.x, 0.38, point.z),
      radius: 1.55,
      heading
    };
  });
}

function createBoostPadVisual(padGroup, material, definition) {
  const boostColor = definition.palette.boost ?? 0xffd23a;
  const accentColor = definition.id === "beach" ? 0x7dd3fc : (definition.id === "monaco" ? 0xffffff : 0xfff7ad);
  const glowMaterial = material.clone();
  glowMaterial.emissive?.setHex(boostColor);
  glowMaterial.emissiveIntensity = Math.max(glowMaterial.emissiveIntensity ?? 0, 1.9);

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: boostColor,
    emissive: boostColor,
    emissiveIntensity: definition.id === "vegas" ? 3.4 : 2.4,
    roughness: 0.24,
    metalness: 0.08,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: definition.id === "vegas" ? 4.2 : 2.8,
    roughness: 0.18,
    metalness: 0.04
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.045, 56), glowMaterial);
  base.name = "BoostPadDisc";
  base.receiveShadow = true;
  padGroup.add(base);

  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.28, 56), glassMaterial);
  glowDisc.name = "BoostPadGlow";
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.035;
  padGroup.add(glowDisc);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.055, 8, 72), accentMaterial);
  outerRing.name = "BoostPadOuterRing";
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.075;
  outerRing.userData.spin = { x: 0, y: 0.9, z: 0 };
  padGroup.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.035, 8, 56), glassMaterial);
  innerRing.name = "BoostPadInnerRing";
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.085;
  innerRing.userData.spin = { x: 0, y: -1.35, z: 0 };
  padGroup.add(innerRing);

  [-0.32, 0.18].forEach((zOffset, chevronIndex) => {
    addBoostChevron(padGroup, accentMaterial, zOffset, chevronIndex);
  });
}

function addBoostChevron(group, material, zOffset, chevronIndex) {
  const barGeometry = new THREE.BoxGeometry(0.18, 0.055, 0.82);
  const leftBar = new THREE.Mesh(barGeometry, material);
  const rightBar = new THREE.Mesh(barGeometry, material);

  leftBar.name = `BoostChevronLeft:${chevronIndex}`;
  rightBar.name = `BoostChevronRight:${chevronIndex}`;
  leftBar.position.set(-0.24, 0.13, zOffset);
  rightBar.position.set(0.24, 0.13, zOffset);
  leftBar.rotation.y = 0.58;
  rightBar.rotation.y = -0.58;
  group.add(leftBar, rightBar);
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

export function createSplineTrack(definition, propsBuilder = noopTrackProps) {
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

  const leftEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, -1), materials.roadEdge);
  leftEdge.name = `${definition.name}:LeftRoadEdge`;
  leftEdge.receiveShadow = true;

  const rightEdge = new THREE.Mesh(createEdgeRibbonGeometry(roadData.edgeSamples, 1), materials.roadEdge);
  rightEdge.name = `${definition.name}:RightRoadEdge`;
  rightEdge.receiveShadow = true;

  group.add(leftEdge, rightEdge);
  addCenterLineDashes(group, roadData.edgeSamples, definition, materials.centerLine);
  addApexCurbs(group, roadData.edgeSamples, definition, materials);
  const barrierColliders = addBarriers(group, roadData.edgeSamples, definition, materials.barrier);
  const checkpoints = createCheckpoints(curve, definition);
  addStartLine(group, checkpoints[0], materials, curve, roadHalfWidth);
  addStartGantry(group, checkpoints[0], materials);
  addCheckpointGates(group, checkpoints, materials.checkpoint);
  const boostPads = addBoostPads(group, curve, definition, materials.boost);
  propsBuilder(group, curve, definition);

  group.userData.trackInfo = {
    id: definition.id,
    name: definition.name,
    spawn,
    roadSegments: roadData.roadSegments,
    roadHalfWidth,
    centerline,
    checkpoints,
    boostPads,
    barrierColliders,
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
