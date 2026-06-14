const AUDIO_SETTINGS_KEY = "kart-racing-audio-settings";

const DEFAULT_AUDIO_SETTINGS = {
  muted: false,
  gameVolume: 1,
  ambienceVolume: 1
};

export function readAudioSettings(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY) ?? "{}");

    return {
      muted: Boolean(parsed.muted),
      gameVolume: normalizeVolume(parsed.gameVolume, DEFAULT_AUDIO_SETTINGS.gameVolume),
      ambienceVolume: normalizeVolume(parsed.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume)
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function writeAudioSettings(storage, settings) {
  storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
    muted: Boolean(settings.muted),
    gameVolume: normalizeVolume(settings.gameVolume, DEFAULT_AUDIO_SETTINGS.gameVolume),
    ambienceVolume: normalizeVolume(settings.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume)
  }));
}

function normalizeVolume(value, fallback) {
  const normalized = Number(value);

  return Number.isFinite(normalized) ? Math.min(1, Math.max(0, normalized)) : fallback;
}
