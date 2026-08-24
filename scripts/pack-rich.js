/**
 * Zip only the files needed for rich-media upload (no .git, scripts, Play.bat).
 * Run: node scripts/pack-rich.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const staging = path.join(root, "rich-media-pack");
const zipPath = path.join(root, "christmas-rich-media.zip");

const files = ["index.html", "script.js", "style.css", "campaign.json"];
const dirs = ["src", "vendor"];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach((entry) => {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  });
}

function dirBytes(dir) {
  let total = 0;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirBytes(full);
    } else {
      total += fs.statSync(full).size;
    }
  });
  return total;
}

if (fs.existsSync(staging)) {
  fs.rmSync(staging, { recursive: true, force: true });
}
fs.mkdirSync(staging);

files.forEach((name) => {
  fs.copyFileSync(path.join(root, name), path.join(staging, name));
});
dirs.forEach((name) => {
  copyDir(path.join(root, name), path.join(staging, name));
});

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`zip -r "${zipPath}" .`, { cwd: staging, stdio: "inherit" });
}

const unpacked = dirBytes(staging);
const zipped = fs.statSync(zipPath).size;
const limit = 8 * 1024 * 1024;

console.log("");
console.log("Rich media pack ready");
console.log("  Folder: " + staging);
console.log("  Zip:    " + zipPath);
console.log("  Unpacked: " + (unpacked / (1024 * 1024)).toFixed(2) + " MB");
console.log("  Zip size: " + (zipped / (1024 * 1024)).toFixed(2) + " MB");
console.log(unpacked <= limit ? "  Under 8 MB unpacked: yes" : "  Under 8 MB unpacked: NO");
console.log("");
console.log("Upload the zip. Entry file: index.html");
console.log("Do not include .git, Play.bat, scripts, or package.json.");
