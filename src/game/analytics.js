function track(name, props) {
  const payload = Object.assign(
    { event: name, ts: Date.now() },
    props || {}
  );
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === "function") {
    window.gtag("event", name, props || {});
  }
  if (typeof window.dkmads === "function") {
    window.dkmads("event", name, props || {});
  }
  if (/debug=1/.test(window.location.search)) {
    console.info("[analytics]", payload);
  }
}

function inAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FBIOS|Line\/|Twitter/i.test(ua);
}

function safariOpenHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  return isIOS
    ? "Open in Safari: tap the ··· menu, then Open in Safari."
    : "Open in Chrome: tap the menu, then Open in browser.";
}
