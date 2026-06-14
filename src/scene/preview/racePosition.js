import { findClosestProgress } from "../../tracks/centerline.js";

export function updatePlayerRacePosition(raceManager, playerState, aiState, trackInfo) {
  const centerline = Array.isArray(trackInfo.centerline) ? trackInfo.centerline : [];
  const raceState = raceManager.getState();

  if (!centerline.length || !aiState || raceState.mode !== "race") {
    raceManager.setPlayerPosition(1, aiState ? 2 : 1);
    return;
  }

  const playerProgress = findClosestProgress(centerline, playerState.position.x, playerState.position.z);
  const playerScore = getRaceProgressScore(raceState.currentLap, playerProgress, raceState.totalLaps);
  const aiProgress = !aiState.hasCrossedStartLine && aiState.progress > 0.5
    ? aiState.progress - 1
    : aiState.progress;
  const aiScore = getRaceProgressScore(aiState.lap, aiProgress, raceState.totalLaps);
  const playerPosition = playerScore >= aiScore ? 1 : 2;

  raceManager.setPlayerPosition(playerPosition, 2);
}

function getRaceProgressScore(lap, progress, totalLaps) {
  return Math.min(totalLaps, Math.max(1, lap) - 1 + Math.max(0, Math.min(1, progress)));
}
