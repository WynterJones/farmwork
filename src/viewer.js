import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
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
  countFarmDocs,
  readFarmDocs,
  runAudit,
  runGates,
  runSecurityScan,
  runCodeQualityScan,
  setChecklistItem,
  addChecklistItem,
  plantIdea,
  compostIdea,
  createPlan,
  completePlan,
  graduatePlanToBeads,
  detectJustfile,
  initJustfile,
  runJustRecipe,
  getBeadsState,
  initBeads,
  runBeadsAction,
} from "./core.js";
import { VIEWER_HTML } from "./viewer/template.js";
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

const ASSET_CACHE = new Map();
const VIEWER_HTML_BUF = Buffer.from(VIEWER_HTML, "utf8");

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function canonicalPath(p) {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function isWithinRoot(rootDir, targetPath) {
  const root = canonicalPath(rootDir);
  const target = canonicalPath(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl/tests) omit Origin
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
}

function sendJson(res, status, data) {
  const body = Buffer.from(JSON.stringify(data), "utf8");
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const MAX_BODY_BYTES = 512 * 1024;

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        settled = true;
        req.destroy();
        reject(new Error("Payload too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
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

  const resolveSafeTarget = (res, rawPath) => {
    const target = rawPath || resolvedRoot;
    if (!isWithinRoot(resolvedRoot, target)) {
      sendJson(res, 403, { error: "Path outside viewer root" });
      return null;
    }
    return target;
  };

  const postHandlers = {
    "/api/gates": (target, body) => runGates(target, { only: body.only }),
    "/api/security": (target, body) => runSecurityScan(target, { skipDeps: Boolean(body.skipDeps) }),
    "/api/code-quality": (target) => runCodeQualityScan(target, { skipDeadCode: true }),
    "/api/audit": (target) => {
      runAudit(target);
      return getFarmDetail(target);
    },
    "/api/checklist/toggle": (target, body) => {
      setChecklistItem(target, { target: body.id, state: body.state });
      return getFarmDetail(target);
    },
    "/api/checklist/add": (target, body) => {
      addChecklistItem(target, {
        group: body.group || BIG_PLANS_GROUP,
        title: body.title,
        beadsId: body.beadsId || null,
        planPath: body.planPath || null,
      });
      return getFarmDetail(target);
    },
    "/api/checklist/link": (target, body) => {
      linkChecklistItem(target, { target: body.id, beadsId: body.beadsId, planPath: body.planPath });
      return getFarmDetail(target);
    },
    "/api/garden/plant": (target, body) => {
      plantIdea(target, { title: body.title, description: body.description || "" });
      return getFarmDetail(target);
    },
    "/api/garden/compost": (target, body) => {
      compostIdea(target, { title: body.title, reason: body.reason || "Retired from Local Viewer" });
      return getFarmDetail(target);
    },
    "/api/plan/create": (target, body) => {
      createPlan(target, { title: body.title, summary: body.summary || "", fromIdea: body.fromIdea || null });
      return getFarmDetail(target);
    },
    "/api/plan/complete": (target, body) => {
      completePlan(target, body.plan);
      return getFarmDetail(target);
    },
    "/api/plan/to-beads": (target, body) => {
      graduatePlanToBeads(target, body.plan);
      return getFarmDetail(target);
    },
    "/api/beads/init": (target, body) => {
      initBeads(target, { prefix: body.prefix });
      return getFarmDetail(target);
    },
    "/api/beads/create": (target, body) => {
      runBeadsAction(target, {
        action: "create",
        title: body.title,
        type: body.type || "task",
        priority: body.priority ?? 2,
        description: body.description || "",
      });
      return getFarmDetail(target);
    },
    "/api/beads/update": (target, body) => {
      runBeadsAction(target, { action: "update", id: body.id, status: body.status });
      return getFarmDetail(target);
    },
    "/api/beads/close": (target, body) => {
      runBeadsAction(target, { action: "close", id: body.id, reason: body.reason || "Completed from Local Viewer" });
      return getFarmDetail(target);
    },
    "/api/beads/sync": (target) => ({ ...runBeadsAction(target, { action: "sync" }), detail: getFarmDetail(target) }),
    "/api/just/init": (target, body) => {
      initJustfile(target, { force: Boolean(body.force) });
      return getFarmDetail(target);
    },
    "/api/just/run": (target, body) => runJustRecipe(target, body.recipe, { args: body.args }),
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/") {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": String(VIEWER_HTML_BUF.length),
        });
        res.end(VIEWER_HTML_BUF);
        return;
      }

      if (req.method === "GET" && pathname === "/api/events") {
        syncWatchers();
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/assets/")) {
        const fileName = path.basename(pathname.slice("/assets/".length));
        if (!ALLOWED_ASSETS.has(fileName)) {
          sendJson(res, 404, { error: "Asset not found" });
          return;
        }
        let buf = ASSET_CACHE.get(fileName);
        if (!buf) {
          const assetPath = path.join(ASSETS_DIR, fileName);
          if (!fs.existsSync(assetPath)) {
            sendJson(res, 404, { error: "Asset missing" });
            return;
          }
          buf = fs.readFileSync(assetPath);
          ASSET_CACHE.set(fileName, buf);
        }
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, immutable",
          "Content-Length": String(buf.length),
        });
        res.end(buf);
        return;
      }

      if (req.method === "GET" && pathname === "/api/farms") {
        const scanned = scanFarms(resolvedRoot);
        const enriched = scanned.farms.map((farm) => ({ ...farm, docCount: countFarmDocs(farm.path) }));
        sendJson(res, 200, { version: VERSION, root: scanned.root, farms: enriched });
        return;
      }

      if (req.method === "GET" && pathname === "/api/farm") {
        const target = resolveSafeTarget(res, url.searchParams.get("path"));
        if (!target) return;
        sendJson(res, 200, getFarmDetail(target));
        return;
      }

      if (req.method === "POST" && pathname in postHandlers) {
        if (!isAllowedOrigin(req)) {
          sendJson(res, 403, { error: "Cross-origin POST blocked" });
          return;
        }
        const body = await readBody(req);
        const target = resolveSafeTarget(res, body.path);
        if (!target) return;
        sendJson(res, 200, postHandlers[pathname](target, body));
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
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { shell: false, detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // ignore if browser launcher unavailable
  }
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

  if (options.open !== false) openBrowser(url);
  return { server, url, port: boundPort };
}
