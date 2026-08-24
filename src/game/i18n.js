const STRINGS = {
  en: {
    documentTitle: "Christmas Catch",
    start: "Turn on camera",
    play: "Play",
    retry: "Retry",
    skip: "Skip",
    tryAgain: "Try again",
    soundOn: "Sound on",
    soundOff: "Sound off",
    privacy: "We use your camera to catch gifts.",
    howTo: "After the camera is on, wave or tap Play.",
    playHint: "Wave your hand — or tap Play",
    startingCamera: "Starting camera…",
    cameraDenied:
      "Camera was blocked. On iPhone: Settings → Safari → Camera → Allow, then reload. On Android: tap the lock icon → Permissions → Camera → Allow, then Try again.",
    cameraInsecure:
      "Camera needs HTTPS on a phone. Use the https:// link (padlock), not http:// or a LAN address.",
    cameraMissing: "No camera was found on this device.",
    cameraBusy: "The camera is in use by another app. Close it, then try again.",
    cameraIframe:
      "This page is inside an ad frame that blocks the camera. Tap Try again to open it full screen.",
    cameraArFail:
      "Camera started, but face tracking could not begin. Close other camera apps, reload, and try again over https://.",
    coach: "Wave your hand or tap Play to start.",
    totalScore: "Total score",
    faceLost: "Center your face to keep playing",
    loadingAr: "Loading AR…",
    startingCameraShort: "Starting camera…",
    distanceFar: "Move a little farther from the camera",
    distanceClose: "Move a little closer",
    inappNeed: "This game needs a full browser camera.",
    roundCleared: "Round cleared!",
    roundFailed: "Round failed",
    points: "points",
    life: "life",
    lives: "lives",
    left: "left",
    round: "Round",
    youFinished: "You finished!",
    gameOver: "Game over",
    score: "Score",
    cleared: "cleared",
    failed: "failed",
    cameraNotSaved: "Your camera video was not saved.",
    share: "Save / Share score",
    playAgain: "Play again",
    endedTitle: "This campaign has ended",
    endedBody: "Thanks for playing Christmas Catch.",
    leadPlaceholder: "Email for the prize draw (optional)",
    leadSubmit: "Enter draw",
    leadThanks: "Thanks — we saved your entry.",
    leadError: "Could not send. Try again later.",
    shareTitle: "Christmas Catch",
    shareText: "I played Christmas Catch",
  },
};

function locale() {
  const query = new URLSearchParams(window.location.search).get("lang");
  if (query && STRINGS[query]) {
    return query;
  }
  const html = document.documentElement.lang;
  if (html && STRINGS[html]) {
    return html;
  }
  return "en";
}

function t(key) {
  const pack = STRINGS[locale()] || STRINGS.en;
  return pack[key] || STRINGS.en[key] || key;
}

function applyI18n() {
  document.documentElement.lang = locale();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = t(key);
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.setAttribute("placeholder", value);
    } else {
      el.textContent = value;
    }
  });
}

function overlayCopy(copy) {
  if (!copy || typeof copy !== "object") {
    return;
  }
  const pack = STRINGS[locale()] || STRINGS.en;
  Object.keys(copy).forEach((key) => {
    if (pack[key] == null || copy[key] == null || copy[key] === "") {
      return;
    }
    pack[key] = String(copy[key]);
  });
  applyI18n();
}
