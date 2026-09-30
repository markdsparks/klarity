// ADR-006 — mints short-lived Kroger OAuth2 access tokens so the
// client_secret never ships inside the Expo app bundle. This is the ONLY
// job this Worker does: no Kroger product data is ever proxied, fetched,
// or cached here — that keeps it outside Kroger's content-caching
// restriction (their terms distinguish "content" from auth credentials),
// and keeps this Worker's own blast radius as small as possible.

export interface Env {
  KROGER_CLIENT_ID: string;
  KROGER_CLIENT_SECRET: string;
}

interface CachedToken {
  value: string;
  expiresAt: number; // ms epoch
}

interface KrogerTokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

// Per-isolate, in-memory only — never written to any persistent store.
// Tokens live 30 minutes; refreshing only when actually near expiry avoids
// re-minting one on every single search when the existing token still has
// life left.
let cachedToken: CachedToken | null = null;
const REFRESH_MARGIN_MS = 30_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > now) {
      return jsonResponse({
        access_token: cachedToken.value,
        expires_in: Math.floor((cachedToken.expiresAt - now) / 1000),
      });
    }

    const basicAuth = btoa(`${env.KROGER_CLIENT_ID}:${env.KROGER_CLIENT_SECRET}`);
    let resp: Response;
    try {
      resp = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // product.compact is the documented scope for the Products API —
        // worth confirming against the real Kroger response on first deploy.
        body: 'grant_type=client_credentials&scope=product.compact',
      });
    } catch {
      return new Response('Kroger token request failed (network)', { status: 502, headers: CORS_HEADERS });
    }

    if (!resp.ok) {
      return new Response(`Kroger token request failed (${resp.status})`, { status: 502, headers: CORS_HEADERS });
    }

    const data = (await resp.json()) as KrogerTokenResponse;
    cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };

    return jsonResponse({ access_token: data.access_token, expires_in: data.expires_in });
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
