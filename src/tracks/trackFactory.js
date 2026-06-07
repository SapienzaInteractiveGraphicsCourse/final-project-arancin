import * as THREE from "three";

const TRACK_COLORS = {
  vegas: {
    ground: 0x141827,
    road: 0x252a37,
    accent: 0x38bdf8
  },
  beach: {
    ground: 0xc8a86a,
    road: 0x5f6670,
    accent: 0x2dd4bf
  },
  monaco: {
    ground: 0x60717a,
    road: 0x2d3338,
    accent: 0xf43f5e
  }
};

export function createTrackById(trackId) {
  const colors = TRACK_COLORS[trackId] ?? TRACK_COLORS.vegas;
  const group = new THREE.Group();
  group.name = `TrackPlaceholder:${trackId}`;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(84, 84),
    new THREE.MeshStandardMaterial({
      color: colors.ground,
      roughness: 0.9,
      metalness: 0.02
    })
  );
  ground.name = "PlaceholderGround";
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const road = new THREE.Mesh(
    new THREE.RingGeometry(14, 18, 96),
    new THREE.MeshStandardMaterial({
      color: colors.road,
      roughness: 0.78,
      metalness: 0.04
    })
  );
  road.name = "PlaceholderRoad";
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.025;
  road.receiveShadow = true;
  group.add(road);

  const startLine = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.05, 0.5),
    new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: colors.accent,
      emissiveIntensity: 0.55
    })
  );
  startLine.name = "PlaceholderStartLine";
  startLine.position.set(0, 0.06, -16);
  startLine.receiveShadow = true;
  group.add(startLine);

  const spawn = {
    position: new THREE.Vector3(0, 0.42, -16),
    heading: 0
  };

  group.userData.trackInfo = {
    id: trackId,
    name: group.name,
    spawn,
    centerline: [],
    checkpoints: [],
    barrierColliders: [],
    minimapBounds: {
      minX: -22,
      maxX: 22,
      minZ: -22,
      maxZ: 22
    }
  };

  return {
    group,
    spawn,
    trackInfo: group.userData.trackInfo,
    dispose() {
      group.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
    }
  };
}
