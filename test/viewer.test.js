import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";

import { initProject, scanFarms } from "../src/core.js";
import { createViewerServer } from "../src/viewer.js";

function makeTempDir(prefix = "fw-view-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("Local Farm Viewer enforces security headers, CSRF Origin checks, accessibility landmarks, and full API", async () => {
  const workspace = makeTempDir();
  const appA = path.join(workspace, "alpha-app");
  const appB = path.join(workspace, "beta-app");
  fs.ensureDirSync(appA);
  fs.ensureDirSync(appB);
  initProject(appA, { projectName: "Alpha App" });
  initProject(appB, { projectName: "Beta App" });

  assert.equal(scanFarms(workspace).farms.length, 2);

  const server = createViewerServer(workspace);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  // HTML shell: security headers + WCAG accessibility landmarks
  const htmlRes = await fetch(`${base}/`);
  assert.equal(htmlRes.status, 200);
  assert.equal(htmlRes.headers.get("x-frame-options"), "DENY");
  assert.equal(htmlRes.headers.get("x-content-type-options"), "nosniff");
  assert.equal(htmlRes.headers.get("referrer-policy"), "no-referrer");
  assert.ok(htmlRes.headers.get("content-security-policy")?.includes("default-src 'self'"));

  const html = await htmlRes.text();
  assert.ok(html.includes("Local Farm Viewer"));
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes("prefers-reduced-motion"));

  // Portfolio API uses lightweight docCount
  const listRes = await fetch(`${base}/api/farms`);
  const listData = await listRes.json();
  assert.equal(listData.farms.length, 2);
  assert.ok(listData.farms[0].docCount >= 4);

  // Path traversal & symlink escape protection
  const forbidden = await fetch(`${base}/api/farm?path=/etc`);
  assert.equal(forbidden.status, 403);
  const escapeLink = path.join(workspace, "escape-link");
  fs.symlinkSync("/etc", escapeLink);
  const symlinkBlocked = await fetch(`${base}/api/farm?path=${encodeURIComponent(escapeLink)}`);
  assert.equal(symlinkBlocked.status, 403);

  // CSRF Origin protection rejects cross-origin POSTs
  const csrfBlocked = await fetch(`${base}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ path: appA }),
  });
  assert.equal(csrfBlocked.status, 403);

  // Localhost Origin is allowed
  const toggleRes = await fetch(`${base}/api/checklist/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ path: appA, id: 2, state: "complete" }),
  });
  assert.equal(toggleRes.status, 200);
  assert.equal((await toggleRes.json()).checklist.items[1].state, "complete");

  // Gates + Code Quality scan APIs
  const gatesRes = await fetch(`${base}/api/gates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA }),
  });
  assert.equal(gatesRes.status, 200);
  assert.equal((await gatesRes.json()).allPassed, true);

  const qualityRes = await fetch(`${base}/api/code-quality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA }),
  });
  assert.equal(qualityRes.status, 200);
  assert.equal((await qualityRes.json()).clean, true);

  // Cached FarmFactory visual assets served safely
  const logoRes = await fetch(`${base}/assets/logo.webp`);
  assert.equal(logoRes.status, 200);
  assert.equal(logoRes.headers.get("content-type"), "image/webp");
  assert.equal((await fetch(`${base}/assets/secret.txt`)).status, 404);

  // Plan create + complete
  const createPlanRes = await fetch(`${base}/api/plan/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA, title: "Viewer Plan", summary: "Created from UI" }),
  });
  assert.equal(createPlanRes.status, 200);
  assert.equal((await createPlanRes.json()).plans.length, 1);

  const completePlanRes = await fetch(`${base}/api/plan/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: appA, plan: "VIEWER_PLAN" }),
  });
  assert.equal(completePlanRes.status, 200);
  assert.equal((await completePlanRes.json()).plans[0].completed, true);

  // Live SSE endpoint
  const controller = new AbortController();
  const sseRes = await fetch(`${base}/api/events`, { signal: controller.signal });
  assert.equal(sseRes.status, 200);
  assert.ok(sseRes.headers.get("content-type").includes("text/event-stream"));
  controller.abort();

  server.close();
  fs.removeSync(workspace);
});
