export const VIEWER_CLIENT_VIEWS_JS = `
    function closeMobileMenu() {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("mobile-overlay").classList.remove("open");
      document.getElementById("mobile-menu-btn")?.setAttribute("aria-expanded", "false");
    }

    function renderSidebar() {
      document.getElementById("root-path").textContent = state.root;
      const isFarms = state.route.kind === "farms";
      const isChecks = state.route.kind === "checklists";
      const navFarms = document.getElementById("nav-farms");
      const navChecks = document.getElementById("nav-checklists");
      navFarms.classList.toggle("active", isFarms);
      navChecks.classList.toggle("active", isChecks);
      navFarms.setAttribute("aria-current", isFarms ? "page" : "false");
      navChecks.setAttribute("aria-current", isChecks ? "page" : "false");

      const list = document.getElementById("sidebar-farms");
      if (state.farms.length === 0) {
        list.innerHTML = '<div style="padding:0.5rem 0.7rem;font-size:11px;color:var(--latte-500)">No farms found</div>';
        return;
      }
      list.innerHTML = state.farms.map((f) => {
        const t = scoreTier(f.score);
        const active = (state.route.kind === "farm" || state.route.kind === "doc") && state.route.path === f.path;
        return \`
          <button type="button" class="sidebar-farm-btn \${active ? "active" : ""}" data-open-farm="\${esc(f.path)}" aria-current="\${active ? "page" : "false"}">
            <span class="sidebar-farm-name">\${esc(f.projectName)}</span>
            <span style="display:flex;align-items:center;gap:0.4rem;flex:none">
              \${f.install?.isLegacy ? '<span style="font-size:9px;color:var(--honey-300);opacity:0.85">v1/2</span>' : ""}
              <span class="sidebar-dot \${t.dot}" aria-hidden="true" title="\${f.score}/10"></span>
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
        <div class="legacy-banner" role="status">
          <span style="font-size:1rem;line-height:1" aria-hidden="true">⚠</span>
          <div>
            <strong>Past Farmwork (\${esc(health.install.generation)}) project — Read-Only Mode.</strong>
            Farmwork v3 never auto-updates past Farmwork apps. Browse safely here; run <code>farmwork init --reinstall</code> to upgrade.
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
              <button type="button" class="farm-info-btn" id="open-help-btn">Help</button>
              <a href="https://farmwork.dev" target="_blank" rel="noopener noreferrer" class="farm-info-btn gold">farmwork.dev</a>
            </div>
            <div class="score-legend">
              <span><span class="score-pip score-pip-sm score-pip-green">\${ICONS.barn}9+</span> Healthy</span>
              <span><span class="score-pip score-pip-sm score-pip-orange">\${ICONS.warn}7–8</span> Needs Work</span>
              <span><span class="score-pip score-pip-sm score-pip-amber">\${ICONS.tractor}5–6</span> Struggling</span>
              <span><span class="score-pip score-pip-sm score-pip-red">\${ICONS.flame}1–4</span> Critical</span>
            </div>
          </div>
          <div class="header-stats">
            <div class="header-stat"><div class="header-stat-val">\${farms.length}</div><div class="header-stat-lbl">Farms</div></div>
            <div class="stat-divider"></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--honey-200)">\${totalDocs}</div><div class="header-stat-lbl">Documents</div></div>
            \${farms.length ? \`<div class="stat-divider"></div><div style="display:flex;align-items:center;gap:0.75rem"><div class="header-stat"><div class="header-stat-val \${avgTier.color}">\${avgScore}</div><div class="header-stat-lbl">Avg Score</div></div>\${scorePipHtml(avgScore, { iconOnly: true })}</div>\` : ""}
            \${farmsWithChecks.length ? \`<div class="stat-divider"></div><div class="header-stat"><div class="header-stat-val" style="color:\${avgCheck >= 90 ? "var(--sage-200)" : avgCheck >= 60 ? "var(--honey-200)" : "var(--latte-300)"}">\${avgCheck}%</div><div class="header-stat-lbl">Checklists</div></div>\` : ""}
          </div>
        </div>

        <div class="filter-bar">
          <div class="search-wrap">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <label for="farm-search" class="sr-only">Search farms by name or stack</label>
            <input type="search" id="farm-search" class="input-primary" placeholder="Search farms by name or stack..." value="\${esc(state.filterText)}" />
          </div>
          <div role="group" aria-label="Filter by generation" style="display:flex;gap:0.25rem">
            <button type="button" class="farm-filter-btn \${state.filterGen === "all" ? "active" : ""}" data-gen="all" aria-pressed="\${state.filterGen === "all"}">All</button>
            <button type="button" class="farm-filter-btn \${state.filterGen === "v3" ? "active" : ""}" data-gen="v3" aria-pressed="\${state.filterGen === "v3"}">v3 Active</button>
            <button type="button" class="farm-filter-btn \${state.filterGen === "legacy" ? "active" : ""}" data-gen="legacy" aria-pressed="\${state.filterGen === "legacy"}">Legacy</button>
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
                  <button type="button" class="surface card-btn card-hover farm-card \${hasChecklist ? "has-ribbon" : ""}" data-card-farm="\${esc(f.path)}">
                    <span style="min-inline-size:0;flex:1;display:block">
                      <span style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                        <span class="farm-card-title">\${esc(f.projectName)}</span>
                        \${f.install?.isLegacy ? \`<span class="badge badge-warning">Legacy \${esc(f.install.generation)}</span>\` : '<span class="badge badge-success">Active v3</span>'}
                        <span class="badge badge-muted">\${esc(f.stack)}</span>
                      </span>
                      <span class="farm-card-meta">
                        <span>Branch: <strong>\${esc(f.git.branch || "no-git")}</strong>\${f.git.dirtyCount ? \` (\${f.git.dirtyCount} dirty)\` : ""}</span>
                        <span>Docs: <strong>\${f.docCount || 0}</strong></span>
                        <span>Tests: <strong>\${f.metrics.testFiles}</strong></span>
                        <span>Plans: <strong>\${f.metrics.completedPlans}/\${f.metrics.totalPlans}</strong></span>
                        <span>Ideas: <strong style="color:var(--honey-200)">\${f.metrics.activeIdeas}</strong></span>
                        \${f.beads?.initialized ? \`<span>Beads: <strong style="color:var(--sage-200)">\${f.beads.summary.ready} ready</strong></span>\` : ""}
                        \${f.justfile?.exists ? \`<span>Just: <strong>\${f.justfile.recipes.length}</strong></span>\` : ""}
                      </span>
                    </span>
                    <span class="farm-card-right">\${scorePipHtml(f.score)}\${ICONS.chevron}</span>
                  </button>
                  \${hasChecklist ? (checkComplete ? \`
                    <button type="button" class="checklist-ribbon complete" data-card-check="\${esc(f.path)}" aria-label="\${esc(f.projectName)} checklist 100% complete"></button>
                  \` : \`
                    <button type="button" class="checklist-ribbon" data-card-check="\${esc(f.path)}" aria-label="Open \${esc(f.projectName)} checklist (\${f.metrics.checklistPercent}%)">
                      <span class="ribbon-track"><span class="ribbon-fill" style="width:\${f.metrics.checklistPercent}%"></span></span>
                      <span class="ribbon-stat">\${f.metrics.checklistCompleted}/\${f.metrics.checklistActive}</span>
                      <span class="ribbon-pct">\${f.metrics.checklistPercent}%</span>
                    </button>
                  \`) : ""}
                </div>
              \`;
            }).join("")}
          </div>
        \`}
      \`;

      main.querySelector("#open-help-btn")?.addEventListener("click", () => document.getElementById("help-dialog").showModal());
      main.querySelector("#farm-search")?.addEventListener("input", (e) => {
        state.filterText = e.target.value.trim().toLowerCase();
        render();
        const inp = document.getElementById("farm-search");
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      });
      for (const b of main.querySelectorAll("[data-gen]")) b.addEventListener("click", () => { state.filterGen = b.dataset.gen; render(); });
      for (const card of main.querySelectorAll("[data-card-farm]")) card.addEventListener("click", () => openFarm(card.dataset.cardFarm, "overview"));
      for (const rib of main.querySelectorAll("[data-card-check]")) rib.addEventListener("click", () => openFarm(rib.dataset.cardCheck, "checklists"));
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
              <button type="button" class="surface card-btn card-hover" style="padding:1.25rem 1.35rem;cursor:pointer" data-jump-check="\${esc(f.path)}">
                <span style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-block-end:0.85rem">
                  <span class="farm-card-title">\${esc(f.projectName)}</span>
                  <span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:\${complete ? "var(--sage-200)" : "var(--honey-200)"}">\${pct}%</span>
                </span>
                <span class="progress-track" style="display:block;block-size:6px;margin-block-end:0.65rem">
                  <span class="progress-fill" style="display:block;width:\${pct}%;background:\${complete ? "var(--sage-400)" : "var(--honey-400)"}"></span>
                </span>
                <span style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--latte-400)">
                  <span>\${f.metrics.checklistCompleted}/\${f.metrics.checklistActive} active</span>
                  <span>\${f.install?.isLegacy ? "Legacy (read-only)" : esc(f.stack)}</span>
                </span>
              </button>
            \`;
          }).join("")}
        </div>
      \`;
      for (const card of main.querySelectorAll("[data-jump-check]")) card.addEventListener("click", () => openFarm(card.dataset.jumpCheck, "checklists"));
    }

    function renderActivePanel() {
      const p = state.activePanel;
      if (!p || p.kind === "none") return "";
      if (p.kind === "error") {
        return \`
          <section class="surface animate-in" role="alert" style="padding:1.1rem 1.35rem;margin-block-end:1.5rem;border-color:rgba(180,102,86,0.4)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem">
              <h2 style="font-size:0.95rem;color:var(--clay-100)">Action Failed</h2>
              <span class="badge badge-error">Error</span>
            </div>
            <p style="margin:0.45rem 0 0;font-size:0.84rem;color:var(--latte-200)">\${esc(p.message)}</p>
          </section>
        \`;
      }
      if (p.kind === "gates") {
        const g = p.data;
        return \`
          <section class="surface animate-in" aria-label="Quality gates result" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.85rem">
              <h2 style="font-size:0.95rem">Quality Gates</h2>
              <span class="badge \${g.allPassed ? "badge-success" : "badge-error"}">\${g.allPassed ? "All Passed" : "Failures Found"}</span>
            </div>
            \${g.results.map((r) => \`
              <div class="gate-row">
                <div class="gate-row-top">
                  <span>
                    <span style="color:\${r.status === "passed" ? "var(--sage-200)" : r.status === "skipped" ? "var(--latte-400)" : "var(--clay-100)"}">\${r.status === "passed" ? "✓" : r.status === "skipped" ? "○" : "✗"}</span>
                    <strong style="margin-inline-start:0.35rem;color:var(--latte-100)">\${esc(r.gate)}</strong>
                    <span style="color:var(--latte-400);margin-inline-start:0.5rem">\${esc(r.command || "(not configured)")}</span>
                  </span>
                  <span style="color:var(--latte-400)">\${r.durationMs}ms</span>
                </div>
                \${r.status === "failed" && r.output ? \`<pre>\${esc(r.output)}</pre>\` : ""}
              </div>
            \`).join("")}
          </section>
        \`;
      }
      if (p.kind === "security") {
        const s = p.data;
        return \`
          <section class="surface animate-in" aria-label="Security scan result" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.85rem">
              <h2 style="font-size:0.95rem">Security Scan (\${s.filesScanned} files scanned)</h2>
              <span class="badge \${s.passed ? "badge-success" : "badge-error"}">\${s.passed ? "Clean" : "Issues Found"}</span>
            </div>
            \${s.secretFindings.length === 0
              ? '<div class="gate-row"><div class="gate-row-top"><span><span style="color:var(--sage-200)">✓</span> <strong style="margin-inline-start:0.35rem">Secrets &amp; Sensitive Files</strong></span><span style="color:var(--latte-400)">0 findings</span></div></div>'
              : s.secretFindings.map((f) => \`<div class="gate-row"><div class="gate-row-top"><span><span style="color:var(--clay-100)">✗</span> <strong>\${esc(f.type)}</strong> <code>\${esc(f.file)}\${f.line ? ":" + f.line : ""}</code></span><span class="badge badge-error">\${esc(f.severity)}</span></div></div>\`).join("")}
            <div class="gate-row">
              <div class="gate-row-top">
                <span><strong style="color:var(--latte-100)">Dependency Audit</strong> <span style="color:var(--latte-400);margin-inline-start:0.5rem">\${esc(s.dependencyAudit.command || s.dependencyAudit.reason || "")}</span></span>
                <span class="badge \${s.dependencyAudit.status === "passed" ? "badge-success" : s.dependencyAudit.status === "skipped" ? "badge-muted" : "badge-error"}">\${esc(s.dependencyAudit.status)}</span>
              </div>
              \${s.dependencyAudit.status === "failed" && s.dependencyAudit.output ? \`<pre>\${esc(s.dependencyAudit.output)}</pre>\` : ""}
            </div>
          </section>
        \`;
      }
      if (p.kind === "quality") {
        const q = p.data;
        return \`
          <section class="surface animate-in" aria-label="Code and state machine scan" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-block-end:0.85rem">
              <h2 style="font-size:0.95rem">Code &amp; State Machine Scan (\${q.sourceFilesScanned} source files)</h2>
              <span class="badge \${q.clean ? "badge-success" : "badge-warning"}">\${q.clean ? "Clean" : "Hotspots Found"}</span>
            </div>
            \${q.clean ? '<div class="gate-row"><div class="gate-row-top"><span><span style="color:var(--sage-200)">✓</span> 0 oversized files, 0 implicit state-machine hotspots, 0 debug breakpoints</span></div></div>' : ""}
            \${q.oversizedFiles.map((f) => \`<div class="gate-row"><div class="gate-row-top"><span><strong>Oversized</strong> <code>\${esc(f.file)}</code> (\${f.lines}L &gt; \${f.limit}L)</span><span class="badge badge-warning">Split</span></div></div>\`).join("")}
            \${q.stateMachineHotspots.map((h) => \`<div class="gate-row"><div class="gate-row-top"><span><strong>State Machine</strong> <code>\${esc(h.file)}</code> — \${esc(h.detail)}</span><span class="badge badge-warning">\${esc(h.severity)}</span></div></div>\`).join("")}
            \${q.debugNoise.map((d) => \`<div class="gate-row"><div class="gate-row-top"><span><strong>Debug</strong> <code>\${esc(d.file)}:\${d.line}</code> — \${esc(d.type)}</span><span class="badge badge-error">Remove</span></div></div>\`).join("")}
            \${q.stateMachineHotspots.length ? \`<p style="margin:0.5rem 0 0;font-size:0.78rem;color:var(--latte-300)">\${esc(q.stateRecommendation)}</p>\` : ""}
          </section>
        \`;
      }
      return "";
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
      const tab = state.route.tab || "overview";
      const beadsInfo = beads || { installed: false, initialized: false, summary: { total: 0, open: 0, inProgress: 0, blocked: 0, ready: 0, closed: 0 }, ready: [], issues: [] };
      const justInfo = justfile || { installed: false, exists: false, file: null, recipes: [] };

      const tabDefs = [
        { id: "overview", label: "Audit", count: "" },
        { id: "beads", label: "Beads", count: beadsInfo.initialized ? beadsInfo.summary.ready + " ready" : "off" },
        { id: "justfile", label: "Justfile", count: justInfo.exists ? String(justInfo.recipes.length) : "off" },
        { id: "checklists", label: "Checklists", count: checklist.summary.percent + "%" },
        { id: "ideas", label: "Ideas", count: String(garden.ideas.length) },
        { id: "plans", label: "Plans", count: String(plans.length) },
        { id: "docs", label: "All Docs", count: String(docs.length) },
      ];

      const headerHtml = \`
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <button type="button" id="bc-farms">Farms</button>
          \${ICONS.chevron}
          <span style="color:var(--latte-200)">\${esc(health.projectName)}</span>
        </nav>

        <div class="page-header animate-in">
          <div style="flex:1;min-inline-size:0">
            <h1 class="page-title">\${esc(health.projectName)}</h1>
            <p class="page-sub" style="font-family:var(--font-mono);font-size:0.78rem">
              \${esc(health.path)} <span style="color:var(--latte-500);margin:0 0.35rem">/</span> \${esc(health.git.branch || "no-git")}
            </p>
            <div class="action-row">
              \${isLegacy ? \`<span class="badge badge-warning">Legacy \${esc(health.install.generation)}</span>\` : '<span class="badge badge-success">Active v3</span>'}
              <span class="badge badge-muted">\${esc(health.stack)}</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-audit" \${isLegacy ? "disabled" : ""}>Run Audit</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-gates">Run Gates</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-security">Security Scan</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-run-quality">Code &amp; State Scan</button>
            </div>
          </div>

          <div class="header-stats">
            <div class="header-stat" style="text-align:center"><div class="header-stat-val">\${docs.length}</div><div class="header-stat-lbl">docs</div></div>
            <div class="stat-divider tall"></div>
            <div class="header-stat" style="text-align:center"><div class="header-stat-val big \${t.color}">\${health.score}</div><div class="header-stat-lbl">\${esc(health.status)}</div></div>
            \${scorePipHtml(health.score, { iconOnly: true })}
          </div>
        </div>

        \${renderLegacyBanner(health)}

        <div class="repo-tabs" role="tablist" aria-label="Farm sections">
          \${tabDefs.map((td) => \`
            <button type="button" role="tab" id="tab-\${td.id}" aria-selected="\${tab === td.id}" aria-controls="panel-\${td.id}" class="repo-tab \${tab === td.id ? "active" : ""}" data-tab="\${td.id}">
              \${td.label}\${td.count ? \` <span class="repo-tab-count">\${esc(td.count)}</span>\` : ""}
            </button>
          \`).join("")}
        </div>
      \`;

      const bodyHtml = renderFarmTabBody(tab, { health, checklist, garden, compost, plans, beadsInfo, justInfo, docs, isLegacy });
      main.innerHTML = headerHtml + \`<div role="tabpanel" id="panel-\${tab}" aria-labelledby="tab-\${tab}">\${bodyHtml}</div>\`;
      bindFarmDetailEvents(main, isLegacy, docs);
    }
`;
