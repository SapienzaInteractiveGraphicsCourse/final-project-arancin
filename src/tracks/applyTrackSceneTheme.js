import * as THREE from "three";

function removePreviousSky(scene) {
  const previousSky = scene.userData.trackSky;

  if (!previousSky) {
    return;
  }

  scene.remove(previousSky);
  previousSky.geometry.dispose();
  previousSky.material.dispose();
  scene.userData.trackSky = null;
}

function createGradientSky(gradient) {
  const geometry = new THREE.SphereGeometry(260, 24, 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      horizonColor: { value: new THREE.Color(gradient.horizon) },
      midColor: { value: new THREE.Color(gradient.mid) },
      zenithColor: { value: new THREE.Color(gradient.zenith) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 horizonColor;
      uniform vec3 midColor;
      uniform vec3 zenithColor;

      void main() {
        float height = normalize(vWorldPosition).y * 0.5 + 0.5;
        vec3 sunsetBand = mix(horizonColor, midColor, smoothstep(0.18, 0.52, height));
        vec3 skyColor = mix(sunsetBand, zenithColor, smoothstep(0.48, 1.0, height));
        gl_FragColor = vec4(skyColor, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = "TrackGradientSky";
  sky.renderOrder = -1000;

  return sky;
}

export function applyTrackSceneTheme(scene, trackInfo) {
  const theme = trackInfo.scene;

  if (!theme) {
    return;
  }

  removePreviousSky(scene);
  scene.background = new THREE.Color(theme.background);

  if (theme.fogType === "exp2") {
    scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
  } else {
    scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
  }

  if (theme.skyGradient) {
    const sky = createGradientSky(theme.skyGradient);
    scene.userData.trackSky = sky;
    scene.add(sky);
  }
}

export function applyTrackLightingTheme(lights, trackInfo) {
  const theme = trackInfo.scene;

  if (!theme) {
    return;
  }

  if (theme.ambientColor !== undefined) {
    lights.ambient.color.setHex(theme.ambientColor);
  }
  if (theme.ambientIntensity !== undefined) {
    lights.ambient.intensity = theme.ambientIntensity;
  }

  if (theme.moonColor !== undefined) {
    lights.sun.color.setHex(theme.moonColor);
  }
  if (theme.moonIntensity !== undefined) {
    lights.sun.intensity = theme.moonIntensity;
  }
  if (theme.moonPosition) {
    lights.sun.position.set(...theme.moonPosition);
  }

  if (theme.shadowBounds !== undefined) {
    const bounds = theme.shadowBounds;
    lights.sun.shadow.camera.left = -bounds;
    lights.sun.shadow.camera.right = bounds;
    lights.sun.shadow.camera.top = bounds;
    lights.sun.shadow.camera.bottom = -bounds;
  }
  if (theme.shadowFar !== undefined) {
    lights.sun.shadow.camera.far = theme.shadowFar;
  }

  lights.sun.castShadow = true;
  lights.sun.shadow.mapSize.set(2048, 2048);
  lights.sun.shadow.camera.updateProjectionMatrix();
}
