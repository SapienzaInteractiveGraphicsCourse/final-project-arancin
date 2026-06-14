import * as THREE from "three";
import { BaseVehicle } from "./BaseVehicle.js";

const DEFAULT_WHEEL_POSITIONS = [
  [-1.05, 0.28, -1.1],
  [1.05, 0.28, -1.1],
  [-1.05, 0.28, 1.1],
  [1.05, 0.28, 1.1]
];

export class PlaceholderVehicle extends BaseVehicle {
  constructor({
    id,
    name,
    bodyColor,
    metalness = 0.18,
    wheelPositions = DEFAULT_WHEEL_POSITIONS
  }) {
    super({ id, name, bodyColor });

    this.wheels = [];
    this.buildPlaceholderBody({ metalness, wheelPositions });
  }

  buildPlaceholderBody({ metalness, wheelPositions }) {
    const bodyMaterial = this.registerBodyMaterial(new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.52,
      metalness
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
