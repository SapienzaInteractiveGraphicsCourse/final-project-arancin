import * as THREE from "three";

const ENABLE_VEGAS_DECORATIVE_POINT_LIGHTS = false;

export function addDecorativePointLight(parent, color, intensity, distance, decay, position) {
  if (!ENABLE_VEGAS_DECORATIVE_POINT_LIGHTS) {
    return null;
  }

  const light = new THREE.PointLight(color, intensity, distance, decay);
  light.position.copy(position);
  parent.add(light);
  return light;
}


