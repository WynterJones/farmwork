# Performance Audit — farmwork

> Speed, bundle size, queries, rendering, and runtime efficiency

**Last Updated:** 2026-11-27
**Score:** 10/10
**Status:** Fast

---

## Executive Summary

Consolidated git inspection from 6 subprocess spawns to 2 per repository (`git status --porcelain=v1 --branch` + single-format `git log -1`), eliminated redundant statSync calls in doc reading, switched `/api/farms` to lightweight `countFarmDocs()`, pre-encoded the Viewer HTML response buffer, and added in-memory WebP asset caching with immutable HTTP cache headers.

---

## Findings

_No open issues recorded._

---

## Recommendations

- Keep zero new runtime dependencies (5 lean deps total) and benchmark `scanFarms` when adding any new per-repo metadata.

---

## Audit History

| Date | Summary |
|------|---------|
| 2026-11-27 | Score 10/10 · 0 findings · Fast |
