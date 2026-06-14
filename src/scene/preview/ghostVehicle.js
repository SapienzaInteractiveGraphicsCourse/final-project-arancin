import * as THREE from "three";
import { RACE_MODES, RACE_PHASES } from "../../systems/RaceManager.js";
import { sampleGhostLap } from "../../systems/ghostLapRecords.js";

export function createGhostVehicleController(ghostVehicle) {
  const ghostPosition = new THREE.Vector3();

  return {
    applyMaterial() {
      if (ghostVehicle) {
        applyGhostVehicleMaterial(ghostVehicle);
      }
    },
    hide() {
      if (ghostVehicle) {
        ghostVehicle.group.visible = false;
      }
    },
    update(deltaTime, raceState, savedGhostLap) {
      if (
        !ghostVehicle ||
        !savedGhostLap ||
        raceState.mode !== RACE_MODES.TIME_TRIAL ||
        raceState.phase !== RACE_PHASES.RUNNING ||
        ghostVehicle.isLoading?.()
      ) {
        this.hide();
        return;
      }

      const ghostSample = sampleGhostLap(savedGhostLap, raceState.lapTime);
      if (!ghostSample) {
        this.hide();
        return;
      }

      ghostPosition.set(ghostSample.x, ghostSample.y, ghostSample.z);
      ghostVehicle.group.visible = true;
      ghostVehicle.setTransform(ghostPosition, ghostSample.heading);
      ghostVehicle.update(deltaTime, {
        position: ghostPosition,
        heading: ghostSample.heading,
        speed: ghostSample.speed ?? 0,
        steering: 0,
        throttle: 0,
        braking: false
      });
    }
  };
}

function applyGhostVehicleMaterial(vehicle) {
  vehicle.setHeadlights?.(false);
  vehicle.group.traverse((child) => {
    if (child.isLight) {
      child.visible = false;
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material)
      ? child.material.map(cloneGhostMaterial)
      : cloneGhostMaterial(child.material);
    child.material = materials;
  });
}

function cloneGhostMaterial(material) {
  const ghostMaterial = material.clone();

  ghostMaterial.transparent = true;
  ghostMaterial.opacity = Math.min(ghostMaterial.opacity ?? 1, 0.34);
  ghostMaterial.depthWrite = false;

  if (ghostMaterial.color) {
    ghostMaterial.color.lerp(new THREE.Color(0x7dd3fc), 0.68);
  }

  if (ghostMaterial.emissive) {
    ghostMaterial.emissive.setHex(0x164e63);
    ghostMaterial.emissiveIntensity = Math.max(ghostMaterial.emissiveIntensity ?? 0, 0.24);
  }

  return ghostMaterial;
}
