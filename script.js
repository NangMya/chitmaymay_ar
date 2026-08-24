const DEBUG = /debug=1/.test(window.location.search);
let bagWorld;
let giftWorld;
let faceWorld;
let cameraWorld;

function ensureVectors() {
  if (bagWorld || typeof THREE === "undefined") {
    return;
  }
  bagWorld = new THREE.Vector3();
  giftWorld = new THREE.Vector3();
  faceWorld = new THREE.Vector3();
  cameraWorld = new THREE.Vector3();
}

const els = {
  arScene: document.getElementById("ar-scene"),
  scene: document.querySelector("a-scene"),
  faceTarget: document.getElementById("faceTarget"),
  mouthTarget: document.getElementById("mouthTarget"),
  bracket: document.getElementById("bracket"),
  falling: document.getElementById("falling-images"),
  splash: document.getElementById("splash"),
  denied: document.getElementById("camera-denied"),
  coach: document.getElementById("face-coach"),
  hud: document.getElementById("hud"),
  play: document.getElementById("cta-play"),
  playHint: document.getElementById("play-hint"),
  retry: document.getElementById("cta-retry"),
  start: document.getElementById("cta-start"),
  cameraRetry: document.getElementById("camera-retry"),
  cameraPreview: document.getElementById("camera-preview"),
  cameraFeed: document.getElementById("camera-feed"),
  screenBag: document.getElementById("screen-bag"),
  fallingLayer: document.getElementById("falling-layer"),
  coachSkip: document.getElementById("coach-skip"),
  mute: document.getElementById("mute-btn"),
  distanceHint: document.getElementById("distance-hint"),
  faceLost: document.getElementById("face-lost"),
  loading: document.getElementById("ar-loading"),
  loadingLabel: document.getElementById("ar-loading-label"),
  loadingBar: document.getElementById("ar-loading-bar"),
  loadingDetail: document.getElementById("ar-loading-detail"),
  ended: document.getElementById("campaign-ended"),
  leadForm: document.getElementById("lead-form"),
  leadStatus: document.getElementById("lead-status"),
  endCard: document.getElementById("end-card"),
  endTitle: document.getElementById("end-title"),
  endScore: document.getElementById("end-score"),
  endRounds: document.getElementById("end-rounds"),
  endPreview: document.getElementById("end-preview"),
  endShare: document.getElementById("end-share"),
  endRetry: document.getElementById("end-retry"),
  inapp: document.getElementById("inapp-gate"),
  inappCopy: document.getElementById("inapp-copy"),
  status: document.getElementById("modalAlert"),
  statusTitle: document.getElementById("status-title"),
  statusDetail: document.getElementById("status-detail"),
  roundNumber: document.getElementById("round-number"),
  timer: document.getElementById("hud-timer"),
  score: document.getElementById("hud-score"),
  lives: [
    document.getElementById("live1"),
    document.getElementById("live2"),
    document.getElementById("live3"),
  ],
  debug: document.getElementById("debug-hud"),
  audio: {
    main: document.getElementById("main"),
    fail: document.getElementById("fail"),
    score: document.getElementById("increase_score"),
    gameOver: document.getElementById("game_over"),
    passed: document.getElementById("game_passed"),
    song: document.getElementById("game_song"),
  },
};

const state = {
  muted: false,
  cameraStarted: false,
  cameraStarting: false,
  faceLocked: false,
  waveSamples: [],
  waveArmedAt: 0,
  waveSeenAt: 0,
  waveFaceX: null,
  waveFaceLean: 0,
  waveRaf: 0,
  waveNoise: 0,
  waveNoiseSamples: [],
  phase: "splash",
  lives: GAME.lives,
  round: 1,
  currentPoints: 0,
  totalPoints: 0,
  roundLeftMs: GAME.roundSeconds * 1000,
  countdownLeftMs: 0,
  spawnAccMs: 0,
  nextSpawnMs: 0,
  roundSpawns: 0,
  lastSpawnX: 0,
  gifts: [],
  drops: createDropTable(),
  hidden: false,
  faceLockMs: 0,
  coachMs: 0,
  faceLostMs: 0,
  pausedByFace: false,
  bagX: 0,
  bagY: 0,
  bagRaf: 0,
  bagLastMs: 0,
  bagDragUntil: 0,
  roundResults: [],
  mindarLoading: false,
  vendorsReady: false,
  campaign: { ended: false, leadFormUrl: "" },
  vendorStartedAt: 0,
};

function createDropTable() {
  const drops = {};
  Object.keys(GAME.items).forEach((id) => {
    drops[id] = 0;
  });
  return drops;
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  document.body.classList.toggle(
    "is-playing",
    phase === "playing" || phase === "countdown" || phase === "between"
  );
}

function show(el, on) {
  if (!el) {
    return;
  }
  el.hidden = !on;
}

function allAudio() {
  return Object.values(els.audio).filter(Boolean);
}

function playSound(node) {
  if (state.muted || !node) {
    return;
  }
  node.currentTime = 0;
  const play = node.play();
  if (play && play.catch) {
    play.catch(() => {});
  }
}

function unlockAudio() {
  allAudio().forEach((node) => {
    node.volume = state.muted ? 0 : 1;
  });
  const probe = els.audio.main;
  if (!probe) {
    return;
  }
  const p = probe.play();
  if (p && p.then) {
    p.then(() => probe.pause()).catch(() => {});
  }
}

function applyMute() {
  allAudio().forEach((node) => {
    node.muted = state.muted;
    node.volume = state.muted ? 0 : 1;
  });
  if (els.mute) {
    els.mute.textContent = state.muted ? t("soundOff") : t("soundOn");
    els.mute.setAttribute("aria-pressed", state.muted ? "true" : "false");
  }
}

function warmAudio() {
  allAudio().forEach((node) => {
    node.preload = "auto";
    try {
      node.load();
    } catch (err) {
      /* ignore */
    }
  });
}

function setLoadingProgress(info) {
  if (els.loadingLabel && info.label) {
    els.loadingLabel.textContent = info.label;
  }
  if (els.loadingDetail) {
    els.loadingDetail.textContent = info.detail || "";
  }
  if (els.loadingBar && info.total) {
    const pct = Math.max(4, Math.min(100, Math.round((info.loaded / info.total) * 100)));
    els.loadingBar.style.width = `${pct}%`;
  }
}

function mindarSystem() {
  return els.scene && els.scene.systems ? els.scene.systems["mindar-face-system"] : null;
}

function coverSize(sourceW, sourceH, boxW, boxH) {
  const sourceRatio = sourceW / sourceH;
  const boxRatio = boxW / boxH;
  if (sourceRatio > boxRatio) {
    const height = boxH;
    const width = height * sourceRatio;
    return { width, height, top: 0, left: -(width - boxW) / 2 };
  }
  const width = boxW;
  const height = width / sourceRatio;
  return { width, height, top: -(height - boxH) / 2, left: 0 };
}

function sizeArContainer() {
  if (!els.arScene) {
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  els.arScene.hidden = false;
  els.arScene.style.display = "block";
  els.arScene.style.position = "fixed";
  els.arScene.style.top = "0px";
  els.arScene.style.left = "0px";
  els.arScene.style.width = w + "px";
  els.arScene.style.height = h + "px";
  els.arScene.classList.add("is-live");
}

function applyWindowCover() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const system = mindarSystem();
  const videos = [];
  if (system && system.video) {
    videos.push(system.video);
  }
  document.querySelectorAll("video").forEach((video) => {
    if (video.id === "camera-feed") {
      return;
    }
    if (videos.indexOf(video) === -1) {
      videos.push(video);
    }
  });
  videos.forEach((video) => {
    if (video.id === "camera-feed" || (els.cameraPreview && els.cameraPreview.contains(video))) {
      return;
    }
    const srcW = video.videoWidth || w;
    const srcH = video.videoHeight || h;
    const box = coverSize(srcW, srcH, w, h);
    video.style.position = "absolute";
    video.style.top = box.top + "px";
    video.style.left = box.left + "px";
    video.style.width = box.width + "px";
    video.style.height = box.height + "px";
    video.style.zIndex = "0";
    video.style.objectFit = "cover";
  });
  if (els.scene) {
    els.scene.style.position = "fixed";
    els.scene.style.top = "0px";
    els.scene.style.left = "0px";
    els.scene.style.width = w + "px";
    els.scene.style.height = h + "px";
    if (typeof els.scene.resize === "function") {
      els.scene.resize();
    }
  }
}

function fitCameraToWindow() {
  sizeArContainer();
  markVideosInline();
  const system = mindarSystem();
  if (system && typeof system._resize === "function" && system.video && system.video.videoWidth) {
    system._resize();
  }
  applyWindowCover();
}

/**
 * MindAR must keep decoding the camera on mobile. Opacity:0 / off-DOM mirrors
 * often freeze frames on iOS/Android. Put the tracker <video> inside the PiP
 * frame, and patch _resize so it updates tracking math without blowing the
 * video up to full-screen (which broke "fit inside camera frame").
 */
function mindarVideoEl() {
  const system = mindarSystem();
  return system && system.video ? system.video : null;
}

function fitVideoInPreview(video) {
  if (!video) {
    return;
  }
  video.muted = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.playsInline = true;
  // MindAR sets width/height attributes to the raw camera resolution.
  // Force CSS box fit so the feed stays clipped inside the PiP frame.
  video.style.setProperty("position", "absolute", "important");
  video.style.setProperty("inset", "0px", "important");
  video.style.setProperty("top", "0px", "important");
  video.style.setProperty("left", "0px", "important");
  video.style.setProperty("right", "0px", "important");
  video.style.setProperty("bottom", "0px", "important");
  video.style.setProperty("width", "100%", "important");
  video.style.setProperty("height", "100%", "important");
  video.style.setProperty("max-width", "none", "important");
  video.style.setProperty("max-height", "none", "important");
  video.style.setProperty("object-fit", "cover", "important");
  video.style.setProperty("object-position", "center center", "important");
  video.style.setProperty("opacity", "1", "important");
  video.style.setProperty("z-index", "0", "important");
  video.style.setProperty("transform", "scaleX(-1)", "important");
  video.style.setProperty("border-radius", "inherit", "important");
  video.style.setProperty("pointer-events", "none", "important");
  const play = video.play();
  if (play && play.catch) {
    play.catch(() => {});
  }
}

function sizeSceneFullWindow() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (els.scene) {
    els.scene.style.position = "fixed";
    els.scene.style.top = "0px";
    els.scene.style.left = "0px";
    els.scene.style.width = w + "px";
    els.scene.style.height = h + "px";
    if (typeof els.scene.resize === "function") {
      els.scene.resize();
    }
  }
  if (els.arScene) {
    els.arScene.style.width = w + "px";
    els.arScene.style.height = h + "px";
  }
}

function patchMindArResize() {
  const system = mindarSystem();
  if (!system || system.__pipResizePatched || typeof system._resize !== "function") {
    return;
  }
  system._resize = function pipSafeResize() {
    const video = this.video;
    const container = this.container || (els && els.arScene);
    if (!video) {
      return;
    }
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      video.setAttribute("width", String(video.videoWidth));
      video.setAttribute("height", String(video.videoHeight));
      if (this.controller && typeof this.controller.onInputResized === "function") {
        this.controller.onInputResized(video);
      }
      if (this.controller && typeof this.controller.getCameraParams === "function") {
        const params = this.controller.getCameraParams();
        const camHost = (container && container.getElementsByTagName("a-camera")[0]) ||
          (els.scene && els.scene.querySelector("[camera]"));
        const camera = camHost && camHost.getObject3D && camHost.getObject3D("camera");
        if (camera && params) {
          camera.fov = params.fov;
          camera.aspect = params.aspect;
          camera.near = params.near;
          camera.far = params.far;
          camera.updateProjectionMatrix();
        }
        if (camHost) {
          camHost.setAttribute("camera", "active", true);
        }
      }
    }
    sizeSceneFullWindow();
    if (els.cameraPreview && els.cameraPreview.contains(video)) {
      fitVideoInPreview(video);
    } else if (container) {
      const cw = container.clientWidth || window.innerWidth;
      const ch = container.clientHeight || window.innerHeight;
      const box = coverSize(
        video.videoWidth || cw,
        video.videoHeight || ch,
        cw,
        ch
      );
      video.style.position = "absolute";
      video.style.top = box.top + "px";
      video.style.left = box.left + "px";
      video.style.width = box.width + "px";
      video.style.height = box.height + "px";
      video.style.zIndex = "-2";
      if (this.shouldFaceUser && !this.disableFaceMirror) {
        video.style.transform = "scaleX(-1)";
      } else {
        video.style.transform = "scaleX(1)";
      }
    }
  };
  system.__pipResizePatched = true;
}

function pinMindArVideoToPreview() {
  const system = mindarSystem();
  const video = system && system.video;
  if (!els.cameraPreview) {
    return;
  }
  patchMindArResize();
  if (!video) {
    return;
  }
  if (video.parentElement !== els.cameraPreview) {
    els.cameraPreview.appendChild(video);
  }
  if (els.cameraFeed) {
    els.cameraFeed.style.display = "none";
    try {
      els.cameraFeed.pause();
    } catch (_err) {
      /* ignore */
    }
    els.cameraFeed.srcObject = null;
  }
  fitVideoInPreview(video);
  show(els.cameraPreview, true);
  if (typeof system._resize === "function") {
    system._resize();
  }
}

function syncPreviewFromMindAr() {
  pinMindArVideoToPreview();
}

function enablePlayWorld() {
  sizeArContainer();
  markVideosInline();
  patchMindArResize();
  const system = mindarSystem();
  if (system && typeof system._resize === "function" && system.video && system.video.videoWidth) {
    system._resize();
  }
  sizeSceneFullWindow();
  pinMindArVideoToPreview();
}

function revealAr() {
  enablePlayWorld();
  window.requestAnimationFrame(() => {
    enablePlayWorld();
  });
}

function showCameraPreview() {
  pinMindArVideoToPreview();
}

function hideCameraPreview() {
  show(els.cameraPreview, false);
  if (els.cameraFeed) {
    try {
      els.cameraFeed.pause();
    } catch (_err) {
      /* ignore */
    }
    els.cameraFeed.srcObject = null;
  }
}

function bindSceneEvents() {
  if (!els.scene || els.scene.dataset.bound === "1") {
    return;
  }
  els.scene.dataset.bound = "1";
  els.scene.addEventListener("arReady", onArReady);
  els.scene.addEventListener("arError", (ev) => {
    const detail = (ev && ev.detail) || {};
    track("permission_denied", {
      reason: "arError",
      error: detail.error || detail.message || "unknown",
      secure: window.isSecureContext,
      href: window.location.href,
    });
    state.cameraStarted = false;
    state.cameraStarting = false;
    showDenied(t("cameraArFail"));
  });
  els.scene.addEventListener("camera-set-active", () => {
    revealAr();
  });
}

function showBag() {
  if (els.screenBag && els.screenBag.hidden) {
    state.bagX = window.innerWidth * 0.5;
    state.bagY = window.innerHeight * 0.86;
  }
  show(els.screenBag, true);
  startBagTrack();
}

function hideBag() {
  stopBagTrack();
  show(els.screenBag, false);
  if (els.screenBag) {
    els.screenBag.style.left = "50%";
    els.screenBag.style.top = "auto";
    els.screenBag.style.bottom = "5vh";
    els.screenBag.style.transform = "translate3d(-50%, 0, 0)";
  }
}

function startBagTrack() {
  if (state.bagRaf) {
    return;
  }
  state.bagLastMs = performance.now();
  const loop = () => {
    state.bagRaf = window.requestAnimationFrame(loop);
    tickBagSprite();
  };
  state.bagRaf = window.requestAnimationFrame(loop);
}

function stopBagTrack() {
  if (state.bagRaf) {
    window.cancelAnimationFrame(state.bagRaf);
    state.bagRaf = 0;
  }
}

let wavePrev = null;
const WAVE_COLS = 4;
const WAVE_ROWS = 3;
const waveCanvas = document.createElement("canvas");
waveCanvas.width = 128;
waveCanvas.height = 72;
const waveCtx =
  waveCanvas.getContext("2d", { willReadFrequently: true }) ||
  waveCanvas.getContext("2d");

function waveVideo() {
  const systemVideo = mindarVideoEl();
  if (systemVideo && systemVideo.readyState >= 2 && systemVideo.videoWidth >= 16) {
    return systemVideo;
  }
  if (els.cameraFeed && els.cameraFeed.readyState >= 2 && els.cameraFeed.videoWidth >= 16) {
    return els.cameraFeed;
  }
  const inPreview = els.cameraPreview && els.cameraPreview.querySelector("video");
  if (inPreview && inPreview.readyState >= 2 && inPreview.videoWidth >= 16) {
    return inPreview;
  }
  return document.querySelector("video");
}

function sampleHandMotion() {
  const video = waveVideo();
  if (!video || video.readyState < 2 || video.videoWidth < 16 || video.videoHeight < 16 || !waveCtx) {
    return null;
  }
  const w = waveCanvas.width;
  const h = waveCanvas.height;
  try {
    // Prefer the upper 70% of the frame where a hand wave usually appears.
    const srcH = Math.floor(video.videoHeight * 0.7);
    waveCtx.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      Math.max(16, srcH),
      0,
      0,
      w,
      h
    );
    const pixels = waveCtx.getImageData(0, 0, w, h).data;
    if (!wavePrev || wavePrev.length !== w * h) {
      wavePrev = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i += 1) {
        wavePrev[i] = pixels[i * 4] * 0.3 + pixels[i * 4 + 1] * 0.59 + pixels[i * 4 + 2] * 0.11;
      }
      return null;
    }
    const cellSum = new Float32Array(WAVE_COLS * WAVE_ROWS);
    const cellN = new Uint16Array(WAVE_COLS * WAVE_ROWS);
    let changed = 0;
    const count = w * h;
    for (let y = 0; y < h; y += 1) {
      const row = Math.min(WAVE_ROWS - 1, Math.floor((y * WAVE_ROWS) / h));
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        const gray = pixels[i * 4] * 0.3 + pixels[i * 4 + 1] * 0.59 + pixels[i * 4 + 2] * 0.11;
        const delta = Math.abs(gray - wavePrev[i]);
        wavePrev[i] = gray;
        if (delta > 12) {
          changed += 1;
        }
        const col = Math.min(WAVE_COLS - 1, Math.floor((x * WAVE_COLS) / w));
        const cell = row * WAVE_COLS + col;
        cellSum[cell] += delta;
        cellN[cell] += 1;
      }
    }
    let maxCell = 0;
    const means = [];
    for (let c = 0; c < cellSum.length; c += 1) {
      const mean = cellN[c] ? cellSum[c] / cellN[c] : 0;
      means.push(mean);
      if (mean > maxCell) {
        maxCell = mean;
      }
    }
    means.sort((a, b) => a - b);
    const medCell = means[Math.floor(means.length / 2)] || 0;
    return {
      maxCell,
      localized: maxCell > Math.max(6, medCell * 1.25),
      change: changed / count,
    };
  } catch (_err) {
    return null;
  }
}

function sampleFaceLeanMotion() {
  const ndc = faceNdc();
  if (!ndc) {
    return 0;
  }
  if (state.waveFaceX == null) {
    state.waveFaceX = ndc.x;
    return 0;
  }
  const delta = Math.abs(ndc.x - state.waveFaceX);
  state.waveFaceX = ndc.x;
  return delta;
}

function resetWaveWatch() {
  wavePrev = null;
  state.waveSamples = [];
  state.waveNoise = 0;
  state.waveNoiseSamples = [];
  state.waveSeenAt = 0;
  state.waveArmedAt = 0;
  state.waveFaceX = null;
  state.waveFaceLean = 0;
}

function startWaveWatch() {
  if (state.waveRaf) {
    return;
  }
  resetWaveWatch();
  const loop = () => {
    state.waveRaf = window.requestAnimationFrame(loop);
    tickWaveStart();
  };
  state.waveRaf = window.requestAnimationFrame(loop);
}

function stopWaveWatch() {
  if (state.waveRaf) {
    window.cancelAnimationFrame(state.waveRaf);
    state.waveRaf = 0;
  }
  resetWaveWatch();
}

function faceEstimate() {
  const system = mindarSystem();
  const controller = system && system.controller;
  if (!controller || !controller.lastEstimateResult) {
    return null;
  }
  return controller.lastEstimateResult;
}

function landmarkTranslation(index) {
  const estimate = faceEstimate();
  const controller = mindarSystem() && mindarSystem().controller;
  if (!estimate || !controller || typeof controller.getLandmarkMatrix !== "function") {
    return null;
  }
  try {
    const matrix = controller.getLandmarkMatrix(index);
    if (!matrix) {
      return null;
    }
    const x = matrix[3];
    const y = matrix[7];
    const z = matrix[11];
    if (![x, y, z].every(Number.isFinite)) {
      return null;
    }
    return { x, y, z };
  } catch (_err) {
    return null;
  }
}

function faceCameraPoint() {
  return landmarkTranslation(0) || landmarkTranslation(GAME.mouthAnchor);
}

function faceNdc() {
  ensureVectors();
  const camEl = els.scene && els.scene.querySelector("[camera]");
  const camera = camEl && camEl.getObject3D && camEl.getObject3D("camera");

  // Prefer the live face anchor MindAR already updates each frame.
  if (
    camera &&
    faceWorld &&
    cameraWorld &&
    els.faceTarget &&
    els.faceTarget.object3D &&
    els.faceTarget.object3D.visible
  ) {
    els.faceTarget.object3D.updateWorldMatrix(true, false);
    els.faceTarget.object3D.getWorldPosition(faceWorld);
    cameraWorld.copy(faceWorld).project(camera);
    if (Number.isFinite(cameraWorld.x) && Number.isFinite(cameraWorld.y)) {
      return { x: cameraWorld.x, y: cameraWorld.y };
    }
  }

  const point = faceCameraPoint();
  if (!point) {
    return null;
  }
  if (camera && faceWorld && cameraWorld && typeof cameraWorld.project === "function") {
    faceWorld.set(point.x, point.y, point.z);
    cameraWorld.copy(faceWorld).project(camera);
    if (Number.isFinite(cameraWorld.x) && Number.isFinite(cameraWorld.y)) {
      return { x: cameraWorld.x, y: cameraWorld.y };
    }
  }
  const depth = Math.max(0.25, Math.abs(point.z));
  return {
    x: point.x / depth,
    y: point.y / depth,
  };
}

function faceBagTarget() {
  const ndc = faceNdc();
  if (!ndc) {
    return null;
  }
  const bagW = els.screenBag.offsetWidth || 156;
  const bagH = els.screenBag.offsetHeight || 96;
  const minX = bagW * 0.5 + 12;
  const maxX = window.innerWidth - bagW * 0.5 - 12;
  const minY = bagH * 0.5 + 64;
  const maxY = window.innerHeight - bagH * 0.5 - 16;
  // Wider travel so face lean is obvious on phones.
  const u = Math.max(0, Math.min(1, 0.5 + ndc.x * 0.75));
  const v = Math.max(-1, Math.min(1, -ndc.y));
  return {
    x: minX + u * (maxX - minX),
    y: window.innerHeight * 0.84 + v * window.innerHeight * 0.14,
    minY,
    maxY,
  };
}

function applyBagTransform() {
  if (!els.screenBag) {
    return;
  }
  els.screenBag.style.left = "0px";
  els.screenBag.style.top = "0px";
  els.screenBag.style.bottom = "auto";
  els.screenBag.style.transform = `translate3d(${state.bagX}px, ${state.bagY}px, 0) translate(-50%, -50%)`;
}

function tickBagSprite() {
  if (!els.screenBag || els.screenBag.hidden) {
    return;
  }
  const now = performance.now();
  const dt = Math.min(48, now - (state.bagLastMs || now));
  state.bagLastMs = now;
  const dragging = now < state.bagDragUntil;
  const point = faceBagTarget();
  if (!point && !dragging) {
    return;
  }
  if (point && !dragging) {
    const follow = 1 - Math.exp(-dt / GAME.bagFollowMs);
    const targetX = point.x;
    const targetY = Math.max(point.minY, Math.min(point.maxY, point.y));
    state.bagX += (targetX - state.bagX) * follow;
    state.bagY += (targetY - state.bagY) * follow;
  }
  applyBagTransform();
}

function moveBagToPointer(clientX, clientY) {
  if (!els.screenBag || els.screenBag.hidden) {
    return;
  }
  if (state.phase !== "playing" && state.phase !== "countdown") {
    return;
  }
  const bagW = els.screenBag.offsetWidth || 156;
  const bagH = els.screenBag.offsetHeight || 96;
  const minX = bagW * 0.5 + 12;
  const maxX = window.innerWidth - bagW * 0.5 - 12;
  const minY = window.innerHeight * 0.55;
  const maxY = window.innerHeight - bagH * 0.5 - 16;
  state.bagX = Math.max(minX, Math.min(maxX, clientX));
  state.bagY = Math.max(minY, Math.min(maxY, clientY));
  state.bagDragUntil = performance.now() + 500;
  applyBagTransform();
}

function registerGameComponents() {
  if (typeof AFRAME === "undefined" || AFRAME.components["game-runtime"]) {
    return;
  }
  ensureVectors();
  AFRAME.registerComponent("game-runtime", {
    tick: function (_time, delta) {
      tick(delta);
    },
  });
  if (els.scene) {
    els.scene.setAttribute("game-runtime", "");
  }
}

function bindFaceTarget() {
  if (!els.faceTarget || els.faceTarget.dataset.bound === "1") {
    return;
  }
  els.faceTarget.dataset.bound = "1";
  els.faceTarget.addEventListener("targetFound", () => {
    state.faceLocked = true;
  });
  els.faceTarget.addEventListener("targetLost", () => {
    state.faceLocked = false;
  });
  if (els.mouthTarget && els.mouthTarget.dataset.bound !== "1") {
    els.mouthTarget.dataset.bound = "1";
  }
}

function startCameraSystem() {
  if (state.cameraStarted) {
    return true;
  }
  if (state.cameraStarting) {
    return true;
  }
  const system = mindarSystem();
  if (!system || typeof system.start !== "function") {
    return false;
  }
  state.cameraStarting = true;
  if (!armCameraHandoff()) {
    state.cameraStarting = false;
    showDenied(t("cameraArFail"));
    return true;
  }
  patchMindArResize();
  revealAr();
  try {
    system.start();
  } catch (err) {
    console.error(err);
    state.cameraStarting = false;
    restoreGetUserMedia();
    showDenied(t("cameraArFail"));
    return true;
  }
  window.setTimeout(syncPreviewFromMindAr, 80);
  window.setTimeout(syncPreviewFromMindAr, 250);
  window.setTimeout(syncPreviewFromMindAr, 700);
  state.mindarLoading = false;
  return true;
}

let preparePromise = null;

function prepareMindAr() {
  if (state.vendorsReady) {
    return Promise.resolve();
  }
  if (preparePromise) {
    return preparePromise;
  }
  preparePromise = (async () => {
    state.vendorStartedAt = performance.now();
    await loadVendors(setLoadingProgress);
    track("vendor_loaded", {
      ms: Math.round(performance.now() - state.vendorStartedAt),
    });
    registerGameComponents();
    bindFaceTarget();
    if (els.scene && !els.scene.getAttribute("mindar-face")) {
      els.scene.setAttribute("mindar-face", "autoStart: false; faceOccluder: false");
    }
    bindSceneEvents();
    state.vendorsReady = true;
  })().catch((err) => {
    preparePromise = null;
    throw err;
  });
  return preparePromise;
}

async function startMindAr() {
  if (state.cameraStarted) {
    revealAr();
    return;
  }
  await prepareMindAr();
  if (els.scene && !els.scene.hasLoaded) {
    await new Promise((resolve) => {
      const done = () => resolve();
      els.scene.addEventListener("loaded", done, { once: true });
      window.setTimeout(done, 2000);
    });
  }
  for (let i = 0; i < 40; i += 1) {
    if (startCameraSystem()) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  showDenied(t("cameraArFail"));
}

function showDenied(message) {
  state.mindarLoading = false;
  state.cameraStarted = false;
  state.cameraStarting = false;
  releasePrimedCamera();
  setPhase("denied");
  show(els.loading, false);
  show(els.splash, false);
  show(els.coach, false);
  show(els.denied, true);
  show(els.hud, false);
  hideCameraPreview();
  hideBag();
  const copy = els.denied && els.denied.querySelector("p");
  if (copy) {
    copy.textContent = message || t("cameraDenied");
  }
}

function onArReady() {
  state.cameraStarted = true;
  state.cameraStarting = false;
  show(els.loading, false);
  revealAr();
  window.setTimeout(revealAr, 100);
  window.setTimeout(revealAr, 500);
  track("permission_granted");
  track("tracking_ready", {
    ms: state.vendorStartedAt
      ? Math.round(performance.now() - state.vendorStartedAt)
      : undefined,
  });
  if (state.phase === "denied") {
    return;
  }
  if (state.phase === "ready") {
    startWaveWatch();
    return;
  }
  if (
    state.phase === "countdown" ||
    state.phase === "playing" ||
    state.phase === "between" ||
    state.phase === "coach"
  ) {
    return;
  }
}

function enterCoach() {
  setPhase("coach");
  show(els.splash, false);
  show(els.denied, false);
  show(els.coach, true);
  show(els.hud, false);
  show(els.play, false);
  show(els.playHint, false);
  state.coachMs = 0;
  state.faceLockMs = 0;
}

function enterReady() {
  setPhase("ready");
  show(els.splash, false);
  show(els.denied, false);
  show(els.coach, false);
  show(els.play, true);
  show(els.playHint, true);
  show(els.hud, false);
  hideBag();
  startWaveWatch();
}

function finishCoach() {
  enterReady();
}

function resetDrops() {
  state.drops = createDropTable();
}

function resetRun() {
  clearGifts();
  state.lives = GAME.lives;
  state.round = 1;
  state.currentPoints = 0;
  state.totalPoints = 0;
  state.roundLeftMs = GAME.roundSeconds * 1000;
  state.roundResults = [];
  state.pausedByFace = false;
  state.faceLostMs = 0;
  resetDrops();
  updateLivesUi();
  updateScoreUi();
  updateTimerUi();
  show(els.endCard, false);
  show(els.faceLost, false);
  if (els.roundNumber) {
    els.roundNumber.textContent = "1";
  }
}

function clearGifts() {
  state.gifts.forEach((gift) => {
    if (gift.el && gift.el.parentNode) {
      gift.el.parentNode.removeChild(gift.el);
    }
  });
  state.gifts = [];
  if (els.fallingLayer) {
    els.fallingLayer.innerHTML = "";
  }
  if (els.falling) {
    els.falling.innerHTML = "";
  }
}

function updateLivesUi() {
  els.lives.forEach((node, index) => {
    if (node) {
      node.style.visibility = index < state.lives ? "visible" : "hidden";
    }
  });
}

function roundPassScore() {
  const scores = GAME.passScore;
  if (Array.isArray(scores)) {
    return scores[state.round - 1] || scores[0];
  }
  return scores;
}

function updateScoreUi() {
  const pass = roundPassScore();
  if (els.score) {
    els.score.textContent = `${state.currentPoints}/${pass}`;
  }
  const circle = document.querySelector(".circle");
  if (!circle) {
    return;
  }
  const pct = Math.min(100, (state.currentPoints / pass) * 100);
  circle.style.stroke = state.currentPoints <= 0 ? "#ff4d4d" : "#28a745";
  circle.style.strokeDasharray = `${pct}, 100`;
}

function updateTimerUi() {
  if (!els.timer) {
    return;
  }
  const seconds = Math.max(0, Math.ceil(state.roundLeftMs / 1000));
  els.timer.textContent = `0:${String(seconds).padStart(2, "0")}`;
}

function showStatus(title, detail, ms) {
  if (!els.status) {
    return;
  }
  els.status.style.display = "block";
  if (els.statusTitle) {
    els.statusTitle.textContent = title;
  }
  if (els.statusDetail) {
    els.statusDetail.textContent = detail || "";
  }
  if (ms) {
    window.setTimeout(() => {
      if (els.status) {
        els.status.style.display = "none";
      }
    }, ms);
  }
}

function hideStatus() {
  if (els.status) {
    els.status.style.display = "none";
  }
}

function availableItemIds() {
  return Object.keys(GAME.items).filter((id) => {
    const item = GAME.items[id];
    return (
      item.rounds.indexOf(state.round) !== -1 &&
      state.drops[id] < item.maxDrops
    );
  });
}

function spawnGift() {
  const ids = availableItemIds();
  if (!ids.length || !els.fallingLayer) {
    return;
  }
  const imageId = ids[Math.floor(Math.random() * ids.length)];
  const item = GAME.items[imageId];
  const minGap = GAME.minSpawnXGapPct || 22;
  let xPct = 14 + Math.random() * 72;
  let tries = 0;
  while (Math.abs(xPct - state.lastSpawnX) < minGap && tries < 8) {
    xPct = 14 + Math.random() * 72;
    tries += 1;
  }
  state.lastSpawnX = xPct;
  state.drops[imageId] += 1;

  const xPx = (xPct / 100) * window.innerWidth;
  // Stagger entry so gifts don't appear on the same horizontal "step".
  const yPx = -60 - Math.random() * 140;
  const el = document.createElement("img");
  el.className = "falling-gift";
  el.src = `./src/assets/images/${imageId}.webp`;
  el.alt = "";
  el.decoding = "async";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, 0)`;
  els.fallingLayer.appendChild(el);
  state.gifts.push({
    el,
    imageId,
    points: item.points,
    speed: item.speed * (0.88 + Math.random() * 0.28),
    collecting: false,
    xPx,
    yPx,
    sway: (Math.random() - 0.5) * 22,
    phase: Math.random() * Math.PI * 2,
  });
}

function isCatch(gift) {
  if (gift.collecting || !els.screenBag || els.screenBag.hidden || !gift.el) {
    return false;
  }
  const bag = els.screenBag.getBoundingClientRect();
  const rect = gift.el.getBoundingClientRect();
  if (!bag.width || !rect.width) {
    return false;
  }
  const padX = bag.width * 0.12;
  const padY = bag.height * 0.18;
  return !(
    rect.right < bag.left + padX ||
    rect.left > bag.right - padX ||
    rect.bottom < bag.top + padY ||
    rect.top > bag.bottom - padY
  );
}

function catchGift(gift) {
  if (gift.collecting) {
    return;
  }
  gift.collecting = true;
  gift.collectMs = 0;
  const rect = gift.el.getBoundingClientRect();
  const bag = els.screenBag
    ? els.screenBag.getBoundingClientRect()
    : { left: state.bagX, top: state.bagY, width: 160, height: 100 };
  const fromX = rect.left + rect.width / 2;
  const fromY = rect.top + rect.height / 2;
  const mouthY = bag.top + bag.height * 0.18;
  gift.collectFrom = { x: fromX, y: fromY, w: rect.width };
  gift.collectTo = {
    x: bag.left + bag.width * 0.5,
    y: Math.max(fromY, mouthY) + bag.height * 0.14,
  };
  gift.el.classList.add("is-collecting");
  gift.el.style.position = "fixed";
  gift.el.style.zIndex = "18";
  gift.el.style.left = `${fromX}px`;
  gift.el.style.top = `${fromY}px`;
  gift.el.style.width = `${rect.width}px`;
  gift.el.style.transform = "translate3d(-50%, -50%, 0) scale(1)";
  gift.el.style.opacity = "1";
  document.body.appendChild(gift.el);
  if (state.roundLeftMs <= 0) {
    return;
  }
  state.currentPoints += gift.points;
  state.totalPoints += gift.points;
  playSound(els.audio.score);
  updateScoreUi();
  track("catch", { item: gift.imageId, points: gift.points, round: state.round });
}

function tickCollect(gift, delta) {
  gift.collectMs += delta;
  const u = Math.min(1, gift.collectMs / GAME.collectMs);
  const t = u * u;
  const x = gift.collectFrom.x + (gift.collectTo.x - gift.collectFrom.x) * t;
  const y = gift.collectFrom.y + (gift.collectTo.y - gift.collectFrom.y) * t;
  const scale = Math.max(0, 1 - u);
  gift.el.style.zIndex = u > 0.55 ? "15" : "18";
  gift.el.style.left = `${x}px`;
  gift.el.style.top = `${y}px`;
  gift.el.style.transform = `translate3d(-50%, -50%, 0) scale(${scale})`;
  gift.el.style.opacity = u > 0.82 ? String(1 - (u - 0.82) / 0.18) : "1";
  return u >= 1;
}

async function beginRound() {
  if (!state.cameraStarted) {
    show(els.loading, true);
    setLoadingProgress({ label: t("loadingAr"), loaded: 0, total: 1 });
    await startMindAr();
    show(els.loading, false);
    if (!state.cameraStarted && !state.cameraStarting) {
      return;
    }
  } else {
    revealAr();
  }
  show(els.hud, true);
  show(els.cameraPreview, true);
  showBag();
  clearGifts();
  state.currentPoints = 0;
  state.roundLeftMs = GAME.roundSeconds * 1000;
  state.countdownLeftMs = GAME.countdownMs;
  state.spawnAccMs = 0;
  state.nextSpawnMs = 0;
  state.roundSpawns = 0;
  state.pausedByFace = false;
  state.faceLostMs = 0;
  updateScoreUi();
  updateTimerUi();
  if (els.roundNumber) {
    els.roundNumber.textContent = String(state.round);
  }
  show(els.play, false);
  show(els.playHint, false);
  show(els.retry, false);
  show(els.endCard, false);
  setPhase("countdown");
  playSound(els.audio.song);
  if (els.audio.main) {
    els.audio.main.pause();
  }
  if (els.audio.song) {
    els.audio.song.play().catch(() => {});
  }
  showStatus("3", t("howTo"), 0);
  track("play", { round: state.round });
}

function onRoundEnd() {
  clearGifts();
  const passed = state.currentPoints >= roundPassScore();
  state.roundResults.push({
    round: state.round,
    score: state.currentPoints,
    passed,
  });
  track("round_end", {
    round: state.round,
    score: state.currentPoints,
    passed,
    lives: state.lives,
  });
  if (passed) {
    showStatus(t("roundCleared"), `${state.currentPoints} ${t("points")}`, GAME.betweenRoundsMs);
  } else {
    state.lives -= 1;
    updateLivesUi();
    playSound(els.audio.fail);
    showStatus(
      t("roundFailed"),
      `${state.lives} ${state.lives === 1 ? t("life") : t("lives")} ${t("left")}`,
      GAME.betweenRoundsMs
    );
    if (state.lives <= 0) {
      endGame(false);
      return;
    }
  }
  if (state.round >= GAME.rounds) {
    endGame(true);
    return;
  }
  setPhase("between");
  state.countdownLeftMs = GAME.betweenRoundsMs;
}

function endGame(won) {
  setPhase("ended");
  if (els.audio.song) {
    els.audio.song.pause();
  }
  const didWin = !!(won && state.lives > 0);
  if (didWin) {
    playSound(els.audio.passed);
  } else {
    playSound(els.audio.gameOver);
  }
  track("game_over", {
    won: didWin,
    score: state.totalPoints,
    lives: state.lives,
  });
  hideStatus();
  show(els.play, false);
  show(els.playHint, false);
  show(els.retry, false);
  document.body.classList.remove("is-playing");
  hideBag();
  showEndCard(didWin);
  if (els.audio.main && !state.muted) {
    els.audio.main.play().catch(() => {});
  }
}

function showEndCard(won) {
  const canvas = drawScoreCard({
    won,
    totalPoints: state.totalPoints,
    lives: state.lives,
    results: state.roundResults,
  });
  if (els.endPreview) {
    els.endPreview.src = canvas.toDataURL("image/png");
  }
  if (els.endTitle) {
    els.endTitle.textContent = won ? t("youFinished") : t("gameOver");
  }
  if (els.endScore) {
    els.endScore.textContent = String(state.totalPoints);
  }
  if (els.endRounds) {
    els.endRounds.replaceChildren();
    state.roundResults.forEach((row) => {
      const item = document.createElement("li");
      item.className = row.passed ? "pass" : "fail";
      item.textContent = `${t("round")} ${row.round} · ${
        row.passed ? t("cleared") : t("failed")
      } · ${row.score}`;
      els.endRounds.appendChild(item);
    });
  }
  if (els.leadForm && state.campaign.leadFormUrl) {
    show(els.leadForm, true);
  }
  els.endCard._canvas = canvas;
  show(els.endCard, true);
}

function tickDistance() {
  show(els.distanceHint, false);
}

function startFromReady() {
  if (state.phase !== "ready") {
    return;
  }
  stopWaveWatch();
  unlockAudio();
  resetRun();
  beginRound();
}

function tickWaveStart() {
  if (state.phase !== "ready") {
    return;
  }
  const motion = sampleHandMotion();
  const lean = sampleFaceLeanMotion();
  state.waveFaceLean = (state.waveFaceLean || 0) * 0.85 + lean;
  if (state.waveFaceLean >= (GAME.wave.faceLean || 0.12)) {
    startFromReady();
    return;
  }
  if (!motion) {
    return;
  }
  const now = performance.now();
  if (!state.waveSeenAt) {
    state.waveSeenAt = now;
    state.waveArmedAt = now + GAME.wave.armMs;
    state.waveNoiseSamples = [];
    state.waveSamples = [];
    return;
  }
  if (now < state.waveArmedAt) {
    state.waveNoiseSamples.push(motion.maxCell);
    state.waveSamples = [];
    return;
  }
  if (!state.waveNoise && state.waveNoiseSamples.length) {
    const sorted = state.waveNoiseSamples.slice().sort((a, b) => a - b);
    state.waveNoise = sorted[Math.floor(sorted.length / 2)] || 0;
  }
  state.waveSamples.push({ t: now, motion });
  state.waveSamples = state.waveSamples.filter((row) => now - row.t <= GAME.wave.windowMs);
  if (state.waveSamples.length < GAME.wave.hotFrames) {
    return;
  }
  const floor = Math.max(GAME.wave.motionMin, (state.waveNoise || 0) * 1.6);
  const hot = state.waveSamples.filter((row) => {
    const hit = row.motion.maxCell >= floor && row.motion.localized;
    const cover = row.motion.change >= GAME.wave.changeMin;
    const soft = row.motion.maxCell >= floor * 0.85;
    return hit || cover || soft;
  }).length;
  if (hot >= GAME.wave.hotFrames) {
    startFromReady();
  }
}

function countFlips(values, minDelta) {
  const need = minDelta || 0.02;
  let flips = 0;
  let dir = 0;
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (Math.abs(delta) < need) {
      continue;
    }
    const next = delta > 0 ? 1 : -1;
    if (dir && next !== dir) {
      flips += 1;
    }
    dir = next;
  }
  return flips;
}

function tickFacePause(faceVisible, delta) {
  const inRound = state.phase === "playing" || state.phase === "countdown";
  if (!inRound) {
    state.pausedByFace = false;
    state.faceLostMs = 0;
    show(els.faceLost, false);
    return false;
  }
  if (faceVisible) {
    if (state.pausedByFace) {
      track("face_recovered", { round: state.round });
    }
    state.faceLostMs = 0;
    state.pausedByFace = false;
    show(els.faceLost, false);
    return false;
  }
  state.faceLostMs += delta;
  if (state.faceLostMs >= GAME.faceLostPauseMs) {
    if (!state.pausedByFace) {
      track("face_lost", { round: state.round });
    }
    state.pausedByFace = true;
    show(els.faceLost, true);
    return true;
  }
  return false;
}

function tickDebug(gift) {
  if (!DEBUG || !els.debug) {
    return;
  }
  els.debug.hidden = false;
  let extra = "";
  if (gift && gift.el && els.screenBag && !els.screenBag.hidden) {
    const bag = els.screenBag.getBoundingClientRect();
    const rect = gift.el.getBoundingClientRect();
    extra = `  bag:${Math.round(bag.left)} gift:${Math.round(rect.left)}`;
  }
  const hasEstimate = !!faceEstimate();
  els.debug.textContent =
    `Phase 4  camera:${state.cameraStarted ? "on" : "off"}  face:${
      state.faceLocked ? "LOCK" : "lost"
    }  est:${hasEstimate ? "yes" : "no"}  bag:${Math.round(state.bagX)},${Math.round(
      state.bagY
    )}  phase:${state.phase}${state.pausedByFace ? " PAUSED" : ""}${extra}`;
}

function tick(delta) {
  if (state.hidden || !delta) {
    return;
  }
  const faceVisible = !!(
    els.faceTarget &&
    els.faceTarget.object3D &&
    els.faceTarget.object3D.visible
  );
  state.faceLocked = faceVisible;
  tickDistance();
  if (tickFacePause(faceVisible, delta)) {
    tickDebug(state.gifts[0]);
    return;
  }

  if (state.phase === "coach") {
    state.coachMs += delta;
    if (faceVisible) {
      state.faceLockMs += delta;
    } else {
      state.faceLockMs = 0;
    }
    if (state.faceLockMs >= GAME.faceLockHoldMs || state.coachMs >= GAME.coachSkipMs) {
      finishCoach();
    }
  }

  if (state.phase === "countdown") {
    state.countdownLeftMs -= delta;
    const n = Math.max(1, Math.ceil(state.countdownLeftMs / 1000));
    if (els.statusTitle) {
      els.statusTitle.textContent = String(n);
    }
    if (state.countdownLeftMs <= 0) {
      hideStatus();
      setPhase("playing");
      state.spawnAccMs = 0;
      state.nextSpawnMs = 350;
    }
    tickDebug(state.gifts[0]);
    return;
  }

  if (state.phase === "between") {
    state.countdownLeftMs -= delta;
    if (state.countdownLeftMs <= 0) {
      state.round += 1;
      beginRound();
    }
    return;
  }

  if (state.phase !== "playing") {
    tickDebug(state.gifts[0]);
    return;
  }

  state.roundLeftMs -= delta;
  updateTimerUi();
  if (state.roundLeftMs <= 0) {
    onRoundEnd();
    return;
  }

  const spawnEvery = GAME.spawnEveryMs[state.round - 1] || GAME.spawnEveryMs[0];
  const spawnMax = GAME.spawnMax[state.round - 1] || GAME.spawnMax[0];
  if (!state.nextSpawnMs) {
    const jitter = GAME.spawnJitterMs || 0;
    state.nextSpawnMs = Math.max(700, spawnEvery + (Math.random() * 2 - 1) * jitter);
  }
  state.spawnAccMs += delta;
  if (state.roundSpawns < spawnMax && state.spawnAccMs >= state.nextSpawnMs) {
    state.spawnAccMs = 0;
    const jitter = GAME.spawnJitterMs || 0;
    state.nextSpawnMs = Math.max(700, spawnEvery + (Math.random() * 2 - 1) * jitter);
    spawnGift();
    state.roundSpawns += 1;
  }

  const dtMs = Math.min(48, delta);
  const fallBase = (GAME.fallPxPerSec || 220) * (dtMs / 1000);
  const bottomLimit = window.innerHeight + 96;
  for (let i = state.gifts.length - 1; i >= 0; i -= 1) {
    const gift = state.gifts[i];
    if (!gift.el) {
      state.gifts.splice(i, 1);
      continue;
    }
    if (gift.collecting) {
      if (tickCollect(gift, delta)) {
        if (gift.el.parentNode) {
          gift.el.parentNode.removeChild(gift.el);
        }
        state.gifts.splice(i, 1);
      }
      continue;
    }
    gift.yPx += fallBase * gift.speed;
    gift.phase = (gift.phase || 0) + dtMs * 0.004;
    const swayX = Math.sin(gift.phase) * (gift.sway || 0);
    const drawX = gift.xPx + swayX;
    gift.el.style.transform = `translate3d(${drawX}px, ${gift.yPx}px, 0) translate(-50%, 0)`;
    if (isCatch(gift)) {
      catchGift(gift);
      continue;
    }
    if (gift.yPx > bottomLimit) {
      if (gift.el.parentNode) {
        gift.el.parentNode.removeChild(gift.el);
      }
      state.gifts.splice(i, 1);
    }
  }
  tickDebug(state.gifts[0]);
}

function showCampaignEnded(campaign) {
  document.body.dataset.phase = "ended-campaign";
  show(els.ended, true);
  show(els.splash, false);
  show(els.start, false);
  show(els.mute, false);
  show(els.hud, false);
  show(els.play, false);
  show(els.retry, false);
  show(els.denied, false);
  show(els.coach, false);
  show(els.inapp, false);
  hideBag();
  if (els.ended) {
    const title = els.ended.querySelector("h1");
    const body = els.ended.querySelector("p");
    if (title && campaign.endedTitle) {
      title.textContent = campaign.endedTitle;
    }
    if (body && campaign.endedBody) {
      body.textContent = campaign.endedBody;
    }
  }
  track("campaign_ended");
}

async function submitLead(event) {
  event.preventDefault();
  if (!els.leadForm || !state.campaign.leadFormUrl) {
    return;
  }
  const data = new FormData(els.leadForm);
  if (data.get("company")) {
    if (els.leadStatus) {
      els.leadStatus.textContent = t("leadThanks");
    }
    return;
  }
  const email = String(data.get("email") || "").trim();
  if (!email) {
    return;
  }
  const submit = document.getElementById("lead-submit");
  if (submit) {
    submit.disabled = true;
  }
  try {
    const res = await fetch(state.campaign.leadFormUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        score: state.totalPoints,
        rounds: state.roundResults,
        ts: Date.now(),
      }),
    });
    if (els.leadStatus) {
      els.leadStatus.textContent = res.ok ? t("leadThanks") : t("leadError");
    }
    track("lead_submit", { ok: res.ok });
  } catch (err) {
    if (els.leadStatus) {
      els.leadStatus.textContent = t("leadError");
    }
    if (submit) {
      submit.disabled = false;
    }
    track("lead_submit", { ok: false });
  }
}

async function beginCamera() {
  unlockAudio();
  warmAudio();
  show(els.start, false);
  if (els.splash) {
    const copy = els.splash.querySelector(".privacy");
    if (copy) {
      copy.textContent = t("startingCamera");
    }
  }
  track("permission_prompt", {
    secure: window.isSecureContext,
    iframe: inAdFrame(),
    href: window.location.href,
  });

  if (isCameraBlockedContext()) {
    showDenied(insecureCameraMessage());
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showDenied(t("cameraMissing"));
    return;
  }

  // Kick off getUserMedia in the same tap turn (required on iOS).
  const streamPromise = navigator.mediaDevices
    .getUserMedia({ audio: false, video: { facingMode: "user" } })
    .catch(() => navigator.mediaDevices.getUserMedia({ audio: false, video: true }));

  try {
    const stream = await streamPromise;
    setPrimedStream(stream);
    track("permission_granted", { primed: true });
    // Do not bind the stream to a second <video> before MindAR on iOS.
    show(els.splash, false);
    show(els.coach, false);
    enterReady();
    show(els.loading, true);
    setLoadingProgress({ label: t("loadingAr"), loaded: 0, total: 1 });
    await startMindAr();
    show(els.loading, false);
  } catch (err) {
    console.error(err);
    show(els.loading, false);
    track("permission_denied", {
      reason: err && err.name,
      href: window.location.href,
      secure: window.isSecureContext,
      iframe: inAdFrame(),
    });
    if (inAdFrame() && err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      showDenied(t("cameraIframe"));
      return;
    }
    showDenied(cameraFailMessage(err) || t(cameraFailKey(err)));
  }
}

function bindUi() {
  if (els.start) {
    els.start.addEventListener("click", () => {
      beginCamera();
    });
  }

  if (els.cameraRetry) {
    els.cameraRetry.addEventListener("click", () => {
      if (inAdFrame()) {
        openOutOfFrame();
        return;
      }
      show(els.denied, false);
      show(els.splash, true);
      setPhase("splash");
      if (els.start) {
        show(els.start, true);
      }
      beginCamera();
    });
  }

  if (els.coachSkip) {
    els.coachSkip.addEventListener("click", finishCoach);
  }

  if (els.play) {
    els.play.addEventListener("click", startFromReady);
  }

  if (els.playHint) {
    els.playHint.addEventListener("click", startFromReady);
  }

  if (els.retry) {
    els.retry.addEventListener("click", () => {
      unlockAudio();
      resetRun();
      beginRound();
    });
  }

  if (els.endRetry) {
    els.endRetry.addEventListener("click", () => {
      unlockAudio();
      resetRun();
      beginRound();
    });
  }

  if (els.endShare) {
    els.endShare.addEventListener("click", async () => {
      const canvas = els.endCard && els.endCard._canvas;
      if (!canvas) {
        return;
      }
      const result = await shareOrDownload(canvas);
      track("share", { method: result, score: state.totalPoints });
    });
  }

  if (els.mute) {
    els.mute.addEventListener("click", () => {
      state.muted = !state.muted;
      applyMute();
    });
  }

  if (els.leadForm) {
    els.leadForm.addEventListener("submit", submitLead);
  }

  document.addEventListener("visibilitychange", () => {
    state.hidden = document.hidden;
    if (document.hidden && els.audio.song) {
      els.audio.song.pause();
    }
  });

  window.addEventListener("resize", () => {
    if (!els.arScene || !els.arScene.classList.contains("is-live")) {
      return;
    }
    window.requestAnimationFrame(enablePlayWorld);
  });

  let bagPointerId = null;
  const onBagPointer = (ev) => {
    if (ev.pointerType === "mouse" && ev.buttons === 0 && ev.type === "pointermove") {
      return;
    }
    if (state.phase !== "playing" && state.phase !== "countdown") {
      return;
    }
    if (!els.screenBag || els.screenBag.hidden) {
      return;
    }
    if (ev.type === "pointerdown") {
      bagPointerId = ev.pointerId;
    } else if (bagPointerId !== null && ev.pointerId !== bagPointerId) {
      return;
    }
    if (ev.type === "pointerup" || ev.type === "pointercancel") {
      bagPointerId = null;
      return;
    }
    // Only drag in the lower play area so UI taps still work.
    if (ev.clientY < window.innerHeight * 0.45) {
      return;
    }
    ev.preventDefault();
    moveBagToPointer(ev.clientX, ev.clientY);
  };
  window.addEventListener("pointerdown", onBagPointer, { passive: false });
  window.addEventListener("pointermove", onBagPointer, { passive: false });
  window.addEventListener("pointerup", onBagPointer);
  window.addEventListener("pointercancel", onBagPointer);
}

async function boot() {
  applyI18n();
  bindUi();
  applyMute();
  updateLivesUi();
  updateScoreUi();
  updateTimerUi();
  setPhase("splash");
  show(els.denied, false);
  show(els.coach, false);
  show(els.play, false);
  show(els.playHint, false);
  show(els.retry, false);
  show(els.hud, false);
  show(els.endCard, false);
  show(els.loading, false);
  show(els.faceLost, false);
  show(els.ended, false);
  hideCameraPreview();
  hideBag();
  if (DEBUG && els.debug) {
    els.debug.hidden = false;
  }

  if (inAppBrowser()) {
    show(els.inapp, true);
    if (els.inappCopy) {
      els.inappCopy.textContent = safariOpenHint();
    }
    track("inapp_browser");
  }

  const campaign = await loadCampaign();
  state.campaign = campaign;
  const applied = applyLiveTweak(campaign);
  if (campaign.copy) {
    overlayCopy(campaign.copy);
  }
  state.roundLeftMs = GAME.roundSeconds * 1000;
  updateScoreUi();
  updateTimerUi();
  startOps(track, {
    buildId: campaign.buildId || "",
    ended: campaign.ended,
    tweak: Object.keys(applied).join(",") || "none",
  });
  if (Object.keys(applied).length) {
    track("ops_tweak", applied);
  }
  if (campaign.ended) {
    showCampaignEnded(campaign);
    return;
  }
  if (isHttpLan()) {
    const copy = els.splash && els.splash.querySelector(".privacy");
    if (copy) {
      copy.textContent = insecureCameraMessage();
    }
  }
  prefetchVendors();
}

boot();

