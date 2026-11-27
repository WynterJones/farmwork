export const VIEWER_CLIENT_CORE_JS = `
    // Explicit Viewer Navigation & Run State Machine (prevents impossible view/tab/panel combinations)
    const VALID_TABS = new Set(["overview", "beads", "justfile", "checklists", "ideas", "plans", "docs"]);

    const state = {
      root: "",
      farms: [],
      route: { kind: "farms" }, // { kind: "farms" } | { kind: "checklists" } | { kind: "farm", path, tab } | { kind: "doc", path, docPath, returnTab }
      detail: null,
      activePanel: { kind: "none" }, // { kind: "none" } | { kind: "gates", data } | { kind: "security", data } | { kind: "quality", data } | { kind: "just", data }
      filterText: "",
      filterGen: "all",
      prosePx: 15,
      pendingCompostTitle: null,
      beadFocusId: null,
    };

    function transitionRoute(event) {
      switch (event.type) {
        case "GO_FARMS":
          state.route = { kind: "farms" };
          return;
        case "GO_CHECKLISTS":
          state.route = { kind: "checklists" };
          return;
        case "OPEN_FARM": {
          const tab = VALID_TABS.has(event.tab) ? event.tab : "overview";
          const switchingFarm = state.route.path !== event.path;
          state.route = { kind: "farm", path: event.path, tab };
          if (switchingFarm) {
            state.detail = null;
            state.activePanel = { kind: "none" };
            state.beadFocusId = null;
          }
          return;
        }
        case "SWITCH_TAB":
          if (state.route.kind === "farm" && VALID_TABS.has(event.tab)) {
            state.route = { ...state.route, tab: event.tab };
          }
          return;
        case "OPEN_DOC":
          if (state.route.kind === "farm" || state.route.kind === "doc") {
            const returnTab = state.route.kind === "farm" ? state.route.tab : state.route.returnTab;
            state.route = { kind: "doc", path: state.route.path, docPath: event.docPath, returnTab };
          }
          return;
        case "BACK_TO_FARM":
          if (state.route.kind === "doc") {
            state.route = { kind: "farm", path: state.route.path, tab: state.route.returnTab || "overview" };
          }
          return;
      }
    }

    function announce(msg) {
      const el = document.getElementById("sr-status");
      if (el) el.textContent = msg;
    }

    const esc = (s) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    async function runSafe(fn) {
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        state.activePanel = { kind: "error", message: msg };
        announce("Error: " + msg);
        render();
      }
    }

    const ICONS = {
      barn: '<svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M223.85 216H24v-96a257 257 0 0 1 56.2 6.21l-.2-.07V80l64-48l64 48v41.11a255 255 0 0 0-40 7V96h-48v42.61A256.8 256.8 0 0 1 223.85 216" opacity="0.2"/><path d="M232 160a8 8 0 0 0 0-16a232.2 232.2 0 0 0-65.8 9.47q-9-5.78-18.46-10.78A246.3 246.3 0 0 1 232 128a8 8 0 0 0 0-16c-5.36 0-10.69.18-16 .49V80a8 8 0 0 0-3.2-6.4l-64-48a8 8 0 0 0-9.6 0l-64 48A8 8 0 0 0 72 80v36.37A266.3 266.3 0 0 0 24 112a8 8 0 0 0 0 16a247 247 0 0 1 193.61 93a8 8 0 1 0 12.48-10q-7.59-9.5-15.94-18.14c5.92-.57 11.89-.86 17.85-.86a8 8 0 0 0 0-16a201.5 201.5 0 0 0-32.59 2.65q-7.75-6.92-16-13.16A216.5 216.5 0 0 1 232 160m-104-26.76V104h32v17.94a262.5 262.5 0 0 0-31.93 11.33ZM88 84l56-42l56 42v29.93q-12.12 1.45-24 4V96a8 8 0 0 0-8-8h-48a8 8 0 0 0-8 8v31q-11.79-4.15-24-7.18Zm48.83 136.43a8 8 0 0 1-11.09 2.23A183.15 183.15 0 0 0 24 192a8 8 0 0 1 0-16a199.1 199.1 0 0 1 110.6 33.34a8 8 0 0 1 2.23 11.09m49.54-10.14a8 8 0 1 1-11.2 11.42A214.8 214.8 0 0 0 24 160a8 8 0 0 1 0-16a230.7 230.7 0 0 1 162.37 66.29"/></svg>',
      warn: '<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" /></svg>',
      tractor: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M10 18a3 3 0 0 1-6 0a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11.001C16.105 4 17 4.895 17 5.999L20 6c2 0 2 2.896 2 4v6a2 2 0 0 1-2 2h-1a3 3 0 0 1-6 0zM4 6v9h11V6zm13 2v4h3V8zm-1 11a1 1 0 1 0 0-2a1 1 0 0 0 0 2m-9 0a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/></svg>',
      flame: '<svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M208 144a80 80 0 0 1-160 0c0-30.57 14.42-58.26 31-80l33 32l26.27-72C159.86 41.92 208 88.15 208 144" opacity="0.2"/><path d="M183.89 153.34a57.6 57.6 0 0 1-46.56 46.55a9 9 0 0 1-1.33.11a8 8 0 0 1-1.32-15.89c16.57-2.79 30.63-16.85 33.44-33.45a8 8 0 0 1 15.78 2.68ZM216 144a88 88 0 0 1-176 0c0-27.92 11-56.47 32.66-84.85a8 8 0 0 1 11.93-.89l24.12 23.41l22-60.41a8 8 0 0 1 12.63-3.41C165.21 36 216 84.55 216 144m-16 0c0-46.09-35.79-85.92-58.21-106.33l-22.27 61.07a8 8 0 0 1-13.09 3L80.06 76.16C64.09 99.21 56 122 56 144a72 72 0 0 0 144 0"/></svg>',
      chevron: '<svg aria-hidden="true" class="chevron" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>',
      check: '<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="2.6" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>',
      x: '<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>',
    };

    function scoreTier(score) {
      if (score >= 9) return { pip: "score-pip-green", color: "score-green", dot: "green", icon: ICONS.barn };
      if (score >= 7) return { pip: "score-pip-orange", color: "score-orange", dot: "orange", icon: ICONS.warn };
      if (score >= 5) return { pip: "score-pip-amber", color: "score-amber", dot: "amber", icon: ICONS.tractor };
      return { pip: "score-pip-red", color: "score-red", dot: "red", icon: ICONS.flame };
    }

    function scorePipHtml(score, { iconOnly = false } = {}) {
      const t = scoreTier(score);
      if (iconOnly) return \`<span class="score-pip score-pip-icon-only \${t.pip}" aria-hidden="true">\${t.icon}</span>\`;
      return \`<span class="score-pip \${t.pip}" aria-label="Score \${score} out of 10">\${t.icon}\${score}</span>\`;
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
      let blockState = "none"; // "none" | "code" | "ul" | "ol" | "table"

      const closeNonCode = () => {
        if (blockState === "ul" || blockState === "ol") html += "</" + blockState + ">";
        else if (blockState === "table") html += "</tbody></table>";
        if (blockState !== "code") blockState = "none";
      };

      for (const line of lines) {
        if (line.trim().startsWith("\`\`\`")) {
          if (blockState === "code") { html += "</code></pre>"; blockState = "none"; }
          else { closeNonCode(); html += "<pre><code>"; blockState = "code"; }
          continue;
        }
        if (blockState === "code") { html += esc(line) + "\\n"; continue; }
        if (/^\\s*$/.test(line)) { closeNonCode(); continue; }
        if (/^---+$/.test(line.trim())) { closeNonCode(); html += "<hr>"; continue; }

        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          if (blockState !== "table") closeNonCode();
          const cells = line.trim().split("|").slice(1, -1).map((c) => c.trim());
          if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
          if (blockState !== "table") {
            html += "<table><thead><tr>" + cells.map((c) => "<th>" + renderInline(c) + "</th>").join("") + "</tr></thead><tbody>";
            blockState = "table";
          } else {
            html += "<tr>" + cells.map((c) => "<td>" + renderInline(c) + "</td>").join("") + "</tr>";
          }
          continue;
        }

        if (blockState === "table") closeNonCode();

        const h = line.match(/^(#{1,4})\\s+(.+)$/);
        if (h) { closeNonCode(); html += "<h" + h[1].length + ">" + renderInline(h[2]) + "</h" + h[1].length + ">"; continue; }
        if (line.startsWith("> ")) { closeNonCode(); html += "<blockquote><p>" + renderInline(line.slice(2)) + "</p></blockquote>"; continue; }

        const oli = line.match(/^\\s*\\d+\\.\\s+(.+)$/);
        if (oli) {
          if (blockState !== "ol") { closeNonCode(); html += "<ol>"; blockState = "ol"; }
          html += "<li>" + renderInline(oli[1]) + "</li>";
          continue;
        }

        const li = line.match(/^\\s*[-*]\\s+(.+)$/);
        if (li) {
          if (blockState !== "ul") { closeNonCode(); html += "<ul>"; blockState = "ul"; }
          const task = li[1].match(/^\\[([ xX-])\\]\\s+(.+)$/);
          if (task) {
            const sym = task[1] === " " ? "☐" : task[1] === "-" ? "⊘" : "☑";
            html += "<li>" + sym + " " + renderInline(task[2]) + "</li>";
          } else {
            html += "<li>" + renderInline(li[1]) + "</li>";
          }
          continue;
        }

        closeNonCode();
        html += "<p>" + renderInline(line) + "</p>";
      }
      if (blockState === "code") html += "</code></pre>";
      else closeNonCode();
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
`;
