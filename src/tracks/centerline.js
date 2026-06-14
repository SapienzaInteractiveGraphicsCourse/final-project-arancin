import * as THREE from "three";

const DEFAULT_SAMPLE_COUNT = 160;

export function createTrackCurve(definition) {
  return new THREE.CatmullRomCurve3(
    definition.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    definition.curveType ?? "catmullrom",
    definition.tension ?? 0.42
  );
}

export function createSplineCenterline(curve, count = DEFAULT_SAMPLE_COUNT) {
  const centerline = [];

  for (let index = 0; index < count; index += 1) {
    const progress = index / count;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();

    centerline.push({
      x: point.x,
      z: point.z,
      heading: Math.atan2(tangent.x, tangent.z),
      progress
    });
  }

  return centerline;
}

export function getMinimapBounds(points, padding = 8) {
  if (!points.length) {
    return {
      minX: -padding,
      maxX: padding,
      minZ: -padding,
      maxZ: padding
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });

  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding
  };
}

export function samplePathAtProgress(points, progress) {
  if (!points.length) {
    return { x: 0, z: 0, heading: 0, progress: 0 };
  }

  const wrapped = wrapProgress(progress);
  const scaled = wrapped * points.length;
  const index = Math.floor(scaled) % points.length;
  const nextIndex = (index + 1) % points.length;
  const alpha = scaled - Math.floor(scaled);
  const current = points[index];
  const next = points[nextIndex];
  const heading = lerpAngle(current.heading, next.heading, alpha);

  return {
    x: THREE.MathUtils.lerp(current.x, next.x, alpha),
    z: THREE.MathUtils.lerp(current.z, next.z, alpha),
    heading,
    progress: wrapped
  };
}

function getPathLength(points) {
  let length = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next.x - current.x, next.z - current.z);
  }

  return length;
}

export function findClosestProgress(points, x, z) {
  if (!points.length) {
    return 0;
  }

  let closestProgress = 0;
  let closestDistance = Infinity;

  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - x, point.z - z);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestProgress = index / points.length;
    }
  });

  return closestProgress;
}

export function offsetProgress(points, progress, deltaMeters) {
  const length = Math.max(getPathLength(points), 1);
  return wrapProgress(progress + deltaMeters / length);
}

export function headingFromLookahead(points, progress, lookAheadMeters = 1.8) {
  const current = samplePathAtProgress(points, progress);
  const ahead = samplePathAtProgress(points, offsetProgress(points, progress, lookAheadMeters));
  const dx = ahead.x - current.x;
  const dz = ahead.z - current.z;

  if (dx * dx + dz * dz < 0.000001) {
    return current.heading;
  }

  return Math.atan2(dx, dz);
}

function lerpAngle(current, target, alpha) {
  let delta = target - current;

  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return current + delta * alpha;
}

function wrapProgress(progress) {
  return ((progress % 1) + 1) % 1;
}
