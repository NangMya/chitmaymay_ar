const AFRAME_SRC = "./vendor/aframe.min.js";
const MINDAR_SRC = "./vendor/mindar-face-aframe.prod.js";

let pending = null;

function vendorHref(src) {
  try {
    return new URL(src, document.baseURI).href;
  } catch (_err) {
    return src;
  }
}

function loadScript(src, label, onProgress, step, total) {
  return new Promise((resolve, reject) => {
    const href = vendorHref(src);
    const existing = document.querySelector(`script[data-vendor="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    if (onProgress) {
      onProgress({
        label: `Loading AR… ${label}`,
        detail: `${step} / ${total}`,
        loaded: step - 1,
        total,
      });
    }
    const script = document.createElement("script");
    script.src = href;
    script.async = false;
    script.dataset.vendor = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(script);
  });
}

function shouldPrefetchVendors() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) {
    return false;
  }
  return true;
}

function prefetchVendors() {
  if (!shouldPrefetchVendors() || !document.head) {
    return;
  }
  [AFRAME_SRC, MINDAR_SRC].forEach((href) => {
    const url = vendorHref(href);
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "script";
    link.href = url;
    document.head.appendChild(link);
  });
}

async function loadVendors(onProgress) {
  if (pending) {
    return pending;
  }
  pending = (async () => {
    try {
      if (typeof window.AFRAME === "undefined") {
        await loadScript(AFRAME_SRC, "engine", onProgress, 1, 2);
      }
      await loadScript(MINDAR_SRC, "tracker", onProgress, 2, 2);
      if (onProgress) {
        onProgress({ label: "Starting camera…", loaded: 1, total: 1 });
      }
    } catch (err) {
      pending = null;
      throw err;
    }
  })();
  return pending;
}
