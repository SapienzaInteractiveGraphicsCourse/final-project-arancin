import * as THREE from "three";

const BOOST_PAD_UNIFORMS_KEY = "boostPadShaderUniforms";

export function createBoostPadShaderMaterial({
  baseColor = 0xffd23a,
  accentColor = 0xffffff,
  opacity = 0.72,
  phase = 0
} = {}) {
  const material = new THREE.ShaderMaterial({
    name: "BoostPadPulseShader",
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uPhase: { value: phase },
        uBaseColor: { value: new THREE.Color(baseColor) },
        uAccentColor: { value: new THREE.Color(accentColor) },
        uOpacity: { value: opacity }
      }
    ]),
    vertexShader: /* glsl */`
      varying vec2 vUv;

      #include <fog_pars_vertex>

      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uPhase;
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      uniform float uOpacity;

      varying vec2 vUv;

      #include <fog_pars_fragment>

      void main() {
        vec2 centeredUv = vUv - vec2(0.5);
        float radius = length(centeredUv) * 2.0;
        float angle = atan(centeredUv.y, centeredUv.x);
        float pulseTime = uTime * 2.25 + uPhase;

        float outwardWave = fract(radius * 1.75 - pulseTime * 0.42);
        float ring = smoothstep(0.10, 0.0, abs(outwardWave - 0.5));
        float corePulse = 0.55 + 0.45 * sin(pulseTime * 2.35);
        float radialFade = smoothstep(1.0, 0.18, radius);
        float spokeMask = smoothstep(0.62, 1.0, sin(angle * 6.0 + pulseTime * 1.6) * 0.5 + 0.5);

        vec3 color = mix(uBaseColor, uAccentColor, ring * 0.68 + spokeMask * 0.22);
        float alpha = uOpacity * radialFade * (0.34 + ring * 0.48 + corePulse * 0.28);

        gl_FragColor = vec4(color, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true
  });

  material.userData.isBoostPadShader = true;
  return material;
}

export function registerBoostPadShaderMaterial(trackGroup, material) {
  if (!trackGroup.userData[BOOST_PAD_UNIFORMS_KEY]) {
    trackGroup.userData[BOOST_PAD_UNIFORMS_KEY] = [];
  }

  trackGroup.userData[BOOST_PAD_UNIFORMS_KEY].push(material.uniforms.uTime);
}

export function updateBoostPadShaderTime(trackGroup, elapsedTime) {
  const uniforms = trackGroup?.userData?.[BOOST_PAD_UNIFORMS_KEY];

  if (!Array.isArray(uniforms)) {
    return;
  }

  for (let index = 0; index < uniforms.length; index += 1) {
    uniforms[index].value = elapsedTime;
  }
}
