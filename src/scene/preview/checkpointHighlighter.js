import * as THREE from "three";
import { getOrderedCheckpoints } from "../../systems/checkpointUtils.js";
import { RACE_PHASES } from "../../systems/RaceManager.js";

export function createCheckpointHighlighter(trackInfo) {
  const checkpoints = getOrderedCheckpoints(trackInfo);
  const inactiveMaterial = createCheckpointHighlightMaterial(0x34f4ff, 0.22, 0.28);
  const activeMaterial = createCheckpointHighlightMaterial(0xfacc15, 1.8, 0.88);
  let activeCheckpointOrder = null;

  checkpoints.forEach((checkpoint) => {
    setCheckpointGateMaterial(checkpoint, inactiveMaterial);
  });

  return {
    update(raceState) {
      if (raceState.finished || raceState.phase !== RACE_PHASES.RUNNING) {
        setActiveCheckpoint(null);
        return;
      }

      setActiveCheckpoint(raceState.currentCheckpoint);
    },
    dispose() {
      inactiveMaterial.dispose();
      activeMaterial.dispose();
    }
  };

  function setActiveCheckpoint(checkpointOrder) {
    if (activeCheckpointOrder === checkpointOrder) {
      return;
    }

    activeCheckpointOrder = checkpointOrder;

    checkpoints.forEach((checkpoint) => {
      setCheckpointGateMaterial(
        checkpoint,
        checkpoint.order === checkpointOrder ? activeMaterial : inactiveMaterial
      );
    });
  }
}

function createCheckpointHighlightMaterial(color, emissiveIntensity, opacity) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.42,
    transparent: true,
    opacity
  });
}

function setCheckpointGateMaterial(checkpoint, material) {
  checkpoint.gate?.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
    }
  });
}
