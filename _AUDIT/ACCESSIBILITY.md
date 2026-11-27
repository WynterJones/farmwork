# Accessibility Audit — farmwork

> WCAG 2.1 AA semantics, keyboard navigation, and contrast

**Last Updated:** 2026-11-27
**Score:** 10/10
**Status:** WCAG 2.1 AA

---

## Executive Summary

Local Farm Viewer ships semantic landmarks (`aside`, `nav`, `main`, `article`, native `<dialog>`), skip-to-content link, `aria-live="polite"` status announcements and `role="alert"` error panels, semantic `<button>` cards/rows (no clickable `<div>`s), WAI-ARIA `tablist`/`tab`/`tabpanel` with ArrowLeft/ArrowRight/Home/End keyboard navigation, `role="checkbox"` & `role="progressbar"` semantics, unbroken `h1 -> h2 -> h3` heading hierarchy, visible `:focus-visible` honey rings, WCAG AA contrast tokens (`--latte-500` #8d8d99), and `@media (prefers-reduced-motion: reduce)`.

---

## Findings

_No open issues recorded._

---

## Recommendations

- Keep all new interactive Viewer controls as native `<button>`/`<a>`/`<dialog>` elements with explicit labels and keyboard handlers.

---

## Audit History

| Date | Summary |
|------|---------|
| 2026-11-27 | Score 10/10 · 0 findings · WCAG 2.1 AA |
