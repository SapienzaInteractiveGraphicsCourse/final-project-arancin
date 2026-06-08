import * as THREE from "three";
import { BaseVehicle } from "./BaseVehicle.js";

const VEHICLE_COLORS = {
  kart: 0xd6332f,
  porsche: 0xf8fafc,
  silvia: 0x2f74d6
};

class PlaceholderVehicle extends BaseVehicle {
  constructor(vehicleId) {
    const color = VEHICLE_COLORS[vehicleId] ?? VEHICLE_COLORS.kart;

    super({
      id: vehicleId,
      name: `VehiclePlaceholder:${vehicleId}`,
      bodyColor: color
    });

    this.wheels = [];
    this.buildPlaceholderBody(vehicleId);
  }

  buildPlaceholderBody(vehicleId) {
    const bodyMaterial = this.registerBodyMaterial(new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.52,
      metalness: vehicleId === "kart" ? 0.08 : 0.22
    }));

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 3.1), bodyMaterial);
    body.name = "PlaceholderBody";
    body.position.y = 0.45;
    body.castShadow = true;
    this.group.add(body);

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

    this.wheels = wheelPositions.map(([x, y, z], index) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.name = `PlaceholderWheel:${index}`;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      this.group.add(wheel);
      return wheel;
    });
  }

  update(deltaTime) {
    this.wheels.forEach((wheel) => {
      wheel.rotation.x += deltaTime * 2.2;
    });
  }
}

export function createVehicleById(vehicleId) {
  return new PlaceholderVehicle(vehicleId);
}
