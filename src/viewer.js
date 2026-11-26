import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import {
  VERSION,
  LegacyFarmworkError,
  resolveProjectPath,
  scanFarms,
  computeHealth,
  parseChecklist,
  parseGarden,
  parseCompost,
  listPlans,
  readFarmDocs,
  runAudit,
  runGates,
  runSecurityScan,
  setChecklistItem,
  addChecklistItem,
  plantIdea,
  compostIdea,
  createPlan,
  completePlan,
  detectJustfile,
  initJustfile,
  runJustRecipe,
  getBeadsState,
  initBeads,
  runBeadsAction,
} from "./core.js";
import { farmTerm } from "./terminal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "..", "assets");
const ALLOWED_ASSETS = new Set([
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
]);

function isWithinRoot(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 512) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getFarmDetail(farmDir) {
  return {
    health: computeHealth(farmDir),
    checklist: parseChecklist(farmDir),
    garden: parseGarden(farmDir),
    compost: parseCompost(farmDir),
    plans: listPlans(farmDir),
    beads: getBeadsState(farmDir, { includeIssues: true }),
    justfile: detectJustfile(farmDir),
    docs: readFarmDocs(farmDir),
  };
}

export function createViewerServer(rootDir) {
  const resolvedRoot = resolveProjectPath(rootDir);
  const sseClients = new Set();
  const watchers = new Map();
  let debounceTimer = null;

  const broadcastChange = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const payload = `event: change\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
      for (const client of sseClients) {
        try {
          client.write(payload);
        } catch {
          sseClients.delete(client);
        }
      }
    }, 150);
  };

  const watchDirSafe = (dirPath) => {
    if (watchers.has(dirPath) || !fs.existsSync(dirPath)) return;
    try {
      const w = fs.watch(dirPath, { persistent: false }, () => broadcastChange());
      w.on("error", () => {
        w.close();
        watchers.delete(dirPath);
      });
      watchers.set(dirPath, w);
    } catch {
      // ignore unwatched directories
    }
  };

  const syncWatchers = () => {
    const { farms } = scanFarms(resolvedRoot);
    for (const farm of farms) {
      watchDirSafe(farm.path);
      watchDirSafe(path.join(farm.path, "_AUDIT"));
      watchDirSafe(path.join(farm.path, "_PLANS"));
      watchDirSafe(path.join(farm.path, ".beads"));
    }
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(VIEWER_HTML);
        return;
      }

      if (req.method === "GET" && pathname === "/api/events") {
        syncWatchers();
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        sseClients.add(res);
        req.on("close", () => {
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/assets/")) {
        const fileName = path.basename(pathname.slice("/assets/".length));
        if (!ALLOWED_ASSETS.has(fileName)) {
          sendJson(res, 404, { error: "Asset not found" });
          return;
        }
        const assetPath = path.join(ASSETS_DIR, fileName);
        if (!fs.existsSync(assetPath)) {
          sendJson(res, 404, { error: "Asset missing" });
          return;
        }
        res.writeHead(200, {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=3600",
        });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }

      if (req.method === "GET" && pathname === "/api/farms") {
        const scanned = scanFarms(resolvedRoot);
        const enriched = scanned.farms.map((farm) => ({
          ...farm,
          docCount: readFarmDocs(farm.path).length,
        }));
        sendJson(res, 200, { version: VERSION, root: scanned.root, farms: enriched });
        return;
      }

      if (req.method === "GET" && pathname === "/api/farm") {
        const requested = url.searchParams.get("path") || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, requested)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        sendJson(res, 200, getFarmDetail(requested));
        return;
      }

      if (req.method === "POST" && pathname === "/api/gates") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        sendJson(res, 200, runGates(target, { only: body.only }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/security") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        sendJson(res, 200, runSecurityScan(target, { skipDeps: Boolean(body.skipDeps) }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/audit") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        runAudit(target);
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/checklist/toggle") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        setChecklistItem(target, { target: body.id, state: body.state });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/checklist/add") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        addChecklistItem(target, { group: body.group || "Project Standards", title: body.title });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/garden/plant") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        plantIdea(target, { title: body.title, description: body.description || "" });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/garden/compost") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        compostIdea(target, { title: body.title, reason: body.reason || "Retired from Local Viewer" });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/plan/create") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        createPlan(target, {
          title: body.title,
          summary: body.summary || "",
          fromIdea: body.fromIdea || null,
        });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/plan/complete") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        completePlan(target, body.plan);
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/beads/init") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        initBeads(target, { prefix: body.prefix });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/beads/create") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        runBeadsAction(target, {
          action: "create",
          title: body.title,
          type: body.type || "task",
          priority: body.priority ?? 2,
          description: body.description || "",
        });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/beads/update") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        runBeadsAction(target, { action: "update", id: body.id, status: body.status });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/beads/close") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        runBeadsAction(target, { action: "close", id: body.id, reason: body.reason || "Completed from Local Viewer" });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/beads/sync") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        const synced = runBeadsAction(target, { action: "sync" });
        sendJson(res, 200, { ...synced, detail: getFarmDetail(target) });
        return;
      }

      if (req.method === "POST" && pathname === "/api/just/init") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        initJustfile(target, { force: Boolean(body.force) });
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname === "/api/just/run") {
        const body = await readBody(req);
        const target = body.path || resolvedRoot;
        if (!isWithinRoot(resolvedRoot, target)) {
          sendJson(res, 403, { error: "Path outside viewer root" });
          return;
        }
        sendJson(res, 200, runJustRecipe(target, body.recipe, { args: body.args }));
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const statusCode = err instanceof LegacyFarmworkError ? 409 : 400;
      sendJson(res, statusCode, {
        error: err instanceof Error ? err.message : String(err),
        code: err instanceof LegacyFarmworkError ? err.code : undefined,
      });
    }
  });

  server.on("close", () => {
    clearTimeout(debounceTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.clear();
    for (const w of watchers.values()) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }
    watchers.clear();
  });

  return server;
}

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function listenWithFallback(server, startPort, host, maxAttempts = 20) {
  let port = startPort;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      return port;
    } catch (err) {
      if (err && err.code === "EADDRINUSE" && attempt < maxAttempts - 1) {
        port += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`No available port found starting at ${startPort}`);
}

export async function startViewer(targetPath = ".", options = {}) {
  const rootDir = resolveProjectPath(targetPath);
  const requestedPort = Number(options.port) || 4174;
  const host = "127.0.0.1";

  const server = createViewerServer(rootDir);
  const boundPort = await listenWithFallback(server, requestedPort, host);

  const url = `http://${host}:${boundPort}`;
  const scanned = scanFarms(rootDir);

  farmTerm.banner(VERSION);
  farmTerm.header("LOCAL FARM VIEWER");
  if (boundPort !== requestedPort) {
    farmTerm.warn(`Port ${requestedPort} was busy — switched automatically to ${boundPort}`);
  }
  farmTerm.kv("URL", url);
  farmTerm.kv("Watching Folder", rootDir);
  farmTerm.kv("Farms Found", String(scanned.farms.length));
  farmTerm.dim("\nReads & writes your local .md files directly on disk. Press Ctrl+C to stop.\n");

  if (options.open !== false) {
    openBrowser(url);
  }

  return { server, url, port: boundPort };
}

/* ============================================================================
   Self-Contained Local Farm Viewer UI — FarmFactory Design System
   (Crust / Latte / Honey / Sage / Clay · Fira Code + Inter · Frosted Glass)
   ============================================================================ */

const VIEWER_HTML = `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Farmwork — Local Farm Viewer</title>
  <link rel="icon" type="image/webp" sizes="32x32" href="/assets/favicon-32x32.webp" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --font-mono: "Fira Code", ui-monospace, "SF Mono", Monaco, Consolas, monospace;
      --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;

      /* Crust - Neutral black and charcoal surfaces */
      --crust-50: #232328;
      --crust-100: #1b1b20;
      --crust-200: #151519;
      --crust-300: #111114;
      --crust-400: #0d0d10;
      --crust-500: #09090b;

      /* Latte - Neutral cool-gray text */
      --latte-50: #f5f5f6;
      --latte-100: #e4e4e7;
      --latte-200: #c7c7ce;
      --latte-300: #a1a1aa;
      --latte-400: #85858f;
      --latte-500: #696973;
      --latte-600: #4f4f58;

      /* Honey - Warm amber gold */
      --honey-50: #f5e2aa;
      --honey-100: #edd28e;
      --honey-200: #e5c46e;
      --honey-300: #dab240;
      --honey-400: #c49e35;
      --honey-500: #a8892c;

      /* Sage - Muted olive/earthy green */
      --sage-50: #b8c7a6;
      --sage-100: #a2b590;
      --sage-200: #8ca37a;
      --sage-300: #769166;
      --sage-400: #627e54;
      --sage-500: #506a44;

      /* Clay - Terracotta earth */
      --clay-50: #d8ae9e;
      --clay-100: #cc9686;
      --clay-200: #c07e6e;
      --clay-300: #b46656;
      --clay-400: #a05042;
      --clay-500: #884436;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html {
      color-scheme: dark;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      scrollbar-gutter: stable;
    }

    body {
      margin: 0;
      min-block-size: 100dvb;
      font-family: var(--font-sans);
      color: var(--latte-200);
      background: linear-gradient(160deg, #111114 0%, #09090b 48%, #151519 100%);
      background-attachment: fixed;
      overflow-x: hidden;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      opacity: 0.03;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-repeat: repeat;
      pointer-events: none;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--latte-50);
      letter-spacing: -0.01em;
      margin: 0;
    }

    a { color: inherit; text-decoration: none; }

    * {
      scrollbar-width: thin;
      scrollbar-color: #4f4f58 #151519;
    }
    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-track { background: var(--crust-200); }
    *::-webkit-scrollbar-thumb { background: var(--latte-600); border-radius: 999px; border: 2px solid #151519; }
    *::-webkit-scrollbar-thumb:hover { background: var(--latte-500); }

    /* ── App Shell (FarmFactory Sidebar + Main) ──────────── */

    .app-shell {
      display: flex;
      min-block-size: 100dvb;
    }

    .glass-sidebar {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: 40;
      inline-size: 256px;
      display: flex;
      flex-direction: column;
      border-inline-end: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(20, 20, 24, 0.85);
      backdrop-filter: blur(20px) saturate(1.5);
      -webkit-backdrop-filter: blur(20px) saturate(1.5);
      overflow-y: auto;
      transition: transform 0.25s ease;
    }

    .sidebar-logo {
      padding: 1.25rem 1.25rem;
      border-block-end: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .sidebar-logo img {
      inline-size: 100%;
      max-inline-size: 196px;
      block-size: auto;
      display: block;
    }

    .sidebar-nav {
      padding: 0.75rem;
      display: grid;
      gap: 0.15rem;
    }

    .nav-link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      inline-size: 100%;
      padding: 0.52rem 0.75rem;
      border: 0;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--latte-400);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: start;
      transition: background 150ms ease, color 150ms ease;
    }
    .nav-link:hover { background: rgba(255, 255, 255, 0.06); color: var(--latte-200); }
    .nav-link.active {
      color: var(--honey-200);
      background: rgba(218, 178, 64, 0.08);
    }
    .nav-link.active::before {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 50%;
      inline-size: 2px;
      block-size: 20px;
      transform: translateY(-50%);
      border-radius: 999px;
      background: linear-gradient(180deg, #dab240, #c49e35);
    }
    .nav-link svg { inline-size: 16px; block-size: 16px; flex: none; }

    .sidebar-section-label {
      padding: 0.9rem 1rem 0.35rem;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--latte-600);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sidebar-farms {
      flex: 1;
      padding: 0 0.75rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .sidebar-farm-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      inline-size: 100%;
      padding: 0.45rem 0.7rem;
      border: 0;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--latte-400);
      font-family: var(--font-mono);
      font-size: 12px;
      cursor: pointer;
      text-align: start;
      transition: background 150ms ease, color 150ms ease;
    }
    .sidebar-farm-btn:hover { background: rgba(255, 255, 255, 0.05); color: var(--latte-100); }
    .sidebar-farm-btn.active {
      color: var(--honey-200);
      background: rgba(218, 178, 64, 0.08);
    }
    .sidebar-farm-btn.active::before {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 50%;
      inline-size: 2px;
      block-size: 16px;
      transform: translateY(-50%);
      border-radius: 999px;
      background: linear-gradient(180deg, #dab240, #c49e35);
    }
    .sidebar-farm-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidebar-dot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 999px;
      flex: none;
    }
    .sidebar-dot.green { background: var(--sage-300); }
    .sidebar-dot.orange { background: var(--honey-300); }
    .sidebar-dot.amber { background: #e0b88a; }
    .sidebar-dot.red { background: var(--clay-300); }

    .sidebar-footer {
      border-block-start: 1px solid rgba(255, 255, 255, 0.06);
      padding: 0.75rem 1rem;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--latte-500);
    }
    .sidebar-root-path {
      color: var(--latte-400);
      word-break: break-all;
      line-height: 1.4;
      margin-block-start: 0.2rem;
    }

    .main-wrap {
      flex: 1;
      padding-inline-start: 256px;
      min-inline-size: 0;
    }

    .main-inner {
      padding: 2.25rem 2.5rem 4rem;
      max-inline-size: 1220px;
      position: relative;
      z-index: 1;
    }

    .mobile-menu-btn {
      display: none;
      position: fixed;
      inset-block-start: 1rem;
      inset-inline-start: 1rem;
      z-index: 50;
      inline-size: 40px;
      block-size: 40px;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(28, 28, 33, 0.85);
      backdrop-filter: blur(16px);
      color: var(--latte-200);
      cursor: pointer;
    }
    .mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
    }

    @media (max-width: 960px) {
      .glass-sidebar { transform: translateX(-100%); }
      .glass-sidebar.open { transform: translateX(0); }
      .mobile-menu-btn { display: inline-flex; }
      .mobile-overlay.open { display: block; }
      .main-wrap { padding-inline-start: 0; }
      .main-inner { padding: 4.5rem 1.25rem 3.5rem; }
    }

    /* ── Glass Surfaces & Cards ──────────────────────────── */

    .surface {
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(28, 28, 33, 0.65);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.5),
                  inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
    }

    .card-hover {
      transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, background 200ms ease;
    }
    .card-hover:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.5),
                  0 0 20px -4px rgba(218, 178, 64, 0.08);
    }

    /* ── Buttons (Exact FarmFactory) ─────────────────────── */

    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      border-radius: 0.375rem;
      padding: 0.5rem 0.95rem;
      font-family: var(--font-mono);
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 150ms ease;
      white-space: nowrap;
    }
    .btn svg { inline-size: 14px; block-size: 14px; flex: none; }
    .btn:disabled { opacity: 0.42; cursor: not-allowed; pointer-events: none; }

    .btn-primary {
      color: var(--crust-400);
      border: 1px solid rgba(196, 158, 53, 0.6);
      background: linear-gradient(135deg, #dab240, #c49e35);
      box-shadow: 0 2px 12px -2px rgba(218, 178, 64, 0.25);
    }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-primary:active { filter: brightness(0.95); }

    .btn-secondary {
      color: var(--latte-100);
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(28, 28, 33, 0.7);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
      color: var(--latte-50);
    }

    .btn-ghost {
      color: var(--latte-300);
      border: 1px solid transparent;
      background: transparent;
    }
    .btn-ghost:hover { background: rgba(255, 255, 255, 0.06); color: var(--latte-100); }

    .btn-sm { padding: 0.38rem 0.75rem; font-size: 0.75rem; }

    .farm-info-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.38rem;
      padding: 0.35rem 0.75rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      color: var(--latte-400);
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 1px 3px rgba(0, 0, 0, 0.3);
      transition: all 150ms ease;
    }
    .farm-info-btn:hover {
      color: var(--latte-100);
      background: rgba(255, 255, 255, 0.065);
      border-color: rgba(255, 255, 255, 0.14);
    }
    .farm-info-btn.gold {
      background: rgba(196, 158, 53, 0.15);
      color: var(--honey-300);
      border-color: rgba(196, 158, 53, 0.22);
    }
    .farm-info-btn.gold:hover {
      background: rgba(196, 158, 53, 0.25);
      border-color: rgba(196, 158, 53, 0.35);
    }
    .farm-info-btn svg { inline-size: 13px; block-size: 13px; }

    /* ── Badges ──────────────────────────────────────────── */

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border-radius: 9999px;
      padding: 0.18rem 0.65rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 500;
    }
    .badge-gold { background: rgba(168, 137, 44, 0.15); color: var(--honey-200); }
    .badge-success { background: rgba(80, 106, 68, 0.18); color: var(--sage-100); }
    .badge-error { background: rgba(136, 68, 54, 0.18); color: var(--clay-100); }
    .badge-warning { background: rgba(168, 137, 44, 0.15); color: var(--honey-100); }
    .badge-muted { background: rgba(255, 255, 255, 0.06); color: var(--latte-400); }

    /* ── Score Pips (Exact FarmFactory) ──────────────────── */

    .score-pip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.82rem 0.4rem 0.65rem;
      border-radius: 9999px;
      font-family: var(--font-mono);
      font-size: 0.88rem;
      font-weight: 600;
      line-height: 1;
      border: 1px solid transparent;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  0 1px 3px rgba(0, 0, 0, 0.3),
                  0 2px 8px rgba(0, 0, 0, 0.15);
      transition: filter 150ms ease;
    }
    .score-pip:hover { filter: brightness(1.1); }
    .score-pip svg { inline-size: 1rem; block-size: 1rem; flex: none; }
    .score-pip-sm { font-size: 0.65rem; padding: 0.22rem 0.5rem 0.22rem 0.38rem; gap: 0.3rem; }
    .score-pip-sm svg { inline-size: 0.72rem; block-size: 0.72rem; }
    .score-pip-icon-only { padding: 0.55rem; gap: 0; }
    .score-pip-icon-only svg { inline-size: 1.15rem; block-size: 1.15rem; }

    .score-pip-green {
      color: #b8c7a6;
      background: linear-gradient(180deg, rgba(98, 126, 84, 0.35), rgba(80, 106, 68, 0.45));
      border-color: rgba(118, 145, 102, 0.3);
      box-shadow: inset 0 1px 0 rgba(184, 199, 166, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(98, 126, 84, 0.15);
    }
    .score-pip-orange {
      color: #edd28e;
      background: linear-gradient(180deg, rgba(196, 158, 53, 0.3), rgba(168, 137, 44, 0.4));
      border-color: rgba(218, 178, 64, 0.25);
      box-shadow: inset 0 1px 0 rgba(245, 226, 170, 0.12), 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(196, 158, 53, 0.12);
    }
    .score-pip-amber {
      color: #e0b88a;
      background: linear-gradient(180deg, rgba(180, 118, 58, 0.32), rgba(155, 100, 48, 0.42));
      border-color: rgba(200, 138, 72, 0.28);
      box-shadow: inset 0 1px 0 rgba(224, 184, 138, 0.12), 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(180, 118, 58, 0.13);
    }
    .score-pip-red {
      color: #d8ae9e;
      background: linear-gradient(180deg, rgba(160, 80, 66, 0.35), rgba(136, 68, 54, 0.45));
      border-color: rgba(180, 102, 86, 0.3);
      box-shadow: inset 0 1px 0 rgba(216, 174, 158, 0.12), 0 1px 3px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(160, 80, 66, 0.15);
    }
    .score-pip-muted {
      color: #8a7e70;
      background: linear-gradient(180deg, rgba(85, 77, 66, 0.3), rgba(62, 56, 48, 0.4));
      border-color: rgba(255, 255, 255, 0.06);
    }

    .score-green { color: var(--sage-300); }
    .score-orange { color: var(--honey-300); }
    .score-amber { color: #e0b88a; }
    .score-red { color: var(--clay-300); }

    /* ── Inputs & Filters ────────────────────────────────── */

    .input-primary {
      inline-size: 100%;
      border-radius: 0.375rem;
      padding: 0.55rem 0.85rem;
      font-family: var(--font-mono);
      font-size: 0.84rem;
      color: var(--latte-100);
      background: rgba(15, 15, 18, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .input-primary::placeholder { color: var(--latte-500); }
    .input-primary:focus {
      outline: none;
      border-color: rgba(196, 158, 53, 0.5);
      box-shadow: 0 0 0 2px rgba(168, 137, 44, 0.18);
    }

    .search-wrap { position: relative; flex: 1; }
    .search-wrap svg {
      position: absolute;
      inset-inline-start: 0.75rem;
      inset-block-start: 50%;
      transform: translateY(-50%);
      inline-size: 16px;
      block-size: 16px;
      color: var(--latte-500);
      pointer-events: none;
    }
    .search-wrap .input-primary { padding-inline-start: 2.3rem; }

    .farm-filter-btn {
      padding: 0.35rem 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 0.375rem;
      border: 0;
      cursor: pointer;
      color: var(--latte-400);
      background: transparent;
      transition: background 150ms ease, color 150ms ease;
    }
    .farm-filter-btn:hover { color: var(--latte-200); }
    .farm-filter-btn.active { background: rgba(255, 255, 255, 0.08); color: var(--latte-100); }

    /* ── Repo Tabs (Exact FarmFactory Folder Tabs) ───────── */

    .repo-tabs {
      display: flex;
      gap: 0.25rem;
      border-block-end: 1px solid rgba(255, 255, 255, 0.06);
      margin-block-end: 1.5rem;
      overflow-x: auto;
    }
    .repo-tab {
      position: relative;
      padding: 0.65rem 1rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--latte-400);
      border-radius: 0.5rem 0.5rem 0 0;
      margin-block-end: -1px;
      border: 1px solid transparent;
      border-block-end: none;
      background: transparent;
      cursor: pointer;
      transition: all 150ms ease;
      white-space: nowrap;
    }
    .repo-tab:hover:not(.active) { color: var(--latte-200); background: rgba(255, 255, 255, 0.03); }
    .repo-tab.active {
      color: var(--honey-200);
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.06);
      box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
    }
    .repo-tab-count {
      margin-inline-start: 0.35rem;
      font-size: 0.72rem;
      color: var(--latte-600);
    }
    .repo-tab.active .repo-tab-count { color: rgba(196, 158, 53, 0.65); }

    /* ── Header & Portfolio Layouts ──────────────────────── */

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-block-end: 2rem;
    }
    .page-title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .page-title { font-size: clamp(1.5rem, 2.5vw, 1.9rem); line-height: 1.2; }
    .page-sub { margin-block-start: 0.35rem; font-size: 0.85rem; color: var(--latte-400); }

    .score-legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.65rem 1.2rem;
      margin-block-start: 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--latte-500);
    }
    .score-legend span { display: inline-flex; align-items: center; gap: 0.4rem; }

    .header-stats {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    .header-stat { text-align: end; }
    .header-stat-val { font-family: var(--font-mono); font-size: 1.55rem; font-weight: 600; color: var(--latte-100); line-height: 1.1; }
    .header-stat-val.big { font-size: 2.75rem; font-weight: 700; }
    .header-stat-lbl { font-family: var(--font-mono); font-size: 11px; color: var(--latte-500); margin-block-start: 0.2rem; }
    .stat-divider { inline-size: 1px; block-size: 32px; background: rgba(255, 255, 255, 0.06); }
    .stat-divider.tall { block-size: 44px; }

    /* ── Farms Index Cards + Tucked Checklist Ribbon ─────── */

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-block-end: 1.25rem;
    }
    .farm-stack { display: grid; gap: 1rem; }

    .farm-card-wrap { position: relative; }
    .farm-card {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.35rem;
      cursor: pointer;
    }
    .farm-card.has-ribbon {
      padding-block-end: 1.5rem;
      box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
    }
    .farm-card-title {
      font-family: var(--font-mono);
      font-size: 1rem;
      font-weight: 500;
      color: var(--latte-100);
      transition: color 150ms ease;
    }
    .farm-card:hover .farm-card-title { color: var(--honey-200); }
    .farm-card-meta {
      margin-block-start: 0.55rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem 1rem;
      font-size: 0.76rem;
      color: var(--latte-500);
    }
    .farm-card-meta strong { color: var(--latte-300); font-weight: 500; }
    .farm-card-right { display: flex; align-items: center; gap: 0.85rem; flex: none; }
    .chevron { inline-size: 18px; block-size: 18px; color: var(--latte-600); transition: color 150ms ease, transform 150ms ease; }
    .farm-card:hover .chevron { color: var(--honey-300); transform: translateX(2px); }

    .checklist-ribbon {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-block-start: -10px;
      padding: 19px 1.25rem 0.6rem;
      border-radius: 0 0 0.75rem 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.04);
      background: rgba(14, 14, 17, 0.75);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 42%);
      mask-image: linear-gradient(to bottom, transparent 0%, black 42%);
      cursor: pointer;
      transition: background 150ms ease;
    }
    .checklist-ribbon:hover { background: rgba(255, 255, 255, 0.03); }
    .checklist-ribbon.complete {
      block-size: 18px;
      padding: 0;
      background: rgba(74, 158, 101, 0.16);
      border-color: rgba(74, 158, 101, 0.12);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 60%);
      mask-image: linear-gradient(to bottom, transparent 0%, black 60%);
    }
    .ribbon-track {
      flex: 1;
      block-size: 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      overflow: hidden;
    }
    .ribbon-fill {
      block-size: 100%;
      border-radius: 999px;
      background: rgba(196, 158, 53, 0.55);
      transition: width 400ms ease;
    }
    .ribbon-stat { font-family: var(--font-mono); font-size: 11px; color: var(--latte-500); }
    .ribbon-pct { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--latte-400); }

    /* ── Watermarked Audit / Ideas Cards (Exact FarmFactory) ─ */

    .art-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-block-end: 1.5rem;
    }
    .art-card {
      position: relative;
      overflow: hidden;
      padding: 1.25rem 1.35rem;
      cursor: pointer;
    }
    .art-card img.art-bg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      opacity: 0.08;
      -webkit-mask-image: linear-gradient(to right, transparent, black);
      mask-image: linear-gradient(to right, transparent, black);
      transition: opacity 450ms ease;
      pointer-events: none;
    }
    .art-card:hover img.art-bg { opacity: 0.15; }
    .art-card-inner {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .art-card h4 { font-size: 0.92rem; color: var(--latte-100); transition: color 150ms ease; }
    .art-card:hover h4 { color: var(--honey-200); }
    .art-card p { margin: 0.25rem 0 0; font-size: 0.76rem; color: var(--latte-500); line-height: 1.45; }

    /* ── Checklist Progress & Items (Exact FarmFactory) ──── */

    .progress-card {
      padding: 1.25rem 1.4rem;
      margin-block-end: 1.5rem;
      border-radius: 0.75rem;
    }
    .progress-card.complete {
      border: 1px solid rgba(98, 126, 84, 0.25);
      background: linear-gradient(135deg, rgba(22, 50, 32, 0.5) 0%, rgba(30, 60, 38, 0.35) 100%);
      box-shadow: inset 0 1px 0 0 rgba(74, 158, 101, 0.08);
    }
    .progress-track {
      block-size: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(21, 21, 25, 0.85);
    }
    .progress-card.complete .progress-track { background: rgba(98, 126, 84, 0.18); }
    .progress-fill {
      block-size: 100%;
      border-radius: 999px;
      background: var(--honey-400);
      transition: width 450ms ease;
    }
    .progress-card.complete .progress-fill { background: var(--sage-400); }

    .check-group-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.5rem 0 0.75rem;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--latte-500);
    }
    .check-group-title::after {
      content: "";
      flex: 1;
      block-size: 1px;
      background: rgba(255, 255, 255, 0.06);
    }

    .check-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.85rem;
      padding: 0.95rem 1.1rem;
      margin-block-end: 0.5rem;
      cursor: pointer;
      transition: background 150ms ease, opacity 150ms ease, border-color 150ms ease;
    }
    .check-row:hover { background: rgba(133, 133, 143, 0.08); }
    .check-row.readonly { cursor: default; }
    .check-row.complete { opacity: 0.62; }
    .check-row.skip { opacity: 0.44; }
    .check-left { display: flex; align-items: center; gap: 0.8rem; min-inline-size: 0; flex: 1; }
    .check-box {
      inline-size: 20px;
      block-size: 20px;
      border-radius: 4px;
      border: 1px solid var(--latte-600);
      display: grid;
      place-items: center;
      flex: none;
      transition: all 150ms ease;
    }
    .check-row:hover .check-box { border-color: rgba(196, 158, 53, 0.55); }
    .check-row.complete .check-box { background: var(--honey-400); border-color: var(--honey-400); color: var(--crust-100); }
    .check-row.skip .check-box { background: rgba(79, 79, 88, 0.35); border-color: var(--latte-600); color: var(--latte-400); }
    .check-box svg { inline-size: 14px; block-size: 14px; }
    .check-title { font-size: 0.9rem; font-weight: 500; color: var(--latte-100); }
    .check-row.complete .check-title { color: var(--latte-500); text-decoration: line-through; }
    .check-row.skip .check-title { color: var(--latte-500); text-decoration: line-through; font-style: italic; }
    .skip-btn { opacity: 0.35; transition: opacity 150ms ease; }
    .check-row:hover .skip-btn, .check-row.skip .skip-btn { opacity: 1; }

    /* ── Breadcrumb, Breakdown, Gates & Legacy Banner ────── */

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--latte-400);
      margin-block-end: 1.15rem;
    }
    .breadcrumb button {
      border: 0;
      background: transparent;
      color: var(--latte-400);
      font: inherit;
      padding: 0;
      cursor: pointer;
    }
    .breadcrumb button:hover { color: var(--latte-100); }
    .breadcrumb svg { inline-size: 14px; block-size: 14px; color: var(--latte-600); }

    .action-row {
      margin-block-start: 0.85rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .legacy-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid rgba(196, 158, 53, 0.28);
      background: rgba(168, 137, 44, 0.1);
      padding: 0.9rem 1.1rem;
      margin-block-end: 1.5rem;
      font-size: 0.86rem;
      color: var(--honey-100);
      line-height: 1.55;
    }
    .legacy-banner code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: rgba(9, 9, 11, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--honey-200);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }

    .breakdown-list { display: grid; gap: 0.5rem; }
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.6rem 0.85rem;
      border-radius: 0.45rem;
      background: rgba(15, 15, 18, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 0.86rem;
    }
    .breakdown-pts { font-family: var(--font-mono); font-size: 0.78rem; color: var(--honey-200); flex: none; }

    .gate-row {
      padding: 0.7rem 0.9rem;
      border-radius: 0.45rem;
      background: rgba(15, 15, 18, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      margin-block-end: 0.5rem;
    }
    .gate-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }
    .gate-row pre {
      margin: 0.5rem 0 0;
      padding: 0.75rem;
      border-radius: 0.4rem;
      background: #0b0b0e;
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-family: var(--font-mono);
      font-size: 0.74rem;
      color: var(--clay-100);
      overflow-x: auto;
      max-block-size: 180px;
    }

    .inline-form {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .inline-form .input-primary { flex: 1 1 200px; }

    .doc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.95rem 1.15rem;
      margin-block-end: 0.5rem;
      cursor: pointer;
    }
    .doc-row h4 { font-size: 0.88rem; color: var(--latte-100); transition: color 150ms ease; }
    .doc-row:hover h4 { color: var(--honey-200); }
    .doc-row code { font-family: var(--font-mono); font-size: 0.74rem; color: var(--latte-500); }

    /* ── Document Reader (Exact FarmFactory .prose) ──────── */

    .doc-watermark {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }
    .doc-watermark img {
      position: absolute;
      inset-block-end: 0;
      inset-inline-end: 0;
      block-size: 68%;
      inline-size: 56%;
      object-fit: cover;
      filter: grayscale(1);
      opacity: 0.045;
      -webkit-mask-image: radial-gradient(ellipse at 100% 100%, black 0%, transparent 70%);
      mask-image: radial-gradient(ellipse at 100% 100%, black 0%, transparent 70%);
    }

    .prose-reader { max-inline-size: 900px; margin-inline: auto; }
    .prose-card { padding: 2.25rem 2.75rem; }
    @media (max-width: 640px) { .prose-card { padding: 1.5rem 1.25rem; } }

    .prose {
      font-family: var(--font-sans);
      color: var(--latte-200);
      font-size: var(--prose-size, 0.9375rem);
      line-height: 1.8;
    }
    .prose h1 {
      font-family: var(--font-mono);
      color: var(--latte-50);
      font-size: 1.9em;
      margin: 0 0 1.4rem;
      padding-block-end: 0.7rem;
      border-block-end: 1px solid rgba(255, 255, 255, 0.08);
      line-height: 1.3;
    }
    .prose h2 {
      font-family: var(--font-mono);
      color: var(--honey-200);
      font-size: 1.4em;
      margin: 2.2rem 0 0.85rem;
      line-height: 1.35;
    }
    .prose h3 {
      font-family: var(--font-mono);
      color: var(--sage-100);
      font-size: 1.18em;
      margin: 1.75rem 0 0.6rem;
      line-height: 1.4;
    }
    .prose p { margin: 1.05rem 0; }
    .prose p:first-child { margin-block-start: 0; }
    .prose strong { color: var(--latte-100); font-weight: 600; }
    .prose em { color: var(--latte-300); }
    .prose a {
      color: var(--honey-300);
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-color: rgba(168, 137, 44, 0.35);
    }
    .prose a:hover { color: var(--honey-100); text-decoration-color: rgba(218, 178, 64, 0.65); }
    .prose ul, .prose ol { margin: 0.9rem 0; padding-inline-start: 1.5rem; }
    .prose ul li::marker { color: var(--sage-300); }
    .prose ol li::marker { color: var(--honey-400); }
    .prose li { margin: 0.35rem 0; color: var(--latte-200); }
    .prose code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      border-radius: 4px;
      background: var(--crust-200);
      color: var(--honey-200);
      padding: 0.14rem 0.42rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .prose pre {
      overflow-x: auto;
      border-radius: 0.5rem;
      background: #101014;
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 1.15rem 1.25rem;
      margin: 1.4rem 0;
      font-family: var(--font-mono);
      font-size: 0.85em;
      line-height: 1.65;
    }
    .prose pre code { background: transparent; border: 0; padding: 0; color: #ddd3c2; font-size: inherit; }
    .prose blockquote {
      margin: 1.35rem 0;
      border-inline-start: 2px solid rgba(98, 126, 84, 0.55);
      padding: 0.8rem 1.1rem;
      border-radius: 0 0.4rem 0.4rem 0;
      font-style: italic;
      color: var(--latte-300);
      background: rgba(28, 28, 33, 0.45);
      backdrop-filter: blur(8px);
    }
    .prose table {
      inline-size: 100%;
      margin: 1.4rem 0;
      font-size: 0.88em;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
    }
    .prose th {
      padding: 0.7rem 1rem;
      text-align: start;
      font-family: var(--font-mono);
      font-size: 0.74rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #f2ead8;
      background: rgba(15, 15, 18, 0.92);
      border-block-end: 2px solid rgba(196, 158, 53, 0.22);
    }
    .prose td {
      padding: 0.7rem 1rem;
      color: var(--latte-200);
      border-block-end: 1px solid rgba(255, 255, 255, 0.04);
    }
    .prose tbody tr:nth-child(odd) td { background: rgba(20, 20, 24, 0.6); }
    .prose tbody tr:nth-child(even) td { background: rgba(24, 24, 28, 0.6); }
    .prose tbody tr:last-child td { border-block-end: 0; }
    .prose tbody tr:hover td { background: rgba(28, 28, 33, 0.82); }
    .prose hr {
      margin: 1.8rem 0;
      border: 0;
      block-size: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(218, 178, 64, 0.16) 50%, rgba(255, 255, 255, 0.08) 80%, transparent);
    }

    /* ── Floating Text Size Controls (Exact FarmFactory) ─── */

    .text-size-controls {
      position: fixed;
      inset-block-end: 1.5rem;
      inset-inline-end: 1.5rem;
      z-index: 30;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
    }
    .text-size-btn {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 15, 18, 0.88);
      backdrop-filter: blur(12px) saturate(1.4);
      color: var(--latte-300);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: all 150ms ease;
    }
    .text-size-btn:hover { color: var(--latte-100); background: rgba(26, 26, 31, 0.94); border-color: rgba(255, 255, 255, 0.14); }

    /* ── Native Modals (Modern Web Guidance compliant) ───── */

    dialog.farm-modal {
      margin: auto;
      padding: 1.5rem;
      inline-size: min(500px, 92vw);
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.09);
      background: rgba(16, 16, 20, 0.96);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      color: var(--latte-200);
      box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.75);
    }
    dialog:modal { overscroll-behavior: contain; }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      overflow: hidden;
      overscroll-behavior: contain;
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-end: 1rem;
    }
    .modal-head h1 { font-size: 1.05rem; }
    .modal-close {
      border: 0;
      background: transparent;
      color: var(--latte-500);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.375rem;
    }
    .modal-close:hover { color: var(--latte-100); background: rgba(255, 255, 255, 0.06); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-block-start: 1.1rem; }
    .help-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0.75rem 0 1rem; }
    .help-item {
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      font-size: 0.8rem;
      color: var(--latte-200);
    }
    .help-item small { display: block; margin-block-start: 0.15rem; font-size: 0.7rem; color: var(--latte-500); }

    @keyframes slide-up {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-in { animation: slide-up 0.22s ease-out; }
    .empty-state { padding: 3rem 1.5rem; text-align: center; color: var(--latte-500); }
    .empty-state h3 { color: var(--latte-300); margin-block-end: 0.35rem; font-size: 1rem; }
  </style>
</head>
<body>
  <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  </button>
  <div class="mobile-overlay" id="mobile-overlay"></div>

  <div class="app-shell">
    <aside class="glass-sidebar" id="sidebar">
      <div class="sidebar-logo" id="logo-home" title="All Local Farms">
        <img src="/assets/logo.webp" alt="Farmwork Local Farm Viewer" />
      </div>

      <nav class="sidebar-nav" aria-label="Primary">
        <button type="button" class="nav-link active" id="nav-farms">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
          </svg>
          Farms
        </button>
        <button type="button" class="nav-link" id="nav-checklists">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Checklists
        </button>
      </nav>

      <div class="sidebar-section-label">
        <span>Local Repos</span>
        <button type="button" class="btn-ghost" id="refresh-btn" title="Rescan local disk" style="padding:2px 6px;font-size:11px;border-radius:4px">↻</button>
      </div>
      <div class="sidebar-farms" id="sidebar-farms"></div>

      <div class="sidebar-footer">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>LOCAL FARM VIEWER · v3</span>
          <span id="live-pill" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:10px;color:var(--sage-200)" title="Watching local .md files for live updates">
            <span style="inline-size:6px;block-size:6px;border-radius:999px;background:var(--sage-300)"></span>
            LIVE
          </span>
        </div>
        <div class="sidebar-root-path" id="root-path">Scanning...</div>
      </div>
    </aside>

    <div class="main-wrap">
      <div id="doc-watermark"></div>
      <main class="main-inner" id="main">
        <div class="empty-state">Loading local farms...</div>
      </main>
    </div>
  </div>

  <div class="text-size-controls" id="text-size-controls" hidden>
    <button type="button" class="text-size-btn" id="text-inc" title="Increase text size">+</button>
    <button type="button" class="text-size-btn" id="text-reset" title="Reset text size">15</button>
    <button type="button" class="text-size-btn" id="text-dec" title="Decrease text size">−</button>
  </div>

  <!-- Native Help Dialog -->
  <dialog id="help-dialog" class="farm-modal" closedby="any" aria-labelledby="help-dialog-title">
    <div class="modal-head">
      <h1 id="help-dialog-title">What is a Farm?</h1>
      <form method="dialog">
        <button type="submit" class="modal-close" aria-label="Close help">✕</button>
      </form>
    </div>
    <p style="font-size:0.86rem;line-height:1.6;margin:0 0 1rem;color:var(--latte-300)">
      A <strong style="color:var(--latte-50)">Farm</strong> is a real software project managed with AI agents through living Markdown files stored directly in git — zero database, zero vendor lock-in.
    </p>
    <div style="font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--latte-400)">Core Files</div>
    <div class="help-grid">
      <div class="help-item"><code>_AUDIT/FARMHOUSE.md</code><small>Deterministic 0–10 health report</small></div>
      <div class="help-item"><code>_AUDIT/CHECKLIST.md</code><small>Living engineering standards</small></div>
      <div class="help-item"><code>_AUDIT/GARDEN.md</code><small>Pre-plan ideas (45d/60d aging)</small></div>
      <div class="help-item"><code>_PLANS/*.md</code><small>Plan-before-implement specs</small></div>
    </div>
    <p style="font-size:0.78rem;line-height:1.55;margin:0;color:var(--latte-500)">
      Past Farmwork (v1/v2) repos open in read-only mode so nothing is ever auto-modified. Run <code>farmwork init --reinstall</code> inside a repo to upgrade it to v3.
    </p>
  </dialog>

  <!-- Native Compost Dialog -->
  <dialog id="compost-dialog" class="farm-modal" closedby="any" aria-labelledby="compost-dialog-title">
    <div class="modal-head">
      <h1 id="compost-dialog-title">Compost Idea</h1>
      <form method="dialog">
        <button type="submit" class="modal-close" aria-label="Close dialog">✕</button>
      </form>
    </div>
    <p id="compost-target-label" style="font-size:0.86rem;color:var(--latte-300);margin:0 0 0.85rem"></p>
    <form id="compost-form">
      <input class="input-primary" id="compost-reason" name="reason" value="Out of scope" required autofocus placeholder="Why are you retiring this idea?" />
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="compost-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Move to Compost</button>
      </div>
    </form>
  </dialog>

  <script>
    const state = {
      root: "",
      farms: [],
      view: "farms", // "farms" | "checklists" | "farm" | "doc"
      selectedPath: null,
      detail: null,
      tab: "overview", // "overview" | "checklists" | "ideas" | "plans" | "docs"
      docPath: null,
      gateResult: null,
      securityResult: null,
      filterText: "",
      filterGen: "all", // "all" | "v3" | "legacy"
      prosePx: 15,
      pendingCompostTitle: null,
    };

    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const ICONS = {
      barn: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M223.85 216H24v-96a257 257 0 0 1 56.2 6.21l-.2-.07V80l64-48l64 48v41.11a255 255 0 0 0-40 7V96h-48v42.61A256.8 256.8 0 0 1 223.85 216" opacity="0.2"/><path d="M232 160a8 8 0 0 0 0-16a232.2 232.2 0 0 0-65.8 9.47q-9-5.78-18.46-10.78A246.3 246.3 0 0 1 232 128a8 8 0 0 0 0-16c-5.36 0-10.69.18-16 .49V80a8 8 0 0 0-3.2-6.4l-64-48a8 8 0 0 0-9.6 0l-64 48A8 8 0 0 0 72 80v36.37A266.3 266.3 0 0 0 24 112a8 8 0 0 0 0 16a247 247 0 0 1 193.61 93a8 8 0 1 0 12.48-10q-7.59-9.5-15.94-18.14c5.92-.57 11.89-.86 17.85-.86a8 8 0 0 0 0-16a201.5 201.5 0 0 0-32.59 2.65q-7.75-6.92-16-13.16A216.5 216.5 0 0 1 232 160m-104-26.76V104h32v17.94a262.5 262.5 0 0 0-31.93 11.33ZM88 84l56-42l56 42v29.93q-12.12 1.45-24 4V96a8 8 0 0 0-8-8h-48a8 8 0 0 0-8 8v31q-11.79-4.15-24-7.18Zm48.83 136.43a8 8 0 0 1-11.09 2.23A183.15 183.15 0 0 0 24 192a8 8 0 0 1 0-16a199.1 199.1 0 0 1 110.6 33.34a8 8 0 0 1 2.23 11.09m49.54-10.14a8 8 0 1 1-11.2 11.42A214.8 214.8 0 0 0 24 160a8 8 0 0 1 0-16a230.7 230.7 0 0 1 162.37 66.29"/></svg>',
      warn: '<svg fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" /></svg>',
      tractor: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M10 18a3 3 0 0 1-6 0a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11.001C16.105 4 17 4.895 17 5.999L20 6c2 0 2 2.896 2 4v6a2 2 0 0 1-2 2h-1a3 3 0 0 1-6 0zM4 6v9h11V6zm13 2v4h3V8zm-1 11a1 1 0 1 0 0-2a1 1 0 0 0 0 2m-9 0a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/></svg>',
      flame: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M208 144a80 80 0 0 1-160 0c0-30.57 14.42-58.26 31-80l33 32l26.27-72C159.86 41.92 208 88.15 208 144" opacity="0.2"/><path d="M183.89 153.34a57.6 57.6 0 0 1-46.56 46.55a9 9 0 0 1-1.33.11a8 8 0 0 1-1.32-15.89c16.57-2.79 30.63-16.85 33.44-33.45a8 8 0 0 1 15.78 2.68ZM216 144a88 88 0 0 1-176 0c0-27.92 11-56.47 32.66-84.85a8 8 0 0 1 11.93-.89l24.12 23.41l22-60.41a8 8 0 0 1 12.63-3.41C165.21 36 216 84.55 216 144m-16 0c0-46.09-35.79-85.92-58.21-106.33l-22.27 61.07a8 8 0 0 1-13.09 3L80.06 76.16C64.09 99.21 56 122 56 144a72 72 0 0 0 144 0"/></svg>',
      chevron: '<svg class="chevron" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>',
      check: '<svg fill="none" viewBox="0 0 24 24" stroke-width="2.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>',
      x: '<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>',
    };

    function scoreTier(score) {
      if (score >= 9) return { pip: "score-pip-green", color: "score-green", dot: "green", icon: ICONS.barn };
      if (score >= 7) return { pip: "score-pip-orange", color: "score-orange", dot: "orange", icon: ICONS.warn };
      if (score >= 5) return { pip: "score-pip-amber", color: "score-amber", dot: "amber", icon: ICONS.tractor };
      return { pip: "score-pip-red", color: "score-red", dot: "red", icon: ICONS.flame };
    }

    function scorePipHtml(score, { iconOnly = false } = {}) {
      const t = scoreTier(score);
      if (iconOnly) return \`<span class="score-pip score-pip-icon-only \${t.pip}">\${t.icon}</span>\`;
      return \`<span class="score-pip \${t.pip}">\${t.icon}\${score}</span>\`;
    }

    function renderInline(text) {
      const codeSpans = [];
      let safe = esc(text).replace(/\`([^\`]+)\`/g, (_, inner) => {
        const idx = codeSpans.push("<code>" + inner + "</code>") - 1;
        return "\\u0000CODE" + idx + "\\u0000";
      });
      safe = safe
        .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
        .replace(/(^|[\\s(>])_([^_\\n]+)_(?=[\\s.,;:!?)<]|$)/g, "$1<em>$2</em>")
        .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return safe.replace(/\\u0000CODE(\\d+)\\u0000/g, (_, idx) => codeSpans[Number(idx)]);
    }

    function renderMarkdown(md) {
      if (!md) return "<p><em>Empty document.</em></p>";
      const lines = md.replace(/\\r\\n/g, "\\n").split("\\n");
      let html = "";
      let inCode = false;
      let listType = null;
      let inTable = false;

      const closeBlocks = () => {
        if (listType) { html += "</" + listType + ">"; listType = null; }
        if (inTable) { html += "</tbody></table>"; inTable = false; }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("\`\`\`")) {
          closeBlocks();
          if (!inCode) { html += "<pre><code>"; inCode = true; }
          else { html += "</code></pre>"; inCode = false; }
          continue;
        }
        if (inCode) { html += esc(line) + "\\n"; continue; }
        if (/^\\s*$/.test(line)) { closeBlocks(); continue; }
        if (/^---+$/.test(line.trim())) { closeBlocks(); html += "<hr>"; continue; }

        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          if (listType) { html += "</" + listType + ">"; listType = null; }
          const cells = line.trim().split("|").slice(1, -1).map((c) => c.trim());
          if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
          if (!inTable) {
            html += "<table><thead><tr>" + cells.map((c) => "<th>" + renderInline(c) + "</th>").join("") + "</tr></thead><tbody>";
            inTable = true;
          } else {
            html += "<tr>" + cells.map((c) => "<td>" + renderInline(c) + "</td>").join("") + "</tr>";
          }
          continue;
        }

        if (inTable) { html += "</tbody></table>"; inTable = false; }

        const h = line.match(/^(#{1,4})\\s+(.+)$/);
        if (h) {
          closeBlocks();
          const lvl = h[1].length;
          html += "<h" + lvl + ">" + renderInline(h[2]) + "</h" + lvl + ">";
          continue;
        }

        if (line.startsWith("> ")) {
          closeBlocks();
          html += "<blockquote><p>" + renderInline(line.slice(2)) + "</p></blockquote>";
          continue;
        }

        const oli = line.match(/^\\s*\\d+\\.\\s+(.+)$/);
        if (oli) {
          if (listType !== "ol") {
            if (listType) html += "</" + listType + ">";
            html += "<ol>";
            listType = "ol";
          }
          html += "<li>" + renderInline(oli[1]) + "</li>";
          continue;
        }

        const li = line.match(/^\\s*[-*]\\s+(.+)$/);
        if (li) {
          if (listType !== "ul") {
            if (listType) html += "</" + listType + ">";
            html += "<ul>";
            listType = "ul";
          }
          const task = li[1].match(/^\\[([ xX-])\\]\\s+(.+)$/);
          if (task) {
            const sym = task[1] === " " ? "☐" : task[1] === "-" ? "⊘" : "☑";
            html += "<li>" + sym + " " + renderInline(task[2]) + "</li>";
          } else {
            html += "<li>" + renderInline(li[1]) + "</li>";
          }
          continue;
        }

        closeBlocks();
        html += "<p>" + renderInline(line) + "</p>";
      }
      closeBlocks();
      if (inCode) html += "</code></pre>";
      return html;
    }

    async function api(url, opts) {
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    function docArtForPath(p) {
      const low = String(p || "").toLowerCase();
      if (low.includes("farmhouse")) return "/assets/audit-farmhouse.webp";
      if (low.includes("security")) return "/assets/audit-security.webp";
      if (low.includes("perform")) return "/assets/audit-performance.webp";
      if (low.includes("accessib")) return "/assets/audit-accessibility.webp";
      if (low.includes("code_quality") || low.includes("code-quality")) return "/assets/audit-code-quality.webp";
      if (low.includes("garden")) return "/assets/audit-garden.webp";
      if (low.includes("compost")) return "/assets/audit-compost.webp";
      if (low.includes("test") || low.includes("checklist")) return "/assets/audit-tests.webp";
      return "/assets/main-bg.webp";
    }

    function closeMobileMenu() {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("mobile-overlay").classList.remove("open");
    }

    function renderSidebar() {
      document.getElementById("root-path").textContent = state.root;
      document.getElementById("nav-farms").classList.toggle("active", state.view === "farms");
      document.getElementById("nav-checklists").classList.toggle("active", state.view === "checklists");

      const list = document.getElementById("sidebar-farms");
      if (state.farms.length === 0) {
        list.innerHTML = '<div style="padding:0.5rem 0.7rem;font-size:11px;color:var(--latte-600)">No farms found</div>';
        return;
      }
      list.innerHTML = state.farms.map((f) => {
        const t = scoreTier(f.score);
        const active = (state.view === "farm" || state.view === "doc") && state.selectedPath === f.path;
        return \`
          <button type="button" class="sidebar-farm-btn \${active ? "active" : ""}" data-open-farm="\${esc(f.path)}">
            <span class="sidebar-farm-name">\${esc(f.projectName)}</span>
            <span style="display:flex;align-items:center;gap:0.4rem;flex:none">
              \${f.install?.isLegacy ? '<span style="font-size:9px;color:var(--honey-300);opacity:0.8">v1/2</span>' : ""}
              <span class="sidebar-dot \${t.dot}" title="\${f.score}/10"></span>
            </span>
          </button>
        \`;
      }).join("");

      for (const btn of list.querySelectorAll("[data-open-farm]")) {
        btn.addEventListener("click", () => {
          closeMobileMenu();
          openFarm(btn.dataset.openFarm, "overview");
        });
      }
    }

    function renderLegacyBanner(health) {
      if (!health?.install?.isLegacy) return "";
      return \`
        <div class="legacy-banner">
          <span style="font-size:1rem;line-height:1">⚠</span>
          <div>
            <strong>Past Farmwork (\${esc(health.install.generation)}) project — Read-Only Mode.</strong>
            Farmwork v3 never auto-updates past Farmwork apps. Browse all Markdown docs safely here; to upgrade this repo to v3, run <code>farmwork init --reinstall</code>.
          </div>
        </div>
      \`;
    }

    function renderFarmsIndex() {
      const main = document.getElementById("main");
      const farms = state.farms;
      const totalDocs = farms.reduce((sum, f) => sum + (f.docCount || 0), 0);
      const avgScore = farms.length ? Number((farms.reduce((s, f) => s + f.score, 0) / farms.length).toFixed(1)) : 0;
      const farmsWithChecks = farms.filter((f) => f.metrics.checklistActive > 0);
      const avgCheck = farmsWithChecks.length
        ? Math.round(farmsWithChecks.reduce((s, f) => s + f.metrics.checklistPercent, 0) / farmsWithChecks.length)
        : 0;
      const avgTier = scoreTier(avgScore);

      const filtered = farms.filter((f) => {
        if (state.filterGen === "v3" && f.install?.isLegacy) return false;
        if (state.filterGen === "legacy" && !f.install?.isLegacy) return false;
        if (state.filterText && !f.projectName.toLowerCase().includes(state.filterText) && !f.stack.toLowerCase().includes(state.filterText)) return false;
        return true;
      });

      main.innerHTML = \`
        <div class="page-header animate-in">
          <div>
            <div class="page-title-row">
              <h1 class="page-title">Farms</h1>
              <button type="button" class="farm-info-btn" id="open-help-btn">
                <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                Help
              </button>
              <a href="https://farmwork.dev" target="_blank" rel="noopener noreferrer" class="farm-info-btn gold">
                <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                farmwork.dev
              </a>
            </div>
            <div class="score-legend">
              <span><span class="score-pip score-pip-sm score-pip-green">\${ICONS.barn}9+</span> Healthy</span>
              <span><span class="score-pip score-pip-sm score-pip-orange">\${ICONS.warn}7–8</span> Needs Work</span>
              <span><span class="score-pip score-pip-sm score-pip-amber">\${ICONS.tractor}5–6</span> Struggling</span>
              <span><span class="score-pip score-pip-sm score-pip-red">\${ICONS.flame}1–4</span> Critical</span>
            </div>
          </div>

          <div class="header-stats">
            <div class="header-stat">
              <div class="header-stat-val">\${farms.length}</div>
              <div class="header-stat-lbl">Farms</div>
            </div>
            <div class="stat-divider"></div>
            <div class="header-stat">
              <div class="header-stat-val" style="color:var(--honey-200)">\${totalDocs}</div>
              <div class="header-stat-lbl">Documents</div>
            </div>
            \${farms.length ? \`
              <div class="stat-divider"></div>
              <div style="display:flex;align-items:center;gap:0.75rem">
                <div class="header-stat">
                  <div class="header-stat-val \${avgTier.color}">\${avgScore}</div>
                  <div class="header-stat-lbl">Avg Score</div>
                </div>
                \${scorePipHtml(avgScore, { iconOnly: true })}
              </div>
            \` : ""}
            \${farmsWithChecks.length ? \`
              <div class="stat-divider"></div>
              <div class="header-stat">
                <div class="header-stat-val" style="color:\${avgCheck >= 90 ? "var(--sage-200)" : avgCheck >= 60 ? "var(--honey-200)" : "var(--latte-300)"}">\${avgCheck}%</div>
                <div class="header-stat-lbl">Checklists</div>
              </div>
            \` : ""}
          </div>
        </div>

        <div class="filter-bar">
          <div class="search-wrap">
            <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <input type="search" id="farm-search" class="input-primary" placeholder="Search farms by name or stack..." value="\${esc(state.filterText)}" />
          </div>
          <div style="display:flex;gap:0.25rem">
            <button type="button" class="farm-filter-btn \${state.filterGen === "all" ? "active" : ""}" data-gen="all">All</button>
            <button type="button" class="farm-filter-btn \${state.filterGen === "v3" ? "active" : ""}" data-gen="v3">v3 Active</button>
            <button type="button" class="farm-filter-btn \${state.filterGen === "legacy" ? "active" : ""}" data-gen="legacy">Legacy</button>
          </div>
        </div>

        \${filtered.length === 0 ? \`
          <div class="surface empty-state">
            <h3>No Farmwork repositories found</h3>
            <p style="font-size:0.86rem;margin:0.35rem 0 0">Run <code>farmwork init</code> inside a project folder to initialize Farmwork v3.</p>
          </div>
        \` : \`
          <div class="farm-stack">
            \${filtered.map((f) => {
              const hasChecklist = f.metrics.checklistActive > 0;
              const checkComplete = hasChecklist && f.metrics.checklistPercent === 100;
              return \`
                <div class="farm-card-wrap animate-in">
                  <div class="surface card-hover farm-card \${hasChecklist ? "has-ribbon" : ""}" data-card-farm="\${esc(f.path)}">
                    <div style="min-inline-size:0;flex:1">
                      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                        <span class="farm-card-title">\${esc(f.projectName)}</span>
                        \${f.install?.isLegacy
                          ? \`<span class="badge badge-warning">Legacy \${esc(f.install.generation)}</span>\`
                          : '<span class="badge badge-success">Active v3</span>'}
                        <span class="badge badge-muted">\${esc(f.stack)}</span>
                      </div>
                      <div class="farm-card-meta">
                        <span>Branch: <strong>\${esc(f.git.branch || "no-git")}</strong>\${f.git.dirtyCount ? \` (\${f.git.dirtyCount} dirty)\` : ""}</span>
                        <span>Docs: <strong>\${f.docCount || 0}</strong></span>
                        <span>Tests: <strong>\${f.metrics.testFiles}</strong></span>
                        <span>Plans: <strong>\${f.metrics.completedPlans}/\${f.metrics.totalPlans}</strong></span>
                        <span>Ideas: <strong style="color:var(--honey-200)">\${f.metrics.activeIdeas}</strong></span>
                        \${f.beads?.initialized ? \`<span>Beads: <strong style="color:var(--sage-200)">\${f.beads.summary.ready} ready</strong></span>\` : ""}
                        \${f.justfile?.exists ? \`<span>Just: <strong>\${f.justfile.recipes.length}</strong></span>\` : ""}
                      </div>
                    </div>
                    <div class="farm-card-right">
                      \${scorePipHtml(f.score)}
                      \${ICONS.chevron}
                    </div>
                  </div>
                  \${hasChecklist ? (checkComplete ? \`
                    <div class="checklist-ribbon complete" data-card-check="\${esc(f.path)}" title="Checklist 100% complete"></div>
                  \` : \`
                    <div class="checklist-ribbon" data-card-check="\${esc(f.path)}" title="Open checklist">
                      <div class="ribbon-track"><div class="ribbon-fill" style="width:\${f.metrics.checklistPercent}%"></div></div>
                      <span class="ribbon-stat">\${f.metrics.checklistCompleted}/\${f.metrics.checklistActive}</span>
                      <span class="ribbon-pct">\${f.metrics.checklistPercent}%</span>
                    </div>
                  \`) : ""}
                </div>
              \`;
            }).join("")}
          </div>
        \`}
      \`;

      main.querySelector("#open-help-btn")?.addEventListener("click", () => {
        document.getElementById("help-dialog").showModal();
      });
      main.querySelector("#farm-search")?.addEventListener("input", (e) => {
        state.filterText = e.target.value.trim().toLowerCase();
        render();
        const inp = document.getElementById("farm-search");
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      });
      for (const b of main.querySelectorAll("[data-gen]")) {
        b.addEventListener("click", () => { state.filterGen = b.dataset.gen; render(); });
      }
      for (const card of main.querySelectorAll("[data-card-farm]")) {
        card.addEventListener("click", () => openFarm(card.dataset.cardFarm, "overview"));
      }
      for (const rib of main.querySelectorAll("[data-card-check]")) {
        rib.addEventListener("click", () => openFarm(rib.dataset.cardCheck, "checklists"));
      }
    }

    function renderChecklistsPortfolio() {
      const main = document.getElementById("main");
      main.innerHTML = \`
        <div class="page-header animate-in">
          <div>
            <h1 class="page-title">Checklists</h1>
            <p class="page-sub">Living engineering standards across your local Farmwork repositories</p>
          </div>
        </div>
        <div class="art-grid">
          \${state.farms.map((f) => {
            const pct = f.metrics.checklistPercent;
            const complete = f.metrics.checklistActive > 0 && pct === 100;
            return \`
              <div class="surface card-hover" style="padding:1.25rem 1.35rem;cursor:pointer" data-jump-check="\${esc(f.path)}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-block-end:0.85rem">
                  <span class="farm-card-title">\${esc(f.projectName)}</span>
                  <span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:\${complete ? "var(--sage-200)" : "var(--honey-200)"}">\${pct}%</span>
                </div>
                <div class="progress-track" style="block-size:6px;margin-block-end:0.65rem">
                  <div class="progress-fill" style="width:\${pct}%;background:\${complete ? "var(--sage-400)" : "var(--honey-400)"}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--latte-500)">
                  <span>\${f.metrics.checklistCompleted}/\${f.metrics.checklistActive} active</span>
                  <span>\${f.install?.isLegacy ? "Legacy (read-only)" : esc(f.stack)}</span>
                </div>
              </div>
            \`;
          }).join("")}
        </div>
      \`;
      for (const card of main.querySelectorAll("[data-jump-check]")) {
        card.addEventListener("click", () => openFarm(card.dataset.jumpCheck, "checklists"));
      }
    }

    function renderGatesPanel() {
      if (!state.gateResult) return "";
      const g = state.gateResult;
      return \`
        <div class="surface animate-in" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.85rem">
            <h3 style="font-size:0.95rem">Quality Gates</h3>
            <span class="badge \${g.allPassed ? "badge-success" : "badge-error"}">\${g.allPassed ? "All Passed" : "Failures Found"}</span>
          </div>
          \${g.results.map((r) => \`
            <div class="gate-row">
              <div class="gate-row-top">
                <span>
                  <span style="color:\${r.status === "passed" ? "var(--sage-200)" : r.status === "skipped" ? "var(--latte-500)" : "var(--clay-200)"}">
                    \${r.status === "passed" ? "✓" : r.status === "skipped" ? "○" : "✗"}
                  </span>
                  <strong style="margin-inline-start:0.35rem;color:var(--latte-100)">\${esc(r.gate)}</strong>
                  \${r.command ? \`<span style="color:var(--latte-400);margin-inline-start:0.5rem">\${esc(r.command)}</span>\` : '<span style="color:var(--latte-500);margin-inline-start:0.5rem">(not configured)</span>'}
                </span>
                <span style="color:var(--latte-500)">\${r.durationMs}ms</span>
              </div>
              \${r.status === "failed" && r.output ? \`<pre>\${esc(r.output)}</pre>\` : ""}
            </div>
          \`).join("")}
        </div>
      \`;
    }

    function renderSecurityPanel() {
      if (!state.securityResult) return "";
      const s = state.securityResult;
      return \`
        <div class="surface animate-in" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.85rem">
            <h3 style="font-size:0.95rem">Security Scan (\${s.filesScanned} files scanned)</h3>
            <span class="badge \${s.passed ? "badge-success" : "badge-error"}">\${s.passed ? "Clean" : "Issues Found"}</span>
          </div>
          \${s.secretFindings.length === 0
            ? '<div class="gate-row"><div class="gate-row-top"><span><span style="color:var(--sage-200)">✓</span> <strong style="margin-inline-start:0.35rem;color:var(--latte-100)">Secrets &amp; Sensitive Files</strong></span><span style="color:var(--latte-500)">0 findings</span></div></div>'
            : s.secretFindings.map((f) => \`
              <div class="gate-row">
                <div class="gate-row-top">
                  <span><span style="color:var(--clay-200)">✗</span> <strong style="margin-inline-start:0.35rem;color:var(--clay-100)">\${esc(f.type)}</strong> <code style="margin-inline-start:0.4rem">\${esc(f.file)}\${f.line ? ":" + f.line : ""}</code></span>
                  <span class="badge badge-error">\${esc(f.severity)}</span>
                </div>
              </div>
            \`).join("")}
          <div class="gate-row">
            <div class="gate-row-top">
              <span>
                <span style="color:\${s.dependencyAudit.status === "passed" ? "var(--sage-200)" : s.dependencyAudit.status === "skipped" ? "var(--latte-500)" : "var(--clay-200)"}">
                  \${s.dependencyAudit.status === "passed" ? "✓" : s.dependencyAudit.status === "skipped" ? "○" : "✗"}
                </span>
                <strong style="margin-inline-start:0.35rem;color:var(--latte-100)">Dependency Audit</strong>
                <span style="color:var(--latte-400);margin-inline-start:0.5rem">\${esc(s.dependencyAudit.command || s.dependencyAudit.reason || "")}</span>
              </span>
              <span style="color:var(--latte-500)">\${s.dependencyAudit.durationMs || 0}ms</span>
            </div>
            \${s.dependencyAudit.status === "failed" && s.dependencyAudit.output ? \`<pre>\${esc(s.dependencyAudit.output)}</pre>\` : ""}
          </div>
        </div>
      \`;
    }

    function renderFarmDetail() {
      const main = document.getElementById("main");
      if (!state.detail) {
        main.innerHTML = '<div class="empty-state">Loading farm details...</div>';
        return;
      }

      const { health, checklist, garden, compost, plans, beads, justfile, docs } = state.detail;
      const isLegacy = Boolean(health.install?.isLegacy);
      const t = scoreTier(health.score);
      const beadsInfo = beads || { installed: false, initialized: false, summary: { total: 0, open: 0, inProgress: 0, blocked: 0, ready: 0, closed: 0 }, ready: [], issues: [] };
      const justInfo = justfile || { installed: false, exists: false, file: null, recipes: [] };

      const headerHtml = \`
        <div class="breadcrumb">
          <button type="button" id="bc-farms">Farms</button>
          \${ICONS.chevron}
          <span style="color:var(--latte-200)">\${esc(health.projectName)}</span>
        </div>

        <div class="page-header animate-in">
          <div style="flex:1;min-inline-size:0">
            <h1 class="page-title">\${esc(health.projectName)}</h1>
            <p class="page-sub" style="font-family:var(--font-mono);font-size:0.78rem">
              \${esc(health.path)} <span style="color:var(--latte-600);margin:0 0.35rem">/</span> \${esc(health.git.branch || "no-git")}
            </p>
            <div class="action-row">
              \${isLegacy
                ? \`<span class="badge badge-warning">Legacy \${esc(health.install.generation)}</span>\`
                : '<span class="badge badge-success">Active v3</span>'}
              <span class="badge badge-muted">\${esc(health.stack)}</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-audit" \${isLegacy ? "disabled" : ""}>
                <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                Run Audit
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-gates">
                <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                Run Gates
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-security">
                <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                Security Scan
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-jump-check" style="\${checklist.summary.percent === 100 && checklist.summary.activeTotal > 0 ? "border-color:rgba(118,145,102,0.35);color:var(--sage-200)" : ""}">
                Checklist <span style="color:var(--latte-400);font-size:11px">\${checklist.summary.percent}%</span>
              </button>
            </div>
          </div>

          <div class="header-stats">
            <div class="header-stat" style="text-align:center">
              <div class="header-stat-val">\${docs.length}</div>
              <div class="header-stat-lbl">docs</div>
            </div>
            <div class="stat-divider tall"></div>
            <div class="header-stat" style="text-align:center">
              <div class="header-stat-val big \${t.color}">\${health.score}</div>
              <div class="header-stat-lbl">\${esc(health.status)}</div>
            </div>
            \${scorePipHtml(health.score, { iconOnly: true })}
          </div>
        </div>

        \${renderLegacyBanner(health)}

        <nav class="repo-tabs" role="tablist">
          <button type="button" class="repo-tab \${state.tab === "overview" ? "active" : ""}" data-tab="overview">Audit</button>
          <button type="button" class="repo-tab \${state.tab === "beads" ? "active" : ""}" data-tab="beads">Beads <span class="repo-tab-count">\${beadsInfo.initialized ? beadsInfo.summary.ready + " ready" : "off"}</span></button>
          <button type="button" class="repo-tab \${state.tab === "justfile" ? "active" : ""}" data-tab="justfile">Justfile <span class="repo-tab-count">\${justInfo.exists ? justInfo.recipes.length : "off"}</span></button>
          <button type="button" class="repo-tab \${state.tab === "checklists" ? "active" : ""}" data-tab="checklists">Checklists <span class="repo-tab-count">\${checklist.summary.percent}%</span></button>
          <button type="button" class="repo-tab \${state.tab === "ideas" ? "active" : ""}" data-tab="ideas">Ideas <span class="repo-tab-count">\${garden.ideas.length}</span></button>
          <button type="button" class="repo-tab \${state.tab === "plans" ? "active" : ""}" data-tab="plans">Plans <span class="repo-tab-count">\${plans.length}</span></button>
          <button type="button" class="repo-tab \${state.tab === "docs" ? "active" : ""}" data-tab="docs">All Docs <span class="repo-tab-count">\${docs.length}</span></button>
        </nav>
      \`;

      let bodyHtml = "";

      if (state.tab === "overview") {
        const farmhouseDoc = docs.find((d) => d.path === "_AUDIT/FARMHOUSE.md");
        const pillarArt = {
          security: "/assets/audit-security.webp",
          performance: "/assets/audit-performance.webp",
          accessibility: "/assets/audit-accessibility.webp",
          "code-quality": "/assets/audit-code-quality.webp",
        };
        const pillars = health.pillars || [];
        bodyHtml = \`
          \${renderGatesPanel()}
          \${renderSecurityPanel()}
          <div class="art-grid">
            <div class="surface card-hover art-card" data-open-doc="_AUDIT/FARMHOUSE.md">
              <img src="/assets/audit-farmhouse.webp" alt="" class="art-bg" />
              <div class="art-card-inner">
                <div>
                  <h4>Farmhouse</h4>
                  <p>Overall project health &amp; audit history</p>
                </div>
                \${scorePipHtml(health.score)}
              </div>
            </div>
            <div class="surface card-hover art-card" data-switch-tab="checklists">
              <img src="/assets/audit-tests.webp" alt="" class="art-bg" />
              <div class="art-card-inner">
                <div>
                  <h4>Standards &amp; Tests</h4>
                  <p>\${health.metrics.testFiles} test files · \${health.metrics.checklistPercent}% checklist complete</p>
                </div>
                <span class="badge \${health.metrics.checklistPercent >= 80 ? "badge-success" : "badge-gold"}">\${health.metrics.checklistCompleted}/\${health.metrics.checklistActive}</span>
              </div>
            </div>
            \${pillars.map((p) => \`
              <div class="surface \${p.exists ? "card-hover" : ""} art-card" \${p.exists ? \`data-open-doc="\${esc(p.path)}"\` : 'style="opacity:0.58;cursor:default"'}>
                <img src="\${pillarArt[p.key] || "/assets/main-bg.webp"}" alt="" class="art-bg" />
                <div class="art-card-inner">
                  <div>
                    <h4>\${esc(p.title.replace(" Audit", ""))}</h4>
                    <p>\${esc(p.exists ? (p.status || p.description) : "Not audited yet — run via MCP")}</p>
                  </div>
                  \${p.exists && p.score !== null ? scorePipHtml(p.score) : '<span class="score-pip score-pip-muted">&mdash;</span>'}
                </div>
              </div>
            \`).join("")}
          </div>

          <div class="surface" style="padding:1.35rem 1.5rem;margin-block-end:1.5rem">
            <h3 style="font-size:0.95rem;margin-block-end:0.95rem">Deterministic Score Breakdown</h3>
            <div class="breakdown-list">
              \${health.breakdown.map((b) => \`
                <div class="breakdown-row">
                  <span style="display:flex;align-items:center;gap:0.6rem">
                    <span style="color:\${b.passed ? "var(--sage-200)" : "var(--honey-300)"}">\${b.passed ? "✓" : "!"}</span>
                    <span>\${esc(b.label)}</span>
                  </span>
                  <span class="breakdown-pts">\${b.points} / \${b.max}</span>
                </div>
              \`).join("")}
            </div>
          </div>

          \${farmhouseDoc ? \`
            <div class="surface prose-card">
              <div class="prose">\${renderMarkdown(farmhouseDoc.content)}</div>
            </div>
          \` : ""}
        \`;
      } else if (state.tab === "beads") {
        const s = beadsInfo.summary;
        const prioBadge = (p) => {
          const n = Number(p ?? 2);
          if (n <= 0) return '<span class="badge badge-error">P0</span>';
          if (n === 1) return '<span class="badge badge-warning">P1</span>';
          if (n === 2) return '<span class="badge badge-gold">P2</span>';
          return \`<span class="badge badge-muted">P\${n}</span>\`;
        };
        const statusBadge = (st) => {
          if (st === "in_progress") return '<span class="badge badge-gold">in_progress</span>';
          if (st === "closed") return '<span class="badge badge-success">closed</span>';
          if (st === "blocked") return '<span class="badge badge-error">blocked</span>';
          return \`<span class="badge badge-muted">\${esc(st || "open")}</span>\`;
        };
        const renderIssueRow = (it) => \`
          <div class="surface" style="padding:1rem 1.25rem;margin-block-end:0.6rem">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;min-inline-size:0">
                <code style="font-family:var(--font-mono);font-size:0.78rem;color:var(--honey-200)">\${esc(it.id)}</code>
                \${prioBadge(it.priority)}
                <span class="badge badge-muted">\${esc(it.issue_type || "task")}</span>
                \${statusBadge(it.status)}
                <span style="font-family:var(--font-mono);font-size:0.9rem;font-weight:500;color:var(--latte-50)">\${esc(it.title)}</span>
              </div>
              \${!isLegacy && beadsInfo.installed && it.status !== "closed" ? \`
                <div style="display:flex;align-items:center;gap:0.4rem">
                  \${it.status !== "in_progress" ? \`<button type="button" class="btn btn-secondary btn-sm" data-bead-claim="\${esc(it.id)}">Claim</button>\` : ""}
                  <button type="button" class="btn btn-primary btn-sm" data-bead-close="\${esc(it.id)}">Close</button>
                </div>
              \` : ""}
            </div>
            \${it.description ? \`<p style="margin:0.45rem 0 0;font-size:0.84rem;color:var(--latte-400)">\${esc(it.description)}</p>\` : ""}
          </div>
        \`;

        if (!beadsInfo.initialized) {
          bodyHtml = \`
            <div class="surface empty-state">
              <h3>Beads Not Initialized</h3>
              <p style="margin:0.4rem auto 1rem;max-inline-size:520px;font-size:0.86rem;color:var(--latte-400)">
                Beads (<code>bd</code>) gives your AI agents a git-backed dependency graph for cross-session task tracking (<code>bd ready</code>, <code>bd create</code>, <code>bd close</code>, <code>bd sync</code>).
              </p>
              \${!isLegacy && beadsInfo.installed
                ? '<button type="button" class="btn btn-primary btn-sm" id="btn-beads-init">Initialize Beads (.beads/)</button>'
                : '<a href="https://beads.gascity.com/" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Install Beads (beads.gascity.com)</a>'}
            </div>
          \`;
        } else {
          const activeIssues = (beadsInfo.issues || []).filter((i) => i.status !== "closed");
          const closedIssues = (beadsInfo.issues || []).filter((i) => i.status === "closed");
          bodyHtml = \`
            <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center">
                <span class="badge badge-success">\${s.ready} ready</span>
                <span class="badge badge-gold">\${s.inProgress} in progress</span>
                <span class="badge badge-muted">\${s.open} open</span>
                \${s.blocked ? \`<span class="badge badge-error">\${s.blocked} blocked</span>\` : ""}
                <span class="badge badge-muted">\${s.closed} closed</span>
              </div>
              <div style="display:flex;gap:0.5rem;align-items:center">
                \${!isLegacy && beadsInfo.installed ? '<button type="button" class="btn btn-secondary btn-sm" id="btn-beads-sync">Sync Beads (bd sync)</button>' : ""}
              </div>
            </div>

            \${!isLegacy && beadsInfo.installed ? \`
              <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.5rem">
                <h3 style="font-size:0.9rem;margin-block-end:0.8rem">Create New Bead</h3>
                <form class="inline-form" id="beads-create-form">
                  <input class="input-primary" name="title" placeholder="Task or feature title..." required />
                  <select class="input-primary" name="type" style="max-inline-size:135px">
                    <option value="task">task</option>
                    <option value="feature">feature</option>
                    <option value="bug">bug</option>
                    <option value="epic">epic</option>
                    <option value="chore">chore</option>
                  </select>
                  <select class="input-primary" name="priority" style="max-inline-size:100px">
                    <option value="0">P0</option>
                    <option value="1">P1</option>
                    <option value="2" selected>P2</option>
                    <option value="3">P3</option>
                    <option value="4">P4</option>
                  </select>
                  <button type="submit" class="btn btn-primary btn-sm">+ Add Bead</button>
                </form>
              </div>
            \` : ""}

            <div class="check-group-title">Ready Work — No Blockers (\${beadsInfo.ready.length})</div>
            \${beadsInfo.ready.length === 0
              ? '<div class="surface empty-state"><p style="margin:0">No unblocked ready beads right now.</p></div>'
              : beadsInfo.ready.map(renderIssueRow).join("")}

            <div class="check-group-title" style="margin-block-start:1.75rem">All Active Issues (\${activeIssues.length})</div>
            \${activeIssues.length === 0
              ? '<div class="surface empty-state"><p style="margin:0">No open issues.</p></div>'
              : activeIssues.map(renderIssueRow).join("")}

            \${closedIssues.length > 0 ? \`
              <div class="check-group-title" style="margin-block-start:1.75rem">Recently Closed (\${closedIssues.length})</div>
              \${closedIssues.slice(0, 10).map(renderIssueRow).join("")}
            \` : ""}
          \`;
        }
      } else if (state.tab === "justfile") {
        if (!justInfo.exists) {
          bodyHtml = \`
            <div class="surface empty-state">
              <h3>No Justfile Yet</h3>
              <p style="margin:0.4rem auto 1rem;max-inline-size:520px;font-size:0.86rem;color:var(--latte-400)">
                A maintained <code>justfile</code> (<code>just.systems</code>) gives humans and AI agents instant, memorable recipes for dev, lint, test, build, Farmwork audits, and Beads commands.
              </p>
              \${!isLegacy
                ? '<button type="button" class="btn btn-primary btn-sm" id="btn-just-init">Generate Stack-Aware Justfile</button>'
                : '<span class="badge badge-warning">Legacy read-only</span>'}
            </div>
          \`;
        } else {
          const jr = state.justResult;
          bodyHtml = \`
            <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap">
                <code style="font-family:var(--font-mono);font-size:0.9rem;color:var(--honey-200)">\${esc(justInfo.file)}</code>
                <span class="badge badge-muted">\${justInfo.recipes.length} recipes</span>
                <span class="badge \${justInfo.installed ? "badge-success" : "badge-warning"}">\${justInfo.installed ? "just CLI ready" : "install just CLI"}</span>
              </div>
              <div style="display:flex;gap:0.5rem">
                <button type="button" class="btn btn-secondary btn-sm" data-open-doc="\${esc(justInfo.file)}">View Source</button>
              </div>
            </div>

            \${jr ? \`
              <div class="surface animate-in" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.65rem">
                  <strong style="font-family:var(--font-mono);font-size:0.86rem;color:var(--latte-100)">\${esc(jr.command)}</strong>
                  <span style="display:flex;align-items:center;gap:0.5rem">
                    <span style="font-family:var(--font-mono);font-size:11px;color:var(--latte-500)">\${jr.durationMs}ms</span>
                    <span class="badge \${jr.passed ? "badge-success" : "badge-error"}">\${jr.passed ? "Passed" : "Exit " + jr.exitCode}</span>
                  </span>
                </div>
                <pre style="margin:0;padding:0.75rem;border-radius:0.4rem;background:rgba(9,9,11,0.7);border:1px solid rgba(255,255,255,0.06);font-family:var(--font-mono);font-size:12px;color:var(--latte-200);overflow-x:auto;white-space:pre-wrap">\${esc(jr.output || "(no output)")}</pre>
              </div>
            \` : ""}

            <div class="check-group-title">Maintained Recipes (\${justInfo.recipes.length})</div>
            \${justInfo.recipes.map((r) => {
              const hasRequiredParams = r.params.some((p) => !p.includes("="));
              return \`
                <div class="surface" style="padding:0.95rem 1.25rem;margin-block-end:0.55rem;display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
                  <div style="min-inline-size:0;flex:1">
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                      <code style="font-family:var(--font-mono);font-size:0.92rem;font-weight:600;color:var(--honey-200)">just \${esc(r.name)}</code>
                      \${r.params.length ? \`<code style="font-size:0.76rem;color:var(--latte-400)">\${esc(r.params.join(" "))}</code>\` : ""}
                      \${r.isDefault ? '<span class="badge badge-gold">default</span>' : ""}
                      \${r.deps.length ? \`<span class="badge badge-muted">deps: \${esc(r.deps.join(", "))}</span>\` : ""}
                    </div>
                    \${r.description ? \`<p style="margin:0.35rem 0 0;font-size:0.83rem;color:var(--latte-400)">\${esc(r.description)}</p>\` : ""}
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" data-run-just="\${esc(r.name)}" \${!justInfo.installed || hasRequiredParams ? "disabled" : ""} title="\${!justInfo.installed ? "Install just CLI first" : hasRequiredParams ? "Requires CLI arguments" : "Run recipe"}">
                    Run
                  </button>
                </div>
              \`;
            }).join("")}
          \`;
        }
      } else if (state.tab === "checklists") {
        const complete = checklist.summary.activeTotal > 0 && checklist.summary.percent === 100;
        const groups = {};
        for (const it of checklist.items) (groups[it.group] ||= []).push(it);

        bodyHtml = \`
          <div class="progress-card \${complete ? "complete" : "surface"}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.86rem;color:\${complete ? "var(--sage-200)" : "var(--latte-300)"}">Progress</span>
              <span style="font-family:var(--font-mono);font-size:1.15rem;font-weight:600;color:\${complete ? "var(--sage-200)" : "var(--honey-200)"}">\${checklist.summary.percent}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:\${checklist.summary.percent}%"></div>
            </div>
            <div style="margin-block-start:0.55rem;display:flex;justify-content:space-between;font-size:0.76rem;color:\${complete ? "rgba(162,181,144,0.8)" : "var(--latte-500)"}">
              <span>\${checklist.summary.completed} of \${checklist.summary.activeTotal || 0} items completed\${checklist.summary.skipped ? \` · \${checklist.summary.skipped} skipped\` : ""}</span>
              \${complete ? '<span style="color:var(--sage-200);font-weight:600">All done!</span>' : ""}
            </div>
          </div>

          \${Object.entries(groups).map(([grp, items]) => \`
            <div class="check-group-title">\${esc(grp)}</div>
            \${items.map((it) => \`
              <div class="surface check-row \${it.state} \${isLegacy ? "readonly" : ""}" data-row-toggle="\${it.id}" data-row-next="\${it.state === "complete" ? "pending" : "complete"}">
                <div class="check-left">
                  <div class="check-box">
                    \${it.state === "complete" ? ICONS.check : it.state === "skip" ? ICONS.x : ""}
                  </div>
                  <div class="check-title">
                    \${esc(it.title)}
                    \${it.state === "skip" ? '<span style="font-size:10px;color:var(--latte-500);margin-inline-start:0.4rem;font-style:normal;text-decoration:none">Not Applicable</span>' : ""}
                  </div>
                </div>
                \${isLegacy ? "" : \`
                  <button type="button" class="btn btn-secondary btn-sm skip-btn" data-skip-id="\${it.id}" data-skip-next="\${it.state === "skip" ? "pending" : "skip"}">
                    \${it.state === "skip" ? "Restore" : "Not Applicable"}
                  </button>
                \`}
              </div>
            \`).join("")}
          \`).join("") || '<div class="surface empty-state"><h3>No checklist items yet</h3></div>'}

          \${isLegacy ? "" : \`
            <div class="surface" style="padding:1.15rem 1.3rem;margin-block-start:1.5rem">
              <form class="inline-form" id="add-check-form">
                <input class="input-primary" name="group" value="Project Standards" placeholder="Section group..." style="max-inline-size:240px" />
                <input class="input-primary" name="title" placeholder="Add a new engineering standard..." required />
                <button type="submit" class="btn btn-primary btn-sm">+ Add Item</button>
              </form>
            </div>
          \`}
        \`;
      } else if (state.tab === "ideas") {
        bodyHtml = \`
          <div class="art-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
            <div class="surface card-hover art-card" data-open-doc="_AUDIT/GARDEN.md">
              <img src="/assets/audit-garden.webp" alt="" class="art-bg" />
              <div class="art-card-inner">
                <div>
                  <h4>Garden</h4>
                  <p>Ideas being cultivated &amp; aged (45d wilting, 60d auto-compost)</p>
                </div>
                <div style="text-align:end;font-family:var(--font-mono);font-size:0.8rem">
                  <span style="color:var(--sage-200)">\${garden.ideas.length}</span> <span style="color:var(--latte-500)">active</span>
                </div>
              </div>
            </div>
            <div class="surface card-hover art-card" data-open-doc="_AUDIT/COMPOST.md">
              <img src="/assets/audit-compost.webp" alt="" class="art-bg" />
              <div class="art-card-inner">
                <div>
                  <h4>Compost</h4>
                  <p>Retired ideas decomposing into future nutrients</p>
                </div>
                <div style="text-align:end;font-family:var(--font-mono);font-size:0.8rem">
                  <span style="color:var(--latte-200)">\${compost.items.length}</span> <span style="color:var(--latte-500)">archived</span>
                </div>
              </div>
            </div>
          </div>

          \${isLegacy ? "" : \`
            <div class="surface" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
              <h3 style="font-size:0.9rem;margin-block-end:0.8rem">Plant a New Idea</h3>
              <form class="inline-form" id="plant-form">
                <input class="input-primary" name="title" placeholder="Idea title..." required />
                <input class="input-primary" name="description" placeholder="Short description..." />
                <button type="submit" class="btn btn-primary btn-sm">Plant Idea</button>
              </form>
            </div>
          \`}

          <div class="check-group-title">Active Garden (\${garden.ideas.length})</div>
          \${garden.ideas.length === 0 ? '<div class="surface empty-state"><p style="margin:0">No active ideas planted yet.</p></div>' : garden.ideas.map((idea) => \`
            <div class="surface" style="padding:1.1rem 1.25rem;margin-block-end:0.65rem">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
                <div style="font-family:var(--font-mono);font-size:0.95rem;font-weight:500;color:var(--latte-50)">\${esc(idea.title)}</div>
                <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap">
                  <span class="badge \${idea.lifecycle === "fresh" ? "badge-success" : idea.lifecycle === "wilting" ? "badge-warning" : "badge-error"}">\${idea.ageDays}d · \${idea.lifecycle}</span>
                  \${isLegacy ? "" : \`
                    <button type="button" class="btn btn-secondary btn-sm" data-graduate="\${esc(idea.title)}" data-desc="\${esc(idea.description || "")}">Graduate to Plan</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-compost="\${esc(idea.title)}">Compost</button>
                  \`}
                </div>
              </div>
              \${idea.description ? \`<p style="margin:0.45rem 0 0;font-size:0.86rem;color:var(--latte-400)">\${esc(idea.description)}</p>\` : ""}
            </div>
          \`).join("")}

          <div class="check-group-title" style="margin-block-start:2rem">Compost Archive (\${compost.items.length})</div>
          \${compost.items.length === 0 ? '<div class="surface empty-state"><p style="margin:0">No composted ideas yet.</p></div>' : compost.items.map((c) => \`
            <div class="surface" style="padding:1rem 1.25rem;margin-block-end:0.55rem;opacity:0.82">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem">
                <span style="font-family:var(--font-mono);font-size:0.9rem;color:var(--latte-200)">\${esc(c.title)}</span>
                <span class="badge badge-muted">\${esc(c.composted || "")}</span>
              </div>
              <p style="margin:0.35rem 0 0;font-size:0.82rem;color:var(--latte-400)"><strong style="color:var(--latte-300)">Reason:</strong> \${esc(c.reason)}</p>
            </div>
          \`).join("")}
        \`;
      } else if (state.tab === "plans") {
        const planDocs = docs.filter((d) => d.category === "Plans");
        bodyHtml = plans.length === 0
          ? '<div class="surface empty-state"><h3>No plans yet</h3><p style="margin:0.3rem 0 0;font-size:0.86rem">Ask your AI agent to call <code>farmwork_plan</code> or graduate an idea from the Ideas tab.</p></div>'
          : plans.map((p) => {
              const doc = planDocs.find((d) => d.path === p.path);
              return \`
                <div class="surface" style="padding:1.35rem 1.5rem;margin-block-end:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-block-end:0.85rem;padding-block-end:0.8rem;border-block-end:1px solid rgba(255,255,255,0.06)">
                    <div>
                      <h3 style="font-size:1.05rem">\${esc(p.title)}</h3>
                      <div style="font-family:var(--font-mono);font-size:11px;color:var(--latte-500);margin-block-start:0.2rem">\${esc(p.path)}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem">
                      <span class="badge \${p.completed ? "badge-success" : "badge-gold"}">\${esc(p.status)}</span>
                      <button type="button" class="btn btn-secondary btn-sm" data-open-doc="\${esc(p.path)}">Reader</button>
                      \${!isLegacy && !p.completed ? \`<button type="button" class="btn btn-primary btn-sm" data-complete-plan="\${esc(p.slug)}">Mark Complete</button>\` : ""}
                    </div>
                  </div>
                  <div class="prose">\${renderMarkdown(doc?.content || "")}</div>
                </div>
              \`;
            }).join("");
      } else if (state.tab === "docs") {
        bodyHtml = docs.length === 0
          ? '<div class="surface empty-state"><h3>No Markdown documents found</h3></div>'
          : docs.map((d) => \`
              <div class="surface card-hover doc-row" data-open-doc="\${esc(d.path)}">
                <div style="min-inline-size:0;flex:1">
                  <h4>\${esc(d.title)}</h4>
                  <code>\${esc(d.path)}</code>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem;flex:none">
                  <span class="badge badge-muted">\${esc(d.category)}</span>
                  \${ICONS.chevron}
                </div>
              </div>
            \`).join("");
      }

      main.innerHTML = headerHtml + bodyHtml;

      main.querySelector("#bc-farms")?.addEventListener("click", () => { state.view = "farms"; render(); });
      main.querySelector("#btn-jump-check")?.addEventListener("click", () => { state.tab = "checklists"; render(); });
      main.querySelector("#btn-run-audit")?.addEventListener("click", async () => {
        state.detail = await api("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: state.selectedPath }),
        });
        await refreshFarmsOnly();
        render();
      });
      main.querySelector("#btn-run-gates")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Running Gates...";
        try {
          state.gateResult = await api("/api/gates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath }),
          });
          state.detail = await api("/api/farm?path=" + encodeURIComponent(state.selectedPath));
          await refreshFarmsOnly();
          state.tab = "overview";
          render();
        } finally {
          btn.disabled = false;
        }
      });

      main.querySelector("#btn-run-security")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Scanning...";
        try {
          state.securityResult = await api("/api/security", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath }),
          });
          state.tab = "overview";
          render();
        } finally {
          btn.disabled = false;
        }
      });

      for (const tabBtn of main.querySelectorAll("[data-tab]")) {
        tabBtn.addEventListener("click", () => { state.tab = tabBtn.dataset.tab; render(); });
      }
      for (const el of main.querySelectorAll("[data-switch-tab]")) {
        el.addEventListener("click", () => { state.tab = el.dataset.switchTab; render(); });
      }
      for (const el of main.querySelectorAll("[data-open-doc]")) {
        el.addEventListener("click", () => {
          const targetDoc = el.dataset.openDoc;
          if (docs.some((d) => d.path === targetDoc)) {
            state.docPath = targetDoc;
            state.view = "doc";
            render();
          }
        });
      }

      if (!isLegacy) {
        for (const row of main.querySelectorAll("[data-row-toggle]")) {
          row.addEventListener("click", async (e) => {
            if (e.target.closest("[data-skip-id]")) return;
            state.detail = await api("/api/checklist/toggle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, id: Number(row.dataset.rowToggle), state: row.dataset.rowNext }),
            });
            await refreshFarmsOnly();
            render();
          });
        }
        for (const btn of main.querySelectorAll("[data-skip-id]")) {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            state.detail = await api("/api/checklist/toggle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, id: Number(btn.dataset.skipId), state: btn.dataset.skipNext }),
            });
            await refreshFarmsOnly();
            render();
          });
        }
        main.querySelector("#add-check-form")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          state.detail = await api("/api/checklist/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath, group: fd.get("group"), title: fd.get("title") }),
          });
          await refreshFarmsOnly();
          render();
        });
        main.querySelector("#plant-form")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          state.detail = await api("/api/garden/plant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath, title: fd.get("title"), description: fd.get("description") }),
          });
          await refreshFarmsOnly();
          render();
        });
        for (const btn of main.querySelectorAll("[data-graduate]")) {
          btn.addEventListener("click", async () => {
            state.detail = await api("/api/plan/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, title: btn.dataset.graduate, summary: btn.dataset.desc, fromIdea: btn.dataset.graduate }),
            });
            await refreshFarmsOnly();
            state.tab = "plans";
            render();
          });
        }
        for (const btn of main.querySelectorAll("[data-compost]")) {
          btn.addEventListener("click", () => {
            state.pendingCompostTitle = btn.dataset.compost;
            document.getElementById("compost-target-label").textContent = "Retire: " + state.pendingCompostTitle;
            document.getElementById("compost-reason").value = "Out of scope";
            document.getElementById("compost-dialog").showModal();
          });
        }
        for (const btn of main.querySelectorAll("[data-complete-plan]")) {
          btn.addEventListener("click", async () => {
            state.detail = await api("/api/plan/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, plan: btn.dataset.completePlan }),
            });
            await refreshFarmsOnly();
            render();
          });
        }
        main.querySelector("#btn-beads-init")?.addEventListener("click", async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = "Initializing...";
          state.detail = await api("/api/beads/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath }),
          });
          await refreshFarmsOnly();
          render();
        });
        main.querySelector("#btn-beads-sync")?.addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = "Syncing...";
          try {
            const res = await api("/api/beads/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath }),
            });
            if (res.detail) state.detail = res.detail;
            await refreshFarmsOnly();
            render();
          } finally {
            btn.disabled = false;
          }
        });
        main.querySelector("#beads-create-form")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          state.detail = await api("/api/beads/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: state.selectedPath,
              title: fd.get("title"),
              type: fd.get("type"),
              priority: Number(fd.get("priority")),
            }),
          });
          await refreshFarmsOnly();
          render();
        });
        for (const btn of main.querySelectorAll("[data-bead-claim]")) {
          btn.addEventListener("click", async () => {
            state.detail = await api("/api/beads/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, id: btn.dataset.beadClaim, status: "in_progress" }),
            });
            await refreshFarmsOnly();
            render();
          });
        }
        for (const btn of main.querySelectorAll("[data-bead-close]")) {
          btn.addEventListener("click", async () => {
            state.detail = await api("/api/beads/close", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, id: btn.dataset.beadClose }),
            });
            await refreshFarmsOnly();
            render();
          });
        }
        main.querySelector("#btn-just-init")?.addEventListener("click", async () => {
          state.detail = await api("/api/just/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: state.selectedPath }),
          });
          await refreshFarmsOnly();
          render();
        });
      }

      for (const btn of main.querySelectorAll("[data-run-just]")) {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Running...";
          try {
            state.justResult = await api("/api/just/run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: state.selectedPath, recipe: btn.dataset.runJust }),
            });
            render();
          } finally {
            btn.disabled = false;
          }
        });
      }
    }

    function renderDocReader() {
      const main = document.getElementById("main");
      const { health, docs } = state.detail;
      const idx = Math.max(0, docs.findIndex((d) => d.path === state.docPath));
      const doc = docs[idx];
      if (!doc) { state.view = "farm"; render(); return; }

      const prevDoc = idx > 0 ? docs[idx - 1] : null;
      const nextDoc = idx < docs.length - 1 ? docs[idx + 1] : null;

      document.getElementById("doc-watermark").innerHTML =
        \`<div class="doc-watermark"><img src="\${docArtForPath(doc.path)}" alt="" /></div>\`;

      main.innerHTML = \`
        <div class="breadcrumb animate-in">
          <button type="button" id="doc-bc-farms">Farms</button>
          \${ICONS.chevron}
          <button type="button" id="doc-bc-farm">\${esc(health.projectName)}</button>
          \${ICONS.chevron}
          <span style="color:var(--latte-200)">\${esc(doc.name)}</span>
        </div>

        <div class="page-header animate-in" style="margin-block-end:1.5rem">
          <div>
            <h1 class="page-title">\${esc(doc.title)}</h1>
            <div class="action-row">
              <code style="font-family:var(--font-mono);font-size:0.76rem;background:var(--crust-200);border:1px solid rgba(255,255,255,0.08);color:var(--honey-200);padding:0.25rem 0.6rem;border-radius:6px">\${esc(doc.path)}</code>
              <span class="badge badge-success">\${esc(doc.category)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="doc-back">← Back to Farm</button>
        </div>

        <div class="prose-reader animate-in">
          <article class="surface prose-card">
            <div class="prose" style="--prose-size:\${state.prosePx}px">\${renderMarkdown(doc.content)}</div>
          </article>

          <div style="display:flex;justify-content:space-between;margin-block-start:1.5rem;gap:0.75rem">
            \${prevDoc ? \`<button type="button" class="btn btn-secondary btn-sm" data-nav-doc="\${esc(prevDoc.path)}">← \${esc(prevDoc.name)}</button>\` : "<div></div>"}
            \${nextDoc ? \`<button type="button" class="btn btn-secondary btn-sm" data-nav-doc="\${esc(nextDoc.path)}">\${esc(nextDoc.name)} →</button>\` : "<div></div>"}
          </div>
        </div>
      \`;

      main.querySelector("#doc-bc-farms")?.addEventListener("click", () => { state.view = "farms"; render(); });
      main.querySelector("#doc-bc-farm")?.addEventListener("click", () => { state.view = "farm"; render(); });
      main.querySelector("#doc-back")?.addEventListener("click", () => { state.view = "farm"; render(); });
      for (const b of main.querySelectorAll("[data-nav-doc]")) {
        b.addEventListener("click", () => { state.docPath = b.dataset.navDoc; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      }
    }

    function render() {
      renderSidebar();
      const watermark = document.getElementById("doc-watermark");
      const textCtrl = document.getElementById("text-size-controls");
      if (state.view !== "doc") {
        watermark.innerHTML = "";
        textCtrl.hidden = true;
      } else {
        textCtrl.hidden = false;
        document.getElementById("text-reset").textContent = String(state.prosePx);
      }

      if (state.view === "farms") renderFarmsIndex();
      else if (state.view === "checklists") renderChecklistsPortfolio();
      else if (state.view === "farm") renderFarmDetail();
      else if (state.view === "doc") renderDocReader();
    }

    async function refreshFarmsOnly() {
      const data = await api("/api/farms");
      state.root = data.root;
      state.farms = data.farms;
    }

    async function openFarm(farmPath, tab = "overview") {
      state.selectedPath = farmPath;
      state.tab = tab;
      state.gateResult = null;
      state.securityResult = null;
      state.justResult = null;
      state.view = "farm";
      render();
      state.detail = await api("/api/farm?path=" + encodeURIComponent(farmPath));
      render();
    }

    async function boot() {
      await refreshFarmsOnly();
      if (state.farms.length === 1) {
        await openFarm(state.farms[0].path, "overview");
      } else {
        state.view = "farms";
        render();
      }
    }

    document.getElementById("logo-home").addEventListener("click", () => { closeMobileMenu(); state.view = "farms"; render(); });
    document.getElementById("nav-farms").addEventListener("click", () => { closeMobileMenu(); state.view = "farms"; render(); });
    document.getElementById("nav-checklists").addEventListener("click", () => { closeMobileMenu(); state.view = "checklists"; render(); });
    document.getElementById("refresh-btn").addEventListener("click", async () => {
      await refreshFarmsOnly();
      if (state.selectedPath && (state.view === "farm" || state.view === "doc")) {
        state.detail = await api("/api/farm?path=" + encodeURIComponent(state.selectedPath));
      }
      render();
    });

    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
      document.getElementById("mobile-overlay").classList.toggle("open");
    });
    document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu);

    document.getElementById("text-inc").addEventListener("click", () => { state.prosePx = Math.min(22, state.prosePx + 1); render(); });
    document.getElementById("text-dec").addEventListener("click", () => { state.prosePx = Math.max(12, state.prosePx - 1); render(); });
    document.getElementById("text-reset").addEventListener("click", () => { state.prosePx = 15; render(); });

    document.getElementById("compost-cancel").addEventListener("click", () => {
      document.getElementById("compost-dialog").close();
    });
    document.getElementById("compost-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.pendingCompostTitle) return;
      const reason = document.getElementById("compost-reason").value.trim() || "Retired";
      document.getElementById("compost-dialog").close();
      state.detail = await api("/api/garden/compost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: state.selectedPath, title: state.pendingCompostTitle, reason }),
      });
      state.pendingCompostTitle = null;
      await refreshFarmsOnly();
      render();
    });

    // Light-dismiss fallback for browsers without native dialog closedby support (Safari)
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener("pointerup", (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
      }
    }

    function connectLiveUpdates() {
      if (typeof EventSource === "undefined") return;
      const es = new EventSource("/api/events");
      es.addEventListener("change", async () => {
        // Avoid disrupting active typing inside an input
        if (document.activeElement && document.activeElement.matches("input, textarea")) return;
        await refreshFarmsOnly();
        if (state.selectedPath && (state.view === "farm" || state.view === "doc")) {
          state.detail = await api("/api/farm?path=" + encodeURIComponent(state.selectedPath));
        }
        render();
      });
    }

    boot().then(connectLiveUpdates);
  </script>
</body>
</html>
`;
