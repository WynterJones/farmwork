import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { execSync } from "child_process";

import {
  initProject,
  detectJustfile,
  runJustRecipe,
  getBeadsState,
  runBeadsAction,
  isJustAvailable,
  isBeadsAvailable,
} from "../src/core.js";
import { createViewerServer } from "../src/viewer.js";

function makeTempDir(prefix = "fw-bj-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("Justfile and Beads (bd) integrate end-to-end across core, init, and Local Viewer", async () => {
  const dir = makeTempDir();
  execSync("git init -q", { cwd: dir });
  fs.writeJsonSync(path.join(dir, "package.json"), {
    name: "homestead-app",
    scripts: {
      test: "node -e \"console.log('just-test-ok')\"",
      lint: "node -e \"console.log('just-lint-ok')\"",
    },
  });

  const initRes = initProject(dir);
  assert.equal(initRes.blocked, false);
  assert.ok(fs.existsSync(path.join(dir, "justfile")));

  const justInfo = detectJustfile(dir);
  assert.equal(justInfo.exists, true);
  const recipeNames = justInfo.recipes.map((r) => r.name);
  assert.ok(recipeNames.includes("help"));
  assert.ok(recipeNames.includes("test"));
  assert.ok(recipeNames.includes("lint"));
  assert.ok(recipeNames.includes("check"));
  assert.ok(recipeNames.includes("ready"));

  // Shell injection rejection
  assert.throws(() => runJustRecipe(dir, "test; rm -rf /"), /Invalid just recipe/);

  if (isJustAvailable()) {
    const runRes = runJustRecipe(dir, "test");
    assert.equal(runRes.passed, true);
    assert.ok(runRes.output.includes("just-test-ok"));
  }

  if (isBeadsAvailable()) {
    assert.ok(fs.existsSync(path.join(dir, ".beads")));
    const created = runBeadsAction(dir, {
      action: "create",
      title: "Ship Beads and Justfile integration",
      type: "feature",
      priority: 1,
    });
    assert.equal(created.created, true);
    assert.ok(created.issue.id);

    const state = getBeadsState(dir, { includeIssues: true });
    assert.equal(state.initialized, true);
    assert.equal(state.summary.ready, 1);

    const claimed = runBeadsAction(dir, { action: "claim", id: created.issue.id });
    assert.equal(claimed.updated, true);

    const closed = runBeadsAction(dir, { action: "close", id: created.issue.id, reason: "Verified in tests" });
    assert.equal(closed.closed, true);

    const afterClose = getBeadsState(dir, { includeIssues: false });
    assert.equal(afterClose.summary.closed, 1);
    assert.equal(afterClose.summary.ready, 0);
  }

  const server = createViewerServer(dir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const detailRes = await fetch(`${base}/api/farm?path=${encodeURIComponent(dir)}`);
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.justfile.exists, true);
  assert.ok(detail.justfile.recipes.length >= 8);

  if (isJustAvailable()) {
    const justRunRes = await fetch(`${base}/api/just/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir, recipe: "lint" }),
    });
    assert.equal(justRunRes.status, 200);
    const justJson = await justRunRes.json();
    assert.equal(justJson.passed, true);
    assert.ok(justJson.output.includes("just-lint-ok"));
  }

  if (isBeadsAvailable()) {
    const createBeadRes = await fetch(`${base}/api/beads/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir, title: "Viewer created bead", type: "task", priority: 2 }),
    });
    assert.equal(createBeadRes.status, 200);
    const afterCreate = await createBeadRes.json();
    assert.equal(afterCreate.beads.summary.ready, 1);
  }

  server.close();
  fs.removeSync(dir);
});
