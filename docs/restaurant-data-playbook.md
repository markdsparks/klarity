# Restaurant Data Ingestion — Playbook

> Operational notes from ingesting Chick-fil-A (full menu), Culver's, Dairy Queen,
> Panera Bread, Jimmy John's, and Subway (spec 004/006). Read this before adding
> a new chain or re-verifying an existing one — it captures what actually worked,
> not just the architecture (that's in spec 004).

---

## Per-chain sourcing notes

| Chain | Coverage tier | What worked | What didn't |
|---|---|---|---|
| Chick-fil-A | `full` | Direct WebFetch of chick-fil-a.com/menu item pages | — |
| Culver's | `full` | Their own "Quality Ingredient Guide" PDF, text-layer extracted | Vision-based transcription of the PDF disagreed with aggregators on some items (see below) |
| Dairy Queen | `full` | National nutrition brochure PDF (dotcmscloud.com CDN) for numbers; **WebSearch snippet extraction** for per-item ingredient pages | Direct WebFetch to dairyqueen.com was blocked by bot protection |
| Jimmy John's | `full` | Their own `NUTRITION_GUIDE_*.pdf` and `Allergen_and_Ingredients.pdf`, both on jimmyjohns.com's asset CDN, converted with `pdftotext` | — |
| Subway | `full` | Their own "US Nutrition Information" + "US Product Ingredient Guide" PDFs on subway.com's CDN | Components don't sum to published item totals — don't try to reconstruct whole-item nutrition from parts |
| Panera Bread | `nutrition-only` | Nutrition Guide PDF via WebFetch using a plain `curl/8.4.0` user-agent (Akamai bot-wall blocks browser-like UAs but not that one) | Full ingredient statements require a cafe-specific session on a private ordering API (`www-api.panerabread.com`) — correctly out of scope; scraping it would cross the "no runtime scraping" line in CLAUDE.md |
| Panda Express | *(blocked)* | — | pandaexpress.com returns 403 to WebFetch and plain `curl`; their ordering API is behind a DataDome CAPTCHA. Needs a real browser session (claude-in-chrome extension connected) or a supplied source document. |

**The pattern:** every chain's own domain is the required source, but *how* you reach
it varies. When direct WebFetch is blocked, escalate in this order before giving up:
1. Try a different, plainer user-agent on WebFetch/curl (worked for Panera).
2. Try WebSearch — its snippets are the search engine's own crawl of the chain's
   page content, which is still first-party sourcing, just accessed differently
   (worked for Dairy Queen).
3. Try the claude-in-chrome extension, which authenticates as a real browser session
   and can get past bot walls that block programmatic fetches (not yet tried; this
   is the next step for Panda Express).
4. If all three fail: **stop and say so.** Do not fall back to third-party
   aggregators (fastfoodnutrition.org, myfooddiary.com, etc.) and do not bypass
   CAPTCHA/DataDome challenges — both are against the rules, for good reason (see
   "Data integrity" below).

## Data integrity — trust ranking

In order of trust, confirmed by direct experience on this batch:

1. **The chain's own PDF, text-layer extracted.** Culver's caught a genuine ~60
   calorie discrepancy this way — a vision-based read of the same PDF and several
   third-party aggregators both said 610 cal for the Bacon Deluxe; the actual
   embedded text layer said 670 cal (confirmed correct). **Always extract PDF text
   programmatically (`pdftotext` or equivalent) rather than reading it visually or
   trusting a summarized version.**
2. **The chain's own web page**, fetched directly or via a working access method.
3. **Never** third-party aggregators, even as a cross-check tiebreaker — they have
   a demonstrated track record of drifting from the source (see Culver's above).
   If the chain's own source is unreachable, the item is skipped, not sourced
   secondhand.

## Coverage tier decision rule

`full` requires **both** mandated nutrition and per-component ingredient
statements to be genuinely public (not gated behind a private ordering session).
`nutrition-only` is the honest fallback — Panera Bread is the reference case:
their public Allergen Guide is a Yes/May-Contain matrix, not ingredient text, and
the real statements sit behind a cafe-scoped ordering API. Don't stretch a
`full` claim to cover partial data; don't fabricate ingredient text to close the
gap.

When per-component nutrition isn't separately published but the chain publishes
enough item pairs to derive it (Chick-fil-A's cheese, Dairy Queen's mix-ins),
subtraction between two published whole-item numbers is fine — but only when
both real numbers exist, recorded via `nutritionBasis` matching `/published/i`.
Never estimate a delta.

## Catalog ID prefixing

`CATALOG` is one flat array shared across all chains (`src/data/restaurants/index.ts`).
Every chain's catalog IDs must be prefixed to avoid collisions: `cfa_`, `cul_`
(Culver's has no separate catalog — only one cheese, resolved via the item's own
component), `dq_`, `pnr_`, `jj_`, `sub_`. Follow this convention for any new chain.

## Known harness pitfall: worktree isolation can leak into the main checkout

During this batch, one background content-authoring agent's file-edit and shell
tools resolved paths against the **main repository checkout** instead of its
assigned isolated worktree — its environment description apparently still showed
the parent session's "Primary working directory" rather than the worktree path.
Symptoms observed:

- Untracked files (`subway.ts`, `subway-catalog.ts`) appearing directly in the
  main checkout's working directory while the agent was still running.
- A live, uncommitted edit to `src/data/restaurants/index.ts` in the main checkout
  that silently *replaced* another chain's already-merged registration instead of
  appending to it.
- Worse: main's `node_modules` was replaced by a **self-referential symlink**
  (`node_modules -> node_modules`), almost certainly from an agent running
  `ln -s /path/to/node_modules node_modules` while believing its cwd was its own
  worktree but actually being the main checkout — breaking `tsc`/`jest` for
  everyone until caught and fixed (`rm` the broken symlink, `npm install` fresh).

**Mitigation used, and recommended going forward:** while multiple content
agents are running in parallel with `isolation: "worktree"`, do PR-conflict
resolution and integration work from a **separate scratch worktree**
(`git worktree add ../klarity-integration -b integration-scratch origin/main`),
never the primary checkout — it may be getting written to by a misbehaving
background agent at any moment. Check `git status` in the main checkout
periodically during a large parallel batch; anything unexpected there is a
signal, not noise. This is a harness bug worth flagging upstream, not a data
problem.

## Merge mechanics when several chain PRs land in parallel

Every chain PR touches the same two shared files: `src/data/restaurants/index.ts`
(import + array entries) and occasionally the shared test files (new `describe`
blocks appended at the end). Conflicts are near-always trivial — two
independent additions to the same array/file — and are resolved by keeping both
sides' entries, not picking one. Because PRs were squash-merged, `git merge`
across them can falsely conflict on content that's actually identical if the
local `origin/main` ref is stale; always `git fetch origin main` immediately
before resolving, not just once at the start of a session.

## Freshness and future drift-checking

Spec 004 already established the manual rule: the `retrieved` date on every
chain is always visible, and a re-verification pass is a ~6-month checklist
item, not automation, for now.

**Recommendation for automating the check (not yet built):** a scheduled job
that periodically re-fetches each chain's published source and *diffs* it
against what's stored — flagging drift for review — is worth doing, but it
should **never auto-merge**. The whole point of this playbook's trust ranking is
that ingestion needs a human in the loop (Mark's spot-check, per every PR in
this batch); a silent auto-update could introduce bad data with nobody
watching. The right shape is closer to: quarterly cron → one agent per chain
re-pulls the current published numbers → opens a PR *only* where something
changed, labeled "drift detected," never merged automatically. Worth building
once the chain list stabilizes; premature before that.
