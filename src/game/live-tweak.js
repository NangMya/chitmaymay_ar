const PASS_MIN = 50;
const PASS_MAX = 400;
const ROUND_MIN = 15;
const ROUND_MAX = 60;
const SPAWN_MIN = 400;
const SPAWN_MAX = 3000;

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(Math.min(max, Math.max(min, n)));
}

/**
 * Mid-campaign knobs only. Collision (GAME.catch), lives, and round count
 * stay in the shipped bundle — do not add them here.
 */
function applyLiveTweak(campaign) {
  const tweak = (campaign && campaign.tweak) || {};
  const applied = {};

  if (Array.isArray(tweak.passScore) && tweak.passScore.length === 3) {
    const scores = tweak.passScore.map((value) => clampInt(value, PASS_MIN, PASS_MAX));
    if (scores.every((value) => value != null)) {
      GAME.passScore = scores;
      applied.passScore = scores;
    }
  }

  const roundSeconds = clampInt(tweak.roundSeconds, ROUND_MIN, ROUND_MAX);
  if (roundSeconds != null) {
    GAME.roundSeconds = roundSeconds;
    applied.roundSeconds = roundSeconds;
  }

  if (Array.isArray(tweak.spawnEveryMs) && tweak.spawnEveryMs.length === 3) {
    const spawn = tweak.spawnEveryMs.map((ms) => clampInt(ms, SPAWN_MIN, SPAWN_MAX));
    if (spawn.every((ms) => ms != null)) {
      GAME.spawnEveryMs = spawn;
      applied.spawnEveryMs = spawn;
    }
  }

  return applied;
}
