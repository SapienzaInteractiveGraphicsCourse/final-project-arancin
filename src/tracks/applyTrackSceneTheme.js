import * as THREE from "three";

export function applyTrackSceneTheme(scene, trackInfo) {
  const theme = trackInfo.scene;

  if (!theme) {
    return;
  }

  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
}
