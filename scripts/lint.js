#!/usr/bin/env node
/**
 * Zero-dependency Farmwork self-lint gate:
 * 1. Syntax-checks every JS file in bin/, src/, test/, and scripts/ via `node --check`.
 * 2. Dogfoods Farmwork's own code-quality & state-machine hygiene scanner (enforcing <=700 lines/file,
 *    zero implicit state-machine hotspots, and zero stray debugger statements).
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { runCodeQualityScan } from "../src/core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function collectJs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJs(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = [
  ...collectJs(path.join(root, "bin")),
  ...collectJs(path.join(root, "src")),
  ...collectJs(path.join(root, "test")),
  ...collectJs(path.join(root, "scripts")),
];

let failed = false;
for (const file of files) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    console.error(`Syntax error in ${path.relative(root, file)}:\n${res.stderr}`);
    failed = true;
  }
}

const scan = runCodeQualityScan(root, { maxFileLines: 700, skipDeadCode: true });
for (const f of scan.oversizedFiles) {
  console.error(`Oversized file: ${f.file} (${f.lines} lines > ${f.limit})`);
  failed = true;
}
for (const h of scan.stateMachineHotspots) {
  console.error(`State machine hotspot [${h.severity}]: ${h.file} — ${h.detail}`);
  failed = true;
}
for (const d of scan.debugNoise) {
  console.error(`Debug noise: ${d.file}:${d.line} (${d.type})`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log(`Lint passed: ${files.length} JS files syntax-checked, ${scan.sourceFilesScanned} source files clean (0 oversized, 0 state hotspots, 0 debug breakpoints).`);
