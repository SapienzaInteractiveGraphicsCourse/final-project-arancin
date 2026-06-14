import * as THREE from "three";
import { getRightVector } from "../shared.js";
import { createBeachMaterial } from "./common.js";

export function addBeachGround(group) {
  const material = createBeachMaterial({
    color: 0xe4c06c,
    roughness: 0.95
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), material);
  ground.name = "TropicalBeachPropsGround";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);
}

function createBeachSideBandGeometry(curve, trackDef, side, nearOffset, farOffset, y) {
  const vertices = [];
  const indices = [];
  const segments = trackDef.segments || 200;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sampleT = t >= 0.9999 ? 0.0 : t;
    const p = curve.getPointAt(sampleT);
    const tan = curve.getTangentAt(sampleT).setY(0).normalize();
    const normal = getRightVector(tan);

    const nearP = p.clone().addScaledVector(normal, side * nearOffset);
    const farP = p.clone().addScaledVector(normal, side * farOffset);

    vertices.push(
      nearP.x, y, nearP.z,
      farP.x, y, farP.z
    );
  }

  for (let i = 0; i < segments; i++) {
    const current = i * 2;
    const next = (i + 1) * 2;
    if (side < 0) {
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    } else {
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Like createBeachSideBandGeometry but adds a per-vertex 'aShoreT' attribute:
// 0.0 = near shore edge, 1.0 = far ocean edge — used for gradient coloring.
function createBeachGradientBandGeometry(curve, trackDef, side, nearOffset, farOffset, y) {
  const vertices = [];
  const shoreT  = [];   // gradient attribute
  const indices = [];
  const segments = trackDef.segments || 200;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sampleT = t >= 0.9999 ? 0.0 : t;
    const p = curve.getPointAt(sampleT);
    const tan = curve.getTangentAt(sampleT).setY(0).normalize();
    const normal = getRightVector(tan);

    const nearP = p.clone().addScaledVector(normal, side * nearOffset);
    const farP  = p.clone().addScaledVector(normal, side * farOffset);

    vertices.push(nearP.x, y, nearP.z);  // near vertex
    shoreT.push(0.0);
    vertices.push(farP.x,  y, farP.z);   // far vertex
    shoreT.push(1.0);
  }

  for (let i = 0; i < segments; i++) {
    const current = i * 2;
    const next = (i + 1) * 2;
    if (side < 0) {
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    } else {
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("aShoreT",  new THREE.Float32BufferAttribute(shoreT, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBeachBand(group, curve, trackDef, side, nearOffset, farOffset, material, name, y) {
  const geometry = createBeachSideBandGeometry(curve, trackDef, side, nearOffset, farOffset, y);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function addBeachOceanPlane(group, curve, trackDef) {
  const roadHalfWidth = trackDef.roadWidth / 2;

  // Shore Sand (widened)
  const sandMaterial = createBeachMaterial({ color: 0xe0c66f, roughness: 0.95 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 0.65, roadHalfWidth + 14.0, sandMaterial, "TropicalBeachOceanShore", -0.012);

  // Surf/Foam
  const surfMaterial = createBeachMaterial({ color: 0xf0f5e8, roughness: 0.50 });
  addBeachBand(group, curve, trackDef, 1, roadHalfWidth + 14.0, roadHalfWidth + 18.0, surfMaterial, "TropicalBeachOceanSurf", -0.010);

  // Gradient ocean: turquoise (riva) → mid blue → deep blue (largo)
  // Uses a static ShaderMaterial with per-vertex aShoreT attribute (0=riva, 1=largo)
  const gradientShader = new THREE.ShaderMaterial({
    uniforms: {
      uColorA: { value: new THREE.Color(0x2ddde8) }, // turchese chiaro
      uColorB: { value: new THREE.Color(0x0772b0) }, // blu intermedio
      uColorC: { value: new THREE.Color(0x003a6e) }, // blu profondo
    },
    vertexShader: /* glsl */`
      attribute float aShoreT;
      varying float vT;
      void main() {
        vT = aShoreT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      varying float vT;
      void main() {
        // Two-stop blend: A -> B at t=0..0.45, B -> C at t=0.4..1.0
        vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.45, vT));
        col = mix(col, uColorC, smoothstep(0.4, 1.0, vT));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const oceanGeo = createBeachGradientBandGeometry(
    curve, trackDef, 1,
    roadHalfWidth + 18.0, roadHalfWidth + 1155,
    -0.014
  );
  const oceanMesh = new THREE.Mesh(oceanGeo, gradientShader);
  oceanMesh.name = "TropicalBeachGradientOcean";
  oceanMesh.receiveShadow = false;
  group.add(oceanMesh);
}
