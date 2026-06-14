const DEFAULT_CHECKPOINT_RADIUS = 3;

export function getOrderedCheckpoints(trackInfo = {}) {
  const checkpoints = Array.isArray(trackInfo.checkpoints) ? trackInfo.checkpoints : [];

  return checkpoints
    .filter(isValidCheckpoint)
    .map(normalizeCheckpoint)
    .slice()
    .sort((first, second) => first.order - second.order);
}

export function isInsideCheckpoint(position, checkpoint) {
  if (!position || !isValidCheckpoint(checkpoint)) {
    return false;
  }

  const radius = getCheckpointRadius(checkpoint);
  const deltaX = position.x - checkpoint.position.x;
  const deltaZ = position.z - checkpoint.position.z;

  return deltaX * deltaX + deltaZ * deltaZ <= radius * radius;
}

function isValidCheckpoint(checkpoint) {
  return (
    checkpoint &&
    checkpoint.position &&
    Number.isFinite(checkpoint.position.x) &&
    Number.isFinite(checkpoint.position.z) &&
    Number.isFinite(getCheckpointOrder(checkpoint)) &&
    getCheckpointRadius(checkpoint) > 0
  );
}

function normalizeCheckpoint(checkpoint) {
  return {
    ...checkpoint,
    order: getCheckpointOrder(checkpoint),
    radius: getCheckpointRadius(checkpoint),
    isStartFinish: checkpoint.isStartFinish ?? checkpoint.id === 0
  };
}

function getCheckpointOrder(checkpoint) {
  return checkpoint.order ?? checkpoint.id;
}

function getCheckpointRadius(checkpoint) {
  if (Number.isFinite(checkpoint.radius)) {
    return checkpoint.radius;
  }

  if (checkpoint.size && Number.isFinite(checkpoint.size.x) && Number.isFinite(checkpoint.size.z)) {
    return Math.max(DEFAULT_CHECKPOINT_RADIUS, Math.max(checkpoint.size.x, checkpoint.size.z) * 0.5);
  }

  if (checkpoint.size && Number.isFinite(checkpoint.size.x)) {
    return Math.max(DEFAULT_CHECKPOINT_RADIUS, checkpoint.size.x * 0.5);
  }

  return DEFAULT_CHECKPOINT_RADIUS;
}
