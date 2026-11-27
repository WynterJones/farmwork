export const VIEWER_BASE_STYLES = `
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

      /* Latte - Accessible WCAG AA cool-gray text tokens */
      --latte-50: #f5f5f6;
      --latte-100: #e4e4e7;
      --latte-200: #c7c7ce;
      --latte-300: #b2b2bc;
      --latte-400: #9b9ba6;
      --latte-500: #8d8d99;
      --latte-600: #6c6c78;

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

    /* Accessibility: Skip Link, Screen Reader Only, Keyboard Focus & Reduced Motion */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .skip-link {
      position: fixed;
      inset-block-start: -100px;
      inset-inline-start: 1rem;
      z-index: 100;
      padding: 0.6rem 1rem;
      border-radius: 0.5rem;
      background: var(--honey-300);
      color: var(--crust-500);
      font-family: var(--font-mono);
      font-size: 0.84rem;
      font-weight: 600;
      transition: inset-block-start 120ms ease;
    }
    .skip-link:focus { inset-block-start: 1rem; }

    :focus-visible {
      outline: 2px solid var(--honey-300);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

    * { scrollbar-width: thin; scrollbar-color: #4f4f58 #151519; }
    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-track { background: var(--crust-200); }
    *::-webkit-scrollbar-thumb { background: var(--latte-600); border-radius: 999px; border: 2px solid #151519; }
    *::-webkit-scrollbar-thumb:hover { background: var(--latte-500); }

    /* App Shell */
    .app-shell { display: flex; min-block-size: 100dvb; }

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
      inline-size: 100%;
      padding: 1.25rem;
      border: 0;
      border-block-end: 1px solid rgba(255, 255, 255, 0.06);
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .sidebar-logo img { inline-size: 100%; max-inline-size: 196px; block-size: auto; display: block; }

    .sidebar-nav { padding: 0.75rem; display: grid; gap: 0.15rem; }

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
    .nav-link.active { color: var(--honey-200); background: rgba(218, 178, 64, 0.08); }
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
      color: var(--latte-500);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sidebar-farms { flex: 1; padding: 0 0.75rem 0.75rem; display: flex; flex-direction: column; gap: 0.2rem; }
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
    .sidebar-farm-btn.active { color: var(--honey-200); background: rgba(218, 178, 64, 0.08); }
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
    .sidebar-farm-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sidebar-dot { inline-size: 7px; block-size: 7px; border-radius: 999px; flex: none; }
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
    .sidebar-root-path { color: var(--latte-400); word-break: break-all; line-height: 1.4; margin-block-start: 0.2rem; }

    .main-wrap { flex: 1; padding-inline-start: 256px; min-inline-size: 0; }
    .main-inner { padding: 2.25rem 2.5rem 4rem; max-inline-size: 1220px; position: relative; z-index: 1; }
    .main-inner:focus { outline: none; }

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
`;
