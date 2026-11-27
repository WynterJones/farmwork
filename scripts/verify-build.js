#!/usr/bin/env node
/**
 * Zero-dependency release verification script for Farmwork CLI.
 * Ensures package.json, VERSION, bundled WebP assets, and CLI bin entrypoint stay in sync.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { VERSION } from "../src/core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

if (pkg.version !== VERSION) {
  console.error(`Version mismatch: package.json (${pkg.version}) !== src/core/shared.js (${VERSION})`);
  process.exit(1);
}

const requiredAssets = [
  "logo.webp",
  "favicon-32x32.webp",
  "audit-farmhouse.webp",
  "audit-garden.webp",
  "audit-compost.webp",
  "audit-tests.webp",
  "audit-security.webp",
  "audit-performance.webp",
  "audit-accessibility.webp",
  "audit-code-quality.webp",
  "main-bg.webp",
];

for (const asset of requiredAssets) {
  const full = path.join(root, "assets", asset);
  if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
    console.error(`Missing or empty asset: assets/${asset}`);
    process.exit(1);
  }
}

const binRes = spawnSync(process.execPath, [path.join(root, "bin", "farmwork.js"), "--version"], { encoding: "utf8" });
if (binRes.status !== 0 || binRes.stdout.trim() !== VERSION) {
  console.error(`CLI --version failed: exit=${binRes.status}, stdout="${binRes.stdout.trim()}"`);
  process.exit(1);
}

console.log(`Build verification passed: farmwork v${VERSION}, ${requiredAssets.length} assets verified, CLI entrypoint healthy.`);
