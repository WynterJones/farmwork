export const VIEWER_COMPONENT_STYLES = `
    /* Glass Surfaces & Interactive Card Buttons */
    .surface {
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(28, 28, 33, 0.65);
      backdrop-filter: blur(16px) saturate(1.4);
      -webkit-backdrop-filter: blur(16px) saturate(1.4);
      box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
    }

    .card-btn {
      inline-size: 100%;
      text-align: start;
      font: inherit;
      color: inherit;
    }

    .card-hover {
      transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, background 200ms ease;
    }
    .card-hover:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.5), 0 0 20px -4px rgba(218, 178, 64, 0.08);
    }

    /* Buttons */
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
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); color: var(--latte-50); }

    .btn-ghost { color: var(--latte-300); border: 1px solid transparent; background: transparent; }
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
      color: var(--latte-300);
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 150ms ease;
    }
    .farm-info-btn:hover { color: var(--latte-100); background: rgba(255, 255, 255, 0.065); border-color: rgba(255, 255, 255, 0.14); }
    .farm-info-btn.gold { background: rgba(196, 158, 53, 0.15); color: var(--honey-200); border-color: rgba(196, 158, 53, 0.22); }
    .farm-info-btn.gold:hover { background: rgba(196, 158, 53, 0.25); border-color: rgba(196, 158, 53, 0.35); }
    .farm-info-btn svg { inline-size: 13px; block-size: 13px; }

    /* Badges & Score Pips */
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
    .badge-muted { background: rgba(255, 255, 255, 0.06); color: var(--latte-300); }

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
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .score-pip svg { inline-size: 1rem; block-size: 1rem; flex: none; }
    .score-pip-sm { font-size: 0.65rem; padding: 0.22rem 0.5rem 0.22rem 0.38rem; gap: 0.3rem; }
    .score-pip-sm svg { inline-size: 0.72rem; block-size: 0.72rem; }
    .score-pip-icon-only { padding: 0.55rem; gap: 0; }
    .score-pip-icon-only svg { inline-size: 1.15rem; block-size: 1.15rem; }
    .score-pip-green { color: #b8c7a6; background: linear-gradient(180deg, rgba(98, 126, 84, 0.35), rgba(80, 106, 68, 0.45)); border-color: rgba(118, 145, 102, 0.3); }
    .score-pip-orange { color: #edd28e; background: linear-gradient(180deg, rgba(196, 158, 53, 0.3), rgba(168, 137, 44, 0.4)); border-color: rgba(218, 178, 64, 0.25); }
    .score-pip-amber { color: #e0b88a; background: linear-gradient(180deg, rgba(180, 118, 58, 0.32), rgba(155, 100, 48, 0.42)); border-color: rgba(200, 138, 72, 0.28); }
    .score-pip-red { color: #d8ae9e; background: linear-gradient(180deg, rgba(160, 80, 66, 0.35), rgba(136, 68, 54, 0.45)); border-color: rgba(180, 102, 86, 0.3); }
    .score-pip-muted { color: #a3998c; background: linear-gradient(180deg, rgba(85, 77, 66, 0.3), rgba(62, 56, 48, 0.4)); border-color: rgba(255, 255, 255, 0.06); }
    .score-green { color: var(--sage-200); }
    .score-orange { color: var(--honey-200); }
    .score-amber { color: #e0b88a; }
    .score-red { color: var(--clay-100); }

    /* Inputs, Filters & Folder Tabs */
    .input-primary {
      inline-size: 100%;
      border-radius: 0.375rem;
      padding: 0.55rem 0.85rem;
      font-family: var(--font-mono);
      font-size: 0.84rem;
      color: var(--latte-100);
      background: rgba(15, 15, 18, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .input-primary::placeholder { color: var(--latte-500); }
    .search-wrap { position: relative; flex: 1; }
    .search-wrap svg { position: absolute; inset-inline-start: 0.75rem; inset-block-start: 50%; transform: translateY(-50%); inline-size: 16px; block-size: 16px; color: var(--latte-500); pointer-events: none; }
    .search-wrap .input-primary { padding-inline-start: 2.3rem; }

    .farm-filter-btn { padding: 0.35rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 500; border-radius: 0.375rem; border: 0; cursor: pointer; color: var(--latte-400); background: transparent; }
    .farm-filter-btn:hover { color: var(--latte-200); }
    .farm-filter-btn.active { background: rgba(255, 255, 255, 0.08); color: var(--latte-100); }

    .repo-tabs { display: flex; gap: 0.25rem; border-block-end: 1px solid rgba(255, 255, 255, 0.06); margin-block-end: 1.5rem; overflow-x: auto; }
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
      white-space: nowrap;
    }
    .repo-tab:hover:not(.active) { color: var(--latte-200); background: rgba(255, 255, 255, 0.03); }
    .repo-tab.active { color: var(--honey-200); background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.06); }
    .repo-tab-count { margin-inline-start: 0.35rem; font-size: 0.72rem; color: var(--latte-500); }
    .repo-tab.active .repo-tab-count { color: rgba(229, 196, 110, 0.85); }

    /* Headers, Portfolio Cards & Ribbons */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap; margin-block-end: 2rem; }
    .page-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .page-title { font-size: clamp(1.5rem, 2.5vw, 1.9rem); line-height: 1.2; }
    .page-sub { margin-block-start: 0.35rem; font-size: 0.85rem; color: var(--latte-400); }
    .score-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem 1.2rem; margin-block-start: 0.75rem; font-family: var(--font-mono); font-size: 0.72rem; color: var(--latte-400); }
    .score-legend span { display: inline-flex; align-items: center; gap: 0.4rem; }

    .header-stats { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
    .header-stat { text-align: end; }
    .header-stat-val { font-family: var(--font-mono); font-size: 1.55rem; font-weight: 600; color: var(--latte-100); line-height: 1.1; }
    .header-stat-val.big { font-size: 2.75rem; font-weight: 700; }
    .header-stat-lbl { font-family: var(--font-mono); font-size: 11px; color: var(--latte-400); margin-block-start: 0.2rem; }
    .stat-divider { inline-size: 1px; block-size: 32px; background: rgba(255, 255, 255, 0.06); }
    .stat-divider.tall { block-size: 44px; }

    .filter-bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-block-end: 1.25rem; }
    .farm-stack { display: grid; gap: 1rem; }
    .farm-card-wrap { position: relative; }
    .farm-card { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.25rem 1.35rem; cursor: pointer; }
    .farm-card.has-ribbon { padding-block-end: 1.5rem; }
    .farm-card-title { font-family: var(--font-mono); font-size: 1rem; font-weight: 500; color: var(--latte-100); }
    .farm-card:hover .farm-card-title { color: var(--honey-200); }
    .farm-card-meta { margin-block-start: 0.55rem; display: flex; flex-wrap: wrap; gap: 0.45rem 1rem; font-size: 0.76rem; color: var(--latte-400); }
    .farm-card-meta strong { color: var(--latte-200); font-weight: 500; }
    .farm-card-right { display: flex; align-items: center; gap: 0.85rem; flex: none; }
    .chevron { inline-size: 18px; block-size: 18px; color: var(--latte-500); }

    .checklist-ribbon {
      inline-size: 100%;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-block-start: -10px;
      padding: 19px 1.25rem 0.6rem;
      border-radius: 0 0 0.75rem 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.04);
      background: rgba(14, 14, 17, 0.75);
      cursor: pointer;
    }
    .checklist-ribbon.complete { block-size: 18px; padding: 0; background: rgba(74, 158, 101, 0.16); border-color: rgba(74, 158, 101, 0.12); }
    .ribbon-track { flex: 1; block-size: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
    .ribbon-fill { block-size: 100%; border-radius: 999px; background: rgba(196, 158, 53, 0.55); }
    .ribbon-stat { font-family: var(--font-mono); font-size: 11px; color: var(--latte-400); }
    .ribbon-pct { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--latte-300); }

    /* Watermarked Audit Cards, Checklists, Panels & Prose */
    .art-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-block-end: 1.5rem; }
    .art-card { position: relative; overflow: hidden; padding: 1.25rem 1.35rem; cursor: pointer; }
    .art-card img.art-bg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; object-fit: cover; opacity: 0.08; -webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black); pointer-events: none; }
    .art-card-inner { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
    .art-card h3, .art-card h4 { font-size: 0.92rem; color: var(--latte-100); }
    .art-card p { margin: 0.25rem 0 0; font-size: 0.76rem; color: var(--latte-400); line-height: 1.45; }

    .progress-card { padding: 1.25rem 1.4rem; margin-block-end: 1.5rem; border-radius: 0.75rem; }
    .progress-card.complete { border: 1px solid rgba(98, 126, 84, 0.25); background: linear-gradient(135deg, rgba(22, 50, 32, 0.5) 0%, rgba(30, 60, 38, 0.35) 100%); }
    .progress-track { block-size: 8px; border-radius: 999px; overflow: hidden; background: rgba(21, 21, 25, 0.85); }
    .progress-fill { block-size: 100%; border-radius: 999px; background: var(--honey-400); }
    .progress-card.complete .progress-fill { background: var(--sage-400); }

    .check-group-title { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 0.75rem; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.09em; color: var(--latte-400); }
    .check-group-title::after { content: ""; flex: 1; block-size: 1px; background: rgba(255, 255, 255, 0.06); }
    .check-row { display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; padding: 0.95rem 1.1rem; margin-block-end: 0.5rem; }
    .check-row.complete { opacity: 0.72; }
    .check-row.skip { opacity: 0.55; }
    .check-left { display: flex; align-items: center; gap: 0.8rem; min-inline-size: 0; flex: 1; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; padding: 0; }
    .check-left:disabled { cursor: default; }
    .check-box { inline-size: 20px; block-size: 20px; border-radius: 4px; border: 1px solid var(--latte-500); display: grid; place-items: center; flex: none; }
    .check-row.complete .check-box { background: var(--honey-400); border-color: var(--honey-400); color: var(--crust-100); }
    .check-row.skip .check-box { background: rgba(79, 79, 88, 0.35); border-color: var(--latte-500); color: var(--latte-300); }
    .check-box svg { inline-size: 14px; block-size: 14px; }
    .check-title { font-size: 0.9rem; font-weight: 500; color: var(--latte-100); }
    .check-row.complete .check-title { color: var(--latte-400); text-decoration: line-through; }
    .check-row.skip .check-title { color: var(--latte-400); text-decoration: line-through; font-style: italic; }

    .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 500; color: var(--latte-400); margin-block-end: 1.15rem; }
    .breadcrumb button { border: 0; background: transparent; color: var(--latte-300); font: inherit; padding: 0; cursor: pointer; }
    .breadcrumb button:hover { color: var(--latte-50); }
    .breadcrumb svg { inline-size: 14px; block-size: 14px; color: var(--latte-500); }
    .action-row { margin-block-start: 0.85rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }

    .legacy-banner { display: flex; align-items: flex-start; gap: 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(196, 158, 53, 0.28); background: rgba(168, 137, 44, 0.1); padding: 0.9rem 1.1rem; margin-block-end: 1.5rem; font-size: 0.86rem; color: var(--honey-100); line-height: 1.55; }
    .legacy-banner code { font-family: var(--font-mono); font-size: 0.8rem; background: rgba(9, 9, 11, 0.55); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--honey-200); padding: 0.1rem 0.4rem; border-radius: 4px; }

    .breakdown-list { display: grid; gap: 0.5rem; }
    .breakdown-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.6rem 0.85rem; border-radius: 0.45rem; background: rgba(15, 15, 18, 0.55); border: 1px solid rgba(255, 255, 255, 0.04); font-size: 0.86rem; }
    .breakdown-pts { font-family: var(--font-mono); font-size: 0.78rem; color: var(--honey-200); flex: none; }

    .gate-row { padding: 0.7rem 0.9rem; border-radius: 0.45rem; background: rgba(15, 15, 18, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); margin-block-end: 0.5rem; }
    .gate-row-top { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; font-family: var(--font-mono); font-size: 0.8rem; flex-wrap: wrap; }
    .gate-row pre { margin: 0.5rem 0 0; padding: 0.75rem; border-radius: 0.4rem; background: #0b0b0e; border: 1px solid rgba(255, 255, 255, 0.06); font-family: var(--font-mono); font-size: 0.74rem; color: var(--clay-100); overflow-x: auto; max-block-size: 180px; }

    .inline-form { display: flex; gap: 0.55rem; flex-wrap: wrap; align-items: center; }
    .inline-form .input-primary { flex: 1 1 200px; }

    .doc-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.95rem 1.15rem; margin-block-end: 0.5rem; cursor: pointer; }
    .doc-row h4 { font-size: 0.88rem; color: var(--latte-100); }
    .doc-row code { font-family: var(--font-mono); font-size: 0.74rem; color: var(--latte-400); }

    .doc-watermark { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
    .doc-watermark img { position: absolute; inset-block-end: 0; inset-inline-end: 0; block-size: 68%; inline-size: 56%; object-fit: cover; filter: grayscale(1); opacity: 0.045; -webkit-mask-image: radial-gradient(ellipse at 100% 100%, black 0%, transparent 70%); mask-image: radial-gradient(ellipse at 100% 100%, black 0%, transparent 70%); }

    .prose-reader { max-inline-size: 900px; margin-inline: auto; }
    .prose-card { padding: 2.25rem 2.75rem; }
    @media (max-width: 640px) { .prose-card { padding: 1.5rem 1.25rem; } }
    .prose { font-family: var(--font-sans); color: var(--latte-200); font-size: var(--prose-size, 0.9375rem); line-height: 1.8; }
    .prose h1 { font-family: var(--font-mono); color: var(--latte-50); font-size: 1.9em; margin: 0 0 1.4rem; padding-block-end: 0.7rem; border-block-end: 1px solid rgba(255, 255, 255, 0.08); }
    .prose h2 { font-family: var(--font-mono); color: var(--honey-200); font-size: 1.4em; margin: 2.2rem 0 0.85rem; }
    .prose h3 { font-family: var(--font-mono); color: var(--sage-100); font-size: 1.18em; margin: 1.75rem 0 0.6rem; }
    .prose p { margin: 1.05rem 0; }
    .prose p:first-child { margin-block-start: 0; }
    .prose strong { color: var(--latte-100); font-weight: 600; }
    .prose a { color: var(--honey-200); text-decoration: underline; text-underline-offset: 2px; }
    .prose ul, .prose ol { margin: 0.9rem 0; padding-inline-start: 1.5rem; }
    .prose li { margin: 0.35rem 0; }
    .prose code { font-family: var(--font-mono); font-size: 0.85em; border-radius: 4px; background: var(--crust-200); color: var(--honey-200); padding: 0.14rem 0.42rem; border: 1px solid rgba(255, 255, 255, 0.08); }
    .prose pre { overflow-x: auto; border-radius: 0.5rem; background: #101014; border: 1px solid rgba(255, 255, 255, 0.06); padding: 1.15rem 1.25rem; margin: 1.4rem 0; font-family: var(--font-mono); font-size: 0.85em; line-height: 1.65; }
    .prose pre code { background: transparent; border: 0; padding: 0; color: #ddd3c2; }
    .prose blockquote { margin: 1.35rem 0; border-inline-start: 2px solid rgba(98, 126, 84, 0.55); padding: 0.8rem 1.1rem; border-radius: 0 0.4rem 0.4rem 0; font-style: italic; color: var(--latte-300); background: rgba(28, 28, 33, 0.45); }
    .prose table { inline-size: 100%; margin: 1.4rem 0; font-size: 0.88em; border-collapse: separate; border-spacing: 0; border-radius: 0.5rem; border: 1px solid rgba(255, 255, 255, 0.06); overflow: hidden; }
    .prose th { padding: 0.7rem 1rem; text-align: start; font-family: var(--font-mono); font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #f2ead8; background: rgba(15, 15, 18, 0.92); border-block-end: 2px solid rgba(196, 158, 53, 0.22); }
    .prose td { padding: 0.7rem 1rem; color: var(--latte-200); border-block-end: 1px solid rgba(255, 255, 255, 0.04); }
    .prose hr { margin: 1.8rem 0; border: 0; block-size: 1px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(218, 178, 64, 0.16) 50%, rgba(255, 255, 255, 0.08) 80%, transparent); }

    .text-size-controls { position: fixed; inset-block-end: 1.5rem; inset-inline-end: 1.5rem; z-index: 30; display: flex; flex-direction: column; gap: 0.35rem; filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5)); }
    .text-size-btn { inline-size: 36px; block-size: 36px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(15, 15, 18, 0.9); color: var(--latte-200); font-family: var(--font-mono); font-size: 12px; font-weight: 500; display: grid; place-items: center; cursor: pointer; }

    dialog.farm-modal { margin: auto; padding: 1.5rem; inline-size: min(500px, 92vw); border-radius: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(16, 16, 20, 0.96); color: var(--latte-200); box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.75); }
    dialog::backdrop { background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px); }
    .modal-head { display: flex; justify-content: space-between; align-items: center; margin-block-end: 1rem; }
    .modal-head h2 { font-size: 1.05rem; }
    .modal-close { border: 0; background: transparent; color: var(--latte-400); cursor: pointer; padding: 0.25rem 0.45rem; border-radius: 0.375rem; }
    .modal-close:hover { color: var(--latte-50); background: rgba(255, 255, 255, 0.06); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-block-start: 1.1rem; }
    .help-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin: 0.75rem 0 1rem; }
    .help-item { padding: 0.6rem 0.75rem; border-radius: 0.5rem; background: rgba(255, 255, 255, 0.03); font-size: 0.8rem; color: var(--latte-200); }
    .help-item small { display: block; margin-block-start: 0.15rem; font-size: 0.7rem; color: var(--latte-400); }

    @keyframes slide-up { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .animate-in { animation: slide-up 0.22s ease-out; }
    .empty-state { padding: 3rem 1.5rem; text-align: center; color: var(--latte-400); }
    .empty-state h3 { color: var(--latte-200); margin-block-end: 0.35rem; font-size: 1rem; }
`;
