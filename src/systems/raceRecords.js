export function getRaceRecordKey({ trackId, vehicleId, mode }) {
  return `${trackId}:${vehicleId}:${mode}`;
}

export function readBestLapTime(storage, key) {
  if (!storage || !key) {
    return null;
  }

  const value = Number(storage.getItem(key));

  return Number.isFinite(value) && value > 0 ? value : null;
}

export function writeBestLapTime(storage, key, lapTime) {
  if (!storage || !key || !Number.isFinite(lapTime) || lapTime <= 0) {
    return;
  }

  storage.setItem(key, String(lapTime));
}
