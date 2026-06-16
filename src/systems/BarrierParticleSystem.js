import * as THREE from "three";

const MAX_PARTICLES = 180;
const BASE_PARTICLE_SIZE = 0.11;
const SPAWN_COOLDOWN_SECONDS = 0.055;
const GRAVITY = 9.8;
const UP = new THREE.Vector3(0, 1, 0);

const PROFILE_COLORS = {
  neon: [
    new THREE.Color(0x32f6ff),
    new THREE.Color(0xffd23a),
    new THREE.Color(0xff2bd6)
  ],
  sand: [
    new THREE.Color(0xf3d38a),
    new THREE.Color(0xd6a54f),
    new THREE.Color(0xffffff)
  ],
  urban: [
    new THREE.Color(0xfff1b8),
    new THREE.Color(0xffd23a),
    new THREE.Color(0xd9dde2)
  ]
};

export class BarrierParticleSystem {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "BarrierParticleSystem";
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.baseColors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = Array.from({ length: MAX_PARTICLES }, () => new THREE.Vector3());
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.nextParticleIndex = 0;
    this.spawnCooldownTimer = 0;

    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: BASE_PARTICLE_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "BarrierImpactParticles";
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.clear();
  }

  reset() {
    this.clear();
  }

  update(deltaTime = 0) {
    const safeDelta = Math.max(0, deltaTime);
    this.spawnCooldownTimer = Math.max(0, this.spawnCooldownTimer - safeDelta);

    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      if (this.life[index] <= 0) {
        continue;
      }

      this.life[index] = Math.max(0, this.life[index] - safeDelta);
      const offset = index * 3;
      const velocity = this.velocities[index];
      velocity.y -= GRAVITY * safeDelta * 0.75;
      this.positions[offset] += velocity.x * safeDelta;
      this.positions[offset + 1] += velocity.y * safeDelta;
      this.positions[offset + 2] += velocity.z * safeDelta;

      const alpha = this.maxLife[index] > 0 ? this.life[index] / this.maxLife[index] : 0;
      const fade = alpha * alpha;
      this.colors[offset] = this.baseColors[offset] * fade;
      this.colors[offset + 1] = this.baseColors[offset + 1] * fade;
      this.colors[offset + 2] = this.baseColors[offset + 2] * fade;

      if (this.life[index] === 0) {
        this.positions[offset + 1] = -1000;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  spawnBarrierImpact(vehicleState, impact, trackInfo = {}) {
    if (this.spawnCooldownTimer > 0 || impact?.type !== "barrier" || !vehicleState?.position) {
      return;
    }

    const normal = getNormal(impact);
    if (!normal) {
      return;
    }

    const speed = Math.abs(vehicleState.speed ?? 0);
    const count = Math.round(THREE.MathUtils.clamp(8 + speed * 0.7 + (impact.strength ?? 0) * 18, 10, 26));
    const origin = vehicleState.position.clone().addScaledVector(normal, -0.55);
    origin.y = Math.max(origin.y, 0.38);
    const palette = PROFILE_COLORS[trackInfo.particleProfile] ?? PROFILE_COLORS.urban;
    const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
    const outwardSpeed = THREE.MathUtils.clamp(speed * 0.22, 1.8, 6.5);

    for (let index = 0; index < count; index += 1) {
      const spread = randomSigned();
      const lift = 0.65 + Math.random() * 2.0;
      const particleVelocity = normal.clone()
        .multiplyScalar(outwardSpeed * (0.55 + Math.random() * 0.8))
        .addScaledVector(tangent, spread * (1.2 + Math.random() * 2.6))
        .addScaledVector(UP, lift);

      this.spawnParticle({
        position: origin,
        velocity: particleVelocity,
        color: palette[index % palette.length],
        life: 0.22 + Math.random() * 0.34
      });
    }

    this.spawnCooldownTimer = SPAWN_COOLDOWN_SECONDS;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }

  clear() {
    this.life.fill(0);
    this.maxLife.fill(0);
    this.positions.fill(0);
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      this.positions[index * 3 + 1] = -1000;
      this.velocities[index].set(0, 0, 0);
    }
    this.colors.fill(0);
    this.baseColors.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  spawnParticle({ position, velocity, color, life }) {
    const index = this.nextParticleIndex;
    const offset = index * 3;

    this.positions[offset] = position.x + randomSigned() * 0.22;
    this.positions[offset + 1] = position.y + Math.random() * 0.22;
    this.positions[offset + 2] = position.z + randomSigned() * 0.22;
    this.velocities[index].copy(velocity);
    this.life[index] = life;
    this.maxLife[index] = life;

    const brightness = 0.72 + Math.random() * 0.45;
    this.baseColors[offset] = color.r * brightness;
    this.baseColors[offset + 1] = color.g * brightness;
    this.baseColors[offset + 2] = color.b * brightness;
    this.colors[offset] = this.baseColors[offset];
    this.colors[offset + 1] = this.baseColors[offset + 1];
    this.colors[offset + 2] = this.baseColors[offset + 2];

    this.nextParticleIndex = (this.nextParticleIndex + 1) % MAX_PARTICLES;
  }
}

function getNormal(impact) {
  const normalX = Number(impact?.normal?.x);
  const normalZ = Number(impact?.normal?.z);

  if (!Number.isFinite(normalX) || !Number.isFinite(normalZ)) {
    return null;
  }

  const normal = new THREE.Vector3(normalX, 0, normalZ);
  return normal.lengthSq() > 0.000001 ? normal.normalize() : null;
}

function randomSigned() {
  return Math.random() * 2 - 1;
}
