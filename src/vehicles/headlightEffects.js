import * as THREE from "three";

export function createHeadlightBeam({
  name,
  color = 0xffd891,
  width = 0.8,
  length = 4.6,
  opacity = 0.42
}) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: createBeamTexture(color)
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  beam.name = name;
  beam.rotation.x = -Math.PI / 2;
  beam.visible = false;
  return beam;
}

function createBeamTexture(color) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const beamColor = new THREE.Color(color);

  for (let y = 0; y < canvas.height; y += 1) {
    const v = y / (canvas.height - 1);
    const lengthFade = Math.pow(1 - v, 1.7) * smoothstep(0, 0.14, v);
    const halfWidth = 0.14 + v * 0.34;

    for (let x = 0; x < canvas.width; x += 1) {
      const u = Math.abs((x / (canvas.width - 1)) - 0.5);
      const lateralFade = Math.exp(-Math.pow(u / halfWidth, 2.4));
      const alpha = Math.min(255, Math.round(255 * lengthFade * lateralFade));
      const index = (y * canvas.width + x) * 4;

      image.data[index] = beamColor.r * 255;
      image.data[index + 1] = beamColor.g * 255;
      image.data[index + 2] = beamColor.b * 255;
      image.data[index + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}
