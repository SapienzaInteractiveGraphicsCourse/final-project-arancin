export function getRaceRecordKey({ trackId, vehicleId, mode }) {
  return `${trackId}:${vehicleId}:${mode}`;
}

export function getRaceLapRecordsKey(recordKey) {
  return `${recordKey}:laps`;
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

export function readLapRecords(storage, key) {
  if (!storage || !key) {
    return [];
  }

  try {
    const value = JSON.parse(storage.getItem(key) ?? "[]");

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(isValidLapRecord)
      .sort((first, second) => first.time - second.time);
  } catch {
    return [];
  }
}

export function appendLapRecord(storage, key, lapRecord) {
  if (!storage || !key || !isValidLapRecord(lapRecord)) {
    return readLapRecords(storage, key);
  }

  const records = readLapRecords(storage, key);
  writeLapRecords(storage, key, [
    ...records,
    normalizeLapRecord(lapRecord)
  ]);

  return readLapRecords(storage, key);
}

export function ensureBestLapInRecords(storage, key, bestLapTime) {
  if (!storage || !key || !Number.isFinite(bestLapTime) || bestLapTime <= 0) {
    return readLapRecords(storage, key);
  }

  const records = readLapRecords(storage, key);
  const hasBestLap = records.some((record) => Math.abs(record.time - bestLapTime) < 0.005);

  if (hasBestLap) {
    return records;
  }

  writeLapRecords(storage, key, [
    ...records,
    {
      lap: 1,
      time: bestLapTime,
      completedAt: 0,
      migrated: true
    }
  ]);

  return readLapRecords(storage, key);
}

function writeLapRecords(storage, key, records) {
  const normalizedRecords = records
    .filter(isValidLapRecord)
    .map(normalizeLapRecord)
    .sort((first, second) => first.time - second.time);

  storage.setItem(key, JSON.stringify(normalizedRecords));
}

function normalizeLapRecord(record) {
  return {
    lap: record.lap,
    time: record.time,
    completedAt: record.completedAt ?? Date.now(),
    migrated: Boolean(record.migrated)
  };
}

function isValidLapRecord(record) {
  return (
    record &&
    Number.isFinite(record.lap) &&
    Number.isFinite(record.time) &&
    record.time > 0
  );
}
