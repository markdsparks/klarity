# ADR-006 — A minimal token-proxy for Kroger's OAuth2 client secret

**Date:** 2026-07-06
**Status:** Accepted and deployed (2026-07-06). Live at
`https://klarity-kroger-token-proxy.markdsparks.workers.dev`. Client-side
integration shipped as spec 020.

## Context

Spec 019 built a generalized multi-source corroboration model for search
results (`EnrichmentCheck`), with USDA and OFF completeness as the first two
sources. Kroger's public Products API was the next candidate — real retail
catalog data, free signup, and (per Mark's own read of
`developer.kroger.com/terms`) no blanket non-commercial-use restriction like
Nutritionix or Edamam have.

But Kroger's Products API requires the OAuth2 `client_credentials` grant,
which needs a `client_id` **and** `client_secret` sent to
`https://api.kroger.com/v1/connect/oauth2/token`. Kroger's own developer
docs are explicit: *"you should never store your client secret in a
client-side JavaScript file."* Klarity has no backend — it's a pure Expo
client app, and the JS bundle ships to every user's device. OFF needs no
auth; USDA's api.data.gov key is designed to be a client-embeddable,
per-key-rate-limited credential (that's the whole point of that key model).
Kroger's secret is not that kind of credential — embedding it would be
both against Kroger's explicit guidance and a real extraction/abuse
vector (anyone could pull it from the shipped app and burn Klarity's quota,
or worse).

## Decision

Stand up a minimal serverless function whose only job is holding the
Kroger `client_secret` and minting short-lived (30-minute) access tokens on
request. The Klarity app calls this proxy to get a token, then calls
Kroger's Products API directly from the client using that token — the
proxy does **not** forward or cache product data itself, only mints tokens.
This keeps the new infrastructure surface as small as possible and keeps
the proxy itself outside of Kroger's content-caching restriction (Section
5e of their terms — no permanent copies of *content*; a short-lived OAuth
token is a credential, not content).

**Platform: Cloudflare Workers.** Free tier (100,000 requests/day) is far
beyond what a per-search token-mint step needs, no cold-start concerns for
a function this small, single-file deploy via `wrangler`, no need to stand
up a full app server or framework for a job this narrow.

## Alternatives considered

- **Embed the secret client-side anyway** — rejected. Directly against
  Kroger's own stated guidance; real risk the app's own Kroger quota gets
  extracted and abused by anyone who decompiles the shipped app.
- **Drop Kroger entirely** — the fallback if this proxy turns out to be
  more trouble than it's worth, but Mark wants the source and the ToS
  itself doesn't rule it out — only the auth model does.
- **A full backend (Next.js API route, Express server, etc.)** — rejected
  as overbuilt for a single endpoint that does one thing (mint a token).

## Scope, deliberately narrow

- The proxy exposes exactly one endpoint: mint-or-return-cached Kroger
  access token. It does not proxy Kroger's Products API itself — the app
  calls Kroger directly once it has a token, keeping the proxy's blast
  radius (and Kroger ToS surface) as small as possible.
- In-memory (per-isolate) token cache only, keyed on expiry — avoids
  re-minting a token on every single search when the existing one still has
  life left, without needing any persistent storage (KV, D1, etc.) for a
  30-minute-lived credential.
- No product data, images, or any Kroger *content* ever passes through or
  is stored by the proxy — only the OAuth token round-trip.

## What's needed before this can be built

1. **Mark registers a Kroger developer account and app** at
   developer.kroger.com to get a real `client_id`/`client_secret` — this is
   a manual step only Mark can do (same category as the Apple ID sign-in
   step in the deploy docs), since it requires accepting the terms as an
   account holder.
2. **A Cloudflare account** (free tier) to deploy the Worker to — Mark's,
   since it's a real external account with its own credentials; I can write
   the Worker code and `wrangler.toml`, but deploying and setting the
   Worker's secret values (`KROGER_CLIENT_ID`/`KROGER_CLIENT_SECRET`) needs
   Mark's own `wrangler login` or dashboard access.
3. Once deployed, the app needs one new env var
   (`EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL`) pointing at the deployed Worker.

## Deploy steps (Mark, once — needs your own Cloudflare + Kroger accounts)

```bash
cd server/kroger-token-proxy
npm install
npx wrangler login                              # one-time, opens a browser
npx wrangler secret put KROGER_CLIENT_ID         # paste when prompted
npx wrangler secret put KROGER_CLIENT_SECRET     # paste when prompted
npm run deploy                                   # prints the deployed *.workers.dev URL
```

Then add that URL to `.env` as `EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL` (same
pattern as `EXPO_PUBLIC_USDA_API_KEY`) so the app can reach it — the
client-side `krogerCheck` (spec 019's `EnrichmentCheck` model) isn't built
yet; that's the next step once this URL exists and returns a real token.

## Revisit

If Kroger's data doesn't end up meaningfully improving search results once
live (same "measure before investing further" instinct as spec 017's own
constraints section), or if the proxy adds more maintenance burden than
it's worth for a single-developer family app, drop it — nothing else in
the corroboration model depends on Kroger existing (spec 019's `CHECKS`
array is additive by design).
