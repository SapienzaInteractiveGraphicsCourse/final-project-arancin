import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, getRightVector } from "../shared.js";
import { MONACO_ROAD_Y } from "./constants.js";

export function addMonacoLampPosts(group, curve, definition) {
  const postMat = createFlatStandardMaterial({
    color: 0x475569,
    roughness: 0.58,
    metalness: 0.36
  });

  const lampMat = createFlatStandardMaterial({
    color: 0xfffacd,
    emissive: 0xfffacd,
    emissiveIntensity: 1.5,
    roughness: 0.1
  });

  const totalLength = curve.getLength();
  const interval = 16;
  const count = Math.floor(totalLength / interval);

  const postHeight = 3.6;
  const armLength = 1.1;

  for (let i = 0; i < count; i += 1) {
    const progress = (i * interval) / totalLength;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const normal = getRightVector(tangent);

    const side = i % 2 === 0 ? 1 : -1;
    const offset = definition.roadWidth * 0.5 + (definition.barrierOffset ?? 0.85) + 0.42;

    const pos = point.clone().addScaledVector(normal, side * offset);
    pos.y = MONACO_ROAD_Y;

    const heading = getHeading(tangent);

    const postGroup = new THREE.Group();
    postGroup.name = `LampPost_${i}`;
    postGroup.position.copy(pos);
    postGroup.rotation.y = heading;

    // Palo verticale (Vertical post)
    const verticalGeo = new THREE.CylinderGeometry(0.08, 0.12, postHeight, 5);
    const vertical = new THREE.Mesh(verticalGeo, postMat);
    vertical.position.y = postHeight * 0.5;
    vertical.castShadow = true;
    postGroup.add(vertical);

    // Braccio orizzontale (Horizontal arm)
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, armLength);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(-side * armLength * 0.5, postHeight - 0.04, 0);
    arm.rotation.y = Math.PI / 2;
    arm.castShadow = true;
    postGroup.add(arm);

    // Corpo lampada (Lamp fixture)
    const fixtureGeo = new THREE.BoxGeometry(0.24, 0.12, 0.34);
    const fixture = new THREE.Mesh(fixtureGeo, postMat);
    fixture.position.set(-side * armLength, postHeight - 0.1, 0);
    fixture.castShadow = true;
    postGroup.add(fixture);

    const bulbGeo = new THREE.BoxGeometry(0.18, 0.06, 0.26);
    const bulb = new THREE.Mesh(bulbGeo, lampMat);
    bulb.position.set(-side * armLength, postHeight - 0.15, 0);
    postGroup.add(bulb);

    group.add(postGroup);
  }
}

export function addMonacoKerbs(group, curve, definition) {
  const roadWidth = definition.roadWidth;
  const segments = definition.segments;

  // Generiamo gli stessi identici campioni della strada per un allineamento perfetto
  const edgeSamples = [];
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

    edgeSamples.push({
      center: center.clone(),
      normal: right,
      roadHalfWidth: roadWidth * 0.5,
      distance: cumulativeDistance
    });

    previousCenter = center;
  }

  // Costruiamo i vertici e gli indici per le mesh rosse e bianche
  const redVertices = [];
  const redIndices = [];
  const redUvs = [];
  let redVertCount = 0;

  const whiteVertices = [];
  const whiteIndices = [];
  const whiteUvs = [];
  let whiteVertCount = 0;

  // Larghezza del cordolo sul bordo della pista (completamente sull'asfalto, mai oltre il bordo)
  // Bordo esterno = esattamente al bordo della strada
  // Bordo interno = 1.6m verso il centro della pista
  const KERB_WIDTH = 1.6;
  const ROAD_UV_SCALE = 8;

  // Ciclo su entrambi i lati: sinistra (-1) e destra (1)
  [-1, 1].forEach((side) => {
    for (let i = 0; i < edgeSamples.length - 1; i++) {
      const sample1 = edgeSamples[i];
      const sample2 = edgeSamples[i + 1];

      // "outer" = esattamente al bordo della strada (mai oltre → mai sotto il muro)
      // "inner" = KERB_WIDTH verso il centro
      const outerDist1 = sample1.roadHalfWidth;
      const innerDist1 = sample1.roadHalfWidth - KERB_WIDTH;
      const outerDist2 = sample2.roadHalfWidth;
      const innerDist2 = sample2.roadHalfWidth - KERB_WIDTH;

      const inner1 = sample1.center.clone().addScaledVector(sample1.normal, side * innerDist1);
      const outer1 = sample1.center.clone().addScaledVector(sample1.normal, side * outerDist1);
      const inner2 = sample2.center.clone().addScaledVector(sample2.normal, side * innerDist2);
      const outer2 = sample2.center.clone().addScaledVector(sample2.normal, side * outerDist2);

      // Piatto sull'asfalto, leggermente rialzato per non z-fight
      const Y = MONACO_ROAD_Y + 0.015;
      inner1.y = Y;
      outer1.y = Y;
      inner2.y = Y;
      outer2.y = Y;

      // Alterniamo il colore a ogni segmento
      if (i % 2 === 0) {
        redVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        redUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        redIndices.push(
          redVertCount, redVertCount + 2, redVertCount + 1,
          redVertCount + 1, redVertCount + 2, redVertCount + 3
        );
        redVertCount += 4;
      } else {
        whiteVertices.push(
          inner1.x, inner1.y, inner1.z,
          outer1.x, outer1.y, outer1.z,
          inner2.x, inner2.y, inner2.z,
          outer2.x, outer2.y, outer2.z
        );
        whiteUvs.push(
          0, sample1.distance / ROAD_UV_SCALE,
          1, sample1.distance / ROAD_UV_SCALE,
          0, sample2.distance / ROAD_UV_SCALE,
          1, sample2.distance / ROAD_UV_SCALE
        );
        whiteIndices.push(
          whiteVertCount, whiteVertCount + 2, whiteVertCount + 1,
          whiteVertCount + 1, whiteVertCount + 2, whiteVertCount + 3
        );
        whiteVertCount += 4;
      }
    }
  });

  const redMat = createFlatStandardMaterial({
    color: 0xd92d2d, // Rosso vivace Monaco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const whiteMat = createFlatStandardMaterial({
    color: 0xfafafa, // Bianco
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  if (redVertices.length > 0) {
    const redGeo = new THREE.BufferGeometry();
    redGeo.setAttribute("position", new THREE.Float32BufferAttribute(redVertices, 3));
    redGeo.setAttribute("uv", new THREE.Float32BufferAttribute(redUvs, 2));
    redGeo.setIndex(redIndices);
    redGeo.computeVertexNormals();

    const redMesh = new THREE.Mesh(redGeo, redMat);
    redMesh.name = "MonacoKerbsRed";
    redMesh.receiveShadow = true;
    redMesh.castShadow = true;
    group.add(redMesh);
  }

  if (whiteVertices.length > 0) {
    const whiteGeo = new THREE.BufferGeometry();
    whiteGeo.setAttribute("position", new THREE.Float32BufferAttribute(whiteVertices, 3));
    whiteGeo.setAttribute("uv", new THREE.Float32BufferAttribute(whiteUvs, 2));
    whiteGeo.setIndex(whiteIndices);
    whiteGeo.computeVertexNormals();

    const whiteMesh = new THREE.Mesh(whiteGeo, whiteMat);
    whiteMesh.name = "MonacoKerbsWhite";
    whiteMesh.receiveShadow = true;
    whiteMesh.castShadow = true;
    group.add(whiteMesh);
  }
}

