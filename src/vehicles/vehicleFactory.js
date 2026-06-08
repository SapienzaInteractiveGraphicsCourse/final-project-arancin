import * as THREE from "three";
import { getVehiclePerformance } from "../config/vehiclePerformance.js";

const VEHICLE_COLORS = {
  kart: 0xd6332f,
  porsche: 0xf8fafc,
  silvia: 0x2f74d6
};

export function createVehicleById(vehicleId) {
  const color = VEHICLE_COLORS[vehicleId] ?? VEHICLE_COLORS.kart;
  const group = new THREE.Group();
  group.name = `VehiclePlaceholder:${vehicleId}`;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.65, 3.1),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.52,
      metalness: vehicleId === "kart" ? 0.08 : 0.22
    })
  );
  body.name = "PlaceholderBody";
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8
  });
  const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 20);
  wheelGeometry.rotateZ(Math.PI / 2);

  const wheelPositions = [
    [-1.05, 0.28, -1.1],
    [1.05, 0.28, -1.1],
    [-1.05, 0.28, 1.1],
    [1.05, 0.28, 1.1]
  ];

  const wheels = wheelPositions.map(([x, y, z], index) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.name = `PlaceholderWheel:${index}`;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
    return wheel;
  });

  return {
    group,
    performance: getVehiclePerformance(vehicleId),
    setTransform(position, heading = 0) {
      group.position.copy(position);
      group.rotation.y = heading;
    },
    update(deltaTime) {
      wheels.forEach((wheel) => {
        wheel.rotation.x += deltaTime * 2.2;
      });
    },
    setBodyColor(nextColor) {
      body.material.color.set(nextColor);
    },
    setHeadlights() {},
    toggleHeadlights() {},
    dispose() {
      body.geometry.dispose();
      body.material.dispose();
      wheelGeometry.dispose();
      wheelMaterial.dispose();
    }
  };
}
