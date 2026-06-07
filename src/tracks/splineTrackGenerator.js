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

function getRightVector(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
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

  group.userData.trackInfo = {
    id: definition.id,
    name: definition.name,
    spawn,
    roadSegments: roadData.roadSegments,
    roadHalfWidth,
    centerline,
    checkpoints: [],
    boostPads: [],
    barrierColliders: [],
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
