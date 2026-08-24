const DEFAULTS = {
  ended: false,
  endedTitle: "",
  endedBody: "",
  leadFormUrl: "",
  locale: "en",
  buildId: "",
  tweak: {},
  copy: {},
};

function queryEnded() {
  return /(?:^|[?&])ended=1(?:&|$)/.test(window.location.search);
}

async function loadCampaign() {
  if (queryEnded()) {
    return Object.assign({}, DEFAULTS, { ended: true });
  }
  try {
    const res = await fetch("./campaign.json", { cache: "no-store" });
    if (!res.ok) {
      return Object.assign({}, DEFAULTS);
    }
    const data = await res.json();
    return Object.assign({}, DEFAULTS, data, {
      ended: !!(data && data.ended),
      leadFormUrl: data && data.leadFormUrl ? String(data.leadFormUrl) : "",
      buildId: data && data.buildId ? String(data.buildId) : "",
      tweak: data && data.tweak && typeof data.tweak === "object" ? data.tweak : {},
      copy: data && data.copy && typeof data.copy === "object" ? data.copy : {},
    });
  } catch (err) {
    return Object.assign({}, DEFAULTS);
  }
}
