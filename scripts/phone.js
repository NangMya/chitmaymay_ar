/**
 * Phone camera needs HTTPS. This starts the game server (if needed) and a
 * Cloudflare quick tunnel so other devices can open an https:// link.
 */
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { spawn, exec } = require("child_process");

const PORT = Number(process.env.PORT) || 3000;
const BIN = path.join(__dirname, "..", "tools", "cloudflared.exe");
const DOWNLOAD =
  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

const children = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serverUp() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    if (await serverUp()) {
      return;
    }
    await sleep(250);
  }
  throw new Error("Game server did not start on port " + PORT);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(command + " exited " + code));
      }
    });
  });
}

async function download(url, dest) {
  const tmp = dest + ".part";
  try {
    await run("curl.exe", ["-L", "--fail", "--retry", "3", "-o", tmp, url]);
    fs.renameSync(tmp, dest);
    return;
  } catch (_err) {
    fs.unlink(tmp, () => {});
  }
  await downloadNode(url, dest);
}

function downloadNode(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part";
    const file = fs.createWriteStream(tmp);
    let settled = false;
    const fail = (err) => {
      if (settled) {
        return;
      }
      settled = true;
      file.close();
      fs.unlink(tmp, () => {});
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error("Download timed out")), 120000);
    const get = (u) => {
      https
        .get(u, { headers: { "User-Agent": "christmas-ar-phone" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            get(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            fail(new Error("Download failed: HTTP " + res.statusCode));
            return;
          }
          res.pipe(file);
          file.on("finish", () => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            file.close(() => {
              fs.renameSync(tmp, dest);
              resolve();
            });
          });
        })
        .on("error", fail);
    };
    get(url);
  });
}

async function ensureCloudflared() {
  if (fs.existsSync(BIN) && fs.statSync(BIN).size > 20000000) {
    return BIN;
  }
  fs.mkdirSync(path.dirname(BIN), { recursive: true });
  console.log("Downloading Cloudflare tunnel (one-time, for phone HTTPS)...");
  await download(DOWNLOAD, BIN);
  return BIN;
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".woff2": "font/woff2",
    }[ext] || "application/octet-stream"
  );
}

function startStaticServer() {
  const root = path.resolve(__dirname, "..");
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || "/").split("?")[0] || "/");
    const rel = (raw === "/" ? "index.html" : raw).replace(/^[/\\]+/, "");
    let file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime(file) });
      res.end(data);
    });
  });
  server.listen(PORT, "0.0.0.0");
  children.push(server);
  return server;
}

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? `cmd /c start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

function startTunnel(bin) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["tunnel", "--url", `http://127.0.0.1:${PORT}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    let settled = false;
    const onData = (buf) => {
      const text = String(buf);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !settled) {
        settled = true;
        resolve({ url: match[0], child });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error("HTTPS tunnel exited (code " + code + ")"));
      }
    });
  });
}

function shutdown() {
  children.forEach((child) => {
    try {
      if (typeof child.kill === "function") {
        child.kill();
      } else if (typeof child.close === "function") {
        child.close();
      }
    } catch (_err) {
      /* ignore */
    }
  });
}

async function main() {
  process.on("SIGINT", () => {
    shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    shutdown();
    process.exit(0);
  });

  const localOnly = process.argv.indexOf("--local") !== -1;
  const shouldOpen = localOnly || process.argv.indexOf("--open") !== -1;

  if (!(await serverUp())) {
    console.log("Starting the game server...");
    startStaticServer();
    await waitForServer();
  } else {
    console.log("Game server already running on port " + PORT + ".");
  }

  const page = "http://127.0.0.1:" + PORT + "/";
  if (shouldOpen) {
    openBrowser(page);
  }

  if (localOnly) {
    console.log("");
    console.log("  This PC:     " + page);
    console.log("  Phone HTTPS: npm run phone");
    console.log("");
    return;
  }

  const bin = await ensureCloudflared();
  console.log("Opening an HTTPS tunnel for phones...");
  const tunnel = await startTunnel(bin);

  console.log("");
  console.log("  This PC:     http://127.0.0.1:" + PORT + "/");
  console.log("  Phone:       " + tunnel.url + "/");
  console.log("");
  console.log("  Open the Phone URL on the other device (padlock / https).");
  console.log("  Do not use the http://192.168... address — the camera stays blocked.");
  console.log("");
}

main().catch((err) => {
  console.error(err.message || err);
  shutdown();
  process.exit(1);
});
