import {
  clampPropPosition,
  getHeading,
  getRightVector,
  getSafeRoadsidePosition
} from "../shared.js";

function normalizeProgress(progress) {
  const wrapped = ((progress % 1) + 1) % 1;
  return wrapped >= 0.9999 ? 0 : wrapped;
}

export function getTrackFrame(curve, progress) {
  const normalizedProgress = normalizeProgress(progress);
  const point = curve.getPointAt(normalizedProgress);
  const tangent = curve.getTangentAt(normalizedProgress).setY(0).normalize();
  const right = getRightVector(tangent);

  return {
    point,
    tangent,
    right,
    heading: getHeading(tangent),
    progress: normalizedProgress
  };
}

export function getRoadsidePlacement(
  curve,
  progress,
  side,
  offset,
  roadHalfWidth,
  {
    minClearance = 12,
    clamp = true,
    clampSamples = 200,
    targetClearance = minClearance,
    strategy = "direct"
  } = {}
) {
  const frame = getTrackFrame(curve, progress);
  const signedSide = side >= 0 ? 1 : -1;
  const absoluteOffset = Math.max(Math.abs(offset), roadHalfWidth + minClearance);
  const position = strategy === "search"
    ? getSafeRoadsidePosition(curve, frame.progress, signedSide, absoluteOffset, roadHalfWidth, minClearance)
    : frame.point.clone().addScaledVector(frame.right, signedSide * absoluteOffset);

  if (clamp && strategy !== "search") {
    clampPropPosition(curve, position, roadHalfWidth, clampSamples, minClearance, targetClearance);
  }

  return {
    position,
    rotationY: frame.heading + (signedSide > 0 ? -Math.PI / 2 : Math.PI / 2),
    frame
  };
}

export function collectTrackSamples(curve, start, end, spacingMeters) {
  const samples = [];
  const totalLength = curve.getLength();
  const step = Math.max(0.002, spacingMeters / totalLength);

  for (let progress = start; progress <= end; progress += step) {
    const frame = getTrackFrame(curve, progress);
    samples.push({
      center: frame.point,
      tangent: frame.tangent,
      right: frame.right,
      heading: frame.heading,
      progress: frame.progress
    });
  }

  return samples;
}
