# Scan-coverage benchmark

Measures what share of real US grocery barcodes end in a full Klarity verdict, using the app's own
`ScanResolver` and `classifyOutcome` (spec 009) — no UI, no camera.

```bash
npm run bench:scan        # → bench/scan-coverage/runs/<date>/{summary.md,results.jsonl}
```

- `barcodes.tsv` — 300 GTINs, 10 per category across 30 packaged-goods aisles, sampled from Kroger's
  catalog search in relevance order (`klarity-bench sample`). Sampled from a store shelf, not from OFF,
  so OFF coverage isn't inflated by construction. Kroger coverage *is* inflated — every code came from it.
  Identifiers only; no Kroger product data is committed.
- Runs are serial with backoff: OFF rate-limits bursts with HTTP 429 (~5–10 min per run). Re-running into
  an existing run directory keeps resolved rows and retries only errors.
- Runs are gitignored (they hold third-party product data). Keep the read-out in the PR / docs instead.
- The "undetected additives" list comes from an audit-only name list in `main.swift` — a deliberately broad
  "an additive is probably here" detector used to find engine gaps. It is not evidence data and never ships.
