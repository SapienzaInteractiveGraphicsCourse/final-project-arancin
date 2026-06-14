import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial, safePlace } from "./common.js";
import { createBeachPersonSittingWithStrawHat } from "./people.js";
import { createBeachHouse } from "./structures.js";
import { addInstancedPart } from "../common/instancing.js";

const UP = new THREE.Vector3(0, 1, 0);

const palmMaterials = {
  trunk: createBeachMaterial({ color: 0x6f4726, roughness: 0.9 }),
  band: createBeachMaterial({ color: 0xa87a44, roughness: 0.88 }),
  rib: createBeachMaterial({ color: 0x174d25, roughness: 0.82 }),
  leafDark: createBeachMaterial({ color: 0x1f6f2b, roughness: 0.82, metalness: 0 }),
  leafMid: createBeachMaterial({ color: 0x2d8f34, roughness: 0.78, metalness: 0 }),
  leafLight: createBeachMaterial({ color: 0x3eaa43, roughness: 0.78, metalness: 0 }),
  coconut: createBeachMaterial({ color: 0x4d321d, roughness: 0.82 }),
  bushA: createBeachMaterial({ color: 0x2f9b4b, roughness: 0.82 }),
  bushB: createBeachMaterial({ color: 0x1f7a3a, roughness: 0.82 })
};

palmMaterials.leafDark.side = THREE.DoubleSide;
palmMaterials.leafMid.side = THREE.DoubleSide;
palmMaterials.leafLight.side = THREE.DoubleSide;

const palmGeometries = {
  trunk: new THREE.CylinderGeometry(1, 1, 1, 7),
  band: new THREE.CylinderGeometry(1, 1, 1, 7),
  rib: new THREE.BoxGeometry(0.08, 0.05, 1),
  leaf: new THREE.PlaneGeometry(0.85, 3.6),
  coconut: new THREE.SphereGeometry(0.18, 6, 6),
  bush: new THREE.DodecahedronGeometry(0.8, 0)
};

function composeMatrix(position, quaternion, scale) {
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

function multiplyMatrices(parent, local) {
  return new THREE.Matrix4().multiplyMatrices(parent, local);
}

function addInstancedPalm(batch, position, rotationY, scale, seed) {
  const baseMatrix = composeMatrix(
    position,
    new THREE.Quaternion().setFromAxisAngle(UP, rotationY),
    new THREE.Vector3(scale, scale, scale)
  );
  const trunkHeight = 8.8 + (seed % 3) * 0.7;
  const segmentCount = 5;
  const lean = seed % 2 === 0 ? 0.075 : -0.075;
  const segmentHeight = trunkHeight / segmentCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const taper = 1 - index / segmentCount;
    const localPosition = new THREE.Vector3(lean * index * 0.34, segmentHeight * (index + 0.5), 0);
    const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean));
    const radius = 0.19 + taper * 0.08;
    const localScale = new THREE.Vector3(radius, segmentHeight * 1.04, radius);
    batch.trunks.push(multiplyMatrices(baseMatrix, composeMatrix(localPosition, localRotation, localScale)));

    if (index % 2 === 0) {
      const bandScale = new THREE.Vector3(radius * 1.08, 0.12, radius * 1.08);
      batch.bands.push(multiplyMatrices(baseMatrix, composeMatrix(localPosition, localRotation, bandScale)));
    }
  }

  const crownCenter = new THREE.Vector3(lean * segmentCount * 0.34, trunkHeight + 0.35, 0);
  const leafMaterials = [batch.leavesMid, batch.leavesLight, batch.leavesDark];

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2 + pseudoRandom(seed + index) * 0.18;
    const length = 4.7 + pseudoRandom(seed + index * 0.7) * 1.1;
    const localPosition = crownCenter.clone().add(new THREE.Vector3(
      Math.sin(angle) * length * 0.34,
      0.1 - (index % 3) * 0.08,
      Math.cos(angle) * length * 0.34
    ));
    const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Math.PI / 2.8 + (index % 3) * 0.08,
      angle,
      (index % 2 === 0 ? 1 : -1) * 0.16
    ));
    const localScale = new THREE.Vector3(0.9 + pseudoRandom(seed + index + 3) * 0.25, length / 3.6, 1);
    leafMaterials[index % leafMaterials.length].push(
      multiplyMatrices(baseMatrix, composeMatrix(localPosition, localRotation, localScale))
    );

    const ribPosition = crownCenter.clone().add(new THREE.Vector3(
      Math.sin(angle) * length * 0.45,
      0.03,
      Math.cos(angle) * length * 0.45
    ));
    const ribRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, angle, 0));
    batch.ribs.push(multiplyMatrices(
      baseMatrix,
      composeMatrix(ribPosition, ribRotation, new THREE.Vector3(1, 1, length))
    ));
  }

  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + (seed % 5) * 0.4;
    const localPosition = crownCenter.clone().add(new THREE.Vector3(
      Math.cos(angle) * 0.24,
      -0.22 - (index % 2) * 0.04,
      Math.sin(angle) * 0.24
    ));
    batch.coconuts.push(multiplyMatrices(
      baseMatrix,
      composeMatrix(localPosition, new THREE.Quaternion(), new THREE.Vector3(1, 1.15, 0.95))
    ));
  }
}

function addInstancedBush(batch, position, rotationY, scale, seed) {
  const baseMatrix = composeMatrix(
    position,
    new THREE.Quaternion().setFromAxisAngle(UP, rotationY),
    new THREE.Vector3(scale, scale, scale)
  );
  const target = seed % 2 === 0 ? batch.bushA : batch.bushB;

  for (let index = 0; index < 4; index += 1) {
    const localPosition = new THREE.Vector3(
      (index - 1.5) * 0.45,
      0.55 + index * 0.1,
      (pseudoRandom(seed + index) - 0.5) * 0.8
    );
    const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pseudoRandom(seed + index + 2) * Math.PI, 0));
    const localScale = new THREE.Vector3(1.25, 0.72, 0.9).multiplyScalar(1 + index * 0.08);
    target.push(multiplyMatrices(baseMatrix, composeMatrix(localPosition, localRotation, localScale)));
  }
}

function createVegetationBatchGroup() {
  const group = new THREE.Group();
  group.name = "TropicalBeachInstancedVegetation";
  group.userData.decorativeProps = true;
  return group;
}

function flushVegetationBatch(group, batch) {
  addInstancedPart(group, palmGeometries.trunk, palmMaterials.trunk, batch.trunks, "TropicalBeachPalmTrunks");
  addInstancedPart(group, palmGeometries.band, palmMaterials.band, batch.bands, "TropicalBeachPalmBands");
  addInstancedPart(group, palmGeometries.rib, palmMaterials.rib, batch.ribs, "TropicalBeachPalmRibs");
  addInstancedPart(group, palmGeometries.leaf, palmMaterials.leafMid, batch.leavesMid, "TropicalBeachPalmLeaves:Mid");
  addInstancedPart(group, palmGeometries.leaf, palmMaterials.leafLight, batch.leavesLight, "TropicalBeachPalmLeaves:Light");
  addInstancedPart(group, palmGeometries.leaf, palmMaterials.leafDark, batch.leavesDark, "TropicalBeachPalmLeaves:Dark");
  addInstancedPart(group, palmGeometries.coconut, palmMaterials.coconut, batch.coconuts, "TropicalBeachPalmCoconuts");
  addInstancedPart(group, palmGeometries.bush, palmMaterials.bushA, batch.bushA, "TropicalBeachBushes:A");
  addInstancedPart(group, palmGeometries.bush, palmMaterials.bushB, batch.bushB, "TropicalBeachBushes:B");
}

function createBeachChair(seed = 0) {
  const chair = new THREE.Group();
  chair.name = "BeachPlasticChair";

  const material = createBeachMaterial({
    color: 0xf5f5f5, // White plastic
    roughness: 0.45,
    metalness: 0.05
  });

  // Seat
  const seat = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), material));
  seat.position.y = 0.4;
  chair.add(seat);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 5);
  const legOffsets = [
    [-0.32, 0.2, -0.32],
    [0.32, 0.2, -0.32],
    [-0.32, 0.2, 0.32],
    [0.32, 0.2, 0.32]
  ];
  legOffsets.forEach(([lx, ly, lz]) => {
    const leg = markShadow(new THREE.Mesh(legGeo, material));
    leg.position.set(lx, ly, lz);
    leg.rotation.z = lx * -0.12;
    leg.rotation.x = lz * 0.12;
    chair.add(leg);
  });

  // Backrest frame
  const backFrameLeft = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), material));
  backFrameLeft.position.set(-0.34, 0.75, 0.34);
  const backFrameRight = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), material));
  backFrameRight.position.set(0.34, 0.75, 0.34);
  const backTop = markShadow(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.06), material));
  backTop.position.set(0, 1.1, 0.34);
  chair.add(backFrameLeft, backFrameRight, backTop);

  // Vertical slats
  const slatGeo = new THREE.BoxGeometry(0.05, 0.6, 0.03);
  [-0.2, 0, 0.2].forEach((sx) => {
    const slat = markShadow(new THREE.Mesh(slatGeo, material));
    slat.position.set(sx, 0.75, 0.34);
    chair.add(slat);
  });

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.05, 0.04, 0.6);
  const armSupportGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 5);
  [-0.36, 0.36].forEach((ax) => {
    const arm = markShadow(new THREE.Mesh(armGeo, material));
    arm.position.set(ax, 0.62, 0.06);
    const support = markShadow(new THREE.Mesh(armSupportGeo, material));
    support.position.set(ax, 0.525, -0.2);
    chair.add(arm, support);
  });

  return chair;
}


function addChairsUnderPalm(group, palmPosition, palmRotationY, index) {
  // 1. Two chairs, scaled to 2.8x (slightly smaller than 3.5x as requested)
  const chair1 = createBeachChair(index * 2);
  const chair2 = createBeachChair(index * 2 + 1);

  chair1.scale.setScalar(2.8);
  chair2.scale.setScalar(2.8);

  const angle = palmRotationY;
  // Spacing offsets optimized for 2.8x scale
  const dx1 = Math.sin(angle) * 3.0 + Math.cos(angle) * -2.0;
  const dz1 = Math.cos(angle) * 3.0 - Math.sin(angle) * -2.0;

  const dx2 = Math.sin(angle) * 3.0 + Math.cos(angle) * 2.0;
  const dz2 = Math.cos(angle) * 3.0 - Math.sin(angle) * 2.0;

  chair1.position.set(palmPosition.x + dx1, palmPosition.y - 0.05, palmPosition.z + dz1);
  chair1.rotation.y = angle + Math.PI + 0.15;

  chair2.position.set(palmPosition.x + dx2, palmPosition.y - 0.05, palmPosition.z + dz2);
  chair2.rotation.y = angle + Math.PI - 0.15;

  group.add(chair1, chair2);

  // 2. The sitting person on chair1
  const person = createBeachPersonSittingWithStrawHat(index);
  // Place on seat: y = 0.43 (slightly above y=0.4 seat mesh), z = 0.05
  person.position.set(0, 0.43, 0.05);
  chair1.add(person);
}

export function addBeachTropicalPlants(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;
  const vegetationGroup = createVegetationBatchGroup();
  const batch = {
    trunks: [],
    bands: [],
    ribs: [],
    leavesMid: [],
    leavesLight: [],
    leavesDark: [],
    coconuts: [],
    bushA: [],
    bushB: []
  };

  // Helper to check if a progress value is near a bar kiosk to prevent overlapping palms
  const isNearBar = (p) => {
    const bars = [0.20, 0.55, 0.80];
    return bars.some(barP => Math.abs(p - barP) < 0.04);
  };

  // 20 palme/cespugli distribuiti attorno alla pista, tenendoli vicini sul lato interno
  for (let index = 0; index < 20; index += 1) {
    const side = -1;
    const progress = (index + 0.3) / 20;
    if (isNearBar(progress)) continue;
    const offset = side * (roadHalfWidth + 4.5 + (index % 4) * 2.5); // Offset tra roadHalfWidth + 4.5 e roadHalfWidth + 12
    const { position, rotationY } = safePlace(curve, progress, side, offset, roadHalfWidth, 4.5);
    const useBush = index % 5 === 0;
    // Scale: palme 1.1–1.6x, cespugli 1.2–1.8x
    const baseScale = useBush ? 1.4 : 1.1;
    const scale = baseScale + pseudoRandom(index + 4.1) * 0.5;
    const plantRotationY = rotationY + (index % 5) * 0.22;

    if (useBush) {
      addInstancedBush(batch, position, plantRotationY, scale, index);
    } else {
      addInstancedPalm(batch, position, plantRotationY, scale, index);
    }

    if (!useBush && index === 2) {
      addChairsUnderPalm(group, position, rotationY, index);
      addHouseBehindPalm(group, curve, progress, offset, roadHalfWidth, rotationY, index);
    }
  }

  // Add 45 more palms/bushes on the inside (side = -1) to make the inner ring dense
  for (let index = 0; index < 45; index += 1) {
    const side = -1;
    const progress = (index + 0.75) / 45;
    if (isNearBar(progress)) continue;
    const offset = side * (roadHalfWidth + 5.0 + (index % 3) * 3.5);
    const { position, rotationY } = safePlace(curve, progress, side, offset, roadHalfWidth, 4.5);
    const useBush = index % 4 === 0;
    const baseScale = useBush ? 1.35 : 1.05;
    const scale = baseScale + pseudoRandom(index + 9.9) * 0.5;
    const plantRotationY = rotationY + (index % 5) * 0.3;

    if (useBush) {
      addInstancedBush(batch, position, plantRotationY, scale, index + 100);
    } else {
      addInstancedPalm(batch, position, plantRotationY, scale, index + 100);
    }
  }

  flushVegetationBatch(vegetationGroup, batch);
  group.add(vegetationGroup);
}

function addHouseBehindPalm(group, curve, progress, palmOffset, roadHalfWidth, palmRotationY, index) {
  // Compute position behind the palm.
  // The palm has a negative offset (inside loop, side = -1).
  // So we move it further away by subtracting 25 meters to accommodate the larger 3.2x scale.
  const houseOffset = palmOffset - 25.0;
  
  // Use safePlace to sample coordinates and height correctly.
  // Using side = -1, minClearance = 12.0 for safety.
  const { position, rotationY } = safePlace(curve, progress, -1, houseOffset, roadHalfWidth, 12.0);
  
  const house = createBeachHouse(index);
  house.position.copy(position);
  // Scale up the house to 3.2x to make it beautifully proportioned
  house.scale.setScalar(3.2);
  // Rotate 180 degrees (add Math.PI) so the front porch faces the track/road
  house.rotation.y = rotationY + Math.PI;
  
  group.add(house);
}
