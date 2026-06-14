import * as THREE from "three";
import { markShadow, pseudoRandom } from "../shared.js";
import { createBeachMaterial, safePlace } from "./common.js";
import { createBeachPersonSittingWithStrawHat } from "./people.js";
import { createBeachHouse } from "./structures.js";
import { createTropicalBush, createTropicalPalm } from "./plants.js";

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
    const plant = useBush ? createTropicalBush(index) : createTropicalPalm(index);
    plant.position.copy(position);
    plant.rotation.y = rotationY + (index % 5) * 0.22;
    // Scale: palme 1.1–1.6x, cespugli 1.2–1.8x
    const baseScale = useBush ? 1.4 : 1.1;
    plant.scale.setScalar(baseScale + pseudoRandom(index + 4.1) * 0.5);
    group.add(plant);

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
    const plant = useBush ? createTropicalBush(index + 100) : createTropicalPalm(index + 100);
    plant.position.copy(position);
    plant.rotation.y = rotationY + (index % 5) * 0.3;
    const baseScale = useBush ? 1.35 : 1.05;
    plant.scale.setScalar(baseScale + pseudoRandom(index + 9.9) * 0.5);
    group.add(plant);
  }
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

