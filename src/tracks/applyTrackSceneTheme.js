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

function createGradientSky(gradient, theme = {}) {
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

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float height = dir.y * 0.5 + 0.5;
        vec3 sunsetBand = mix(horizonColor, midColor, smoothstep(0.18, 0.52, height));
        vec3 skyColor = mix(sunsetBand, zenithColor, smoothstep(0.48, 1.0, height));

        // Add starfield in the upper zenith sky (for dark/night themes)
        if (dir.y > 0.05) {
          float n = hash(floor(dir * 180.0));
          if (n > 0.988) {
            float twinkle = sin(n * 100.0) * 0.4 + 0.6;
            skyColor += vec3(twinkle * smoothstep(0.05, 0.35, dir.y));
          }
        }

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = "TrackGradientSky";
  sky.renderOrder = -1000;

  // Add low-poly glowing moon inside the sky sphere
  if (theme.moonPosition) {
    const moonGeo = new THREE.SphereGeometry(7.5, 8, 8);
    const moonColor = theme.moonColor !== undefined ? theme.moonColor : 0xffffff;
    const moonMat = new THREE.MeshBasicMaterial({
      color: moonColor,
      fog: false
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    const dir = new THREE.Vector3(...theme.moonPosition).normalize();
    // Offset moon far away near the sky shell boundary
    moon.position.copy(dir).multiplyScalar(240);
    sky.add(moon);
  }

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
    const sky = createGradientSky(theme.skyGradient, theme);
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
  lights.sun.shadow.mapSize.set(theme.shadowMapSize ?? 1024, theme.shadowMapSize ?? 1024);
  lights.sun.shadow.camera.updateProjectionMatrix();
}
