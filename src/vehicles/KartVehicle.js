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
      }),
      suit: new THREE.MeshStandardMaterial({
        color: 0x1e5f8f,
        roughness: 0.62,
        metalness: 0.04
      }),
      helmet: new THREE.MeshStandardMaterial({
        color: 0xf3f0e6,
        roughness: 0.38,
        metalness: 0.08
      }),
      skin: new THREE.MeshStandardMaterial({
        color: 0xd8a879,
        roughness: 0.58,
        metalness: 0.02
      }),
      light: new THREE.MeshStandardMaterial({
        color: 0xfff3c4,
        emissive: 0xffd66b,
        emissiveIntensity: 0,
        roughness: 0.22,
        metalness: 0.04
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

    this.addDriver();
    this.addSteeringWheel();
    this.addHeadlights();
    this.setHeadlights(false);
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
    const wheelGroup = new THREE.Group();
    wheelGroup.name = `${name}Assembly`;
    wheelGroup.position.set(...position);

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24),
      this.materials.tire
    );
    wheel.name = name;
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    wheel.receiveShadow = true;

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.32, 20),
      this.materials.axle
    );
    hub.name = `${name}Hub`;
    hub.rotation.z = Math.PI / 2;
    hub.castShadow = true;
    hub.receiveShadow = true;

    wheelGroup.add(wheel, hub);
    this.chassisGroup.add(wheelGroup);
    return wheelGroup;
  }

  addDriver() {
    this.driverRoot = new THREE.Group();
    this.driverRoot.name = "KartDriver";
    this.driverRoot.position.set(0, 0.98, -0.48);
    this.chassisGroup.add(this.driverRoot);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.34), this.materials.suit);
    torso.name = "KartDriverTorso";
    torso.position.y = 0.18;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.driverRoot.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), this.materials.helmet);
    head.name = "KartDriverHelmet";
    head.position.y = 0.62;
    head.castShadow = true;
    head.receiveShadow = true;
    this.driverRoot.add(head);

    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.55, 16),
        this.materials.suit
      );
      arm.name = side < 0 ? "KartDriverLeftArm" : "KartDriverRightArm";
      arm.position.set(side * 0.28, 0.25, 0.23);
      arm.rotation.set(Math.PI / 2.7, 0, side * 0.22);
      arm.castShadow = true;
      arm.receiveShadow = true;
      this.driverRoot.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), this.materials.skin);
      hand.name = side < 0 ? "KartDriverLeftHand" : "KartDriverRightHand";
      hand.position.set(side * 0.34, 0.04, 0.48);
      hand.castShadow = true;
      hand.receiveShadow = true;
      this.driverRoot.add(hand);
    });
  }

  addSteeringWheel() {
    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.name = "KartSteeringWheel";
    this.steeringWheelPivot.position.set(0, 1.02, 0.38);
    this.steeringWheelPivot.rotation.x = Math.PI / 2.8;

    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.022, 12, 32),
      this.materials.frame
    );
    wheel.name = "KartSteeringWheelRim";
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    this.steeringWheelPivot.add(wheel);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.42, 16),
      this.materials.axle
    );
    column.name = "KartSteeringColumn";
    column.position.set(0, -0.02, -0.2);
    column.rotation.x = Math.PI / 2;
    column.castShadow = true;
    column.receiveShadow = true;
    this.steeringWheelPivot.add(column);

    this.chassisGroup.add(this.steeringWheelPivot);
  }

  addHeadlights() {
    [-1, 1].forEach((side) => {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), this.materials.light);
      lens.name = side < 0 ? "KartHeadlightLeft" : "KartHeadlightRight";
      lens.position.set(side * 0.42, 0.66, 1.37);
      lens.scale.z = 0.45;
      lens.castShadow = false;
      lens.receiveShadow = false;
      this.headlightMeshes.push(lens);

      const light = new THREE.SpotLight(0xfff0c8, 1.8, 24, Math.PI / 5, 0.55, 0.85);
      light.name = side < 0 ? "KartHeadlightBeamLeft" : "KartHeadlightBeamRight";
      light.position.set(side * 0.42, 0.68, 1.42);
      light.castShadow = false;

      const target = new THREE.Object3D();
      target.name = side < 0 ? "KartHeadlightTargetLeft" : "KartHeadlightTargetRight";
      target.position.set(side * 0.42, 0.38, 7.5);
      light.target = target;

      this.headlights.push(light);
      this.chassisGroup.add(lens, light, target);
    });
  }
}
