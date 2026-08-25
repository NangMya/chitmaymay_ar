const GAME = {
  lives: 3,
  rounds: 3,
  roundSeconds: 30,
  // Round 1 needs ~20×5pt catches if only small gifts; denser spawns make this fair.
  passScore: [100, 150, 200],
  countdownMs: 3000,
  betweenRoundsMs: 1400,
  coachSkipMs: 8000,
  faceLockHoldMs: 900,
  // Soft hint only — do not freeze the round timer or gift spawns.
  faceLostPauseMs: 1200,
  spawnXRange: 0.42,
  spawnY: 0.9,
  spawnZ: -1.35,
  missY: -0.95,
  minSpawnXGap: 0.18,
  // Collision is not a live-ops knob. Do not add catch.* to campaign.json.
  catch: { x: 0.2, y: 0.18 },
  bagOffset: { x: 0, y: -1.15, z: 0.12 },
  bagScale: { x: 1.6, y: 2.1, z: 1 },
  distance: {
    min: 0,
    max: 8,
    enterPad: 0,
    exitPad: 0.2,
  },
  wave: {
    windowMs: 900,
    armMs: 400,
    motionMin: 6,
    changeMin: 0.04,
    hotFrames: 3,
    faceLean: 0.12,
  },
  mouthAnchor: 13,
  bagFollowMs: 28,
  collectMs: 420,
  fallPxPerSec: 440,
  // Round 1: 25 @ 1.0s | Round 2: 30 @ 1.0s | Round 3: 38 @ 0.75s
  spawnEveryMs: [1000, 1000, 750],
  spawnJitterMs: 0,
  spawnMax: [25, 30, 38],
  minSpawnXGapPct: 14,
  maxActiveGifts: 7,
  items: {
    // Round 1: mix of 5pt + some 10pt so 100 is reachable without perfect play.
    vs1: { points: 5, maxDrops: 80, speed: 1.0, rounds: [1, 2, 3] },
    vs2: { points: 5, maxDrops: 80, speed: 1.05, rounds: [1, 2, 3] },
    vs3: { points: 10, maxDrops: 40, speed: 1.15, rounds: [1, 2, 3] },
    vs4: { points: 15, maxDrops: 24, speed: 1.25, rounds: [2, 3] },
    vs5: { points: 20, maxDrops: 12, speed: 1.35, rounds: [3] },
  },
};
