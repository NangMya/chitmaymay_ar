let primed = null;
let handoffActive = false;
let originalGetUserMedia = null;

function isHttpLan() {
  const host = window.location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  return window.location.protocol === "http:" && !local;
}

function isCameraBlockedContext() {
  return (
    window.location.protocol === "file:" ||
    isHttpLan() ||
    !window.isSecureContext
  );
}

function insecureCameraMessage() {
  if (window.location.protocol === "file:") {
    return "Open with Live Server or Play.bat (http://127.0.0.1). Camera cannot run from a file link.";
  }
  return "Camera needs HTTPS on a phone. Open the https:// link with a padlock — not http:// or 192.168… On PC run: npm run phone";
}

function inAdFrame() {
  try {
    return window.self !== window.top;
  } catch (_err) {
    return true;
  }
}

function openOutOfFrame() {
  const url = window.location.href;
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch (_err) {
    /* cross-origin iframe */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function cameraFailKey(err) {
  if (isCameraBlockedContext()) {
    return "cameraInsecure";
  }
  const name = err && err.name;
  if (inAdFrame() && (name === "NotAllowedError" || name === "SecurityError")) {
    return "cameraIframe";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "cameraMissing";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "cameraBusy";
  }
  if (name === "NotAllowedError") {
    return "cameraDenied";
  }
  return "cameraDenied";
}

function cameraFailMessage(err) {
  if (isCameraBlockedContext()) {
    return insecureCameraMessage();
  }
  if (inAdFrame() && err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
    return null;
  }
  return null;
}

function streamIsLive(stream) {
  return !!(stream && stream.getTracks && stream.getTracks().some((t) => t.readyState === "live"));
}

async function requestCameraStream() {
  const attempts = [
    { audio: false, video: { facingMode: "user" } },
    { audio: false, video: true },
  ];
  let lastErr = null;
  for (let i = 0; i < attempts.length; i += 1) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[i]);
    } catch (err) {
      lastErr = err;
      if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
        throw err;
      }
    }
  }
  throw lastErr || new Error("camera");
}

async function primeCamera() {
  if (isCameraBlockedContext()) {
    const err = new Error("insecure");
    err.name = "SecurityError";
    throw err;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const err = new Error("missing");
    err.name = "NotFoundError";
    throw err;
  }
  releasePrimedCamera();
  primed = await requestCameraStream();
  return primed;
}

function getPrimedStream() {
  return primed;
}

function setPrimedStream(stream) {
  if (primed && primed !== stream) {
    primed.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (_err) {
        /* ignore */
      }
    });
  }
  primed = stream || null;
}

function restoreGetUserMedia() {
  if (!handoffActive || !navigator.mediaDevices || !originalGetUserMedia) {
    handoffActive = false;
    return;
  }
  navigator.mediaDevices.getUserMedia = originalGetUserMedia;
  originalGetUserMedia = null;
  handoffActive = false;
}

/**
 * MindAR calls getUserMedia after async loading. Reuse the stream from the
 * Start tap so iOS/Android do not need a second permission gesture.
 */
function armCameraHandoff() {
  if (!streamIsLive(primed) || !navigator.mediaDevices || handoffActive) {
    return false;
  }
  const media = navigator.mediaDevices;
  originalGetUserMedia = media.getUserMedia.bind(media);
  handoffActive = true;
  media.getUserMedia = function handoffGetUserMedia() {
    restoreGetUserMedia();
    if (streamIsLive(primed)) {
      return Promise.resolve(primed);
    }
    return originalGetUserMedia.apply(media, arguments);
  };
  window.setTimeout(restoreGetUserMedia, 30000);
  return true;
}

function attachStreamToVideo(video, stream) {
  if (!video || !stream) {
    return;
  }
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.setAttribute("muted", "");
  video.playsInline = true;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  const play = video.play();
  if (play && play.catch) {
    play.catch(() => {});
  }
}

function releasePrimedCamera() {
  restoreGetUserMedia();
  if (!primed) {
    return;
  }
  const scene = document.querySelector("a-scene");
  const mindarVideo =
    scene &&
    scene.systems &&
    scene.systems["mindar-face-system"] &&
    scene.systems["mindar-face-system"].video;
  if (mindarVideo && mindarVideo.srcObject === primed) {
    primed = null;
    return;
  }
  primed.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (_err) {
      /* ignore */
    }
  });
  primed = null;
}

function markVideosInline() {
  document.querySelectorAll("video").forEach((video) => {
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.setAttribute("muted", "");
    video.playsInline = true;
    const play = video.play();
    if (play && play.catch) {
      play.catch(() => {});
    }
  });
}
