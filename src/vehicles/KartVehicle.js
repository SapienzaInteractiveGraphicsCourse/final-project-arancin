import * as THREE from "three";
import { BaseVehicle } from "./BaseVehicle.js";

export class KartVehicle extends BaseVehicle {
  constructor() {
    super({
      id: "kart",
      name: "KartVehicle",
      bodyColor: 0xd6332f
    });

    this.materials = this.createMaterials();
    this.buildKart();
  }

  createMaterials() {
    return {
      body: this.registerBodyMaterial(new THREE.MeshStandardMaterial({
        color: this.bodyColor,
        roughness: 0.44,
        metalness: 0.12
      })),
      frame: new THREE.MeshStandardMaterial({
        color: 0x1f2933,
        roughness: 0.58,
        metalness: 0.32
      }),
      tire: new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.02
      }),
      axle: new THREE.MeshStandardMaterial({
        color: 0xa8adb2,
        roughness: 0.36,
        metalness: 0.72
      }),
      seat: new THREE.MeshStandardMaterial({
        color: 0x2a2f36,
        roughness: 0.74,
        metalness: 0.06
      })
    };
  }

  buildKart() {
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.name = "KartChassis";
    this.group.add(this.chassisGroup);

    this.addBox("KartFrame", [1.75, 0.18, 2.35], [0, 0.42, 0], this.materials.frame);
    this.addBox("KartBody", [1.45, 0.34, 1.35], [0, 0.64, 0.2], this.materials.body);
    this.addBox("KartNose", [1.12, 0.22, 0.72], [0, 0.55, 1.03], this.materials.body);
    this.addBox("KartSeat", [0.82, 0.52, 0.62], [0, 0.88, -0.55], this.materials.seat);

    this.addAxle("KartFrontAxle", [0, 0.38, 0.88]);
    this.addAxle("KartRearAxle", [0, 0.38, -0.92]);

    this.addWheel("KartWheelFrontLeft", [-1.08, 0.38, 0.88]);
    this.addWheel("KartWheelFrontRight", [1.08, 0.38, 0.88]);
    this.addWheel("KartWheelRearLeft", [-1.08, 0.38, -0.92]);
    this.addWheel("KartWheelRearRight", [1.08, 0.38, -0.92]);
  }

  addBox(name, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.chassisGroup.add(mesh);
    return mesh;
  }

  addAxle(name, position) {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 2.45, 20),
      this.materials.axle
    );
    axle.name = name;
    axle.position.set(...position);
    axle.rotation.z = Math.PI / 2;
    axle.castShadow = true;
    axle.receiveShadow = true;
    this.chassisGroup.add(axle);
    return axle;
  }

  addWheel(name, position) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24),
      this.materials.tire
    );
    wheel.name = name;
    wheel.position.set(...position);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    this.chassisGroup.add(wheel);
    return wheel;
  }
}
