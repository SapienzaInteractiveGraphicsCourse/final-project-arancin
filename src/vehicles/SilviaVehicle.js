import * as THREE from "three";
import { createHeadlightBeam } from "./headlightEffects.js";
import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

const WHEEL_NODE_NAMES = {
  frontLeft: "wheels_rb3DWheel_Front_L",
  frontRight: "wheels_rb3DWheel_Front_R",
  rearLeft: "wheels_rb3DWheel_Rear_L",
  rearRight: "wheels_rb3DWheel_Rear_R"
};

export class SilviaVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "silvia",
      name: "SilviaVehicle",
      bodyColor: 0x2f74d6,
      metalness: 0.2
    });

    this.importedModel = null;
    this.placeholderObjects = [...this.group.children];
    this.modelPivot = new THREE.Group();
    this.modelPivot.name = "SilviaModelPivot";
    this.group.add(this.modelPivot);
    this.wheelRadius = 0.34;
    this.wheelRotation = 0;
    this.wheelRollGroups = [];
    this.frontSteeringPivots = [];
    this.silviaHeadlights = [];
    this.silviaHeadlightBeams = [];
    this.loadPromise = null;

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (!this.disposed && !this.importedModel) {
          this.loadPromise = this.loadImportedModel();
        }
      }, 0);
    }
  }

  async loadImportedModel() {
    try {
      const { createSilviaModelInstance } = await import("./loaders/loadSilviaModel.js");
      const model = await createSilviaModelInstance();

      if (this.disposed) {
        return null;
      }

      this.setupImportedModel(model);
      this.importedModel = model;
      this.modelPivot.add(model);
      this.placeholderObjects.forEach((object) => {
        object.visible = false;
      });
      return model;
    } catch (error) {
      console.error("Silvia model failed to load:", error);
      return null;
    }
  }

  setupImportedModel(model) {
    this.fitModelToVehicle(model);
    this.applyImportedMaterials(model);
    this.collectWheelNodes(model);
    this.createHeadlights();
    this.setHeadlights(this.headlightsEnabled);
  }

  fitModelToVehicle(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetLength = 4.05;
    const scale = targetLength / Math.max(size.x, size.z);

    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    model.updateMatrixWorld(true);
  }

  applyImportedMaterials(model) {
    model.traverse((child) => {
      if (!child.isMesh || !child.material) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const meshName = child.name.toLowerCase();

      materials.forEach((material) => {
        const materialName = material.name.toLowerCase();

        if (meshName.includes("carpaint_max") || meshName.includes("carpaintnormal")) {
          this.registerBodyMaterial(material);
          material.map = null;
          material.color.copy(this.bodyColor);
          material.roughness = 0.38;
          material.metalness = 0.68;
          material.needsUpdate = true;
        }

        if (materialName.includes("glass")) {
          material.transparent = true;
          material.opacity = Math.min(material.opacity ?? 0.7, 0.62);
          material.roughness = 0.08;
          material.metalness = 0.02;
        }
      });
    });
  }

  collectWheelNodes(model) {
    const wheelConfigs = [
      { name: WHEEL_NODE_NAMES.frontLeft, steerable: true },
      { name: WHEEL_NODE_NAMES.frontRight, steerable: true },
      { name: WHEEL_NODE_NAMES.rearLeft, steerable: false },
      { name: WHEEL_NODE_NAMES.rearRight, steerable: false }
    ];

    this.wheelRollGroups = [];
    this.frontSteeringPivots = [];
    model.updateMatrixWorld(true);

    wheelConfigs.forEach(({ name, steerable }) => {
      const wheelNode = model.getObjectByName(name);
      const parent = wheelNode?.parent;

      if (!wheelNode || !parent) {
        return;
      }

      const wheelWorldMatrix = wheelNode.matrixWorld.clone();
      const wheelCenterWorld = new THREE.Box3()
        .setFromObject(wheelNode)
        .getCenter(new THREE.Vector3());
      const wheelCenterLocal = parent.worldToLocal(wheelCenterWorld.clone());

      const steeringPivot = new THREE.Group();
      steeringPivot.name = steerable ? `${name}SteeringPivot` : `${name}Mount`;
      steeringPivot.position.copy(wheelCenterLocal);

      const rollGroup = new THREE.Group();
      rollGroup.name = `${name}RollPivot`;
      steeringPivot.add(rollGroup);

      parent.remove(wheelNode);
      parent.add(steeringPivot);
      parent.updateMatrixWorld(true);
      steeringPivot.updateMatrixWorld(true);
      rollGroup.updateMatrixWorld(true);

      rollGroup.add(wheelNode);
      wheelNode.matrix.copy(new THREE.Matrix4()
        .copy(rollGroup.matrixWorld)
        .invert()
        .multiply(wheelWorldMatrix));
      wheelNode.matrix.decompose(wheelNode.position, wheelNode.quaternion, wheelNode.scale);

      rollGroup.userData.baseRotation = rollGroup.rotation.clone();
      steeringPivot.userData.baseRotation = steeringPivot.rotation.clone();
      this.wheelRollGroups.push(rollGroup);

      if (steerable) {
        this.frontSteeringPivots.push(steeringPivot);
      }
    });
  }

  createHeadlights() {
    const lightPositions = [
      [-0.48, 0.42, 1.95],
      [0.48, 0.42, 1.95]
    ];

    lightPositions.forEach(([x, y, z], index) => {
      const light = new THREE.SpotLight(0xffe3a0, 0, 12, Math.PI * 0.2, 0.46, 1.1);
      light.name = `SilviaHeadlight:${index}`;
      light.position.set(x, y, z + 0.1);
      light.target.position.set(x, 0.04, z + 5.7);
      this.modelPivot.add(light, light.target);
      this.silviaHeadlights.push(light);
      this.headlights.push(light);

      const beam = createHeadlightBeam({
        name: `SilviaHeadlightBeam:${index}`,
        width: 0.9,
        length: 4.6,
        opacity: 0.44
      });
      beam.position.set(x * 0.62, 0.035, z + 2.45);
      this.modelPivot.add(beam);
      this.silviaHeadlightBeams.push(beam);
    });
  }

  update(deltaTime, state = {}) {
    if (!this.importedModel) {
      super.update(deltaTime, state);
      return;
    }

    const distance = state.distanceThisFrame ?? 0;
    const steering = state.steering ?? 0;
    const speedRatio = state.speedRatio ?? 0;

    this.updateWheelRotation(distance);
    this.updateSteeringVisuals(steering);
    this.modelPivot.rotation.z = -steering * speedRatio * 0.07;
    this.modelPivot.rotation.x = Math.abs(steering) * speedRatio * 0.018;
  }

  updateWheelRotation(distanceTravelled) {
    this.wheelRotation += distanceTravelled / this.wheelRadius;

    this.wheelRollGroups.forEach((wheelNode) => {
      const baseRotation = wheelNode.userData.baseRotation;
      wheelNode.rotation.x = baseRotation.x + this.wheelRotation;
    });
  }

  updateSteeringVisuals(steeringValue) {
    const angle = steeringValue * Math.PI * 0.17;

    this.frontSteeringPivots.forEach((pivot) => {
      const baseRotation = pivot.userData.baseRotation;
      pivot.rotation.y = baseRotation.y + angle;
    });
  }

  setHeadlights(enabled) {
    super.setHeadlights(enabled);

    this.silviaHeadlights.forEach((light) => {
      light.intensity = this.headlightsEnabled ? 4.2 : 0;
      light.visible = this.headlightsEnabled;
    });

    this.silviaHeadlightBeams.forEach((beam) => {
      beam.visible = this.headlightsEnabled;
      beam.material.opacity = this.headlightsEnabled ? 0.44 : 0;
    });
  }
}
