const fs = require("fs");
const path = require("path");
const { root } = require("./lib/fs-utils");

const targets = [
  path.join(root, "package.json"),
  path.join(root, "src", "static", "manifest.json"),
];

/**
 * Bump patch with base-10 rollover per segment (0–9):
 * 1.0.8 → 1.0.9 → 1.1.0 → … → 1.9.9 → 2.0.0
 */
function bumpPatch(version) {
  const parts = String(version).split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  let [major, minor, patch] = parts;
  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }

  return [major, minor, patch].join(".");
}

function setVersion(filePath, version) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${path.relative(root, filePath)}`);
    process.exit(1);
  }
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  json.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

const pkgPath = targets[0];
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const previous = pkg.version || "0.0.0";
const next = bumpPatch(previous);

for (const filePath of targets) {
  setVersion(filePath, next);
}

const lockPath = path.join(root, "package-lock.json");
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.version = next;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = next;
  }
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

console.log(`Version bumped ${previous} → ${next}`);
