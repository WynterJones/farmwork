#!/usr/bin/env node
/**
 * Operator - high-level view across many farms (repos).
 *
 * Zero dependencies, Node 18+. Reads ~/.operator/config.json for the farm
 * registry and the FarmFactory API connection. Every command supports --json
 * for machine-readable output.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const OPERATOR_HOME = process.env.OPERATOR_HOME || path.join(os.homedir(), ".operator");
const CONFIG_PATH = path.join(OPERATOR_HOME, "config.json");

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const args = argv.filter((a) => a !== "--json");
const command = args[0] || "status";

/* ---------------------------------------------------------------- config */

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(
      `No config at ${CONFIG_PATH}\n` +
        `Run: operator init   (then edit the file to register your farms)`,
    );
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    fail(`Config at ${CONFIG_PATH} is not valid JSON: ${error.message}`);
  }
}

function saveConfig(config) {
  fs.mkdirSync(OPERATOR_HOME, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Flattens groups into a single farm list, each tagged with its group. */
function allFarms(config) {
  return (config.groups || []).flatMap((group) =>
    (group.farms || []).map((farm) => ({ ...farm, group: group.name })),
  );
}

function findFarm(config, needle) {
  if (!needle) return null;
  const key = needle.toLowerCase();
  const farms = allFarms(config);
  return (
    farms.find((f) => f.name?.toLowerCase() === key) ||
    farms.find((f) => f.slug?.toLowerCase() === key) ||
    farms.find((f) => path.basename(f.path || "").toLowerCase() === key) ||
    farms.find((f) => f.name?.toLowerCase().includes(key)) ||
    null
  );
}

/* ------------------------------------------------------------------- git */

function git(cwd, gitArgs) {
  try {
    return execFileSync("git", ["-C", cwd, ...gitArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function farmGitState(farm) {
  if (!farm.path || !fs.existsSync(farm.path)) {
    return { ok: false, error: "path not found" };
  }
  if (!fs.existsSync(path.join(farm.path, ".git"))) {
    return { ok: false, error: "not a git repo" };
  }

  const porcelain = git(farm.path, ["status", "--porcelain"]) ?? "";
  const dirty = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;
  const branch = git(farm.path, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const last = git(farm.path, ["log", "-1", `--format=%h\x1f%ar\x1f%s`]);
  const [sha, when, subject] = last ? last.split("\x1f") : [null, null, null];

  let ahead = 0;
  let behind = 0;
  const counts = git(farm.path, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  if (counts) {
    const [b, a] = counts.split(/\s+/).map(Number);
    behind = b || 0;
    ahead = a || 0;
  }

  return {
    ok: true,
    branch,
    dirty,
    ahead,
    behind,
    hasUpstream: counts !== null,
    lastCommit: sha ? { sha, when, subject } : null,
    farmworkInstalled: fs.existsSync(path.join(farm.path, "CLAUDE.md")),
  };
}

/* ------------------------------------------------------------------- api */

function apiConfig(config) {
  const ff = config.farmfactory || {};
  const baseUrl = (process.env.FARMFACTORY_URL || ff.baseUrl || "").replace(/\/+$/, "");
  const apiKey = process.env.FARMFACTORY_API_KEY || ff.apiKey || "";
  return { baseUrl, apiKey, configured: Boolean(baseUrl && apiKey) };
}

async function api(config, method, endpoint, body) {
  const { baseUrl, apiKey, configured } = apiConfig(config);
  if (!configured) {
    fail(
      "FarmFactory API is not configured.\n" +
        "Set farmfactory.baseUrl and farmfactory.apiKey in " +
        `${CONFIG_PATH}, or export FARMFACTORY_URL and FARMFACTORY_API_KEY.`,
    );
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    fail(`Could not reach FarmFactory at ${baseUrl}: ${error.message}`);
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const detail = payload?.message || payload?.error || response.statusText;
    const messages = payload?.messages ? ` (${payload.messages.join("; ")})` : "";
    fail(`FarmFactory ${method} ${endpoint} failed: ${response.status} ${detail}${messages}`);
  }

  return payload;
}

/**
 * Accepts a checklist id, a farm name, or a farm slug and resolves it to a
 * checklist id via the API so callers never have to know numeric ids.
 */
async function resolveChecklistId(config, needle) {
  if (!needle) fail("Missing farm or checklist id.");
  if (/^\d+$/.test(needle)) return Number(needle);

  const farm = findFarm(config, needle);
  const slug = farm?.slug || needle;
  const checklists = await api(config, "GET", "/api/checklists");
  const key = String(slug).toLowerCase();

  const match =
    checklists.find((c) => c.repository_slug?.toLowerCase() === key) ||
    checklists.find((c) => c.name?.toLowerCase() === key) ||
    checklists.find((c) => c.name?.toLowerCase().includes(key));

  if (!match) {
    fail(
      `No checklist matches "${needle}".\n` +
        `Known checklists: ${checklists.map((c) => `${c.name} (#${c.id})`).join(", ") || "none"}`,
    );
  }
  return match.id;
}

/* ----------------------------------------------------------------- output */

function fail(message) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`operator: ${message}`);
  }
  process.exit(1);
}

function emit(data, renderText) {
  if (JSON_OUT) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    renderText(data);
  }
}

function bar(percentage) {
  const filled = Math.round((percentage / 100) * 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

/* --------------------------------------------------------------- commands */

async function cmdInit() {
  if (fs.existsSync(CONFIG_PATH)) {
    console.log(`Config already exists: ${CONFIG_PATH}`);
    return;
  }
  // Pre-fill the hosted instance so setup only needs an API key. Overridable
  // via config or FARMFACTORY_URL for self-hosted deployments.
  saveConfig({
    farmfactory: { baseUrl: "https://factory.farmwork.dev", apiKey: "" },
    groups: [{ name: "Default", description: "", farms: [] }],
  });
  console.log(`Created ${CONFIG_PATH}`);
  console.log("Add farms with: operator add <name> <path> --group <group>");
  console.log("Add an API key from factory.farmwork.dev to enable checklists.");
}

function cmdGroups(config) {
  const groups = (config.groups || []).map((g) => ({
    name: g.name,
    description: g.description || "",
    farmCount: (g.farms || []).length,
    farms: (g.farms || []).map((f) => f.name),
  }));

  emit(groups, (rows) => {
    if (!rows.length) return console.log("No groups configured.");
    for (const row of rows) {
      console.log(`\n${row.name} (${row.farmCount})`);
      if (row.description) console.log(`  ${row.description}`);
      for (const farm of row.farms) console.log(`  - ${farm}`);
    }
    console.log("");
  });
}

function cmdFarms(config, groupFilter) {
  let farms = allFarms(config);
  if (groupFilter) {
    farms = farms.filter((f) => f.group?.toLowerCase() === groupFilter.toLowerCase());
  }

  emit(farms, (rows) => {
    if (!rows.length) return console.log("No farms configured.");
    for (const farm of rows) {
      const exists = farm.path && fs.existsSync(farm.path) ? "" : "  [MISSING PATH]";
      console.log(`${farm.group.padEnd(14)} ${farm.name.padEnd(22)} ${farm.path}${exists}`);
    }
  });
}

function cmdAdd(config, rest) {
  const [name, farmPath] = rest;
  if (!name || !farmPath) fail("Usage: operator add <name> <path> [--group G] [--slug S] [--desc D]");

  const flag = (key) => {
    const i = rest.indexOf(`--${key}`);
    return i !== -1 ? rest[i + 1] : undefined;
  };

  const resolved = path.resolve(farmPath.replace(/^~/, os.homedir()));
  if (!fs.existsSync(resolved)) fail(`Path does not exist: ${resolved}`);

  const groupName = flag("group") || "Default";
  config.groups = config.groups || [];
  let group = config.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
  if (!group) {
    group = { name: groupName, description: "", farms: [] };
    config.groups.push(group);
  }
  group.farms = group.farms || [];

  if (group.farms.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    fail(`Farm "${name}" already exists in group "${group.name}".`);
  }

  group.farms.push({
    name,
    path: resolved,
    description: flag("desc") || "",
    slug: flag("slug") || "",
  });
  saveConfig(config);
  console.log(`Added ${name} to ${group.name}: ${resolved}`);
}

function cmdRemove(config, name) {
  if (!name) fail("Usage: operator remove <name>");
  let removed = false;
  for (const group of config.groups || []) {
    const before = (group.farms || []).length;
    group.farms = (group.farms || []).filter((f) => f.name.toLowerCase() !== name.toLowerCase());
    if (group.farms.length !== before) removed = true;
  }
  if (!removed) fail(`No farm named "${name}".`);
  saveConfig(config);
  console.log(`Removed ${name}`);
}

async function cmdStatus(config, groupFilter) {
  let farms = allFarms(config);
  if (groupFilter) {
    farms = farms.filter((f) => f.group?.toLowerCase() === groupFilter.toLowerCase());
    if (!farms.length) fail(`No group named "${groupFilter}".`);
  }

  // Checklist progress is a bonus, not a requirement - a missing API key or an
  // unreachable server must not prevent the local git sweep from reporting.
  let checklists = [];
  if (apiConfig(config).configured) {
    try {
      checklists = await api(config, "GET", "/api/checklists");
    } catch {
      checklists = [];
    }
  }

  const bySlug = new Map(checklists.filter((c) => c.repository_slug).map((c) => [c.repository_slug, c]));
  const byName = new Map(checklists.map((c) => [c.name?.toLowerCase(), c]));

  const rows = farms.map((farm) => {
    const checklist = bySlug.get(farm.slug) || byName.get(farm.name?.toLowerCase()) || null;
    return {
      name: farm.name,
      group: farm.group,
      path: farm.path,
      description: farm.description || "",
      git: farmGitState(farm),
      checklist: checklist
        ? {
            id: checklist.id,
            percentage: checklist.percentage,
            completed: checklist.completed_count,
            total: checklist.effective_total,
          }
        : null,
    };
  });

  emit(rows, (data) => {
    let currentGroup = null;
    for (const row of data) {
      if (row.group !== currentGroup) {
        currentGroup = row.group;
        console.log(`\n── ${currentGroup} ${"─".repeat(Math.max(0, 44 - currentGroup.length))}`);
      }

      if (!row.git.ok) {
        console.log(`  ${row.name.padEnd(22)} !! ${row.git.error}`);
        continue;
      }

      const flags = [];
      if (row.git.dirty) flags.push(`${row.git.dirty} uncommitted`);
      if (row.git.ahead) flags.push(`${row.git.ahead} unpushed`);
      if (row.git.behind) flags.push(`${row.git.behind} behind`);
      if (!row.git.hasUpstream) flags.push("no upstream");
      if (!row.git.farmworkInstalled) flags.push("no CLAUDE.md");

      const progress = row.checklist
        ? `${bar(row.checklist.percentage)} ${String(row.checklist.percentage).padStart(3)}%`
        : "               ";

      console.log(`  ${row.name.padEnd(22)} ${progress}  ${(row.git.branch || "?").padEnd(20)} ${flags.join(", ") || "clean"}`);
      if (row.git.lastCommit) {
        console.log(`  ${" ".repeat(22)} ${row.git.lastCommit.when} — ${row.git.lastCommit.subject.slice(0, 60)}`);
      }
    }
    console.log("");
  });
}

async function cmdChecklists(config) {
  const checklists = await api(config, "GET", "/api/checklists");
  emit(checklists, (rows) => {
    if (!rows.length) return console.log("No checklists yet.");
    for (const c of rows) {
      console.log(
        `#${String(c.id).padEnd(4)} ${(c.name || "").padEnd(24)} ${bar(c.percentage)} ` +
          `${String(c.percentage).padStart(3)}%  ${c.completed_count}/${c.effective_total}` +
          (c.skipped_count ? `  (${c.skipped_count} skipped)` : ""),
      );
    }
  });
}

async function cmdChecklist(config, needle) {
  const id = await resolveChecklistId(config, needle);
  const checklist = await api(config, "GET", `/api/checklists/${id}`);

  emit(checklist, (data) => {
    console.log(`\n${data.name}  ${bar(data.percentage)} ${data.percentage}%  (#${data.id})`);
    console.log(`${data.completed_count} done, ${data.skipped_count} skipped, of ${data.total_count} items\n`);

    let group = null;
    const marks = { completed: "[x]", skipped: "[-]", pending: "[ ]" };
    for (const item of data.items) {
      if (item.group_name !== group) {
        group = item.group_name;
        console.log(`  ${group || "Ungrouped"}`);
      }
      const indent = item.parent_id ? "      " : "    ";
      console.log(`${indent}${marks[item.status]} ${String(item.id).padEnd(5)} ${item.title}`);
    }
    console.log("");
  });
}

async function cmdNewChecklist(config, needle) {
  if (!needle) fail("Usage: operator new-checklist <farm>");
  const farm = findFarm(config, needle);
  const repository = farm?.slug || needle;
  const created = await api(config, "POST", "/api/checklists", { repository });
  emit(created, (data) => console.log(`Created checklist #${data.id} for ${data.name}`));
}

async function cmdDeleteChecklist(config, needle) {
  const id = await resolveChecklistId(config, needle);
  const result = await api(config, "DELETE", `/api/checklists/${id}`);
  emit(result, () => console.log(`Deleted checklist #${id}`));
}

async function cmdComplete(config, rest) {
  const [needle, ...itemIds] = rest;
  if (!itemIds.length) fail("Usage: operator complete <farm|id> <itemId> [itemId...]");
  const id = await resolveChecklistId(config, needle);

  const result = await api(config, "POST", `/api/checklists/${id}/complete`, {
    item_ids: itemIds.map(Number),
  });

  emit(result, (data) => {
    console.log(`Completed ${data.completed_item_ids.length} item(s) — now ${data.percentage}% (${data.completed_count}/${data.effective_total})`);
    if (data.unknown_item_ids?.length) {
      console.log(`Unknown item ids ignored: ${data.unknown_item_ids.join(", ")}`);
    }
  });
}

async function cmdItemAction(config, rest, action) {
  const [needle, itemId] = rest;
  if (!itemId) fail(`Usage: operator ${action} <farm|id> <itemId>`);
  const id = await resolveChecklistId(config, needle);

  const result =
    action === "reset"
      ? await api(config, "DELETE", `/api/checklists/${id}/items/${itemId}`)
      : await api(config, "POST", `/api/checklists/${id}/items/${itemId}/${action}`);

  emit(result, (data) =>
    console.log(`Item ${data.item_id} → ${data.status} — now ${data.percentage}% (${data.completed_count}/${data.effective_total})`),
  );
}

async function cmdItems(config) {
  const items = await api(config, "GET", "/api/checklist_items");
  emit(items, (rows) => {
    let group = null;
    for (const item of rows) {
      if (item.group_name !== group) {
        group = item.group_name;
        console.log(`\n  ${group || "Ungrouped"}`);
      }
      console.log(`${item.parent_id ? "      " : "    "}${String(item.id).padEnd(5)} ${item.title}`);
    }
    console.log("");
  });
}

function cmdConfig(config) {
  const { baseUrl, apiKey } = apiConfig(config);
  const summary = {
    configPath: CONFIG_PATH,
    farmfactory: {
      baseUrl: baseUrl || "(not set)",
      apiKey: apiKey ? `${apiKey.slice(0, 6)}…(${apiKey.length} chars)` : "(not set)",
    },
    groups: (config.groups || []).length,
    farms: allFarms(config).length,
  };
  emit(summary, (data) => {
    console.log(`config:      ${data.configPath}`);
    console.log(`api url:     ${data.farmfactory.baseUrl}`);
    console.log(`api key:     ${data.farmfactory.apiKey}`);
    console.log(`groups:      ${data.groups}`);
    console.log(`farms:       ${data.farms}`);
  });
}

function usage() {
  console.log(`operator - high-level view across many farms

  operator init                          Create ~/.operator/config.json
  operator status [group]                Git + checklist sweep across farms
  operator groups                        List farm groups
  operator farms [group]                 List registered farms
  operator add <name> <path> [--group G] [--slug S] [--desc D]
  operator remove <name>

  operator checklists                    All checklists with progress
  operator checklist <farm|id>           One checklist with every item
  operator items                         The checklist item catalog
  operator new-checklist <farm>          Start a checklist for a farm
  operator delete-checklist <farm|id>    Remove a checklist
  operator complete <farm|id> <itemId...>
  operator skip <farm|id> <itemId>
  operator reset <farm|id> <itemId>

  operator config                        Show resolved config

  Add --json to any command for machine-readable output.`);
}

/* ------------------------------------------------------------------- main */

async function main() {
  if (command === "help" || command === "--help" || command === "-h") return usage();
  if (command === "init") return cmdInit();

  const config = loadConfig();
  const rest = args.slice(1);

  switch (command) {
    case "status":
      return cmdStatus(config, rest[0]);
    case "groups":
      return cmdGroups(config);
    case "farms":
      return cmdFarms(config, rest[0]);
    case "add":
      return cmdAdd(config, rest);
    case "remove":
      return cmdRemove(config, rest[0]);
    case "checklists":
      return cmdChecklists(config);
    case "checklist":
      return cmdChecklist(config, rest[0]);
    case "items":
      return cmdItems(config);
    case "new-checklist":
      return cmdNewChecklist(config, rest[0]);
    case "delete-checklist":
      return cmdDeleteChecklist(config, rest[0]);
    case "complete":
      return cmdComplete(config, rest);
    case "skip":
      return cmdItemAction(config, rest, "skip");
    case "reset":
      return cmdItemAction(config, rest, "reset");
    case "config":
      return cmdConfig(config);
    default:
      fail(`Unknown command "${command}". Run: operator help`);
  }
}

main().catch((error) => fail(error.message));
