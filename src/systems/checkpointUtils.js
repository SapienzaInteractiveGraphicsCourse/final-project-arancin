const DEFAULT_CHECKPOINT_RADIUS = 3;

export function getOrderedCheckpoints(trackInfo = {}) {
  const checkpoints = Array.isArray(trackInfo.checkpoints) ? trackInfo.checkpoints : [];

  return checkpoints
    .filter(isValidCheckpoint)
    .slice()
    .sort((first, second) => first.order - second.order);
}

export function isInsideCheckpoint(position, checkpoint) {
  if (!position || !isValidCheckpoint(checkpoint)) {
    return false;
  }

  const radius = checkpoint.radius ?? DEFAULT_CHECKPOINT_RADIUS;
  const deltaX = position.x - checkpoint.position.x;
  const deltaZ = position.z - checkpoint.position.z;

  return deltaX * deltaX + deltaZ * deltaZ <= radius * radius;
}

export function isValidCheckpoint(checkpoint) {
  return (
    checkpoint &&
    checkpoint.position &&
    Number.isFinite(checkpoint.position.x) &&
    Number.isFinite(checkpoint.position.z) &&
    Number.isFinite(checkpoint.order) &&
    (checkpoint.radius === undefined || checkpoint.radius > 0)
  );
}
