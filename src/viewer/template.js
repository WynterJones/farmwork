import { VIEWER_BASE_STYLES } from "./styles-base.js";
import { VIEWER_COMPONENT_STYLES } from "./styles-components.js";
import { VIEWER_CLIENT_CORE_JS } from "./client-state.js";
import { VIEWER_CLIENT_VIEWS_JS } from "./client-views.js";
import { VIEWER_CLIENT_TABS_JS } from "./client-tabs.js";

export const VIEWER_HTML = `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Farmwork — Local Farm Viewer</title>
  <link rel="icon" type="image/webp" sizes="32x32" href="/assets/favicon-32x32.webp" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${VIEWER_BASE_STYLES}${VIEWER_COMPONENT_STYLES}</style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>

  <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="sidebar">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  </button>
  <div class="mobile-overlay" id="mobile-overlay" aria-hidden="true"></div>

  <div class="app-shell">
    <aside class="glass-sidebar" id="sidebar" aria-label="Workspace navigation">
      <button type="button" class="sidebar-logo" id="logo-home" aria-label="All Local Farms">
        <img src="/assets/logo.webp" alt="Farmwork Local Farm Viewer" />
      </button>

      <nav class="sidebar-nav" aria-label="Primary">
        <button type="button" class="nav-link active" id="nav-farms" aria-current="page">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
          </svg>
          Farms
        </button>
        <button type="button" class="nav-link" id="nav-checklists">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Checklists
        </button>
      </nav>

      <div class="sidebar-section-label">
        <span>Local Repos</span>
        <button type="button" class="btn-ghost" id="refresh-btn" aria-label="Rescan local disk" title="Rescan local disk" style="padding:2px 6px;font-size:11px;border-radius:4px">↻</button>
      </div>
      <div class="sidebar-farms" id="sidebar-farms"></div>

      <div class="sidebar-footer">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>LOCAL FARM VIEWER · v3</span>
          <span id="live-pill" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:10px;color:var(--sage-200)" title="Watching local files for live updates">
            <span style="inline-size:6px;block-size:6px;border-radius:999px;background:var(--sage-300)" aria-hidden="true"></span>
            LIVE
          </span>
        </div>
        <div class="sidebar-root-path" id="root-path">Scanning...</div>
      </div>
    </aside>

    <div class="main-wrap">
      <div id="doc-watermark" aria-hidden="true"></div>
      <main class="main-inner" id="main" tabindex="-1">
        <div class="empty-state">Loading local farms...</div>
      </main>
    </div>
  </div>

  <div class="text-size-controls" id="text-size-controls" hidden role="group" aria-label="Document font size controls">
    <button type="button" class="text-size-btn" id="text-inc" aria-label="Increase text size" title="Increase text size">+</button>
    <button type="button" class="text-size-btn" id="text-reset" aria-label="Reset text size" title="Reset text size">15</button>
    <button type="button" class="text-size-btn" id="text-dec" aria-label="Decrease text size" title="Decrease text size">−</button>
  </div>

  <dialog id="help-dialog" class="farm-modal" closedby="any" aria-labelledby="help-dialog-title">
    <div class="modal-head">
      <h2 id="help-dialog-title">What is a Farm?</h2>
      <form method="dialog">
        <button type="submit" class="modal-close" aria-label="Close help">✕</button>
      </form>
    </div>
    <p style="font-size:0.86rem;line-height:1.6;margin:0 0 1rem;color:var(--latte-300)">
      A <strong style="color:var(--latte-50)">Farm</strong> is a project kept out of Trash Mountain using plain Markdown, Beads, and a maintained Justfile stored right in git.
    </p>
    <div style="font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--latte-400)">Core Files</div>
    <div class="help-grid">
      <div class="help-item"><code>_AUDIT/FARMHOUSE.md</code><small>Deterministic 0–10 health report</small></div>
      <div class="help-item"><code>_AUDIT/CHECKLIST.md</code><small>Living engineering standards</small></div>
      <div class="help-item"><code>.beads/ &amp; justfile</code><small>Task graph &amp; maintained recipes</small></div>
      <div class="help-item"><code>_PLANS/*.md</code><small>Plan-before-implement specs</small></div>
    </div>
    <p style="font-size:0.78rem;line-height:1.55;margin:0;color:var(--latte-400)">
      Past Farmwork (v1/v2) repos open read-only so nothing is ever auto-modified. Run <code>farmwork init --reinstall</code> inside a repo to upgrade.
    </p>
  </dialog>

  <dialog id="compost-dialog" class="farm-modal" closedby="any" aria-labelledby="compost-dialog-title">
    <div class="modal-head">
      <h2 id="compost-dialog-title">Compost Idea</h2>
      <form method="dialog">
        <button type="submit" class="modal-close" aria-label="Close dialog">✕</button>
      </form>
    </div>
    <p id="compost-target-label" style="font-size:0.86rem;color:var(--latte-300);margin:0 0 0.85rem"></p>
    <form id="compost-form">
      <label for="compost-reason" class="sr-only">Reason for retiring this idea</label>
      <input class="input-primary" id="compost-reason" name="reason" value="Out of scope" required autofocus placeholder="Why are you retiring this idea?" />
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="compost-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">Move to Compost</button>
      </div>
    </form>
  </dialog>

  <script>${VIEWER_CLIENT_CORE_JS}${VIEWER_CLIENT_VIEWS_JS}${VIEWER_CLIENT_TABS_JS}</script>
</body>
</html>
`;
