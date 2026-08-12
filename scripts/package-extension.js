const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const { name, version } = require(path.join(root, "package.json"));
const zipName = `${name}-${version}.zip`;
const zipPath = path.join(root, zipName);

if (!fs.existsSync(dist) || !fs.existsSync(path.join(dist, "manifest.json"))) {
  console.error("Missing dist/manifest.json. Run the production build first.");
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${dist.replace(
      /'/g,
      "''"
    )}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`zip -r "${zipPath}" .`, { cwd: dist, stdio: "inherit" });
}

console.log(`Created ${zipName}`);
