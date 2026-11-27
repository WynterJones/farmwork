import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import { VERSION, initProject } from "../src/core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, "..", "bin", "farmwork.js");

function makeTempDir(prefix = "fw-mcp-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("MCP server speaks valid JSON-RPC over stdio with 8 tools and zero stdout banner pollution", async () => {
  const dir = makeTempDir();
  initProject(dir, { projectName: "mcp-demo" });

  const child = spawn(process.execPath, [BIN_PATH, "mcp", "--cwd", dir], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const responses = [];
  let buffer = "";

  const waitForId = (id) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for id=${id}`)), 5000);
      const check = () => {
        const found = responses.find((r) => r.id === id);
        if (found) {
          clearTimeout(timeout);
          resolve(found);
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      responses.push(JSON.parse(line));
    }
  });

  const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  const initResp = await waitForId(1);
  assert.equal(initResp.result.serverInfo.name, "farmwork");
  assert.equal(initResp.result.serverInfo.version, VERSION);

  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const toolsResp = await waitForId(2);
  const toolNames = toolsResp.result.tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, [
    "farmwork_audit",
    "farmwork_beads",
    "farmwork_checklist",
    "farmwork_garden",
    "farmwork_gates",
    "farmwork_just",
    "farmwork_plan",
    "farmwork_status",
  ]);

  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "farmwork_status", arguments: {} } });
  const parsed = JSON.parse((await waitForId(3)).result.content[0].text);
  assert.equal(parsed.projectName, "mcp-demo");
  assert.ok(parsed.score > 0);

  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "farmwork_garden", arguments: { action: "plant", title: "Unified Garden Tool" } },
  });
  assert.equal(JSON.parse((await waitForId(4)).result.content[0].text).added, true);

  send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "farmwork_plan",
      arguments: { action: "create", title: "Unified Plan Tool", fromIdea: "Unified Garden Tool" },
    },
  });
  assert.equal(JSON.parse((await waitForId(5)).result.content[0].text).graduated, true);

  // Security scan via farmwork_audit
  send({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "farmwork_audit", arguments: { pillar: "security" } },
  });
  assert.equal(JSON.parse((await waitForId(6)).result.content[0].text).passed, true);

  // Code quality & state-machine scan via farmwork_audit (no new MCP tool needed)
  send({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "farmwork_audit", arguments: { pillar: "code-quality" } },
  });
  const cq = JSON.parse((await waitForId(7)).result.content[0].text);
  assert.equal(cq.clean, true);
  assert.ok(typeof cq.stateRecommendation === "string" && cq.stateRecommendation.length > 0);

  // Lazy pillar report persistence
  send({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "farmwork_audit",
      arguments: {
        pillar: "performance",
        score: 8.6,
        status: "Fast",
        summary: "Bundle and queries look lean.",
        findings: [{ severity: "LOW", title: "Lazy-load chart module", location: "src/App.jsx:12" }],
      },
    },
  });
  const perfSaved = JSON.parse((await waitForId(8)).result.content[0].text);
  assert.equal(perfSaved.saved.path, "_AUDIT/PERFORMANCE.md");
  assert.equal(perfSaved.saved.score, 8.6);

  child.kill();
  fs.removeSync(dir);
});
