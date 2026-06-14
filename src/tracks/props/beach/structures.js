import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial, safePlace } from "./common.js";
import { createTropicalBush } from "./plants.js";

export function createBeachHouse(seed = 0) {
  const house = new THREE.Group();
  house.name = "TropicalBeachHouse";

  // Materials
  const wallMaterial = createBeachMaterial({ color: 0xfa9b93, roughness: 0.8 }); // Pink/peach plaster
  const roofMaterial = createBeachMaterial({ color: 0xfa9b93, roughness: 0.8 }); // Pink/peach roof
  const trimMaterial = createBeachMaterial({ color: 0xfad02c, roughness: 0.6, metalness: 0.1 }); // Bright yellow trim
  const floorMaterial = createBeachMaterial({ color: 0xdcdcdc, roughness: 0.7 }); // Light grey concrete floor
  const grassMaterial = createBeachMaterial({ color: 0x3d7042, roughness: 0.9 }); // Dark grass green base
  const doorMaterial = createBeachMaterial({ color: 0x5c3b21, roughness: 0.85 }); // Dark brown door
  const windowBackMaterial = createBeachMaterial({ color: 0x2b2b2b, roughness: 0.9 }); // Dark glass/shutter background
  const slatMaterial = createBeachMaterial({ color: 0xf0f0f0, roughness: 0.6 }); // White horizontal slats
  const metalMaterial = createBeachMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.6 }); // Metallic staircase

  // 1. Platform / Grass Base
  const base = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.3, 6.0), grassMaterial));
  base.position.set(0, 0.15, 0);
  house.add(base);

  // 2. Porch Floor
  const floor = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.15, 1.8), floorMaterial));
  floor.position.set(0, 0.375, -1.8);
  house.add(floor);

  // 3. Main Room Box (Peach/Pink walls)
  const room = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.8, 3.4), wallMaterial));
  room.position.set(0, 1.7, 0.8);
  house.add(room);

  // 4. Porch Columns (Pillars)
  const colGeo = new THREE.BoxGeometry(0.2, 2.7, 0.2);
  const colXPositions = [-3.5, -1.2, 1.2, 3.5];
  colXPositions.forEach((cx) => {
    const col = markShadow(new THREE.Mesh(colGeo, wallMaterial));
    col.position.set(cx, 1.65, -2.6);
    house.add(col);
  });

  // 5. Arches (Horizontal header beam + diagonal corner brackets)
  const header = markShadow(new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 0.2), wallMaterial));
  header.position.set(0, 2.85, -2.6);
  house.add(header);

  const bracketGeo = new THREE.BoxGeometry(0.25, 0.25, 0.22);
  const bracketXOffsets = [-3.25, -1.45, -0.95, 0.95, 1.45, 3.25];
  bracketXOffsets.forEach((bx, idx) => {
    const bracket = markShadow(new THREE.Mesh(bracketGeo, wallMaterial));
    bracket.position.set(bx, 2.65, -2.6);
    bracket.rotation.z = (idx % 2 === 0) ? -Math.PI / 4 : Math.PI / 4;
    house.add(bracket);
  });

  // 6. Roof Slab
  const roof = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 5.6), roofMaterial));
  roof.position.set(0, 3.1, -0.3);
  house.add(roof);

  // Yellow Roof Trim / Fascia
  const frontTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(8.22, 0.3, 0.05), trimMaterial));
  frontTrim.position.set(0, 3.15, -3.12);
  const leftTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 5.62), trimMaterial));
  leftTrim.position.set(-4.11, 3.15, -0.3);
  const rightTrim = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 5.62), trimMaterial));
  rightTrim.position.set(4.11, 3.15, -0.3);
  house.add(frontTrim, leftTrim, rightTrim);

  // 7. Door (dark brown wooden door)
  const door = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.08), doorMaterial));
  door.position.set(0.2, 1.3, -0.9);
  house.add(door);

  // Door handle (gold sphere)
  const handle = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), trimMaterial));
  handle.position.set(0.55, 1.3, -0.85);
  house.add(handle);

  // 8. Front Windows (two windows, left and right of door)
  const frameGeo = new THREE.BoxGeometry(1.6, 1.1, 0.08);
  const glassGeo = new THREE.BoxGeometry(1.4, 0.9, 0.04);
  const slatGeo = new THREE.BoxGeometry(1.4, 0.05, 0.02);

  [-2.35, 2.35].forEach((wx) => {
    // Window Frame (Yellow)
    const frame = markShadow(new THREE.Mesh(frameGeo, trimMaterial));
    frame.position.set(wx, 1.5, -0.9);
    house.add(frame);

    // Glass/Backplane (Dark)
    const glass = markShadow(new THREE.Mesh(glassGeo, windowBackMaterial));
    glass.position.set(wx, 1.5, -0.91);
    house.add(glass);

    // Horizontal louvers/slats
    for (let s = 0; s < 5; s++) {
      const slat = markShadow(new THREE.Mesh(slatGeo, slatMaterial));
      slat.position.set(wx, 1.2 + s * 0.15, -0.89);
      house.add(slat);
    }
  });

  // 9. Side Window (Left side)
  const sideFrame = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.6), trimMaterial));
  sideFrame.position.set(-3.8, 1.5, 0.8);
  house.add(sideFrame);
  const sideGlass = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.4), windowBackMaterial));
  sideGlass.position.set(-3.81, 1.5, 0.8);
  house.add(sideGlass);
  const sideSlatGeo = new THREE.BoxGeometry(0.02, 0.05, 1.4);
  for (let s = 0; s < 5; s++) {
    const slat = markShadow(new THREE.Mesh(sideSlatGeo, slatMaterial));
    slat.position.set(-3.79, 1.2 + s * 0.15, 0.8);
    house.add(slat);
  }

  // 10. Spiral Staircase on the Left
  const post = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), metalMaterial));
  post.position.set(-4.1, 1.9, 1.2);
  house.add(post);

  const stairs = new THREE.Group();
  const stepGeo = new THREE.BoxGeometry(0.65, 0.04, 0.22);
  const stairCount = 15;
  for (let i = 0; i < stairCount; i++) {
    const theta = i * (Math.PI * 1.5 / (stairCount - 1));
    const h = (i / (stairCount - 1)) * 2.8;
    const step = markShadow(new THREE.Mesh(stepGeo, metalMaterial));
    step.position.set(
      Math.cos(theta) * 0.32,
      h + 0.02,
      Math.sin(theta) * 0.32
    );
    step.rotation.y = -theta;
    stairs.add(step);
  }
  stairs.position.set(-4.1, 0.3, 1.2);
  house.add(stairs);

  // 11. Ornamental Bushes in Front
  const bushPositions = [
    [-3.2, 0.3, -2.8],
    [3.2, 0.3, -2.8],
    [-0.8, 0.3, -2.8]
  ];
  bushPositions.forEach(([bx, by, bz], bidx) => {
    const bush = createTropicalBush(seed + bidx + 50);
    bush.position.set(bx, by, bz);
    bush.scale.setScalar(0.7);
    house.add(bush);
  });

  return house;
}

// Bartender: standing man with straw hat, holding a coconut in his raised right hand
function createBarBartender() {
  const person = new THREE.Group();
  person.name = "TropicalBeachBartender";

  const skinMat  = createBeachMaterial({ color: 0xdcb38c, roughness: 0.6 });
  const shirtMat = createBeachMaterial({ color: 0xfefefa, roughness: 0.5 });
  const shortsMat= createBeachMaterial({ color: 0x4a7fc4, roughness: 0.7 });
  const blackMat = createBeachMaterial({ color: 0x111111, roughness: 0.8 });
  const strawMat = createBeachMaterial({ color: 0xd4b26f, roughness: 0.8 });
  const coconutMat = createBeachMaterial({ color: 0x5c3d1e, roughness: 0.9 });

  // --- Torso ---
  const torso = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat));
  torso.position.set(0, 1.05, 0);
  person.add(torso);

  // --- Head ---
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), skinMat));
  head.position.set(0, 1.62, 0);
  person.add(head);

  // Hair
  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), blackMat));
  hair.position.set(0, 1.66, 0);
  hair.scale.set(1.02, 0.88, 1.02);
  person.add(hair);

  // Beard
  const beard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.10), blackMat));
  beard.position.set(0, 1.54, 0.09);
  person.add(beard);

  // --- Straw hat ---
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.78, 0);
  const crown = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.25, 8), strawMat));
  crown.position.y = 0.10;
  const brim = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.80, 0.02, 16), strawMat));
  // Frayed strands
  const strandGeo = new THREE.CylinderGeometry(0.007, 0.003, 0.5, 4);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const strand = markShadow(new THREE.Mesh(strandGeo, strawMat));
    strand.position.set(Math.cos(angle) * 0.76, 0.01, Math.sin(angle) * 0.76);
    strand.rotation.z = angle + Math.PI / 2 + (pseudoRandom(i) * 0.3 - 0.15);
    hatGroup.add(strand);
  }
  hatGroup.add(crown, brim);
  person.add(hatGroup);

  // --- Legs ---
  [-0.16, 0.16].forEach((lx) => {
    const thigh = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.42, 6), shortsMat));
    thigh.position.set(lx, 0.53, 0);
    const shin = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 6), skinMat));
    shin.position.set(lx, 0.10, 0);
    const foot = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMat));
    foot.position.set(lx, -0.10, 0.05);
    person.add(thigh, shin, foot);
  });

  // --- Left arm (relaxed, slightly forward on counter) ---
  const upperArmL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 6), shirtMat));
  upperArmL.position.set(-0.32, 1.02, 0);
  upperArmL.rotation.z = 0.25;
  const forearmL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.34, 6), skinMat));
  forearmL.position.set(-0.38, 0.75, -0.08);
  forearmL.rotation.x = 0.3;
  forearmL.rotation.z = 0.1;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), skinMat));
  handL.position.set(-0.40, 0.62, -0.18);
  person.add(upperArmL, forearmL, handL);

  // --- Right arm (raised, holding coconut) ---
  const upperArmR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 6), shirtMat));
  upperArmR.position.set(0.32, 1.12, 0);
  upperArmR.rotation.z = -0.65; // raised outward
  upperArmR.rotation.x = -0.2;
  const forearmR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 6), skinMat));
  forearmR.position.set(0.50, 1.22, -0.10);
  forearmR.rotation.z = -0.5;
  forearmR.rotation.x = -0.4;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), skinMat));
  handR.position.set(0.60, 1.35, -0.22);
  person.add(upperArmR, forearmR, handR);

  // --- Coconut held in right hand ---
  const coconut = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), coconutMat));
  coconut.scale.set(1.0, 1.15, 1.0);
  coconut.position.set(0.60, 1.45, -0.28);
  // Straw/drinking straw sticking out
  const straw = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5),
    createBeachMaterial({ color: 0xff8800, roughness: 0.5 })
  ));
  straw.position.set(0.60, 1.60, -0.30);
  straw.rotation.z = 0.3;
  person.add(coconut, straw);

  person.scale.setScalar(1.4);
  return person;
}

function createBeachHutStrict(seed = 0) {
  const hut = new THREE.Group();
  hut.name = "TropicalBeachBarKiosk";

  // Materials
  const slatMat = createBeachMaterial({ color: 0xc68a4c, roughness: 0.85 }); // Warm natural light wood slats
  const trimMat = createBeachMaterial({ color: 0x4d301c, roughness: 0.88 }); // Darker wood countertop/trim
  const poleMat = createBeachMaterial({ color: 0x4d301c, roughness: 0.9 }); // Dark log poles
  const roofMat = createBeachMaterial({ color: 0x8c6239, roughness: 0.95 }); // Thatched palm roof
  const letterMat = createBeachMaterial({ color: 0xfad02c, roughness: 0.5 }); // Yellow sign letters
  const kayakYellowMat = createBeachMaterial({ color: 0xffd700, roughness: 0.6 }); // Yellow kayak
  const kayakOrangeMat = createBeachMaterial({ color: 0xff4500, roughness: 0.6 }); // Orange-red kayak

  // 1. Semi-circular slatted bar counter
  const slatGeo = new THREE.BoxGeometry(0.32, 1.4, 0.1);
  for (let i = 0; i < 24; i++) {
    const angle = -Math.PI * 0.6 + (i / 23) * Math.PI * 1.2;
    const x = Math.sin(angle) * 2.8;
    const z = -Math.cos(angle) * 2.8; // Z negative is front
    const slat = markShadow(new THREE.Mesh(slatGeo, slatMat));
    slat.position.set(x, 0.7, z);
    slat.rotation.y = -angle;
    hut.add(slat);
  }

  // 2. Curved Countertop and Bottom Trim segments
  const counterGeo = new THREE.BoxGeometry(0.95, 0.08, 0.45);
  const baseTrimGeo = new THREE.BoxGeometry(0.95, 0.1, 0.25);
  for (let j = 0; j < 10; j++) {
    const angleStart = -Math.PI * 0.6 + (j / 10) * Math.PI * 1.2;
    const angleEnd = -Math.PI * 0.6 + ((j + 1) / 10) * Math.PI * 1.2;
    const angleMid = (angleStart + angleEnd) / 2;
    const x = Math.sin(angleMid) * 2.8;
    const z = -Math.cos(angleMid) * 2.8;

    // Countertop
    const counterSegment = markShadow(new THREE.Mesh(counterGeo, trimMat));
    counterSegment.position.set(x, 1.44, z);
    counterSegment.rotation.y = -angleMid;
    hut.add(counterSegment);

    // Bottom Base Trim
    const baseSegment = markShadow(new THREE.Mesh(baseTrimGeo, trimMat));
    baseSegment.position.set(x, 0.05, z);
    baseSegment.rotation.y = -angleMid;
    hut.add(baseSegment);
  }

  // 3. Timber poles/posts
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6);
  const postPositions = [
    [-2.2, 1.6, -0.8],
    [2.2, 1.6, -0.8],
    [-1.8, 1.6, 1.4],
    [1.8, 1.6, 1.4]
  ];
  postPositions.forEach(([px, py, pz]) => {
    const post = markShadow(new THREE.Mesh(poleGeo, poleMat));
    post.position.set(px, py, pz);
    hut.add(post);
  });

  // 4. Horizontal timber beams at top
  const beamLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.3), poleMat));
  beamLeft.position.set(-2.0, 3.14, 0.3);
  const beamRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.3), poleMat));
  beamRight.position.set(2.0, 3.14, 0.3);
  const beamBack = markShadow(new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.12, 0.12), poleMat));
  beamBack.position.set(0, 3.14, 1.4);
  const beamFront = markShadow(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 0.12), poleMat));
  beamFront.position.set(0, 3.14, -0.8);
  hut.add(beamLeft, beamRight, beamBack, beamFront);

  // 5. Thatched Roof — full 360° disc so orientation does not matter
  const roof = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.6, 0.4, 16),
    roofMat
  ));
  roof.position.set(0, 3.3, 0.0);
  hut.add(roof);

  // 6. Sign Board "BAR" — placed on the back-local face (z=+2.55)
  // The kiosk is spawned with rotation.y += Math.PI which flips the X axis.
  // Place sign at z=-2.55 (front of counter in local) with lz=-0.06 (protrudes toward road).
  // Pre-mirror ALL letter x coordinates so that after the kiosk PI flip they read correctly.
  const signGroup = new THREE.Group();
  signGroup.position.set(0, 2.55, -3.2);
  signGroup.rotation.x = 0.04;
  hut.add(signGroup);
  signGroup.rotation.y = Math.PI; // cancels kiosk +PI flip → letters in natural orientation

  // Board: wide warm-wood plank
  const signBoard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 0.08), trimMat));
  signGroup.add(signBoard);

  // Two small hanging chains/brackets at top corners
  const chainGeo = new THREE.BoxGeometry(0.04, 0.22, 0.04);
  [-0.88, 0.88].forEach((cx) => {
    const chain = markShadow(new THREE.Mesh(chainGeo, poleMat));
    chain.position.set(cx, 0.42, 0);
    signGroup.add(chain);
  });

  // Letters in natural reading order (B left, A centre, R right).
  // lz = +0.06 protrudes toward the road (sign faces outward after rotation.y=PI).
  const lz = +0.06;
  const ly = 0;
  const th = 0.05;

  // === B ===
  const bGroup = new THREE.Group();
  bGroup.position.set(-0.52, ly, 0);
  // Vertical stem (left side)
  const bV = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, th), letterMat));
  bV.position.set(-0.15, 0, lz);
  // Top / middle / bottom horizontals
  const bH1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH1.position.set(-0.04, 0.185, lz);
  const bH2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH2.position.set(-0.04, 0, lz);
  const bH3 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  bH3.position.set(-0.04, -0.185, lz);
  // Top and bottom bump connectors (right side)
  const bC1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.185, th), letterMat));
  bC1.position.set(0.065, 0.093, lz);
  const bC2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.185, th), letterMat));
  bC2.position.set(0.065, -0.093, lz);
  bGroup.add(bV, bH1, bH2, bH3, bC1, bC2);
  signGroup.add(bGroup);

  // === A ===
  const aGroup = new THREE.Group();
  aGroup.position.set(0, ly, 0);
  // Left diagonal (leans right)
  const aL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, th), letterMat));
  aL.position.set(-0.10, 0, lz);
  aL.rotation.z = -0.22;
  // Right diagonal (leans left)
  const aR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, th), letterMat));
  aR.position.set(0.10, 0, lz);
  aR.rotation.z = 0.22;
  // Crossbar
  const aC = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.07, th), letterMat));
  aC.position.set(0, -0.04, lz);
  aGroup.add(aL, aR, aC);
  signGroup.add(aGroup);

  // === R ===
  const rGroup = new THREE.Group();
  rGroup.position.set(+0.52, ly, 0);
  // Vertical stem (left side)
  const rV = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, th), letterMat));
  rV.position.set(-0.10, 0, lz);
  // Top horizontal
  const rH1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, th), letterMat));
  rH1.position.set(-0.01, 0.185, lz);
  // Middle horizontal
  const rH2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, th), letterMat));
  rH2.position.set(-0.01, 0.02, lz);
  // Top-right loop connector
  const rC1 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.165, th), letterMat));
  rC1.position.set(0.055, 0.103, lz);
  // Diagonal leg (bottom-right)
  const rLeg2 = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, th), letterMat));
  rLeg2.position.set(0.072, -0.13, lz);
  rLeg2.rotation.z = 0.5;
  rGroup.add(rV, rH1, rH2, rC1, rLeg2);
  signGroup.add(rGroup);

  // 7. Decorative Kayaks next to the bar (Yellow & Orange-Red)
  const kayakGeo = new THREE.SphereGeometry(1.0, 8, 8);
  const kayak1 = markShadow(new THREE.Mesh(kayakGeo, kayakYellowMat));
  kayak1.scale.set(0.35, 0.18, 2.4);
  kayak1.position.set(3.4, 0.1, -0.2);
  kayak1.rotation.set(0.05, 0.35, 0.0);
  
  const kayak2 = markShadow(new THREE.Mesh(kayakGeo, kayakOrangeMat));
  kayak2.scale.set(0.35, 0.18, 2.4);
  kayak2.position.set(4.0, 0.1, -0.6);
  kayak2.rotation.set(-0.05, 0.25, 0.0);

  hut.add(kayak1, kayak2);

  // 8. Bartender — standing behind the counter, holding a coconut
  const bartender = createBarBartender();
  // z = +1.2 = bartender side (inside the bar, opposite to road-facing counter)
  // After kiosk +PI rotation this becomes the interior behind the counter
  bartender.position.set(0, 0, 0.5);
  bartender.rotation.y = Math.PI; // face toward the road/customer side
  hut.add(bartender);

  return hut;
}

export function addBeachHutsStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  [0.20, 0.55, 0.80].forEach((progress, index) => {
    const side = -1;
    const { position, rotationY } = safePlace(curve, progress, side, side * (roadHalfWidth + 16.0), roadHalfWidth, 6.0);
    const hut = createBeachHutStrict(index);
    hut.position.copy(position);
    hut.rotation.y = rotationY + Math.PI; // +Math.PI so open counter faces the road
    hut.scale.setScalar(2.0);
    group.add(hut);
  });
}

function createThatchedUmbrellaWithLoungers(index) {
  const group = new THREE.Group();
  group.name = "TropicalBeachUmbrellaStrict";

  // --- Pole (bamboo-tan cylinder) ---
  const poleMat = createBeachMaterial({ color: 0xb89050, roughness: 0.75 });
  const pole = markShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 4.8, 6),
    poleMat
  ));
  pole.position.y = 2.4;
  // Slight tilt for a natural beach look
  pole.rotation.z = (index % 2 === 0 ? 0.06 : -0.06);
  group.add(pole);

  // --- Canopy: straw thatched layers (3 stacked cones, decreasing size) ---
  const strawMat = createBeachMaterial({ color: 0xd4a843, roughness: 0.92 });
  const strawDarkMat = createBeachMaterial({ color: 0xb8883a, roughness: 0.95 });

  // Bottom layer — widest
  const canopy1 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(3.8, 0.7, 12), strawMat));
  canopy1.position.y = 4.8;
  // Middle layer
  const canopy2 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(2.8, 0.65, 12), strawDarkMat));
  canopy2.position.y = 5.3;
  // Top layer — smallest cap
  const canopy3 = markShadow(new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.5, 10), strawMat));
  canopy3.position.y = 5.8;
  // Tip sphere
  const tip = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), strawDarkMat));
  tip.position.y = 6.1;
  group.add(canopy1, canopy2, canopy3, tip);

  // --- Sun Loungers (sdraio) — two on either side of the pole ---
  const woodMat  = createBeachMaterial({ color: 0x8b5a2b, roughness: 0.80 });
  const fabricMat = createBeachMaterial({ color: 0x4a8fc4, roughness: 0.65 }); // beach-blue
  const fabricMat2 = createBeachMaterial({ color: 0xd4af37, roughness: 0.65 }); // golden

  function makeLounger(side, mat) {
    const lounger = new THREE.Group();

    // Main flat bed
    const bed = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.10, 2.0), mat));
    bed.position.y = 0.30;
    // Raised headrest
    const headrest = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.30, 0.60), mat));
    headrest.position.set(0, 0.45, -0.75);
    headrest.rotation.x = -0.4;

    // Two wooden side rails
    [-0.35, 0.35].forEach((rx) => {
      const rail = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 2.0), woodMat));
      rail.position.set(rx, 0.25, 0);
      lounger.add(rail);
    });
    // Four legs
    [[-0.3, -0.8], [-0.3, 0.7], [0.3, -0.8], [0.3, 0.7]].forEach(([lx, lz]) => {
      const leg = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), woodMat));
      leg.position.set(lx, 0.15, lz);
      lounger.add(leg);
    });

    lounger.add(bed, headrest);
    // Position to one side of the umbrella
    lounger.position.set(side * 1.4, 0, 0.2);
    return lounger;
  }

  const lounger1 = makeLounger(-1, index % 2 === 0 ? fabricMat : fabricMat2);
  lounger1.scale.setScalar(2.0);
  lounger1.rotation.y = Math.PI;

  const lounger2 = makeLounger(+1, index % 2 === 0 ? fabricMat2 : fabricMat);
  lounger2.scale.setScalar(2.0);
  lounger2.rotation.y = Math.PI;

  group.add(lounger1, lounger2);

  return group;
}

export function addBeachUmbrellasStrict(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // Place 30 thatched umbrella+lounger sets on the SEA SIDE (side=+1)
  for (let index = 0; index < 30; index += 1) {
    const progress = (index + 0.5) / 30;
    // Alternate between depth rows on the beach, keeping them closer to the road to avoid the water
    const depthOffset = (index % 4 === 0) ? 5.2 : (index % 4 === 1) ? 7.0 : (index % 4 === 2) ? 8.8 : 10.5;
    const { position, rotationY } = safePlace(
      curve, progress, +1,
      +(roadHalfWidth + depthOffset),
      roadHalfWidth, 5.0
    );
    const umbrellaGroup = createThatchedUmbrellaWithLoungers(index);
    umbrellaGroup.position.copy(position);
    umbrellaGroup.rotation.y = rotationY;
    group.add(umbrellaGroup);
  }
}

