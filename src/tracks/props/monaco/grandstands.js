import * as THREE from "three";
import { createFlatStandardMaterial } from "../../trackMaterials.js";
import { optimizeStaticDecorativeProps, pseudoRandom, UP } from "../shared.js";
import { addMonacoInstancedPart, collectMonacoSamples, createMonacoRibbonMesh } from "./common.js";
import { MONACO_ROAD_Y } from "./constants.js";

function addMonacoSeatedCrowd(group, curve, definition, sections, baseOffset) {
  const shirtMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.78 }),
    createFlatStandardMaterial({ color: 0xf3f0e8, roughness: 0.8 }),
    createFlatStandardMaterial({ color: 0x1f5f9e, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0xf2c94c, roughness: 0.75 }),
    createFlatStandardMaterial({ color: 0x2f80ed, roughness: 0.8 }),
    createFlatStandardMaterial({ color: 0x111827, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0x16a34a, roughness: 0.78 })
  ];
  const skinMaterials = [
    createFlatStandardMaterial({ color: 0xf2c09a, roughness: 0.82 }),
    createFlatStandardMaterial({ color: 0xc68642, roughness: 0.84 }),
    createFlatStandardMaterial({ color: 0x8d5524, roughness: 0.86 })
  ];
  const capMaterials = [
    createFlatStandardMaterial({ color: 0xd92d2d, roughness: 0.72 }),
    createFlatStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
    createFlatStandardMaterial({ color: 0x1f2937, roughness: 0.78 }),
    createFlatStandardMaterial({ color: 0xffd21f, roughness: 0.74 })
  ];
  const pantsMaterial = createFlatStandardMaterial({ color: 0x1f2937, roughness: 0.86 });
  const lightPantsMaterial = createFlatStandardMaterial({ color: 0xd8d2c6, roughness: 0.84 });
  const shoeMaterial = createFlatStandardMaterial({ color: 0x15191f, roughness: 0.72 });
  const ferrariFlagMat = createFlatStandardMaterial({
    color: 0xd71920,
    roughness: 0.58,
    side: THREE.DoubleSide
  });
  const ferrariFlagAccentMat = createFlatStandardMaterial({
    color: 0xffd21f,
    roughness: 0.62,
    side: THREE.DoubleSide
  });
  const flagPoleMat = createFlatStandardMaterial({ color: 0x2f3a45, roughness: 0.52, metalness: 0.42 });

  const torsoGeometry = new THREE.BoxGeometry(0.26, 0.38, 0.16);
  const headGeometry = new THREE.SphereGeometry(0.12, 10, 8);
  const capGeometry = new THREE.CylinderGeometry(0.13, 0.14, 0.05, 10);
  const armGeometry = new THREE.BoxGeometry(0.06, 0.24, 0.06);
  const legGeometry = new THREE.BoxGeometry(0.1, 0.09, 0.36);
  const shoeGeometry = new THREE.BoxGeometry(0.11, 0.055, 0.16);
  const flagGeometry = new THREE.PlaneGeometry(0.42, 0.28);
  const flagAccentGeometry = new THREE.PlaneGeometry(0.14, 0.08);
  const flagPoleGeometry = new THREE.CylinderGeometry(0.014, 0.014, 0.72, 7);

  const torsoMatrices = shirtMaterials.map(() => []);
  const headMatrices = skinMaterials.map(() => []);
  const capMatrices = capMaterials.map(() => []);
  const armMatrices = skinMaterials.map(() => []);
  const darkLegMatrices = [];
  const lightLegMatrices = [];
  const shoeMatrices = [];
  const ferrariFlagMatrices = [];
  const ferrariFlagAccentMatrices = [];
  const flagPoleMatrices = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const torsoQuaternion = new THREE.Quaternion();
  const leftArmQuaternion = new THREE.Quaternion();
  const rightArmQuaternion = new THREE.Quaternion();
  const leftLegQuaternion = new THREE.Quaternion();
  const rightLegQuaternion = new THREE.Quaternion();
  const flagQuaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const personScale = new THREE.Vector3();
  const flagScale = new THREE.Vector3(1, 1, 1);

  sections.forEach((section, sectionIndex) => {
    const samples = collectMonacoSamples(curve, section.start, section.end, 0.58);

    samples.forEach((sample, sampleIndex) => {
      const toTrack = sample.center.clone().sub(
        sample.center.clone().addScaledVector(sample.right, section.side * baseOffset)
      ).setY(0).normalize();
      const rotationY = Math.atan2(toTrack.x, toTrack.z);
      quaternion.setFromAxisAngle(UP, rotationY);

      for (let row = 0; row < 7; row += 1) {
        const seed = sectionIndex * 10000 + sampleIndex * 17 + row * 101;
        const rowCrowding = row < 2 ? 0.95 : row < 5 ? 0.985 : 0.92;
        const microGap = pseudoRandom(sectionIndex * 500 + Math.floor(sampleIndex / 5) * 37 + row * 19);
        if (pseudoRandom(seed) > rowCrowding && microGap < 0.45) {
          continue;
        }
        if (microGap < 0.012) {
          continue;
        }

        const seatOffset = baseOffset + row * 0.72 + 0.34 + (pseudoRandom(seed + 1) - 0.5) * 0.08;
        const rowY = MONACO_ROAD_Y + 0.17 + row * 0.36;
        const jitter = (pseudoRandom(seed + 2) - 0.5) * 0.16;
        const base = sample.center
          .clone()
          .addScaledVector(sample.right, section.side * seatOffset)
          .addScaledVector(sample.tangent, jitter);
        const shirtIndex = seed % torsoMatrices.length;
        const skinIndex = seed % headMatrices.length;
        const heightScale = 1.02 + pseudoRandom(seed + 4) * 0.14;
        const widthScale = 0.92 + pseudoRandom(seed + 5) * 0.12;
        personScale.set(widthScale, heightScale, widthScale);

        torsoQuaternion.copy(quaternion).multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1 + pseudoRandom(seed + 6) * 0.08, 0, (pseudoRandom(seed + 7) - 0.5) * 0.1))
        );

        const torsoPosition = base.clone();
        torsoPosition.y = rowY + 0.24;
        torsoPosition.addScaledVector(toTrack, -0.035);
        matrix.compose(torsoPosition, torsoQuaternion, personScale);
        torsoMatrices[shirtIndex].push(matrix.clone());

        const headPosition = base.clone();
        headPosition.y = rowY + 0.54;
        headPosition.addScaledVector(toTrack, -0.015);
        matrix.compose(headPosition, quaternion, personScale);
        headMatrices[skinIndex].push(matrix.clone());

        if (pseudoRandom(seed + 8) > 0.28) {
          const capPosition = base.clone();
          capPosition.y = rowY + 0.66;
          capPosition.addScaledVector(toTrack, -0.015);
          matrix.compose(capPosition, quaternion, personScale);
          capMatrices[seed % capMatrices.length].push(matrix.clone());
        }

        const cheering = pseudoRandom(seed + 9) > 0.82;
        leftArmQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cheering ? -0.85 : 0.64, 0, cheering ? 0.72 : 0.3)));
        rightArmQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(cheering ? -0.68 : 0.56, 0, cheering ? -0.72 : -0.3)));

        const leftArmPosition = base.clone().addScaledVector(sample.tangent, -0.12);
        leftArmPosition.addScaledVector(toTrack, cheering ? 0.0 : 0.05);
        leftArmPosition.y = rowY + (cheering ? 0.44 : 0.27);
        matrix.compose(leftArmPosition, leftArmQuaternion, personScale);
        armMatrices[skinIndex].push(matrix.clone());

        const rightArmPosition = base.clone().addScaledVector(sample.tangent, 0.12);
        rightArmPosition.addScaledVector(toTrack, cheering ? 0.0 : 0.05);
        rightArmPosition.y = rowY + (cheering ? 0.46 : 0.27);
        matrix.compose(rightArmPosition, rightArmQuaternion, personScale);
        armMatrices[skinIndex].push(matrix.clone());

        const leftShinQuaternion = new THREE.Quaternion();
        const rightShinQuaternion = new THREE.Quaternion();
        leftLegQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0.08)));
        rightLegQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, -0.08)));
        leftShinQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.72, 0, 0.05)));
        rightShinQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.72, 0, -0.05)));
        [-1, 1].forEach((legSide) => {
          const thighPosition = base
            .clone()
            .addScaledVector(toTrack, 0.18)
            .addScaledVector(sample.tangent, legSide * 0.075);
          thighPosition.y = rowY + 0.13;
          matrix.compose(thighPosition, legSide < 0 ? leftLegQuaternion : rightLegQuaternion, personScale);
          (pseudoRandom(seed + 10) > 0.34 ? darkLegMatrices : lightLegMatrices).push(matrix.clone());

          const shinPosition = base
            .clone()
            .addScaledVector(toTrack, 0.34)
            .addScaledVector(sample.tangent, legSide * 0.075);
          shinPosition.y = rowY + 0.015;
          matrix.compose(shinPosition, legSide < 0 ? leftShinQuaternion : rightShinQuaternion, personScale);
          (pseudoRandom(seed + 10) > 0.34 ? darkLegMatrices : lightLegMatrices).push(matrix.clone());

          const shoePosition = base
            .clone()
            .addScaledVector(toTrack, 0.48)
            .addScaledVector(sample.tangent, legSide * 0.075);
          shoePosition.y = rowY + 0.018;
          matrix.compose(shoePosition, quaternion, personScale);
          shoeMatrices.push(matrix.clone());
        });

        if ((shirtIndex === 0 || seed % 29 === 0) && row > 2 && sampleIndex % 6 === 2 && pseudoRandom(seed + 12) > 0.86) {
          const flagBase = base
            .clone()
            .addScaledVector(sample.tangent, 0.18)
            .addScaledVector(toTrack, -0.04);
          flagBase.y = rowY + 0.62;
          matrix.compose(flagBase, quaternion, scale);
          flagPoleMatrices.push(matrix.clone());

          const flagPosition = flagBase.clone().addScaledVector(sample.tangent, 0.16);
          flagPosition.y += 0.24;
          flagQuaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (pseudoRandom(seed + 13) - 0.5) * 0.18)));
          matrix.compose(flagPosition, flagQuaternion, flagScale);
          ferrariFlagMatrices.push(matrix.clone());

          const accentPosition = flagPosition.clone().addScaledVector(toTrack, 0.006);
          accentPosition.y += 0.01;
          matrix.compose(accentPosition, flagQuaternion, flagScale);
          ferrariFlagAccentMatrices.push(matrix.clone());
        }
      }
    });
  });

  torsoMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, torsoGeometry, shirtMaterials[index], matrices, `MonacoCrowdTorso:${index}`);
  });
  headMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, headGeometry, skinMaterials[index], matrices, `MonacoCrowdHead:${index}`);
  });
  capMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, capGeometry, capMaterials[index], matrices, `MonacoCrowdCap:${index}`);
  });
  armMatrices.forEach((matrices, index) => {
    addMonacoInstancedPart(group, armGeometry, skinMaterials[index], matrices, `MonacoCrowdArms:${index}`);
  });
  addMonacoInstancedPart(group, legGeometry, pantsMaterial, darkLegMatrices, "MonacoCrowdDarkSeatedLegs");
  addMonacoInstancedPart(group, legGeometry, lightPantsMaterial, lightLegMatrices, "MonacoCrowdLightSeatedLegs");
  addMonacoInstancedPart(group, shoeGeometry, shoeMaterial, shoeMatrices, "MonacoCrowdShoes");
  addMonacoInstancedPart(group, flagPoleGeometry, flagPoleMat, flagPoleMatrices, "MonacoCrowdFerrariFlagPoles");
  addMonacoInstancedPart(group, flagGeometry, ferrariFlagMat, ferrariFlagMatrices, "MonacoCrowdFerrariFlags");
  addMonacoInstancedPart(group, flagAccentGeometry, ferrariFlagAccentMat, ferrariFlagAccentMatrices, "MonacoCrowdFerrariFlagAccents");
}

export function addMonacoContinuousInnerGrandstands(group, curve, definition) {
  const grandstandGroup = new THREE.Group();
  grandstandGroup.name = "MonacoInnerContinuousGrandstands";

  const concreteMat = createFlatStandardMaterial({ color: 0xbeb7ad, roughness: 0.94 });
  const riserMat = createFlatStandardMaterial({ color: 0x7f7a72, roughness: 0.96 });
  const roofMat = createFlatStandardMaterial({ color: 0xf6f3ea, roughness: 0.46, metalness: 0.04 });
  const backWallMat = createFlatStandardMaterial({ color: 0x9f998f, roughness: 0.96 });

  const roadHalfWidth = definition.roadWidth * 0.5;
  const barrierClearance = (definition.barrierOffset ?? 0.5) + (definition.barrierThickness ?? 0.5);
  const baseOffset = roadHalfWidth + barrierClearance + 2.4;
  const sections = [
    { start: 0.02, end: 0.24, side: 1 },
    { start: 0.27, end: 0.48, side: 1 },
    { start: 0.50, end: 0.72, side: 1 },
    { start: 0.74, end: 0.96, side: 1 }
  ];

  sections.forEach((section, sectionIndex) => {
    for (let row = 0; row < 7; row += 1) {
      const nearOffset = baseOffset + row * 0.72;
      const farOffset = nearOffset + 0.68;
      const y = MONACO_ROAD_Y + row * 0.36;
      grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
        name: `MonacoGrandstandTier:${sectionIndex}:${row}`,
        side: section.side,
        start: section.start,
        end: section.end,
        nearOffset,
        farOffset,
        y,
        material: row % 2 === 0 ? concreteMat : riserMat,
        sampleStep: 2
      }));
    }

    grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoGrandstandBackWall:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      nearOffset: baseOffset + 7 * 0.72 + 0.2,
      farOffset: baseOffset + 7 * 0.72 + 0.85,
      y: MONACO_ROAD_Y + 2.78,
      material: backWallMat,
      sampleStep: 2
    }));

    grandstandGroup.add(createMonacoRibbonMesh(curve, definition, {
      name: `MonacoGrandstandCanopy:${sectionIndex}`,
      side: section.side,
      start: section.start,
      end: section.end,
      nearOffset: baseOffset - 0.2,
      farOffset: baseOffset + 7 * 0.72 + 1.2,
      y: MONACO_ROAD_Y + 3.5,
      material: roofMat,
      sampleStep: 3
    }));
  });

  addMonacoSeatedCrowd(grandstandGroup, curve, definition, sections, baseOffset + 0.28);
  optimizeStaticDecorativeProps(grandstandGroup, []);
  group.add(grandstandGroup);
}
