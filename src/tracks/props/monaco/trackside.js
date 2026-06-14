import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { getHeading, optimizeStaticDecorativeProps, UP } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples, createMonacoRibbonMesh, createMonacoVerticalRibbonMesh } from "./common.js";
import { addMonacoFerrariTracksideFlags } from "./flags.js";
import { MONACO_ROAD_Y } from "./constants.js";

export function addMonacoTracksideVisuals(group, curve, definition) {
  const tracksideGroup = new THREE.Group();
  tracksideGroup.name = "MonacoTracksideVisuals";

  const armcoMat = createFlatStandardMaterial({
    color: 0xbfc5c9,
    roughness: 0.42,
    metalness: 0.65,
    side: THREE.DoubleSide
  });
  const postMat = createFlatStandardMaterial({ color: 0x4b5563, roughness: 0.58, metalness: 0.42 });
  const netMat = createFlatStandardMaterial({
    color: 0x7d8790,
    roughness: 0.7,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide
  });
  netMat.depthWrite = false;
  const lampMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.45 });
  const lampGlowMat = createFlatStandardMaterial({
    color: 0xfff0b8,
    emissive: 0xfff0b8,
    emissiveIntensity: 0.75,
    roughness: 0.22
  });
  const sponsorMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.55 }),
    createFlatStandardMaterial({ color: 0x0f3d68, roughness: 0.55 }),
    createFlatStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    createFlatStandardMaterial({ color: 0xf2c94c, roughness: 0.5 })
  ];

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierOffset = roadHalfWidth + (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5) * 0.5 + 0.18;
  const trackEdgeGuardOffset = roadHalfWidth + 0.58;
  const postGeometry = new THREE.BoxGeometry(0.14, 1.3, 0.14);
  const sponsorGeometry = new THREE.BoxGeometry(3.2, 1.0, 0.08);
  const lampPoleGeometry = new THREE.CylinderGeometry(0.055, 0.075, 3.8, 6);
  const lampArmGeometry = new THREE.BoxGeometry(1.15, 0.06, 0.06);
  const lampHeadGeometry = new THREE.BoxGeometry(0.45, 0.16, 0.28);
  const postMatrices = [];
  const sponsorMatrices = sponsorMaterials.map(() => []);
  const lampPoleMatrices = [];
  const lampArmMatrices = [];
  const lampHeadMatrices = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  [-1, 1].forEach((side) => {
    tracksideGroup.add(createMonacoVerticalRibbonMesh(curve, definition, {
      name: `MonacoTrackEdgeGuard:${side}`,
      side,
      start: 0,
      end: 1,
      offset: trackEdgeGuardOffset,
      yBottom: MONACO_ROAD_Y + 0.1,
      yTop: MONACO_ROAD_Y + 0.58,
      material: armcoMat,
      sampleStep: 1
    }));
    tracksideGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoTrackEdgeGuardTop:${side}`,
      side,
      start: 0,
      end: 1,
      nearOffset: trackEdgeGuardOffset - 0.08,
      farOffset: trackEdgeGuardOffset + 0.08,
      y: MONACO_ROAD_Y + 0.6,
      material: armcoMat,
      sampleStep: 1
    }));
    tracksideGroup.add(createMonacoVerticalRibbonMesh(curve, definition, {
      name: `MonacoContinuousArmco:${side}`,
      side,
      start: 0,
      end: 1,
      offset: barrierOffset,
      yBottom: MONACO_ROAD_Y + 0.18,
      yTop: MONACO_ROAD_Y + 0.72,
      material: armcoMat,
      sampleStep: 1
    }));
    tracksideGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoContinuousArmcoTop:${side}`,
      side,
      start: 0,
      end: 1,
      nearOffset: barrierOffset - 0.08,
      farOffset: barrierOffset + 0.08,
      y: MONACO_ROAD_Y + 0.74,
      material: armcoMat,
      sampleStep: 1
    }));

    const samples = collectMonacoSamples(curve, 0, 0.998, 3.1);
    samples.forEach((sample, index) => {
      const right = sample.right.clone().multiplyScalar(side);
      const tangent = sample.tangent.clone().setY(0).normalize();

      if (index % 2 === 0) {
        const postPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 0.12));
        postPosition.y = MONACO_ROAD_Y + 0.65;
        matrix.makeBasis(right, UP, tangent.clone().negate());
        matrix.setPosition(postPosition);
        postMatrices.push(matrix.clone());
      }

      if (index % 7 === 0) {
        const sponsorPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 0.18));
        sponsorPosition.y = MONACO_ROAD_Y + 0.95;
        matrix.makeBasis(right, UP, tangent.clone().negate());
        matrix.setPosition(sponsorPosition);
        sponsorMatrices[(index + (side > 0 ? 1 : 0)) % sponsorMatrices.length].push(matrix.clone());
      }

      if (index % 13 === 0) {
        const lampPosition = sample.center.clone().addScaledVector(sample.right, side * (barrierOffset + 1.2));
        lampPosition.y = MONACO_ROAD_Y + 1.9;
        quaternion.setFromAxisAngle(UP, getHeading(tangent));
        matrix.compose(lampPosition, quaternion, scale);
        lampPoleMatrices.push(matrix.clone());

        const armPosition = lampPosition.clone();
        armPosition.y += 1.7;
        armPosition.addScaledVector(sample.right, -side * 0.42);
        matrix.compose(armPosition, quaternion, scale);
        lampArmMatrices.push(matrix.clone());

        const headPosition = armPosition.clone().addScaledVector(sample.right, -side * 0.58);
        matrix.compose(headPosition, quaternion, scale);
        lampHeadMatrices.push(matrix.clone());
      }
    });

    [
      [0.02, 0.24],
      [0.28, 0.48],
      [0.52, 0.72],
      [0.76, 0.96]
    ].forEach(([start, end], sectionIndex) => {
      tracksideGroup.add(createMonacoVerticalRibbonMesh(curve, definition, {
        name: `MonacoCatchFence:${side}:${sectionIndex}`,
        side,
        start,
        end,
        offset: barrierOffset + 0.36,
        yBottom: MONACO_ROAD_Y + 0.58,
        yTop: MONACO_ROAD_Y + 2.65,
        material: netMat,
        sampleStep: 4
      }));
    });
  });

  addMonacoInstancedPart(tracksideGroup, postGeometry, postMat, postMatrices, "MonacoArmcoPosts");
  sponsorMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(tracksideGroup, sponsorGeometry, sponsorMaterials[index], matrices, `MonacoSponsorBoards:${index}`);
  });
  addMonacoInstancedPart(tracksideGroup, lampPoleGeometry, lampMat, lampPoleMatrices, "MonacoTrackLampPoles");
  addMonacoInstancedPart(tracksideGroup, lampArmGeometry, lampMat, lampArmMatrices, "MonacoTrackLampArms");
  addMonacoInstancedPart(tracksideGroup, lampHeadGeometry, lampGlowMat, lampHeadMatrices, "MonacoTrackLampHeads");
  addMonacoFerrariTracksideFlags(tracksideGroup, curve, definition, barrierOffset);

  optimizeStaticDecorativeProps(tracksideGroup, ["MonacoCatchFence"]);
  group.add(tracksideGroup);
}
