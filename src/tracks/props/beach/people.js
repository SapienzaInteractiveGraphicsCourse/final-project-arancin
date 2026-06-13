import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial, safePlace } from "./common.js";

export function createBeachPersonSittingWithStrawHat(seed = 0) {
  const person = new THREE.Group();
  person.name = "TropicalBeachPersonSitting";

  // Skin material
  const skinMaterial = createBeachMaterial({ color: 0xdcb38c, roughness: 0.6 });
  // Shirt material (white/cream)
  const shirtMaterial = createBeachMaterial({ color: 0xfefefa, roughness: 0.5 });
  // Pants/shorts material (beige/tan)
  const pantsMaterial = createBeachMaterial({ color: 0xcca070, roughness: 0.7 });
  // Hair/beard material (black)
  const blackMaterial = createBeachMaterial({ color: 0x111111, roughness: 0.8 });
  // Straw hat material (straw yellow)
  const strawMaterial = createBeachMaterial({ color: 0xd4b26f, roughness: 0.8 });

  // 1. Torso (Busto camicia bianca, reclinato)
  const torso = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), shirtMaterial));
  torso.position.set(0, 0.4, 0.05);
  torso.rotation.x = 0.12; // Reclined slightly back
  person.add(torso);

  // 2. Head (Testa color pelle, sopra il busto reclinato)
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMaterial));
  head.position.set(0, 0.92, 0.12);
  person.add(head);

  // Hair (Capelli ricci neri)
  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), blackMaterial));
  hair.position.set(0, 0.96, 0.14);
  hair.scale.set(1.02, 0.9, 1.02);
  person.add(hair);

  // Beard (Barba corta nera)
  const beard = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), blackMaterial));
  beard.position.set(0, 0.82, 0.02);
  person.add(beard);

  // 3. Legs (Thighs extending horizontally forward)
  // Pantaloncini (shorts) part of thighs
  const thighLeftPants = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.35, 6), pantsMaterial));
  thighLeftPants.position.set(-0.18, 0.06, -0.175);
  thighLeftPants.rotation.x = Math.PI / 2;
  
  const thighRightPants = thighLeftPants.clone();
  thighRightPants.position.x = 0.18;
  person.add(thighLeftPants, thighRightPants);

  // Skin (knee) part of thighs
  const thighLeftSkin = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 6), skinMaterial));
  thighLeftSkin.position.set(-0.18, 0.06, -0.4);
  thighLeftSkin.rotation.x = Math.PI / 2;
  
  const thighRightSkin = thighLeftSkin.clone();
  thighRightSkin.position.x = 0.18;
  person.add(thighLeftSkin, thighRightSkin);

  // 4. Shins (Gambe che scendono verticalmente)
  const shinLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), skinMaterial));
  shinLeft.position.set(-0.18, -0.165, -0.5);
  
  const shinRight = shinLeft.clone();
  shinRight.position.x = 0.18;
  person.add(shinLeft, shinRight);

  // Feet (Piedi orizzontali)
  const footLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMaterial));
  footLeft.position.set(-0.18, -0.38, -0.54);
  footLeft.rotation.y = 0.1;
  
  const footRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.16), skinMaterial));
  footRight.position.set(0.18, -0.38, -0.54);
  footRight.rotation.y = -0.1;
  person.add(footLeft, footRight);

  // 5. Arms (Braccia che si appoggiano sui braccioli)
  // Upper arms (sloping down and slightly forward)
  const upperArmLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.45, 6), shirtMaterial));
  upperArmLeft.position.set(-0.34, 0.5, -0.02);
  upperArmLeft.rotation.x = 0.35;
  upperArmLeft.rotation.z = 0.08;
  
  const upperArmRight = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.45, 6), shirtMaterial));
  upperArmRight.position.set(0.34, 0.5, -0.02);
  upperArmRight.rotation.x = 0.35;
  upperArmRight.rotation.z = -0.08;
  person.add(upperArmLeft, upperArmRight);

  // Forearms (resting flat on armrests: x = +/-0.36, y = 0.22)
  const forearmLeft = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 6), skinMaterial));
  forearmLeft.position.set(-0.36, 0.24, -0.28);
  forearmLeft.rotation.x = Math.PI / 2;
  
  const forearmRight = forearmLeft.clone();
  forearmRight.position.x = 0.36;
  person.add(forearmLeft, forearmRight);

  // Hands (on front of armrest)
  const handLeft = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), skinMaterial));
  handLeft.position.set(-0.36, 0.24, -0.47);
  const handRight = handLeft.clone();
  handRight.position.x = 0.36;
  person.add(handLeft, handRight);

  // 6. STRAW HAT (Cappellaccio di paglia gigante)
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.08, 0.12);
  hatGroup.rotation.x = 0.15;
  hatGroup.rotation.z = -0.1;

  // Hat Crown (Cupola centrale)
  const crown = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.28, 8), strawMaterial));
  crown.position.y = 0.12;
  hatGroup.add(crown);

  // Hat Brim (Tesa larga e piatta)
  const brim = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 16), strawMaterial));
  hatGroup.add(brim);

  // Frayed Straw Strands (Fili di paglia sporgenti dalla tesa)
  const strandGeo = new THREE.CylinderGeometry(0.008, 0.004, 0.6, 4);
  const strandCount = 18;
  for (let i = 0; i < strandCount; i++) {
    const angle = (i / strandCount) * Math.PI * 2;
    const strand = markShadow(new THREE.Mesh(strandGeo, strawMaterial));
    
    // Position at the edge of the brim
    const radius = 0.86;
    strand.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
    
    // Rotate to point outwards with some random variations
    strand.rotation.z = angle + Math.PI / 2 + (pseudoRandom(seed + i) * 0.3 - 0.15);
    strand.rotation.y = pseudoRandom(seed + i * 2) * 0.4 - 0.2;
    
    hatGroup.add(strand);
  }

  person.add(hatGroup);

  // Proportional scale to fit chair seat nicely
  person.scale.setScalar(0.9);

  return person;
}

function createBeachGirl(type = "swimsuit", seed = 0) {
  const girl = new THREE.Group();
  girl.name = `BeachGirl_${type}_${seed}`;

  // Skin colors
  const skinColors = [0xdcb38c, 0xe8be9b, 0xbe8c5f, 0xcb9c7a];
  // Hair colors
  const hairColors = [0x111111, 0x4a3728, 0xd4af37, 0xb85a1c];
  // Swimsuit colors
  const swimColors = [0xff3366, 0x33ff66, 0x33ccff, 0xffcc00, 0xff6600, 0xe60067];
  // Top/Shorts colors
  const topColors = [0xfefefa, 0xffdd44, 0xff8833, 0x88ffcc, 0xffaaaa];
  const shortsColors = [0x2a52be, 0x333333, 0x4e5d6c];

  const skinMat = createBeachMaterial({ color: skinColors[seed % skinColors.length], roughness: 0.6 });
  const hairMat = createBeachMaterial({ color: hairColors[(seed * 3) % hairColors.length], roughness: 0.8 });

  // Head and Hair
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8), skinMat));
  head.position.set(0, 1.48, 0);
  girl.add(head);

  // Hair base
  const hairBase = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat));
  hairBase.position.set(0, 1.50, -0.04);
  hairBase.scale.set(1.02, 0.9, 1.02);
  girl.add(hairBase);

  // Ponytail/Long hair hanging down
  const hairHang = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.08), hairMat));
  hairHang.position.set(0, 1.22, -0.15);
  hairHang.rotation.x = 0.08;
  girl.add(hairHang);

  // Torso
  if (type === "swimsuit") {
    const swimMat = createBeachMaterial({ color: swimColors[(seed * 7) % swimColors.length], roughness: 0.6 });
    // Bikini Top
    const bikiniTop = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.22), swimMat));
    bikiniTop.position.set(0, 1.15, 0);
    // Midriff (Skin)
    const midriff = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.18), skinMat));
    midriff.position.set(0, 0.94, 0);
    // Bikini Bottom
    const bikiniBottom = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.22), swimMat));
    bikiniBottom.position.set(0, 0.74, 0);
    girl.add(bikiniTop, midriff, bikiniBottom);
  } else {
    const topMat = createBeachMaterial({ color: topColors[(seed * 7) % topColors.length], roughness: 0.5 });
    const shortsMat = createBeachMaterial({ color: shortsColors[(seed * 11) % shortsColors.length], roughness: 0.7 });
    
    // Top
    const top = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.22), topMat));
    top.position.set(0, 1.08, 0);
    // Denim Shorts
    const shorts = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.24), shortsMat));
    shorts.position.set(0, 0.76, 0);
    girl.add(top, shorts);
  }

  // Walk cycle phase (varies by seed)
  const walkPhase = (seed % 3) * 0.35 + 0.15;
  const swingAngle = Math.sin(walkPhase) * 0.4;

  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-0.13, 0.64, 0);
  const legL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.64, 6), skinMat));
  legL.position.y = -0.32;
  const footL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), skinMat));
  footL.position.set(0, -0.64, 0.04);
  legLGroup.add(legL, footL);
  legLGroup.rotation.x = -swingAngle;
  girl.add(legLGroup);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.position.set(0.13, 0.64, 0);
  const legR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.64, 6), skinMat));
  legR.position.y = -0.32;
  const footR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), skinMat));
  footR.position.set(0, -0.64, 0.04);
  legRGroup.add(legR, footR);
  legRGroup.rotation.x = swingAngle;
  girl.add(legRGroup);

  // Left Arm
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.25, 1.20, 0);
  const armL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.56, 6), skinMat));
  armL.position.y = -0.28;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat));
  handL.position.set(0, -0.56, 0);
  armLGroup.add(armL, handL);
  armLGroup.rotation.x = swingAngle;
  girl.add(armLGroup);

  // Right Arm
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.25, 1.20, 0);
  const armR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.56, 6), skinMat));
  armR.position.y = -0.28;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat));
  handR.position.set(0, -0.56, 0);
  armRGroup.add(armR, handR);
  armRGroup.rotation.x = -swingAngle;
  girl.add(armRGroup);

  return girl;
}

function createBeachBoy(type = "swimsuit", seed = 0) {
  const boy = new THREE.Group();
  boy.name = `BeachBoy_${type}_${seed}`;

  // Skin colors
  const skinColors = [0xdcb38c, 0xe8be9b, 0xbe8c5f, 0xcb9c7a];
  // Hair colors
  const hairColors = [0x111111, 0x4a3728, 0xd4af37, 0xb85a1c];
  // Swim shorts colors
  const swimColors = [0x11cc22, 0xff5500, 0x0088ff, 0xffbb00, 0xff3366, 0x9933ff];
  // Shirt/Shorts colors
  const shirtColors = [0xfefefa, 0xff5566, 0x33ddff, 0xffcc33, 0x77ff77];
  const shortsColors = [0xcca070, 0x333333, 0x4a7fc4];

  const skinMat = createBeachMaterial({ color: skinColors[seed % skinColors.length], roughness: 0.6 });
  const hairMat = createBeachMaterial({ color: hairColors[(seed * 5) % hairColors.length], roughness: 0.8 });

  // Head and Short Hair
  const head = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 8), skinMat));
  head.position.set(0, 1.50, 0);
  boy.add(head);

  const hair = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat));
  hair.position.set(0, 1.53, 0);
  hair.scale.set(1.03, 0.82, 1.03);
  boy.add(hair);

  // Torso
  if (type === "swimsuit") {
    const swimMat = createBeachMaterial({ color: swimColors[(seed * 7) % swimColors.length], roughness: 0.7 });
    // Bare Chest (Skin)
    const chest = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.24), skinMat));
    chest.position.set(0, 1.14, 0);
    // Swim Trunks
    const trunks = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.26), swimMat));
    trunks.position.set(0, 0.80, 0);
    boy.add(chest, trunks);
  } else {
    const shirtMat = createBeachMaterial({ color: shirtColors[(seed * 7) % shirtColors.length], roughness: 0.5 });
    const shortsMat = createBeachMaterial({ color: shortsColors[(seed * 11) % shortsColors.length], roughness: 0.7 });
    
    // T-shirt
    const shirt = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.26), shirtMat));
    shirt.position.set(0, 1.15, 0);
    // Shorts
    const shorts = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.26), shortsMat));
    shorts.position.set(0, 0.79, 0);
    boy.add(shirt, shorts);
  }

  // Walk cycle phase
  const walkPhase = (seed % 3) * 0.35 + 0.32;
  const swingAngle = Math.sin(walkPhase) * 0.4;

  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-0.13, 0.66, 0);
  const legL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.66, 6), skinMat));
  legL.position.y = -0.33;
  const footL = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), skinMat));
  footL.position.set(0, -0.66, 0.04);
  legLGroup.add(legL, footL);
  legLGroup.rotation.x = -swingAngle;
  boy.add(legLGroup);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.position.set(0.13, 0.66, 0);
  const legR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.66, 6), skinMat));
  legR.position.y = -0.33;
  const footR = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.15), skinMat));
  footR.position.set(0, -0.66, 0.04);
  legRGroup.add(legR, footR);
  legRGroup.rotation.x = swingAngle;
  boy.add(legRGroup);

  // Left Arm
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.27, 1.22, 0);
  const armL = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 6), skinMat));
  armL.position.y = -0.29;
  const handL = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat));
  handL.position.set(0, -0.58, 0);
  armLGroup.add(armL, handL);
  armLGroup.rotation.x = swingAngle;
  boy.add(armLGroup);

  // Right Arm
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.27, 1.22, 0);
  const armR = markShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.58, 6), skinMat));
  armR.position.y = -0.29;
  const handR = markShadow(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat));
  handR.position.set(0, -0.58, 0);
  armRGroup.add(armR, handR);
  armRGroup.rotation.x = -swingAngle;
  boy.add(armRGroup);

  return boy;
}

export function addBeachPeople(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // 1. Swimsuit girls on the beach (side = +1)
  for (let index = 0; index < 12; index += 1) {
    const progress = (index + 0.25) / 12;
    const depthOffset = (index % 3 === 0) ? 7.5 : (index % 3 === 1) ? 14.5 : 19.0;
    const { position, rotationY } = safePlace(curve, progress, +1, +(roadHalfWidth + depthOffset), roadHalfWidth, 4.5);

    const girl = createBeachGirl("swimsuit", index);
    girl.position.copy(position);
    girl.scale.setScalar(2.5);

    if (depthOffset === 7.5) {
      girl.rotation.y = rotationY + (index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (depthOffset === 14.5) {
      girl.position.y -= 0.22;
      girl.rotation.y = rotationY + (index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      girl.position.y -= 1.1;
      girl.rotation.y = rotationY + Math.PI + (pseudoRandom(index) * 0.4 - 0.2);
    }
    group.add(girl);
  }

  // 2. Swimsuit boys on the beach (side = +1)
  for (let index = 0; index < 10; index += 1) {
    const progress = (index + 0.75) / 10;
    const depthOffset = (index % 3 === 0) ? 8.5 : (index % 3 === 1) ? 15.5 : 18.0;
    const { position, rotationY } = safePlace(curve, progress, +1, +(roadHalfWidth + depthOffset), roadHalfWidth, 4.5);

    const boy = createBeachBoy("swimsuit", index);
    boy.position.copy(position);
    boy.scale.setScalar(2.5); // matches girls

    if (depthOffset === 8.5) {
      boy.rotation.y = rotationY + (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
    } else if (depthOffset === 15.5) {
      boy.position.y -= 0.22;
      boy.rotation.y = rotationY + (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
    } else {
      boy.position.y -= 1.0;
      boy.rotation.y = rotationY + Math.PI + (pseudoRandom(index * 2) * 0.4 - 0.2);
    }
    group.add(boy);
  }

  // 3. People walking towards the bars (side = -1)
  const barProgresses = [0.20, 0.55, 0.80];
  barProgresses.forEach((barP, barIdx) => {
    const barFrame = safePlace(curve, barP, -1, -(roadHalfWidth + 16.0), roadHalfWidth, 6.0);
    
    // Girl A: approaching from the left, standing outside the counter
    const pA = barP - 0.016;
    const frameA = safePlace(curve, pA, -1, -(roadHalfWidth + 5.8), roadHalfWidth, 4.5);
    const girlA = createBeachGirl("shorts_top", barIdx * 10 + 1);
    girlA.position.copy(frameA.position);
    girlA.scale.setScalar(2.6);
    const dirA = barFrame.position.clone().sub(frameA.position).normalize();
    girlA.rotation.y = Math.atan2(dirA.x, dirA.z);
    group.add(girlA);

    // Girl B: approaching from the right, standing outside the counter
    const pB = barP + 0.014;
    const frameB = safePlace(curve, pB, -1, -(roadHalfWidth + 6.6), roadHalfWidth, 4.5);
    const girlB = createBeachGirl("shorts_top", barIdx * 10 + 2);
    girlB.position.copy(frameB.position);
    girlB.scale.setScalar(2.6);
    const dirB = barFrame.position.clone().sub(frameB.position).normalize();
    girlB.rotation.y = Math.atan2(dirB.x, dirB.z);
    group.add(girlB);

    // Boy C: approaching from the front-left, standing outside the counter
    const pC = barP - 0.008;
    const frameC = safePlace(curve, pC, -1, -(roadHalfWidth + 7.2), roadHalfWidth, 4.5);
    const boyC = createBeachBoy("shorts_shirt", barIdx * 10 + 3);
    boyC.position.copy(frameC.position);
    boyC.scale.setScalar(2.6); // matches girls
    const dirC = barFrame.position.clone().sub(frameC.position).normalize();
    boyC.rotation.y = Math.atan2(dirC.x, dirC.z);
    group.add(boyC);
  });
}

