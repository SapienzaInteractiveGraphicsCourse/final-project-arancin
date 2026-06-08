import * as THREE from "three";
import { getVehiclePerformance } from "../config/vehiclePerformance.js";

export class BaseVehicle {
  constructor({
    id = "kart",
    name = "BaseVehicle",
    performance = getVehiclePerformance(id),
    bodyColor = 0xffffff
  } = {}) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.name = name;
    this.performance = { ...performance };
    this.bodyColor = new THREE.Color(bodyColor);
    this.bodyMaterials = new Set();
    this.headlights = [];
    this.headlightMeshes = [];
    this.headlightsEnabled = false;
    this.disposed = false;
  }

  setTransform(position, heading = 0) {
    this.group.position.copy(position);
    this.group.rotation.y = heading;
  }

  update() {}

  setBodyColor(color) {
    this.bodyColor.set(color);
    this.bodyMaterials.forEach((material) => {
      material.color.copy(this.bodyColor);
    });
  }

  setHeadlights(enabled) {
    this.headlightsEnabled = Boolean(enabled);

    this.headlights.forEach((light) => {
      light.visible = this.headlightsEnabled;
    });

    this.headlightMeshes.forEach((mesh) => {
      if (mesh.material?.emissiveIntensity !== undefined) {
        mesh.material.emissiveIntensity = this.headlightsEnabled ? 1.6 : 0;
      }
    });
  }

  toggleHeadlights() {
    this.setHeadlights(!this.headlightsEnabled);
    return this.headlightsEnabled;
  }

  registerBodyMaterial(material) {
    if (material) {
      this.bodyMaterials.add(material);
    }

    return material;
  }

  dispose() {
    this.disposed = true;
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();

    this.group.traverse((child) => {
      if (child.geometry && !disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (material && !disposedMaterials.has(material)) {
          material.dispose();
          disposedMaterials.add(material);
        }
      });
    });

    this.bodyMaterials.clear();
    this.headlights.length = 0;
    this.headlightMeshes.length = 0;
  }
}
