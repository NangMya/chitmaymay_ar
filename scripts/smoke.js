/**
 * Phase 0/3 smoke: prove the game HTML is served, not Apache, and launch assets resolve.
 * Requires a static server (Live Server or `npm start`) at http://127.0.0.1:3000
 * or set SMOKE_URL, e.g. SMOKE_URL=http://127.0.0.1:5500 npm run smoke
 */
const BASE = process.env.SMOKE_URL || "http://127.0.0.1:3000";

async function get(pathname) {
  const url = `${BASE}${pathname}`;
  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    throw new Error(
      `Cannot reach ${url}. Open the game with Live Server or npm start, then retry.\n${err.message}`
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { url, res, buffer, text: buffer.toString("utf8") };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const html = await get("/");
  assert(html.res.ok, `${html.url} returned ${html.res.status}`);
  assert(
    !html.text.includes("Apache DocumentRoot"),
    `${html.url} is XAMPP Apache, not the game. Use http://127.0.0.1:3000/ (not :8080).`
  );
  assert(
    html.text.includes("Christmas Catch") || html.text.includes("Christmas Game"),
    `${html.url} is missing the game title`
  );
  assert(
    html.text.includes("mindar-face") || html.text.includes("data-mindar"),
    `${html.url} is missing the MindAR scene`
  );
  assert(
    html.text.includes("script.js"),
    `${html.url} is missing script.js — the game UI will be chrome-only`
  );
  assert(
    html.text.includes('id="cta-start"'),
    `${html.url} is missing the Start control`
  );
  assert(
    html.text.includes('data-mindar="autoStart: false"'),
    `${html.url} must not auto-start the camera`
  );
  assert(
    html.text.includes('id="end-card"'),
    `${html.url} is missing the end card`
  );
  assert(
    !html.text.includes("vendor/aframe.min.js\"></script>"),
    `${html.url} still loads A-Frame in <head> (must wait until Start)`
  );
  assert(
    !html.text.includes("fonts.googleapis.com"),
    `${html.url} still loads Google Fonts (blocked under COEP)`
  );
  assert(
    html.text.includes('id="camera-denied"'),
    `${html.url} is missing camera-denied UI`
  );
  assert(
    html.text.includes('id="mute-btn"'),
    `${html.url} is missing mute`
  );
  assert(
    html.text.includes('id="hud-timer"'),
    `${html.url} is missing the round timer`
  );
  assert(
    html.text.includes('id="campaign-ended"'),
    `${html.url} is missing the campaign-ended overlay`
  );
  assert(
    html.text.includes("src/assets/images/og.png"),
    `${html.url} is missing the static og:image`
  );
  assert(
    html.text.includes("src/assets/images/favicon.png"),
    `${html.url} is missing the favicon`
  );
  assert(
    html.text.includes('preload="none"'),
    `${html.url} should not preload audio before Start`
  );

  const js = await get("/script.js");
  assert(js.res.ok, `${js.url} returned ${js.res.status}`);
  assert(js.buffer.length > 100, `${js.url} is empty`);
  assert(
    js.text.includes("game-runtime") || js.text.includes("beginRound"),
    `${js.url} does not look like the game script`
  );
  assert(
    js.text.includes("mindar-face-aframe.prod.js"),
    `${js.url} must lazy-load MindAR from vendor/`
  );
  const ops = await get("/src/game/ops.js");
  assert(ops.res.ok, `${ops.url} returned ${ops.res.status}`);
  assert(
    ops.text.includes("session_start") || ops.text.includes("possible_crash"),
    `${ops.url} is missing live-ops session events`
  );

  const aframe = await get("/vendor/aframe.min.js");
  assert(aframe.res.ok, `${aframe.url} returned ${aframe.res.status}`);
  assert(aframe.buffer.length > 100000, `${aframe.url} is too small`);

  const mindar = await get("/vendor/mindar-face-aframe.prod.js");
  assert(mindar.res.ok, `${mindar.url} returned ${mindar.res.status}`);
  assert(mindar.buffer.length > 100000, `${mindar.url} is too small`);

  const css = await get("/style.css");
  assert(css.res.ok, `${css.url} returned ${css.res.status}`);

  const bag = await get("/src/assets/images/bag.webp");
  assert(bag.res.ok, `${bag.url} returned ${bag.res.status}`);
  assert(bag.buffer.length > 100, `${bag.url} is empty`);

  const og = await get("/src/assets/images/og.png");
  assert(og.res.ok, `${og.url} returned ${og.res.status}`);
  assert(og.buffer.length > 100, `${og.url} is empty`);

  const campaign = await get("/campaign.json");
  assert(campaign.res.ok, `${campaign.url} returned ${campaign.res.status}`);
  const campaignJson = JSON.parse(campaign.text);
  assert(
    typeof campaignJson.ended === "boolean",
    `${campaign.url} must include an ended flag`
  );
  assert(
    typeof campaignJson.buildId === "string",
    `${campaign.url} must include buildId for live ops`
  );
  assert(
    campaignJson.tweak && typeof campaignJson.tweak === "object",
    `${campaign.url} must include a tweak object (may be empty)`
  );

  console.log("Smoke passed");
  console.log(`  UI:    ${BASE}/`);
  console.log(`  Debug: ${BASE}/?debug=1`);
  console.log(`  Ended: ${BASE}/?ended=1`);
}

main().catch((err) => {
  console.error("Smoke failed");
  console.error(err.message);
  process.exit(1);
});
