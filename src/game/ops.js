const STORAGE = "christmas-ops";
const TAB = "christmas-ops-tab";
const HEARTBEAT_MS = 10000;
const OTHER_TAB_MS = 12000;
const CRASH_WINDOW_MS = 10 * 60 * 1000;
const MAX_ERRORS = 5;

function now() {
  return Date.now();
}

function readLast() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE) || "null");
  } catch (err) {
    return null;
  }
}

function writeLast(row) {
  try {
    window.localStorage.setItem(STORAGE, JSON.stringify(row));
  } catch (err) {
    /* private mode */
  }
}

function sessionId() {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${now()}-${Math.random().toString(16).slice(2)}`;
  return rand;
}

function browserHint() {
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua);
  const android = /Android/.test(ua);
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|FxiOS/.test(ua);
  const chrome = /Chrome|CriOS/.test(ua);
  return {
    os: ios ? "ios" : android ? "android" : "other",
    browser: safari ? "safari" : chrome ? "chrome" : "other",
    dpr: window.devicePixelRatio || 1,
    vw: window.innerWidth,
    vh: window.innerHeight,
    conn: (navigator.connection && navigator.connection.effectiveType) || "",
    mem: navigator.deviceMemory || 0,
  };
}

function trimError(err) {
  const message = String((err && (err.message || err.reason || err)) || "error");
  return message.slice(0, 120);
}

function startOps(track, meta) {
  const last = readLast();
  let priorTab = "";
  try {
    priorTab = window.sessionStorage.getItem(TAB) || "";
  } catch (err) {
    priorTab = "";
  }
  const age = last && last.aliveAt ? now() - last.aliveAt : 0;
  const sameTabReload = !!(last && priorTab && last.id === priorTab);
  if (
    last &&
    !last.closed &&
    !sameTabReload &&
    age > OTHER_TAB_MS &&
    age < CRASH_WINDOW_MS
  ) {
    track("possible_crash", {
      prev: last.id,
      ageMs: age,
      buildId: last.buildId || "",
    });
  }

  const startedAt = now();
  const id = sessionId();
  const row = {
    id,
    buildId: (meta && meta.buildId) || "",
    startedAt,
    aliveAt: startedAt,
    closed: false,
    errors: 0,
  };
  writeLast(row);
  try {
    window.sessionStorage.setItem(TAB, id);
  } catch (err) {
    /* private mode */
  }
  track("session_start", Object.assign({ id, buildId: row.buildId }, browserHint(), meta || {}));

  const beat = () => {
    const current = readLast();
    if (!current || current.id !== id || current.closed) {
      return;
    }
    current.aliveAt = now();
    writeLast(current);
  };
  const timer = window.setInterval(beat, HEARTBEAT_MS);

  const close = (reason) => {
    window.clearInterval(timer);
    const current = readLast();
    if (!current || current.id !== id || current.closed) {
      return;
    }
    current.closed = true;
    current.aliveAt = now();
    writeLast(current);
    track("session_end", { id, reason, ms: now() - (current.startedAt || startedAt) });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      beat();
    }
  });
  window.addEventListener("pagehide", () => close("pagehide"));

  window.addEventListener("error", (event) => {
    const current = readLast() || row;
    if (current.errors >= MAX_ERRORS) {
      return;
    }
    current.errors += 1;
    writeLast(current);
    track("js_error", {
      message: trimError(event.error || event.message),
      source: String(event.filename || "").slice(-80),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const current = readLast() || row;
    if (current.errors >= MAX_ERRORS) {
      return;
    }
    current.errors += 1;
    writeLast(current);
    track("js_error", { message: trimError(event.reason), source: "promise" });
  });
  document.addEventListener(
    "webglcontextlost",
    () => {
      track("webgl_lost", { id });
    },
    true
  );

  return { id, close };
}
