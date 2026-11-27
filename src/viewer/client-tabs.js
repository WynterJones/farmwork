export const VIEWER_CLIENT_TABS_JS = `
    function renderFarmTabBody(tab, { health, checklist, garden, compost, plans, beadsInfo, justInfo, docs, isLegacy }) {
      if (tab === "overview") {
        const farmhouseDoc = docs.find((d) => d.path === "_AUDIT/FARMHOUSE.md");
        const pillarArt = { security: "/assets/audit-security.webp", performance: "/assets/audit-performance.webp", accessibility: "/assets/audit-accessibility.webp", "code-quality": "/assets/audit-code-quality.webp" };
        return \`
          \${renderActivePanel()}
          <h2 class="sr-only">Audit Overview &amp; Pillars</h2>
          <div class="art-grid">
            <button type="button" class="surface card-btn card-hover art-card" data-open-doc="_AUDIT/FARMHOUSE.md">
              <img src="/assets/audit-farmhouse.webp" alt="" class="art-bg" />
              <span class="art-card-inner">
                <span><h3>Farmhouse</h3><p>Overall project health &amp; audit history</p></span>
                \${scorePipHtml(health.score)}
              </span>
            </button>
            <button type="button" class="surface card-btn card-hover art-card" data-switch-tab="checklists">
              <img src="/assets/audit-tests.webp" alt="" class="art-bg" />
              <span class="art-card-inner">
                <span><h3>Standards &amp; Tests</h3><p>\${health.metrics.testFiles} test files · \${health.metrics.checklistPercent}% checklist</p></span>
                <span class="badge \${health.metrics.checklistPercent >= 80 ? "badge-success" : "badge-gold"}">\${health.metrics.checklistCompleted}/\${health.metrics.checklistActive}</span>
              </span>
            </button>
            \${(health.pillars || []).map((p) => p.exists ? \`
              <button type="button" class="surface card-btn card-hover art-card" data-open-doc="\${esc(p.path)}">
                <img src="\${pillarArt[p.key] || "/assets/main-bg.webp"}" alt="" class="art-bg" />
                <span class="art-card-inner">
                  <span><h3>\${esc(p.title.replace(" Audit", ""))}</h3><p>\${esc(p.status || p.description)}</p></span>
                  \${p.score !== null ? scorePipHtml(p.score) : '<span class="score-pip score-pip-muted">&mdash;</span>'}
                </span>
              </button>
            \` : \`
              <div class="surface art-card" style="opacity:0.62;cursor:default">
                <img src="\${pillarArt[p.key] || "/assets/main-bg.webp"}" alt="" class="art-bg" />
                <div class="art-card-inner">
                  <div><h3>\${esc(p.title.replace(" Audit", ""))}</h3><p>Not audited yet — run via MCP</p></div>
                  <span class="score-pip score-pip-muted">&mdash;</span>
                </div>
              </div>
            \`).join("")}
          </div>

          <section class="surface" aria-label="Deterministic score breakdown" style="padding:1.35rem 1.5rem;margin-block-end:1.5rem">
            <h2 style="font-size:0.95rem;margin-block-end:0.95rem">Deterministic Score Breakdown</h2>
            <div class="breakdown-list">
              \${health.breakdown.map((b) => \`
                <div class="breakdown-row">
                  <span style="display:flex;align-items:center;gap:0.6rem">
                    <span style="color:\${b.passed ? "var(--sage-200)" : "var(--honey-300)"}" aria-hidden="true">\${b.passed ? "✓" : "!"}</span>
                    <span>\${esc(b.label)}</span>
                  </span>
                  <span class="breakdown-pts">\${b.points} / \${b.max}</span>
                </div>
              \`).join("")}
            </div>
          </section>

          \${farmhouseDoc ? \`<article class="surface prose-card"><div class="prose">\${renderMarkdown(farmhouseDoc.content)}</div></article>\` : ""}
        \`;
      }

      if (tab === "beads") {
        const s = beadsInfo.summary;
        const focusId = state.beadFocusId;
        const matchesFocus = (it) =>
          !focusId ||
          it.id === focusId ||
          it.parent === focusId ||
          String(it.id || "").startsWith(focusId + ".");
        const visibleReady = beadsInfo.ready.filter(matchesFocus);
        const visibleIssues = beadsInfo.issues.filter(matchesFocus);
        const renderIssueRow = (it) => \`
          <div class="surface" style="padding:1rem 1.25rem;margin-block-end:0.6rem">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                <code style="font-family:var(--font-mono);font-size:0.78rem;color:var(--honey-200)">\${esc(it.id)}</code>
                <span class="badge \${Number(it.priority ?? 2) <= 1 ? "badge-warning" : "badge-muted"}">P\${Number(it.priority ?? 2)}</span>
                <span class="badge badge-muted">\${esc(it.issue_type || "task")}</span>
                <span class="badge \${it.status === "closed" ? "badge-success" : it.status === "in_progress" ? "badge-gold" : "badge-muted"}">\${esc(it.status || "open")}</span>
                <span style="font-family:var(--font-mono);font-size:0.9rem;color:var(--latte-50)">\${esc(it.title)}</span>
              </div>
              \${!isLegacy && beadsInfo.installed && it.status !== "closed" ? \`
                <div style="display:flex;gap:0.4rem">
                  \${it.status !== "in_progress" ? \`<button type="button" class="btn btn-secondary btn-sm" data-bead-claim="\${esc(it.id)}">Claim</button>\` : ""}
                  <button type="button" class="btn btn-primary btn-sm" data-bead-close="\${esc(it.id)}">Close</button>
                </div>
              \` : ""}
            </div>
          </div>
        \`;
        return !beadsInfo.initialized ? \`
          <div class="surface empty-state">
            <h3>Beads Not Initialized</h3>
            <p style="margin:0.4rem auto 1rem;max-inline-size:520px;font-size:0.86rem">Beads (<code>bd</code>) is for agents — track granular execution tasks and dependencies here while keeping human big plans concise in Checklists.</p>
            \${!isLegacy && beadsInfo.installed ? '<button type="button" class="btn btn-primary btn-sm" id="btn-beads-init">Initialize Beads (.beads/)</button>' : '<a href="https://beads.gascity.com/" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Install Beads</a>'}
          </div>
        \` : \`
          <p style="margin:0 0 1rem;font-size:0.82rem;color:var(--latte-400)"><strong style="color:var(--latte-200)">For agents:</strong> granular tasks, subtasks, and dependencies. Big plans stay concise for humans in <strong>Checklists</strong>.</p>
          \${focusId ? \`
            <div class="legacy-banner" role="status" style="align-items:center;justify-content:space-between">
              <div>Following checklist link for Beads work <code>\${esc(focusId)}</code> (\${visibleIssues.length} matching issues).</div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-bead-focus">Show all beads</button>
            </div>
          \` : ""}
          <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
            <div style="display:flex;gap:0.55rem;flex-wrap:wrap">
              <span class="badge badge-success">\${s.ready} ready</span>
              <span class="badge badge-gold">\${s.inProgress} in progress</span>
              <span class="badge badge-muted">\${s.open} open</span>
              <span class="badge badge-muted">\${s.closed} closed</span>
            </div>
            \${!isLegacy && beadsInfo.installed ? '<button type="button" class="btn btn-secondary btn-sm" id="btn-beads-sync">Sync Beads (bd sync)</button>' : ""}
          </div>
          \${!isLegacy && beadsInfo.installed ? \`
            <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.5rem">
              <form class="inline-form" id="beads-create-form" aria-label="Create new Bead">
                <label for="bead-title-input" class="sr-only">Bead title</label>
                <input id="bead-title-input" class="input-primary" name="title" placeholder="New granular agent task..." required />
                <label for="bead-type-select" class="sr-only">Bead type</label>
                <select id="bead-type-select" class="input-primary" name="type" style="max-inline-size:135px"><option value="task">task</option><option value="feature">feature</option><option value="bug">bug</option><option value="epic">epic</option></select>
                <label for="bead-prio-select" class="sr-only">Priority</label>
                <select id="bead-prio-select" class="input-primary" name="priority" style="max-inline-size:95px"><option value="0">P0</option><option value="1">P1</option><option value="2" selected>P2</option><option value="3">P3</option></select>
                <button type="submit" class="btn btn-primary btn-sm">+ Add Bead</button>
              </form>
            </div>
          \` : ""}
          <div class="check-group-title">Ready Work (\${visibleReady.length})</div>
          \${visibleReady.length ? visibleReady.map(renderIssueRow).join("") : '<div class="surface empty-state"><p style="margin:0">No unblocked ready beads.</p></div>'}
          <div class="check-group-title">All Issues (\${visibleIssues.length})</div>
          \${visibleIssues.length ? visibleIssues.map(renderIssueRow).join("") : '<div class="surface empty-state"><p style="margin:0">No matching beads.</p></div>'}
        \`;
      }

      if (tab === "justfile") {
        const jr = state.activePanel.kind === "just" ? state.activePanel.data : null;
        return !justInfo.exists ? \`
          <div class="surface empty-state">
            <h3>No Justfile Yet</h3>
            <p style="margin:0.4rem auto 1rem;max-inline-size:520px;font-size:0.86rem">Generate a maintained stack-aware <code>justfile</code> for fast recipes.</p>
            \${!isLegacy ? '<button type="button" class="btn btn-primary btn-sm" id="btn-just-init">Generate Justfile</button>' : '<span class="badge badge-warning">Legacy read-only</span>'}
          </div>
        \` : \`
          <div class="surface" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:0.65rem"><code style="color:var(--honey-200)">\${esc(justInfo.file)}</code><span class="badge badge-muted">\${justInfo.recipes.length} recipes</span></div>
            <button type="button" class="btn btn-secondary btn-sm" data-open-doc="\${esc(justInfo.file)}">View Source</button>
          </div>
          \${jr ? \`<div class="surface animate-in" style="padding:1.2rem 1.4rem;margin-block-end:1.25rem"><div style="display:flex;justify-content:space-between;margin-block-end:0.6rem"><strong>\${esc(jr.command)}</strong><span class="badge \${jr.passed ? "badge-success" : "badge-error"}">\${jr.passed ? "Passed" : "Exit " + jr.exitCode} · \${jr.durationMs}ms</span></div><pre style="margin:0;padding:0.75rem;border-radius:0.4rem;background:#09090b;font-family:var(--font-mono);font-size:12px;overflow-x:auto;white-space:pre-wrap">\${esc(jr.output || "(no output)")}</pre></div>\` : ""}
          \${justInfo.recipes.map((r) => \`
            <div class="surface" style="padding:0.95rem 1.25rem;margin-block-end:0.55rem;display:flex;justify-content:space-between;align-items:center;gap:0.75rem">
              <div><code style="color:var(--honey-200);font-weight:600">just \${esc(r.name)}</code>\${r.description ? \`<p style="margin:0.3rem 0 0;font-size:0.83rem;color:var(--latte-400)">\${esc(r.description)}</p>\` : ""}</div>
              <button type="button" class="btn btn-secondary btn-sm" data-run-just="\${esc(r.name)}" \${!justInfo.installed || r.params.some((p) => !p.includes("=")) ? "disabled" : ""}>Run</button>
            </div>
          \`).join("")}
        \`;
      }

      if (tab === "checklists") {
        const std = checklist.summary.standards || { active: checklist.summary.activeTotal, completed: checklist.summary.completed, percent: checklist.summary.percent };
        const plansInfo = checklist.summary.bigPlans || { total: 0, completed: 0 };
        const complete = std.active > 0 && std.percent === 100;
        const groups = {};
        for (const it of checklist.items) (groups[it.group] ||= []).push(it);
        const beadLabel = (beadsId) => {
          const children = beadsInfo.issues.filter((b) => b.parent === beadsId || String(b.id || "").startsWith(beadsId + "."));
          if (children.length > 0) {
            const done = children.filter((b) => b.status === "closed").length;
            return "beads: " + beadsId + " · " + done + "/" + children.length + " tasks";
          }
          const exact = beadsInfo.issues.find((b) => b.id === beadsId);
          return exact ? "beads: " + beadsId + " · " + (exact.status || "open") : "beads: " + beadsId;
        };
        return \`
          <p style="margin:0 0 1rem;font-size:0.82rem;color:var(--latte-400)"><strong style="color:var(--latte-200)">For humans:</strong> concise big plans, future roadmap, and standards (&le;\${checklist.summary.maxRecommended || 30} items). Detailed agent tasks live in <strong>Beads</strong>.</p>
          \${checklist.summary.bloated ? \`<div class="legacy-banner" role="status">\${esc(checklist.summary.warning)}</div>\` : ""}
          <div class="progress-card \${complete ? "complete" : "surface"}">
            <div style="display:flex;justify-content:space-between;margin-block-end:0.75rem"><span>Standards</span><strong style="font-family:var(--font-mono);color:\${complete ? "var(--sage-200)" : "var(--honey-200)"}">\${std.percent}%</strong></div>
            <div class="progress-track" role="progressbar" aria-label="Standards progress" aria-valuenow="\${std.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:\${std.percent}%"></div></div>
            <div style="margin-block-start:0.55rem;font-size:0.76rem;color:var(--latte-400)">\${std.completed} of \${std.active} standards · \${plansInfo.completed}/\${plansInfo.total} big plans done\${checklist.summary.linkedToBeads ? \` · \${checklist.summary.linkedToBeads} linked to Beads\` : ""}</div>
          </div>
          \${Object.entries(groups).map(([grp, items]) => \`
            <div class="check-group-title">\${esc(grp)}</div>
            \${items.map((it) => \`
              <div class="surface check-row \${it.state}">
                <button type="button" class="check-left" role="checkbox" aria-checked="\${it.state === "complete"}" \${isLegacy ? "disabled" : ""} data-row-toggle="\${it.id}" data-row-next="\${it.state === "complete" ? "pending" : "complete"}">
                  <span class="check-box" aria-hidden="true">\${it.state === "complete" ? ICONS.check : it.state === "skip" ? ICONS.x : ""}</span>
                  <span class="check-title">\${esc(it.displayTitle || it.title)}</span>
                </button>
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
                  \${it.planPath ? \`<button type="button" class="farm-info-btn" data-open-doc="\${esc(it.planPath)}" title="Open linked plan">Plan</button>\` : ""}
                  \${it.beadsId ? \`<button type="button" class="farm-info-btn gold" data-open-bead="\${esc(it.beadsId)}" title="Follow to underlying Beads tasks">\${esc(beadLabel(it.beadsId))}</button>\` : ""}
                  \${isLegacy ? "" : \`<button type="button" class="btn btn-secondary btn-sm" data-skip-id="\${it.id}" data-skip-next="\${it.state === "skip" ? "pending" : "skip"}">\${it.state === "skip" ? "Restore" : "Skip"}</button>\`}
                </div>
              </div>
            \`).join("")}
          \`).join("") || '<div class="surface empty-state"><h3>No checklist items yet</h3></div>'}
          \${isLegacy ? "" : \`<div class="surface" style="padding:1.15rem 1.3rem;margin-block-start:1.5rem"><form class="inline-form" id="add-check-form" aria-label="Add big plan or standard"><label for="chk-grp" class="sr-only">Group</label><input id="chk-grp" class="input-primary" name="group" value="Big Plans &amp; Future Roadmap" style="max-inline-size:235px" /><label for="chk-title" class="sr-only">Big plan or standard</label><input id="chk-title" class="input-primary" name="title" placeholder="Add a big plan, future plan, or standard..." required /><label for="chk-beads" class="sr-only">Related Beads ID (optional)</label><input id="chk-beads" class="input-primary" name="beadsId" placeholder="Beads ID (optional)" style="max-inline-size:155px" /><button type="submit" class="btn btn-primary btn-sm">+ Add Item</button></form></div>\`}
        \`;
      }

      if (tab === "ideas") {
        return \`
          \${isLegacy ? "" : \`<div class="surface" style="padding:1.25rem 1.4rem;margin-block-end:1.5rem"><form class="inline-form" id="plant-form" aria-label="Plant new idea"><label for="idea-title" class="sr-only">Idea title</label><input id="idea-title" class="input-primary" name="title" placeholder="Idea title..." required /><label for="idea-desc" class="sr-only">Description</label><input id="idea-desc" class="input-primary" name="description" placeholder="Short description..." /><button type="submit" class="btn btn-primary btn-sm">Plant Idea</button></form></div>\`}
          <div class="check-group-title">Active Garden (\${garden.ideas.length})</div>
          \${garden.ideas.length === 0 ? '<div class="surface empty-state"><p style="margin:0">No active ideas planted yet.</p></div>' : garden.ideas.map((idea) => \`
            <div class="surface" style="padding:1.1rem 1.25rem;margin-block-end:0.65rem">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap">
                <strong style="font-family:var(--font-mono);color:var(--latte-50)">\${esc(idea.title)}</strong>
                <div style="display:flex;align-items:center;gap:0.45rem">
                  <span class="badge \${idea.lifecycle === "fresh" ? "badge-success" : idea.lifecycle === "wilting" ? "badge-warning" : "badge-error"}">\${idea.ageDays}d · \${idea.lifecycle}</span>
                  \${isLegacy ? "" : \`<button type="button" class="btn btn-secondary btn-sm" data-graduate="\${esc(idea.title)}" data-desc="\${esc(idea.description || "")}">Graduate</button><button type="button" class="btn btn-ghost btn-sm" data-compost="\${esc(idea.title)}">Compost</button>\`}
                </div>
              </div>
              \${idea.description ? \`<p style="margin:0.45rem 0 0;font-size:0.86rem;color:var(--latte-400)">\${esc(idea.description)}</p>\` : ""}
            </div>
          \`).join("")}
          <div class="check-group-title">Compost Archive (\${compost.items.length})</div>
          \${compost.items.length === 0 ? '<div class="surface empty-state"><p style="margin:0">No composted ideas yet.</p></div>' : compost.items.map((c) => \`<div class="surface" style="padding:1rem 1.25rem;margin-block-end:0.55rem"><strong>\${esc(c.title)}</strong> <span class="badge badge-muted">\${esc(c.composted || "")}</span><p style="margin:0.35rem 0 0;font-size:0.82rem;color:var(--latte-400)">Reason: \${esc(c.reason)}</p></div>\`).join("")}
        \`;
      }

      if (tab === "plans") {
        const planDocs = docs.filter((d) => d.category === "Plans");
        return plans.length === 0
          ? '<div class="surface empty-state"><h3>No plans yet</h3><p style="margin:0.3rem 0 0;font-size:0.86rem">Call <code>farmwork_plan</code> or graduate an idea from the Ideas tab.</p></div>'
          : plans.map((p) => {
              const doc = planDocs.find((d) => d.path === p.path);
              return \`
                <article class="surface" style="padding:1.35rem 1.5rem;margin-block-end:1rem">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-block-end:0.85rem;padding-block-end:0.8rem;border-block-end:1px solid rgba(255,255,255,0.06)">
                    <div><h3 style="font-size:1.05rem">\${esc(p.title)}</h3><div style="font-family:var(--font-mono);font-size:11px;color:var(--latte-400)">\${esc(p.path)}\${p.beadsEpic ? \` · Epic \${esc(p.beadsEpic)}\` : ""}</div></div>
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                      <span class="badge \${p.completed ? "badge-success" : "badge-gold"}">\${esc(p.status)}</span>
                      <button type="button" class="btn btn-secondary btn-sm" data-open-doc="\${esc(p.path)}">Reader</button>
                      \${!isLegacy && beadsInfo.initialized && !p.beadsEpic && !p.completed ? \`<button type="button" class="btn btn-secondary btn-sm" data-plan-beads="\${esc(p.slug)}">Create Beads</button>\` : ""}
                      \${!isLegacy && !p.completed ? \`<button type="button" class="btn btn-primary btn-sm" data-complete-plan="\${esc(p.slug)}">Mark Complete</button>\` : ""}
                    </div>
                  </div>
                  <div class="prose">\${renderMarkdown(doc?.content || "")}</div>
                </article>
              \`;
            }).join("");
      }

      return docs.length === 0
        ? '<div class="surface empty-state"><h3>No documents found</h3></div>'
        : docs.map((d) => \`
            <button type="button" class="surface card-btn card-hover doc-row" data-open-doc="\${esc(d.path)}">
              <span style="min-inline-size:0;flex:1;display:block"><h4>\${esc(d.title)}</h4><code>\${esc(d.path)}</code></span>
              <span style="display:flex;align-items:center;gap:0.75rem;flex:none"><span class="badge badge-muted">\${esc(d.category)}</span>\${ICONS.chevron}</span>
            </button>
          \`).join("");
    }

    function bindFarmDetailEvents(main, isLegacy, docs) {
      const farmPath = state.route.path;
      const post = (url, payload) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: farmPath, ...payload }) });

      main.querySelector("#bc-farms")?.addEventListener("click", () => { transitionRoute({ type: "GO_FARMS" }); render(); });
      main.querySelector("#btn-run-audit")?.addEventListener("click", () => runSafe(async () => {
        state.detail = await post("/api/audit", {});
        await refreshFarmsOnly();
        announce("Audit completed");
        render();
      }));
      main.querySelector("#btn-run-gates")?.addEventListener("click", (e) => runSafe(async () => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "Running Gates...";
        try {
          state.activePanel = { kind: "gates", data: await post("/api/gates", {}) };
          state.detail = await api("/api/farm?path=" + encodeURIComponent(farmPath));
          await refreshFarmsOnly();
          transitionRoute({ type: "SWITCH_TAB", tab: "overview" });
          announce("Quality gates finished");
          render();
        } finally { btn.disabled = false; }
      }));
      main.querySelector("#btn-run-security")?.addEventListener("click", (e) => runSafe(async () => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "Scanning...";
        try {
          state.activePanel = { kind: "security", data: await post("/api/security", {}) };
          transitionRoute({ type: "SWITCH_TAB", tab: "overview" });
          announce("Security scan finished");
          render();
        } finally { btn.disabled = false; }
      }));
      main.querySelector("#btn-run-quality")?.addEventListener("click", (e) => runSafe(async () => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "Scanning...";
        try {
          state.activePanel = { kind: "quality", data: await post("/api/code-quality", {}) };
          transitionRoute({ type: "SWITCH_TAB", tab: "overview" });
          announce("Code and state machine scan finished");
          render();
        } finally { btn.disabled = false; }
      }));

      const tabList = main.querySelector('[role="tablist"]');
      const tabBtns = [...main.querySelectorAll("[data-tab]")];
      tabList?.addEventListener("keydown", (e) => {
        const idx = tabBtns.indexOf(document.activeElement);
        if (idx === -1) return;
        let nextIdx = -1;
        if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabBtns.length;
        else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = tabBtns.length - 1;
        if (nextIdx !== -1) {
          e.preventDefault();
          const nextTab = tabBtns[nextIdx].dataset.tab;
          transitionRoute({ type: "SWITCH_TAB", tab: nextTab });
          render();
          document.getElementById("tab-" + nextTab)?.focus();
        }
      });

      for (const tabBtn of tabBtns) tabBtn.addEventListener("click", () => { transitionRoute({ type: "SWITCH_TAB", tab: tabBtn.dataset.tab }); render(); });
      for (const el of main.querySelectorAll("[data-switch-tab]")) el.addEventListener("click", () => { transitionRoute({ type: "SWITCH_TAB", tab: el.dataset.switchTab }); render(); });
      for (const el of main.querySelectorAll("[data-open-doc]")) {
        el.addEventListener("click", () => {
          if (docs.some((d) => d.path === el.dataset.openDoc)) { transitionRoute({ type: "OPEN_DOC", docPath: el.dataset.openDoc }); render(); }
        });
      }
      for (const el of main.querySelectorAll("[data-open-bead]")) {
        el.addEventListener("click", () => {
          state.beadFocusId = el.dataset.openBead;
          transitionRoute({ type: "SWITCH_TAB", tab: "beads" });
          announce("Showing Beads tasks for " + el.dataset.openBead);
          render();
        });
      }
      main.querySelector("#btn-clear-bead-focus")?.addEventListener("click", () => {
        state.beadFocusId = null;
        render();
      });
      for (const btn of main.querySelectorAll("[data-run-just]")) {
        btn.addEventListener("click", async () => {
          btn.disabled = true; btn.textContent = "Running...";
          try { state.activePanel = { kind: "just", data: await post("/api/just/run", { recipe: btn.dataset.runJust }) }; render(); }
          finally { btn.disabled = false; }
        });
      }

      if (isLegacy) return;
      for (const row of main.querySelectorAll("[data-row-toggle]")) row.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/checklist/toggle", { id: Number(row.dataset.rowToggle), state: row.dataset.rowNext }); await refreshFarmsOnly(); render(); }));
      for (const btn of main.querySelectorAll("[data-skip-id]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/checklist/toggle", { id: Number(btn.dataset.skipId), state: btn.dataset.skipNext }); await refreshFarmsOnly(); render(); }));
      main.querySelector("#add-check-form")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); runSafe(async () => { state.detail = await post("/api/checklist/add", { group: fd.get("group"), title: fd.get("title"), beadsId: String(fd.get("beadsId") || "").trim() || null }); await refreshFarmsOnly(); render(); }); });
      main.querySelector("#plant-form")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); runSafe(async () => { state.detail = await post("/api/garden/plant", { title: fd.get("title"), description: fd.get("description") }); await refreshFarmsOnly(); render(); }); });
      for (const btn of main.querySelectorAll("[data-graduate]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/plan/create", { title: btn.dataset.graduate, summary: btn.dataset.desc, fromIdea: btn.dataset.graduate }); await refreshFarmsOnly(); transitionRoute({ type: "SWITCH_TAB", tab: "plans" }); render(); }));
      for (const btn of main.querySelectorAll("[data-compost]")) btn.addEventListener("click", () => { state.pendingCompostTitle = btn.dataset.compost; document.getElementById("compost-target-label").textContent = "Retire: " + state.pendingCompostTitle; document.getElementById("compost-reason").value = "Out of scope"; document.getElementById("compost-dialog").showModal(); });
      for (const btn of main.querySelectorAll("[data-complete-plan]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/plan/complete", { plan: btn.dataset.completePlan }); await refreshFarmsOnly(); render(); }));
      for (const btn of main.querySelectorAll("[data-plan-beads]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/plan/to-beads", { plan: btn.dataset.planBeads }); await refreshFarmsOnly(); transitionRoute({ type: "SWITCH_TAB", tab: "beads" }); render(); }));
      main.querySelector("#btn-beads-init")?.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/beads/init", {}); await refreshFarmsOnly(); render(); }));
      main.querySelector("#btn-beads-sync")?.addEventListener("click", () => runSafe(async () => { const res = await post("/api/beads/sync", {}); if (res.detail) state.detail = res.detail; await refreshFarmsOnly(); render(); }));
      main.querySelector("#beads-create-form")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); runSafe(async () => { state.detail = await post("/api/beads/create", { title: fd.get("title"), type: fd.get("type"), priority: Number(fd.get("priority")) }); await refreshFarmsOnly(); render(); }); });
      for (const btn of main.querySelectorAll("[data-bead-claim]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/beads/update", { id: btn.dataset.beadClaim, status: "in_progress" }); await refreshFarmsOnly(); render(); }));
      for (const btn of main.querySelectorAll("[data-bead-close]")) btn.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/beads/close", { id: btn.dataset.beadClose }); await refreshFarmsOnly(); render(); }));
      main.querySelector("#btn-just-init")?.addEventListener("click", () => runSafe(async () => { state.detail = await post("/api/just/init", {}); await refreshFarmsOnly(); render(); }));
    }

    function renderDocReader() {
      const main = document.getElementById("main");
      const { health, docs } = state.detail;
      const idx = Math.max(0, docs.findIndex((d) => d.path === state.route.docPath));
      const doc = docs[idx];
      if (!doc) { transitionRoute({ type: "BACK_TO_FARM" }); render(); return; }
      const prevDoc = idx > 0 ? docs[idx - 1] : null;
      const nextDoc = idx < docs.length - 1 ? docs[idx + 1] : null;
      document.getElementById("doc-watermark").innerHTML = \`<div class="doc-watermark"><img src="\${docArtForPath(doc.path)}" alt="" /></div>\`;
      main.innerHTML = \`
        <nav class="breadcrumb animate-in" aria-label="Breadcrumb">
          <button type="button" id="doc-bc-farms">Farms</button>\${ICONS.chevron}
          <button type="button" id="doc-bc-farm">\${esc(health.projectName)}</button>\${ICONS.chevron}
          <span style="color:var(--latte-200)">\${esc(doc.name)}</span>
        </nav>
        <div class="page-header animate-in" style="margin-block-end:1.5rem">
          <div><h1 class="page-title">\${esc(doc.title)}</h1><div class="action-row"><code style="color:var(--honey-200)">\${esc(doc.path)}</code><span class="badge badge-success">\${esc(doc.category)}</span></div></div>
          <button type="button" class="btn btn-secondary btn-sm" id="doc-back">← Back to Farm</button>
        </div>
        <div class="prose-reader animate-in">
          <article class="surface prose-card"><div class="prose" style="--prose-size:\${state.prosePx}px">\${renderMarkdown(doc.content)}</div></article>
          <div style="display:flex;justify-content:space-between;margin-block-start:1.5rem;gap:0.75rem">
            \${prevDoc ? \`<button type="button" class="btn btn-secondary btn-sm" data-nav-doc="\${esc(prevDoc.path)}">← \${esc(prevDoc.name)}</button>\` : "<div></div>"}
            \${nextDoc ? \`<button type="button" class="btn btn-secondary btn-sm" data-nav-doc="\${esc(nextDoc.path)}">\${esc(nextDoc.name)} →</button>\` : "<div></div>"}
          </div>
        </div>
      \`;
      main.querySelector("#doc-bc-farms")?.addEventListener("click", () => { transitionRoute({ type: "GO_FARMS" }); render(); });
      main.querySelector("#doc-bc-farm")?.addEventListener("click", () => { transitionRoute({ type: "BACK_TO_FARM" }); render(); });
      main.querySelector("#doc-back")?.addEventListener("click", () => { transitionRoute({ type: "BACK_TO_FARM" }); render(); });
      for (const b of main.querySelectorAll("[data-nav-doc]")) b.addEventListener("click", () => { transitionRoute({ type: "OPEN_DOC", docPath: b.dataset.navDoc }); render(); window.scrollTo({ top: 0 }); });
    }

    function render() {
      renderSidebar();
      const watermark = document.getElementById("doc-watermark");
      const textCtrl = document.getElementById("text-size-controls");
      const inDoc = state.route.kind === "doc";
      if (!inDoc) watermark.innerHTML = "";
      textCtrl.hidden = !inDoc;
      if (inDoc) document.getElementById("text-reset").textContent = String(state.prosePx);
      if (state.route.kind === "farms") renderFarmsIndex();
      else if (state.route.kind === "checklists") renderChecklistsPortfolio();
      else if (state.route.kind === "farm") renderFarmDetail();
      else if (state.route.kind === "doc") renderDocReader();
    }

    async function refreshFarmsOnly() {
      const data = await api("/api/farms");
      state.root = data.root;
      state.farms = data.farms;
    }

    async function openFarm(farmPath, tab = "overview") {
      transitionRoute({ type: "OPEN_FARM", path: farmPath, tab });
      render();
      state.detail = await api("/api/farm?path=" + encodeURIComponent(farmPath));
      render();
    }

    async function boot() {
      await refreshFarmsOnly();
      if (state.farms.length === 1) await openFarm(state.farms[0].path, "overview");
      else { transitionRoute({ type: "GO_FARMS" }); render(); }
    }

    document.getElementById("logo-home").addEventListener("click", () => { closeMobileMenu(); transitionRoute({ type: "GO_FARMS" }); render(); });
    document.getElementById("nav-farms").addEventListener("click", () => { closeMobileMenu(); transitionRoute({ type: "GO_FARMS" }); render(); });
    document.getElementById("nav-checklists").addEventListener("click", () => { closeMobileMenu(); transitionRoute({ type: "GO_CHECKLISTS" }); render(); });
    document.getElementById("refresh-btn").addEventListener("click", async () => {
      await refreshFarmsOnly();
      if ((state.route.kind === "farm" || state.route.kind === "doc") && state.route.path) {
        state.detail = await api("/api/farm?path=" + encodeURIComponent(state.route.path));
      }
      render();
    });
    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
      const open = document.getElementById("sidebar").classList.toggle("open");
      document.getElementById("mobile-overlay").classList.toggle("open", open);
      document.getElementById("mobile-menu-btn").setAttribute("aria-expanded", String(open));
    });
    document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu);
    document.getElementById("text-inc").addEventListener("click", () => { state.prosePx = Math.min(22, state.prosePx + 1); render(); });
    document.getElementById("text-dec").addEventListener("click", () => { state.prosePx = Math.max(12, state.prosePx - 1); render(); });
    document.getElementById("text-reset").addEventListener("click", () => { state.prosePx = 15; render(); });
    document.getElementById("compost-cancel").addEventListener("click", () => document.getElementById("compost-dialog").close());
    document.getElementById("compost-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.pendingCompostTitle || !state.route.path) return;
      const reason = document.getElementById("compost-reason").value.trim() || "Retired";
      document.getElementById("compost-dialog").close();
      state.detail = await api("/api/garden/compost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: state.route.path, title: state.pendingCompostTitle, reason }) });
      state.pendingCompostTitle = null;
      await refreshFarmsOnly();
      render();
    });

    function connectLiveUpdates() {
      if (typeof EventSource === "undefined") return;
      const es = new EventSource("/api/events");
      es.addEventListener("change", async () => {
        if (document.activeElement && document.activeElement.matches("input, textarea, select")) return;
        await refreshFarmsOnly();
        if ((state.route.kind === "farm" || state.route.kind === "doc") && state.route.path) {
          state.detail = await api("/api/farm?path=" + encodeURIComponent(state.route.path));
        }
        render();
      });
    }
    boot().then(connectLiveUpdates);
`;
