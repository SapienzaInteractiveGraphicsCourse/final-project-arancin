import * as THREE from "three";
import { getCachedWelcomeToVegasTexture } from "./billboards.js";
import { addDecorativePointLight } from "./lights.js";
import { createPropMaterial } from "../common/materials.js";
import { getRoadsidePlacement } from "../common/placement.js";
import { markShadow, pseudoRandom } from "../shared.js";

function getRoadsideTransform(curve, progress, side, offset, roadHalfWidth, minClearance = 20) {
  return getRoadsidePlacement(curve, progress, side, offset, roadHalfWidth, {
    minClearance,
    strategy: "search"
  });
}

function createVegasMaterial({ color, emissive, emissiveIntensity = 0.6, roughness = 0.85, metalness = 0.05 }) {
  return createPropMaterial({
    color,
    emissive: emissive ?? color,
    emissiveIntensity,
    roughness,
    metalness
  });
}

function addFacadeNeonSign(parent, { position, seed, color, lineCount = 4 }) {
  const sign = new THREE.Group();
  sign.name = `VegasFacadeNeonSign:${seed}`;
  sign.position.copy(position);

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    flatShading: true,
    roughness: 0.22,
    metalness: 0.03
  });

  for (let line = 0; line < lineCount; line += 1) {
    const width = 8 + pseudoRandom(seed * 11 + line * 3.4) * 8;
    const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, 0.2), material);
    segment.position.set(
      (pseudoRandom(seed * 7 + line) - 0.5) * 1.8,
      -line * 2.05,
      0
    );
    sign.add(segment);
  }

  addDecorativePointLight(sign, color, 12, 15, 2, new THREE.Vector3(0, -lineCount, 2.2));
  parent.add(sign);
}

function buildCaesarsPalace(group, curve, roadHalfWidth) {
  const palace = new THREE.Group();
  palace.name = "VegasSkyline:CaesarsPalace";
  const transform = getRoadsideTransform(curve, 0.3, -1, roadHalfWidth + 145, roadHalfWidth, 70);
  palace.position.copy(transform.position);
  palace.rotation.y = transform.rotationY;
  palace.scale.set(0.52, 0.52, 0.52);

  const cream = createVegasMaterial({ color: 0xc8b89a });
  const domeMaterial = createVegasMaterial({ color: 0xb8a882, roughness: 0.68 });
  const goldTrim = createVegasMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 0.8,
    roughness: 0.32,
    metalness: 0.1
  });

  const main = markShadow(new THREE.Mesh(new THREE.BoxGeometry(60, 45, 40), cream));
  const leftWing = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 35, 30), cream));
  const rightWing = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 35, 30), cream));
  main.position.y = 22.5;
  leftWing.position.set(-40, 17.5, 0);
  rightWing.position.set(40, 17.5, 0);
  palace.add(main, leftWing, rightWing);

  for (let index = 0; index < 6; index += 1) {
    const column = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 20, 6), cream));
    column.position.set(-22 + index * 8.8, 10, 20.8);
    palace.add(column);
  }

  const dome = markShadow(new THREE.Mesh(new THREE.SphereGeometry(8, 6, 4), domeMaterial));
  dome.position.set(0, 48, 0);
  dome.scale.y = 0.58;
  palace.add(dome);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(64, 0.7, 1.2), goldTrim);
  cornice.position.set(0, 45.5, 20.9);
  palace.add(cornice);
  addFacadeNeonSign(palace, {
    position: new THREE.Vector3(-18, 34, 21.6),
    seed: 1,
    color: 0xff2090,
    lineCount: 4
  });
  addFacadeNeonSign(palace, {
    position: new THREE.Vector3(18, 28, 21.6),
    seed: 2,
    color: 0xffe600,
    lineCount: 3
  });

  group.add(palace);
}

function buildMgmGrand(group, curve, roadHalfWidth) {
  const mgm = new THREE.Group();
  mgm.name = "VegasSkyline:MGMGrand";
  const transform = getRoadsideTransform(curve, 0.5, 1, roadHalfWidth + 110, roadHalfWidth, 45);
  mgm.position.copy(transform.position);
  mgm.rotation.y = transform.rotationY;
  mgm.scale.set(0.5, 0.5, 0.5);

  const towerMaterial = createVegasMaterial({ color: 0x1a3d1a });
  const lionMaterial = createVegasMaterial({ color: 0xd4af37, roughness: 0.42, metalness: 0.16 });
  const neonMaterial = createVegasMaterial({
    color: 0x00ff44,
    emissive: 0x00ff44,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });
  const signMaterial = createVegasMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 1,
    roughness: 0.28,
    metalness: 0.08
  });

  const podium = markShadow(new THREE.Mesh(new THREE.BoxGeometry(60, 8, 55), towerMaterial));
  const tower = markShadow(new THREE.Mesh(new THREE.BoxGeometry(35, 120, 35), towerMaterial));
  podium.position.y = 4;
  tower.position.y = 68;
  mgm.add(podium, tower);

  const cornerPositions = [
    [-17.9, 68, -17.9],
    [17.9, 68, -17.9],
    [-17.9, 68, 17.9],
    [17.9, 68, 17.9]
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 80, 0.4), neonMaterial);
    strip.position.set(x, y, z);
    mgm.add(strip);
  });

  const lionBody = markShadow(new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), lionMaterial));
  const lionHead = markShadow(new THREE.Mesh(new THREE.SphereGeometry(5, 4, 3), lionMaterial));
  lionBody.position.set(0, 7, 30);
  lionHead.position.set(0, 13, 30);
  mgm.add(lionBody, lionHead);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 1), signMaterial);
  sign.position.set(0, 131, 18.2);
  mgm.add(sign);
  addFacadeNeonSign(mgm, {
    position: new THREE.Vector3(0, 96, 18.4),
    seed: 3,
    color: 0x00e5ff,
    lineCount: 5
  });
  addFacadeNeonSign(mgm, {
    position: new THREE.Vector3(0, 46, 18.4),
    seed: 4,
    color: 0xff2090,
    lineCount: 3
  });

  group.add(mgm);
}

function buildBellagio(group, curve, roadHalfWidth) {
  const bellagio = new THREE.Group();
  bellagio.name = "VegasSkyline:Bellagio";
  const transform = getRoadsideTransform(curve, 0.6, -1, roadHalfWidth + 175, roadHalfWidth, 90);
  bellagio.position.copy(transform.position);
  bellagio.rotation.y = transform.rotationY;
  bellagio.scale.set(0.42, 0.42, 0.42);

  const facadeMaterial = createVegasMaterial({ color: 0xe0d0b8 });
  const glassMaterial = createVegasMaterial({ color: 0x1a3050, roughness: 0.42, metalness: 0.1 });
  const waterMaterial = createVegasMaterial({ color: 0x0a4a6e, roughness: 0.4, metalness: 0.08 });
  const jetMaterial = createVegasMaterial({
    color: 0x88ddff,
    emissive: 0x88ddff,
    emissiveIntensity: 1.2,
    roughness: 0.2
  });
  const warmStripMaterial = createVegasMaterial({
    color: 0xffa040,
    emissive: 0xffa040,
    emissiveIntensity: 0.8,
    roughness: 0.26
  });

  for (let index = 0; index < 5; index += 1) {
    const block = markShadow(new THREE.Mesh(new THREE.BoxGeometry(18, 55, 15), facadeMaterial));
    const offset = index - 2;
    block.position.set(offset * 15, 27.5, Math.abs(offset) * 3);
    block.rotation.y = -offset * 0.08;
    bellagio.add(block);
  }

  const glassTower = markShadow(new THREE.Mesh(new THREE.BoxGeometry(25, 75, 22), glassMaterial));
  glassTower.position.set(45, 37.5, 4);
  bellagio.add(glassTower);

  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.3, 12), waterMaterial);
  fountain.position.set(0, 0.15, 35);
  fountain.rotation.y = Math.PI / 12;
  bellagio.add(fountain);

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const height = 6 + pseudoRandom(index + 30.4) * 8;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.1, height, 4), jetMaterial);
    jet.position.set(Math.cos(angle) * 11, height * 0.5 + 0.3, 35 + Math.sin(angle) * 11);
    bellagio.add(jet);
  }

  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(82, 0.45, 1), warmStripMaterial);
  lightStrip.position.set(0, 2.2, 8.2);
  bellagio.add(lightStrip);
  addFacadeNeonSign(bellagio, {
    position: new THREE.Vector3(-22, 42, 15.2),
    seed: 5,
    color: 0xffe600,
    lineCount: 4
  });
  addFacadeNeonSign(bellagio, {
    position: new THREE.Vector3(45, 56, 15.4),
    seed: 6,
    color: 0x00e5ff,
    lineCount: 5
  });

  group.add(bellagio);
}

function buildWelcomeToVegasSign(group, curve, roadHalfWidth) {
  const signGroup = new THREE.Group();
  signGroup.name = "VegasSkyline:WelcomeToLasVegasSign";

  const startProgress = 0.87;
  const signProgress = 0.88;
  const innerRightSide = -1;
  const transform = getRoadsidePlacement(curve, signProgress, innerRightSide, roadHalfWidth + 17, roadHalfWidth, {
    minClearance: 14,
    targetClearance: 16,
    strategy: "direct"
  });
  signGroup.position.copy(transform.position);
  signGroup.rotation.y = transform.frame.heading + Math.PI;
  signGroup.userData.startProgress = startProgress;

  const welcomeTex = getCachedWelcomeToVegasTexture();
  const welcomeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: welcomeTex,
    emissive: 0xffffff,
    emissiveMap: welcomeTex,
    emissiveIntensity: 1.5,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.08
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), welcomeMat);
  plane.position.y = 10;
  signGroup.add(plane);

  addDecorativePointLight(signGroup, 0xffffff, 8, 15, 1.5, new THREE.Vector3(0, 8, 3.5));

  group.add(signGroup);
}

function buildEiffelTower(group, curve, roadHalfWidth) {
  const tower = new THREE.Group();
  tower.name = "VegasSkyline:EiffelTower";

  const transform = getRoadsideTransform(curve, 0.1, -1, roadHalfWidth + 42, roadHalfWidth, 30);
  tower.position.copy(transform.position);
  tower.rotation.y = transform.rotationY;

  const metalMaterial = createVegasMaterial({
    color: 0x1f1d24,
    roughness: 0.6,
    metalness: 0.4
  });

  const goldNeonMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb800,
    emissive: 0xffb800,
    emissiveIntensity: 1.5,
    roughness: 0.2
  });

  const legGeo = new THREE.CylinderGeometry(0.8, 1.6, 20, 5);
  const angles = [Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4];
  const legSpacing = 12;

  angles.forEach((angle) => {
    const leg = markShadow(new THREE.Mesh(legGeo, metalMaterial));
    leg.position.set(Math.cos(angle) * legSpacing, 10, Math.sin(angle) * legSpacing);
    leg.rotation.z = -Math.cos(angle) * 0.25;
    leg.rotation.x = Math.sin(angle) * 0.25;
    tower.add(leg);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 20.2, 0.3), goldNeonMaterial);
    neonStrip.position.copy(leg.position);
    neonStrip.rotation.copy(leg.rotation);
    neonStrip.position.x += Math.cos(angle) * 0.8;
    neonStrip.position.z += Math.sin(angle) * 0.8;
    tower.add(neonStrip);
  });

  const plat1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(20, 2.5, 20), metalMaterial));
  plat1.position.y = 20;
  tower.add(plat1);

  const plat1Neon = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.6, 20.4), goldNeonMaterial);
  plat1Neon.position.y = 20;
  tower.add(plat1Neon);

  const archMat = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 0.8
  });
  for (let i = 0; i < 4; i += 1) {
    const rot = (i * Math.PI) / 2;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.4, 6, 16, Math.PI), archMat);
    arch.position.set(0, 18.8, 0);
    arch.rotation.y = rot;
    arch.position.x += Math.cos(rot) * (legSpacing - 2);
    arch.position.z += Math.sin(rot) * (legSpacing - 2);
    arch.rotation.z = Math.PI;
    tower.add(arch);
  }

  const midLegGeo = new THREE.CylinderGeometry(0.5, 0.8, 18, 5);
  const midLegSpacing = 7;
  angles.forEach((angle) => {
    const leg = markShadow(new THREE.Mesh(midLegGeo, metalMaterial));
    leg.position.set(Math.cos(angle) * midLegSpacing, 29, Math.sin(angle) * midLegSpacing);
    leg.rotation.z = -Math.cos(angle) * 0.16;
    leg.rotation.x = Math.sin(angle) * 0.16;
    tower.add(leg);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 18.2, 0.2), goldNeonMaterial);
    neonStrip.position.copy(leg.position);
    neonStrip.rotation.copy(leg.rotation);
    neonStrip.position.x += Math.cos(angle) * 0.5;
    neonStrip.position.z += Math.sin(angle) * 0.5;
    tower.add(neonStrip);
  });

  const plat2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(11, 1.8, 11), metalMaterial));
  plat2.position.y = 38;
  tower.add(plat2);

  const plat2Neon = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 11.4), goldNeonMaterial);
  plat2Neon.position.y = 38;
  tower.add(plat2Neon);

  const spireGeo = new THREE.CylinderGeometry(0.1, 0.5, 27, 4);
  const spire = markShadow(new THREE.Mesh(spireGeo, metalMaterial));
  spire.position.set(0, 51.5, 0);
  tower.add(spire);

  const spireNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.55, 27.2, 4), goldNeonMaterial);
  spireNeon.position.set(0, 51.5, 0);
  tower.add(spireNeon);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 3.0
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), beaconMat);
  beacon.position.set(0, 65.5, 0);
  tower.add(beacon);

  addDecorativePointLight(tower, 0xffffff, 25, 45, 1.2, new THREE.Vector3(0, 65.5, 0));

  group.add(tower);
}

function buildFerrisWheel(group, curve, roadHalfWidth) {
  const ferrisGroup = new THREE.Group();
  ferrisGroup.name = "VegasSkyline:FerrisWheel";

  const transform = getRoadsideTransform(curve, 0.155, -1, roadHalfWidth + 90, roadHalfWidth, 45);
  ferrisGroup.position.copy(transform.position);
  ferrisGroup.rotation.y = transform.rotationY + Math.PI / 2;

  const metalMaterial = createVegasMaterial({ color: 0x222026, roughness: 0.7, metalness: 0.3 });

  const neonCyan = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.6,
    roughness: 0.1
  });

  const neonMagenta = new THREE.MeshStandardMaterial({
    color: 0xff2090,
    emissive: 0xff2090,
    emissiveIntensity: 1.6,
    roughness: 0.1
  });

  [-1.5, 1.5].forEach((zOffset) => {
    const legLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 30, 5), metalMaterial));
    legLeft.position.set(-6, 14, zOffset);
    legLeft.rotation.z = -0.2;
    ferrisGroup.add(legLeft);

    const legRight = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 30, 5), metalMaterial));
    legRight.position.set(6, 14, zOffset);
    legRight.rotation.z = 0.2;
    ferrisGroup.add(legRight);
  });

  const axle = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.2, 8), metalMaterial));
  axle.position.set(0, 28, 0);
  axle.rotation.x = Math.PI / 2;
  ferrisGroup.add(axle);

  const rotatingPart = new THREE.Group();
  rotatingPart.name = "FerrisWheelRotatingPart";
  rotatingPart.position.set(0, 28, 0);

  const spinSpeed = 0.08;
  rotatingPart.userData.spin = { x: 0, y: 0, z: spinSpeed };

  const ringRadius = 18;
  [-0.9, 0.9].forEach((zOffset, ringIndex) => {
    const ringMat = ringIndex === 0 ? neonCyan : neonMagenta;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.35, 8, 36), ringMat);
    ring.position.set(0, 0, zOffset);
    rotatingPart.add(ring);
  });

  const spokeMat = createVegasMaterial({
    color: 0x0088ff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.8,
    roughness: 0.3
  });
  const spokeCount = 12;
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = (i / spokeCount) * Math.PI * 2;
    [-0.9, 0.9].forEach((zOffset) => {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ringRadius, 4), spokeMat);
      spoke.position.set(Math.cos(angle) * (ringRadius * 0.5), Math.sin(angle) * (ringRadius * 0.5), zOffset);
      spoke.rotation.z = angle + Math.PI / 2;
      rotatingPart.add(spoke);
    });
  }

  const cabinColors = [0xffe600, 0xff2090, 0x39ff14, 0x00e5ff, 0xff8800];
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const cabinColor = cabinColors[i % cabinColors.length];

    const cabinGroup = new THREE.Group();
    cabinGroup.name = `FerrisCabin:${i}`;
    cabinGroup.position.set(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
    cabinGroup.userData.spin = { x: 0, y: 0, z: -spinSpeed };

    const hanger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.8, 4),
      metalMaterial
    );
    hanger.position.set(0, 0.9, 0);
    cabinGroup.add(hanger);

    const cabinMat = new THREE.MeshStandardMaterial({
      color: cabinColor,
      emissive: cabinColor,
      emissiveIntensity: 1.4,
      roughness: 0.2
    });
    const cabinBox = markShadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), cabinMat));
    cabinGroup.add(cabinBox);

    addDecorativePointLight(cabinGroup, cabinColor, 3, 5, 2.0, new THREE.Vector3(0, -0.6, 0));

    rotatingPart.add(cabinGroup);
  }

  ferrisGroup.add(rotatingPart);
  addDecorativePointLight(ferrisGroup, 0x00ffcc, 15, 25, 1.5, new THREE.Vector3(0, 28, 0));

  group.add(ferrisGroup);
}

function buildBackgroundVegasTowers(group, curve, roadHalfWidth) {
  const colors = [0x0d0d20, 0x12112a, 0x0a1830, 0x1a0d2e];
  const windowColors = [0xffe066, 0xff8800, 0xffffff, 0x88aaff];
  const towerSlots = [
    { progress: 0.015, side: 1, distance: 92 },
    { progress: 0.045, side: -1, distance: 104 },
    { progress: 0.075, side: 1, distance: 116 },
    { progress: 0.12, side: -1, distance: 96 },
    { progress: 0.18, side: 1, distance: 118 },
    { progress: 0.28, side: -1, distance: 110 },
    { progress: 0.42, side: 1, distance: 100 },
    { progress: 0.56, side: -1, distance: 122 },
    { progress: 0.72, side: 1, distance: 108 },
    { progress: 0.86, side: -1, distance: 96 },
    { progress: 0.93, side: 1, distance: 124 },
    { progress: 0.98, side: -1, distance: 112 }
  ];

  towerSlots.forEach(({ progress, side, distance }, index) => {
    const tower = new THREE.Group();
    tower.name = `VegasSkyline:BackgroundTower:${index}`;
    const width = 18 + pseudoRandom(index + 1.2) * 16;
    const height = 58 + pseudoRandom(index + 2.4) * 82;
    const depth = 18 + pseudoRandom(index + 3.6) * 16;
    const transform = getRoadsideTransform(curve, progress, side, roadHalfWidth + distance, roadHalfWidth, 65);
    const material = createVegasMaterial({ color: colors[index % colors.length], roughness: 0.62, metalness: 0.08 });
    const body = markShadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material));

    tower.position.copy(transform.position);
    tower.rotation.y = transform.rotationY;
    body.position.y = height * 0.5;
    tower.add(body);

    const windowCount = 8 + Math.floor(pseudoRandom(index + 6.4) * 8);
    for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
      const color = windowColors[Math.floor(pseudoRandom(index * 31 + windowIndex * 5.7) * windowColors.length) % windowColors.length];
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.45,
        metalness: 0,
        flatShading: true
      });
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.2), windowMaterial);
      const x = (pseudoRandom(index * 17 + windowIndex) - 0.5) * width * 0.72;
      const y = 10 + pseudoRandom(index * 23 + windowIndex) * (height - 18);
      window.position.set(x, y, side > 0 ? -depth * 0.5 - 0.12 : depth * 0.5 + 0.12);
      tower.add(window);
    }

    group.add(tower);
  });
}

export function buildVegasSkyline(group, curve, roadHalfWidth) {
  buildWelcomeToVegasSign(group, curve, roadHalfWidth);
  buildCaesarsPalace(group, curve, roadHalfWidth);
  buildMgmGrand(group, curve, roadHalfWidth);
  buildBellagio(group, curve, roadHalfWidth);
  buildBackgroundVegasTowers(group, curve, roadHalfWidth);
  buildEiffelTower(group, curve, roadHalfWidth);
  buildFerrisWheel(group, curve, roadHalfWidth);
}
