import * as THREE from "three";
import { createHeadlightBeam } from "./headlightEffects.js";
import { PlaceholderVehicle } from "./PlaceholderVehicle.js";

const WHEEL_NODE_NAMES = {
  frontLeft: "WHEEL_LF",
  frontRight: "WHEEL_RF",
  rearLeft: "WHEEL_LR",
  rearRight: "WHEEL_RR"
};

export class PorscheVehicle extends PlaceholderVehicle {
  constructor() {
    super({
      id: "porsche",
      name: "PorscheVehicle",
      bodyColor: 0xf8fafc,
      metalness: 0.24
    });

    this.importedModel = null;
    this.placeholderObjects = [...this.group.children];
    this.modelPivot = new THREE.Group();
    this.modelPivot.name = "PorscheModelPivot";
    this.group.add(this.modelPivot);
    this.wheelRadius = 0.32;
    this.wheelRotation = 0;
    this.wheelRollGroups = [];
    this.frontSteeringPivots = [];
    this.porscheHeadlights = [];
    this.porscheHeadlightBeams = [];
    this.frontLightMaterials = [];
    this.rearLightMaterials = [];
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
      const { createPorscheModelInstance } = await import("./loaders/loadPorscheModel.js");
      const model = await createPorscheModelInstance();

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
      console.error("Porsche model failed to load:", error);
      return null;
    }
  }

  setupImportedModel(model) {
    this.fitModelToVehicle(model);
    this.applyImportedMaterials(model);
    this.collectWheelNodes(model);
    this.createHeadlightEffects();
    this.setHeadlights(this.headlightsEnabled);
  }

  fitModelToVehicle(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetLength = 4.2;
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

      materials.forEach((material) => {
        if (material.name === "EXT_Carpaint_Inst") {
          this.registerBodyMaterial(material);
          material.color.copy(this.bodyColor);
          material.roughness = 0.36;
          material.metalness = 0.74;
        }

        if (material.name === "EXT_Emissive_Light_Front") {
          material.emissive?.setHex(0xffd66b);
          material.emissiveIntensity = this.headlightsEnabled ? 1.4 : 0;
          this.frontLightMaterials.push(material);
        }

        if (material.name === "EXT_Emissive_Light_Rear") {
          material.emissive?.setHex(0xff2200);
          material.emissiveIntensity = this.headlightsEnabled ? 0.9 : 0;
          this.rearLightMaterials.push(material);
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

  createHeadlightEffects() {
    const lightPositions = [
      [-0.55, 0.46, 1.98],
      [0.55, 0.46, 1.98]
    ];

    lightPositions.forEach(([x, y, z], index) => {
      const light = new THREE.SpotLight(0xffdfad, 0, 13, Math.PI * 0.2, 0.48, 1.1);
      light.name = `PorscheHeadlight:${index}`;
      light.position.set(x, y, z + 0.1);
      light.target.position.set(x, 0.04, z + 6.2);
      this.modelPivot.add(light, light.target);
      this.porscheHeadlights.push(light);
      this.headlights.push(light);

      const beam = createHeadlightBeam({
        name: `PorscheHeadlightBeam:${index}`,
        width: 1.0,
        length: 5.0,
        opacity: 0.42
      });
      beam.position.set(x * 0.62, 0.035, z + 2.7);
      this.modelPivot.add(beam);
      this.porscheHeadlightBeams.push(beam);
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
    this.modelPivot.rotation.z = -steering * speedRatio * 0.08;
    this.modelPivot.rotation.x = Math.abs(steering) * speedRatio * 0.02;
  }

  updateWheelRotation(distanceTravelled) {
    this.wheelRotation += distanceTravelled / this.wheelRadius;

    this.wheelRollGroups.forEach((wheelNode) => {
      const baseRotation = wheelNode.userData.baseRotation;
      wheelNode.rotation.x = baseRotation.x + this.wheelRotation;
    });
  }

  updateSteeringVisuals(steeringValue) {
    const angle = steeringValue * Math.PI * 0.18;

    this.frontSteeringPivots.forEach((pivot) => {
      const baseRotation = pivot.userData.baseRotation;
      pivot.rotation.y = baseRotation.y + angle;
    });
  }

  setHeadlights(enabled) {
    super.setHeadlights(enabled);

    this.porscheHeadlights.forEach((light) => {
      light.intensity = this.headlightsEnabled ? 4.6 : 0;
      light.visible = this.headlightsEnabled;
    });

    this.porscheHeadlightBeams.forEach((beam) => {
      beam.visible = this.headlightsEnabled;
      beam.material.opacity = this.headlightsEnabled ? 0.42 : 0;
    });

    this.frontLightMaterials.forEach((material) => {
      material.emissiveIntensity = this.headlightsEnabled ? 2.6 : 0;
    });

    this.rearLightMaterials.forEach((material) => {
      material.emissiveIntensity = this.headlightsEnabled ? 0.9 : 0;
    });
  }
}
