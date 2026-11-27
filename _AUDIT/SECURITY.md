# Security Audit — farmwork

> OWASP posture, secrets hygiene, and dependency vulnerabilities

**Last Updated:** 2026-11-27
**Score:** 10/10
**Status:** Hardened

---

## Executive Summary

Zero leaked secrets or sensitive tracked files (42 files scanned), clean npm audit (0 high/critical CVEs), strict CSP & security headers, CSRF Origin validation on all Viewer POST routes, symlink-safe canonical root confinement, byte-capped stream-destroying JSON body reader, zero-shell subprocess spawns across git/bd/just/browser launcher, and .env/key exclusions in .gitignore.

---

## Findings

_No open issues recorded._

---

## Recommendations

- Keep npm audit green on dependency updates via `just security`.
- Preserve `shell: false` on all new child_process invocations and canonical path checks in the Local Viewer.

---

## Audit History

| Date | Summary |
|------|---------|
| 2026-11-27 | Score 10/10 · 0 findings · Hardened |
