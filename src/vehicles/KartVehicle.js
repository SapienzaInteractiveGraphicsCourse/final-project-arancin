import * as THREE from "three";
import { BaseVehicle } from "./BaseVehicle.js";
import { createHeadlightBeam } from "./headlightEffects.js";

const KART_WHEEL_GROUND_Y = 0.34;

export class KartVehicle extends BaseVehicle {
  constructor() {
    super({
      id: "kart",
      name: "KartVehicle",
      bodyColor: 0xd6332f
    });

    this.wheelRadius = 0.34;
    this.wheelRotation = 0;
    this.wheelRollGroups = [];
    this.frontSteeringPivots = [];
    this.wheelPivots = [];
    this.driverAnimationTime = 0;
    this.materials = this.createMaterials();
    this.buildKart();
  }

  createMaterials() {
    return {
      body: this.registerBodyMaterial(new THREE.MeshStandardMaterial({
        color: this.bodyColor,
        roughness: 0.36,
        metalness: 0.18
      })),
      bodyDark: new THREE.MeshStandardMaterial({
        color: 0x7f1d1d,
        roughness: 0.48,
        metalness: 0.16
      }),
      frame: new THREE.MeshStandardMaterial({
        color: 0x1f2933,
        roughness: 0.58,
        metalness: 0.32
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: 0x0b0f16,
        roughness: 0.82,
        metalness: 0.04
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
      rim: new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 0.28,
        metalness: 0.78
      }),
      seat: new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.74,
        metalness: 0.06
      }),
      suit: new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.62,
        metalness: 0.04
      }),
      helmet: new THREE.MeshStandardMaterial({
        color: 0xf3f0e6,
        roughness: 0.38,
        metalness: 0.08
      }),
      visor: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.18,
        metalness: 0.3
      }),
      stripe: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.34,
        metalness: 0.08
      }),
      number: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.38,
        metalness: 0.04
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
      }),
      engine: new THREE.MeshStandardMaterial({
        color: 0x2f353d,
        roughness: 0.42,
        metalness: 0.5
      })
    };
  }

  buildKart() {
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.name = "KartChassis";
    this.group.add(this.chassisGroup);

    this.addBox("KartFrame", [1.75, 0.18, 2.35], [0, 0.42, 0], this.materials.frame);
    this.addBox("KartBody", [1.38, 0.3, 1.25], [0, 0.62, 0.13], this.materials.body);
    this.addBox("KartBodyCenterStripe", [0.18, 0.025, 1.18], [0, 0.785, 0.18], this.materials.stripe);
    this.addBox("KartNose", [0.96, 0.2, 0.82], [0, 0.52, 1.03], this.materials.body);
    this.addBox("KartNoseTaperLeft", [0.24, 0.18, 0.74], [-0.5, 0.53, 1.03], this.materials.body);
    this.addBox("KartNoseTaperRight", [0.24, 0.18, 0.74], [0.5, 0.53, 1.03], this.materials.body);
    this.chassisGroup.getObjectByName("KartNoseTaperLeft").rotation.z = -0.18;
    this.chassisGroup.getObjectByName("KartNoseTaperRight").rotation.z = 0.18;
    this.addBox("KartNoseNumberPlate", [0.36, 0.035, 0.3], [0, 0.65, 1.34], this.materials.number);
    this.addNumberMark();
    this.addBox("KartNoseLip", [0.78, 0.065, 0.12], [0, 0.46, 1.46], this.materials.rubber);
    this.addBox("KartSeat", [0.78, 0.5, 0.56], [0, 0.87, -0.55], this.materials.seat);
    this.addBox("KartLeftSidePod", [0.26, 0.24, 1.0], [-0.82, 0.56, 0.03], this.materials.bodyDark);
    this.addBox("KartRightSidePod", [0.26, 0.24, 1.0], [0.82, 0.56, 0.03], this.materials.bodyDark);
    this.addEngineBlock();
    this.addBumper("KartFrontBumper", [0, 0.44, 1.48], 1.45);
    this.addBumper("KartRearBumper", [0, 0.47, -1.32], 1.38);
    this.addRollBar();

    this.addAxle("KartFrontAxle", [0, KART_WHEEL_GROUND_Y, 0.88]);
    this.addAxle("KartRearAxle", [0, KART_WHEEL_GROUND_Y, -0.92]);

    this.addWheel("KartWheelFrontLeft", [-1.08, KART_WHEEL_GROUND_Y, 0.88], true);
    this.addWheel("KartWheelFrontRight", [1.08, KART_WHEEL_GROUND_Y, 0.88], true);
    this.addWheel("KartWheelRearLeft", [-1.08, KART_WHEEL_GROUND_Y, -0.92], false);
    this.addWheel("KartWheelRearRight", [1.08, KART_WHEEL_GROUND_Y, -0.92], false);

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

  addBumper(name, position, width) {
    const bumper = new THREE.Group();
    bumper.name = name;
    bumper.position.set(...position);

    const bar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, width, 8, 18),
      this.materials.frame
    );
    bar.name = `${name}Bar`;
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    bar.receiveShadow = true;
    bumper.add(bar);

    [-1, 1].forEach((side) => {
      const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.34, 12),
        this.materials.axle
      );
      mount.name = `${name}${side < 0 ? "Left" : "Right"}Mount`;
      mount.position.set(side * width * 0.32, 0, name.includes("Front") ? -0.16 : 0.16);
      mount.rotation.x = Math.PI / 2;
      mount.castShadow = true;
      mount.receiveShadow = true;
      bumper.add(mount);
    });

    this.chassisGroup.add(bumper);
    return bumper;
  }

  addRollBar() {
    const rollBar = new THREE.Group();
    rollBar.name = "KartRollBar";
    rollBar.position.set(0, 1.2, -0.88);

    [-1, 1].forEach((side) => {
      const upright = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.72, 14),
        this.materials.frame
      );
      upright.name = side < 0 ? "KartRollBarLeft" : "KartRollBarRight";
      upright.position.set(side * 0.38, 0, 0);
      upright.rotation.z = side * 0.16;
      upright.castShadow = true;
      upright.receiveShadow = true;
      rollBar.add(upright);
    });

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.78, 14),
      this.materials.frame
    );
    top.name = "KartRollBarTop";
    top.position.y = 0.35;
    top.rotation.z = Math.PI / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    rollBar.add(top);

    this.chassisGroup.add(rollBar);
  }

  addNumberMark() {
    const digitGroup = new THREE.Group();
    digitGroup.name = "KartNoseNumberOne";
    digitGroup.position.set(0, 0.675, 1.345);

    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.2), this.materials.frame);
    stem.name = "KartNoseNumberOneStem";
    stem.castShadow = true;
    stem.receiveShadow = true;
    digitGroup.add(stem);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.045), this.materials.frame);
    top.name = "KartNoseNumberOneTop";
    top.position.set(-0.025, 0, 0.08);
    top.rotation.y = -0.38;
    top.castShadow = true;
    top.receiveShadow = true;
    digitGroup.add(top);

    this.chassisGroup.add(digitGroup);
  }

  addEngineBlock() {
    const engine = new THREE.Group();
    engine.name = "KartRearEngine";
    engine.position.set(0, 0.7, -1.18);

    const block = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.34), this.materials.engine);
    block.name = "KartRearEngineBlock";
    block.castShadow = true;
    block.receiveShadow = true;
    engine.add(block);

    [-1, 0, 1].forEach((index) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.38), this.materials.axle);
      fin.name = `KartRearEngineFin${index + 2}`;
      fin.position.x = index * 0.16;
      fin.castShadow = true;
      fin.receiveShadow = true;
      engine.add(fin);
    });

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 16), this.materials.axle);
    exhaust.name = "KartRearExhaust";
    exhaust.position.set(0.42, 0.02, -0.08);
    exhaust.rotation.set(Math.PI / 2, 0, 0);
    exhaust.castShadow = true;
    exhaust.receiveShadow = true;
    engine.add(exhaust);

    this.chassisGroup.add(engine);
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

  addWheel(name, position, steerable) {
    const steeringPivot = new THREE.Group();
    steeringPivot.name = steerable ? `${name}SteeringPivot` : `${name}Mount`;
    steeringPivot.position.set(...position);

    const rollGroup = new THREE.Group();
    rollGroup.name = `${name}RollPivot`;

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.34, 28),
      this.materials.tire
    );
    wheel.name = name;
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    wheel.receiveShadow = true;

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.37, 24),
      this.materials.rim
    );
    hub.name = `${name}Hub`;
    hub.rotation.z = Math.PI / 2;
    hub.castShadow = true;
    hub.receiveShadow = true;

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.39, 18),
      this.materials.axle
    );
    cap.name = `${name}CenterCap`;
    cap.rotation.z = Math.PI / 2;
    cap.castShadow = true;
    cap.receiveShadow = true;

    rollGroup.add(wheel, hub, cap);
    steeringPivot.add(rollGroup);
    this.chassisGroup.add(steeringPivot);
    this.wheelRollGroups.push(rollGroup);
    this.wheelPivots.push({
      pivot: steeringPivot,
      baseY: position[1],
      side: Math.sign(position[0]) || 1,
      phase: position[2] > 0 ? 0 : Math.PI * 0.72
    });

    if (steerable) {
      this.frontSteeringPivots.push(steeringPivot);
    }

    return steeringPivot;
  }

  addDriver() {
    this.driverRoot = new THREE.Group();
    this.driverRoot.name = "KartDriver";
    this.driverRoot.position.set(0, 0.98, -0.48);
    this.chassisGroup.add(this.driverRoot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 6, 14), this.materials.suit);
    torso.name = "KartDriverTorso";
    torso.position.y = 0.18;
    torso.scale.set(1.05, 1, 0.78);
    torso.rotation.x = -0.16;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.driverRoot.add(torso);

    this.driverHeadPivot = new THREE.Group();
    this.driverHeadPivot.name = "KartDriverHeadPivot";
    this.driverHeadPivot.position.set(0, 0.58, 0.02);
    this.driverRoot.add(this.driverHeadPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), this.materials.helmet);
    head.name = "KartDriverHelmet";
    head.position.y = 0.04;
    head.scale.set(1, 0.9, 1.05);
    head.castShadow = true;
    head.receiveShadow = true;
    this.driverHeadPivot.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.075, 0.035), this.materials.visor);
    visor.name = "KartDriverVisor";
    visor.position.set(0, 0.06, 0.2);
    visor.castShadow = true;
    visor.receiveShadow = true;
    this.driverHeadPivot.add(visor);

    const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.34), this.materials.body);
    helmetStripe.name = "KartDriverHelmetStripe";
    helmetStripe.position.set(0, 0.2, 0.02);
    helmetStripe.rotation.x = -0.16;
    helmetStripe.castShadow = true;
    helmetStripe.receiveShadow = true;
    this.driverHeadPivot.add(helmetStripe);

    const visorHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.012), this.materials.stripe);
    visorHighlight.name = "KartDriverVisorHighlight";
    visorHighlight.position.set(-0.03, 0.085, 0.221);
    visorHighlight.castShadow = false;
    visorHighlight.receiveShadow = false;
    this.driverHeadPivot.add(visorHighlight);

    this.driverArms = [-1, 1].map((side) => this.addDriverArm(side));
  }

  addDriverArm(side) {
    const sideName = side < 0 ? "Left" : "Right";
    const shoulder = new THREE.Vector3(side * 0.2, 0.29, 0.18);
    const elbow = new THREE.Vector3(side * 0.32, 0.15, 0.48);
    const hand = new THREE.Vector3(side * 0.2, 0.045, 0.76);
    const shoulderPivot = new THREE.Group();
    shoulderPivot.name = `KartDriver${sideName}ShoulderPivot`;
    shoulderPivot.position.copy(shoulder);

    const upperEnd = elbow.clone().sub(shoulder);
    const forearmEnd = hand.clone().sub(elbow);
    const upperArm = this.createLimbSegment(`KartDriver${sideName}UpperArm`, upperEnd, 0.044, this.materials.suit);
    const elbowPivot = new THREE.Group();
    elbowPivot.name = `KartDriver${sideName}ElbowPivot`;
    elbowPivot.position.copy(upperEnd);
    const forearm = this.createLimbSegment(`KartDriver${sideName}Forearm`, forearmEnd, 0.038, this.materials.suit);
    const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), this.materials.skin);
    handMesh.name = `KartDriver${sideName}Hand`;
    handMesh.position.copy(forearmEnd);
    handMesh.castShadow = true;
    handMesh.receiveShadow = true;

    elbowPivot.add(forearm, handMesh);
    shoulderPivot.add(upperArm, elbowPivot);
    this.driverRoot.add(shoulderPivot);

    return {
      side,
      shoulderPivot,
      elbowPivot,
      hand: handMesh
    };
  }

  createLimbSegment(name, endPoint, radius, material) {
    const length = endPoint.length();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 6, 12), material);
    const direction = endPoint.clone().normalize();
    mesh.name = name;
    mesh.position.copy(endPoint).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  addSteeringWheel() {
    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.name = "KartSteeringWheel";
    this.steeringWheelPivot.position.set(0, 1.03, 0.31);
    this.steeringWheelPivot.rotation.x = Math.PI / 2.55;

    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.022, 12, 32),
      this.materials.frame
    );
    wheel.name = "KartSteeringWheelRim";
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    this.steeringWheelPivot.add(wheel);

    const columnBase = new THREE.Vector3(0, 0.72, 0.05);
    const columnTop = this.steeringWheelPivot.position.clone().add(new THREE.Vector3(0, -0.03, -0.03));
    const columnVector = columnTop.clone().sub(columnBase);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, columnVector.length(), 16), this.materials.axle);
    column.name = "KartSteeringColumn";
    column.position.copy(columnBase).addScaledVector(columnVector, 0.5);
    column.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), columnVector.clone().normalize());
    column.castShadow = true;
    column.receiveShadow = true;

    this.chassisGroup.add(column, this.steeringWheelPivot);
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

      const beam = createHeadlightBeam({
        name: side < 0 ? "KartHeadlightGlowLeft" : "KartHeadlightGlowRight",
        color: 0xffe8a3,
        width: 0.52,
        length: 2.8,
        opacity: 0.2
      });
      beam.position.set(side * 0.42, 0.43, 2.85);
      beam.rotation.z = side * 0.05;
      this.headlightMeshes.push(beam);

      const target = new THREE.Object3D();
      target.name = side < 0 ? "KartHeadlightTargetLeft" : "KartHeadlightTargetRight";
      target.position.set(side * 0.42, 0.38, 7.5);
      light.target = target;

      this.headlights.push(light);
      this.chassisGroup.add(lens, beam, light, target);
    });
  }

  update(deltaTime, state = {}) {
    const distance = state.distanceThisFrame ?? 0;
    const steering = state.steering ?? 0;
    const speedRatio = state.speedRatio ?? 0;
    const speed = state.speed ?? 0;

    this.updateWheelRotation(distance);
    this.updateSteeringVisuals(steering);
    this.updateSuspension(steering, speedRatio);
    this.updateDriverAnimation(deltaTime, steering, speedRatio, speed);
    this.updateBodyMotion(deltaTime, steering, speedRatio, speed);
  }

  updateWheelRotation(distanceTravelled) {
    this.wheelRotation += distanceTravelled / this.wheelRadius;

    this.wheelRollGroups.forEach((rollGroup) => {
      rollGroup.rotation.x = this.wheelRotation;
    });
  }

  updateSteeringVisuals(steeringValue) {
    const wheelAngle = steeringValue * Math.PI * 0.22;

    this.frontSteeringPivots.forEach((pivot) => {
      pivot.rotation.y = wheelAngle;
    });

    if (this.steeringWheelPivot) {
      this.steeringWheelPivot.rotation.z = steeringValue * Math.PI * 0.55;
    }
  }

  updateSuspension(steeringValue, speedRatio) {
    this.wheelPivots.forEach(({ pivot, baseY, side, phase }) => {
      const roadHop = Math.abs(Math.sin(this.wheelRotation * 2.4 + phase)) * speedRatio * 0.018;
      const lateralLoad = -side * steeringValue * speedRatio * 0.018;
      pivot.position.y = baseY + roadHop + lateralLoad;
    });
  }

  updateDriverAnimation(deltaTime, steeringValue, speedRatio, speed) {
    this.driverAnimationTime += deltaTime;
    const absSteering = Math.abs(steeringValue);
    const steeringAngle = steeringValue * Math.PI * 0.55;
    const effort = absSteering * (0.55 + speedRatio * 0.45);
    const vibration = Math.sin(this.driverAnimationTime * 18 + this.wheelRotation) * speedRatio * 0.018;

    if (this.driverHeadPivot) {
      this.driverHeadPivot.rotation.z = -steeringValue * speedRatio * 0.16;
      this.driverHeadPivot.rotation.y = steeringValue * (0.06 + speedRatio * 0.08);
      this.driverHeadPivot.rotation.x = -0.04 * speedRatio + vibration * 0.35;
    }

    this.driverArms?.forEach(({ side, shoulderPivot, elbowPivot, hand }) => {
      const handLift = Math.sin(steeringAngle + side * Math.PI * 0.5) * 0.035;
      shoulderPivot.rotation.x = -0.12 - speedRatio * 0.04 + handLift;
      shoulderPivot.rotation.y = side * (0.08 + effort * 0.1);
      shoulderPivot.rotation.z = side * 0.08 - steeringValue * 0.22;
      elbowPivot.rotation.x = 0.1 + speedRatio * 0.03 - handLift * 0.8;
      elbowPivot.rotation.z = -side * (0.04 + effort * 0.08);
      hand.rotation.x = steeringAngle * 0.55;
      hand.rotation.z = -side * 0.16 + steeringValue * 0.28;
    });

    if (this.driverRoot) {
      this.driverRoot.rotation.z = -steeringValue * speedRatio * 0.05;
      this.driverRoot.rotation.x = Math.min(Math.abs(speed), 18) * -0.0015;
    }
  }

  updateBodyMotion(deltaTime, steeringValue, speedRatio, speed) {
    const bounce = Math.sin(this.wheelRotation * 2.1) * speedRatio * 0.018;

    this.chassisGroup.position.y = bounce;
    this.chassisGroup.rotation.z = -steeringValue * speedRatio * 0.1;
    this.chassisGroup.rotation.x = Math.abs(steeringValue) * speedRatio * 0.035;

    if (Math.abs(speed) < 0.1 && deltaTime > 0) {
      this.chassisGroup.position.y *= 0.9;
    }
  }
}
