# Klarity — spike v0

An evidence-based, calibrated alternative to Yuka. Same one-second glance, but:

- **Calibrated to evidence + dose**, not presence (no carrageenan-style false alarms)
- **Frequency framing**, not a moral good/bad ladder
- **Three verdict states**: `everyday` · `sometimes` · `contested` (we never fake a side when regulators genuinely disagree)
- **Personalized** — a profile re-renders verdicts (the moat Yuka structurally can't copy)

## Run

Open `index.html` in a browser. No build step.

## What to try (the demo path)

1. Scan **Barista Almond Milk** → tap **Carrageenan** → see the Tier-D misattribution dismissed and the live Tier-B gut caveat kept. This is the "calmer *and* more correct" case.
2. Switch the profile to **Has IBD** → reopen carrageenan → the subgroup note now surfaces. Same product, personalized verdict.
3. Scan **Rainbow Chews** → tap **Titanium dioxide** → the `contested` state: EFSA vs JECFA shown side by side, IARC inhalation claim dismissed, resolved by benefit/avoidability not by picking a regulator.
4. Toggle **Precaution-leaning** vs **Risk-tolerant** → watch the contested guidance flip without the science changing.

## Files

- `index.html` — the engine + 3-layer UI (glance → product → evidence trail)
- `data.js` — the seeded dataset. **This is the editorial core**; its shape is the data model the real backend must produce.

## Status

Illustrative. Verdicts are hand-authored from the evidence we reasoned through (carrageenan, nitrite, titanium dioxide, aspartame, polysorbate 80, ascorbic acid). The next real engineering problem is generating these evidence objects reliably at scale — especially refusing to drop the Tier-B caveat on `contested`/`sometimes` cases.
