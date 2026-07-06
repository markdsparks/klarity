import { alternateCode } from './off';

// ADR-006 / spec 020 — Kroger corroboration. The app never holds Kroger's
// client_secret; it only talks to our own token-proxy Worker (which does),
// then calls Kroger's Products API directly with the short-lived token that
// comes back. No Kroger product data is ever cached beyond this in-memory,
// per-session token cache (their terms prohibit permanent copies of content
// — a token is a credential, not content, same reasoning as the proxy).
const TOKEN_PROXY_URL = process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL;
const PRODUCTS_URL = 'https://api.kroger.com/v1/products';

interface CachedToken {
  value: string;
  expiresAt: number; // ms epoch
}

let cachedToken: CachedToken | null = null;
const REFRESH_MARGIN_MS = 30_000;

async function getKrogerToken(): Promise<string | null> {
  if (!TOKEN_PROXY_URL) return null; // not configured — degrade to "no Kroger data", same as an unset USDA key
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > now) return cachedToken.value;

  const res = await fetch(TOKEN_PROXY_URL);
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

export interface KrogerMatch {
  matched: boolean;
  hasIngredients: boolean;
  // Spec 021 — spec 020 only needed the boolean for the search confidence
  // gate; the scan-path fallback (M2/M3) needs the actual text and enough
  // identity to synthesize a product when OFF has nothing (M3).
  ingredientStatement?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
}

interface KrogerImageSize {
  size?: string;
  url?: string;
}
interface KrogerImage {
  perspective?: string;
  featured?: boolean;
  sizes?: KrogerImageSize[];
}
interface KrogerProduct {
  description?: string;
  brand?: string;
  images?: KrogerImage[];
  nutritionInformation?: { ingredientStatement?: string }[];
}
interface KrogerProductsResponse {
  data?: KrogerProduct[];
}

// Prefers the front-perspective photo (what a shopper would recognize on
// shelf) at a "large" size — same size class used elsewhere in the app.
function frontImageUrl(product: KrogerProduct): string | undefined {
  const front = product.images?.find(img => img.perspective === 'front') ?? product.images?.[0];
  const sizes = front?.sizes ?? [];
  return (sizes.find(s => s.size === 'large') ?? sizes[0])?.url;
}

async function lookupByProductId(token: string, code: string): Promise<KrogerMatch | null> {
  const url = `${PRODUCTS_URL}?filter.productId=${encodeURIComponent(code)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = (await res.json()) as KrogerProductsResponse;
  const product = data.data?.[0];
  if (!product) return null; // a real "not found" — Kroger returns 200 + empty data, not a 404
  const ingredientStatement = product.nutritionInformation?.[0]?.ingredientStatement;
  return {
    matched: true,
    hasIngredients: !!ingredientStatement?.trim(),
    ingredientStatement,
    description: product.description,
    brand: product.brand,
    imageUrl: frontImageUrl(product),
  };
}

// Same UPC-A/EAN-13 twin-code reality off.ts's fetchProduct already handles
// — Kroger's own catalog stores the zero-padded 13-digit form (confirmed
// against real responses), so a 12-digit scan can miss a record that exists
// under its zero-padded twin.
export async function fetchKrogerMatch(barcode: string): Promise<KrogerMatch | null> {
  const token = await getKrogerToken();
  if (!token) return null;

  const primary = await lookupByProductId(token, barcode);
  if (primary) return primary;

  const alt = alternateCode(barcode);
  if (!alt) return null;
  try {
    return await lookupByProductId(token, alt);
  } catch {
    return null; // the alt lookup failing never turns a real "not found" into an error
  }
}
