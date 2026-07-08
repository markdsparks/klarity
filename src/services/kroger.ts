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

  // A proxy hiccup (network, DNS, bad response) means "no corroboration
  // right now", never an error — same contract as usda.ts's fetchJson.
  try {
    const res = await fetch(TOKEN_PROXY_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

// Real bug this fixes (found on Mark's device, 2026-07-06 — scanning was
// erroring on every US product): Kroger's productId is NOT the GTIN. It is
// the GTIN with its check digit REMOVED, left-padded with zeros to exactly
// 13 digits — verified empirically against Kroger's own term-search results
// (their upc for plain Cheerios 8.9oz is 0001600027526; the real scanned
// GTIN is 016000275263 — drop the trailing 3, pad to 13, identical).
// Sending a real 13-digit GTIN returns 200-with-empty (so corroboration
// silently never matched), and sending a 12-digit UPC-A returns HTTP 400
// (which threw, and the scan screen's Promise.all turned that into an error
// screen for the whole scan). A nice side effect: a UPC-A and its
// zero-padded EAN-13 twin normalize to the SAME Kroger id, so the twin-code
// double-lookup the GTIN forms needed is unnecessary here.
export function krogerProductId(barcode: string): string | null {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const significant = barcode.replace(/^0+/, '');
  if (significant.length < 2) return null;
  const sansCheckDigit = significant.slice(0, -1);
  if (sansCheckDigit.length > 13) return null;
  return sansCheckDigit.padStart(13, '0');
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

export async function fetchKrogerMatch(barcode: string): Promise<KrogerMatch | null> {
  const productId = krogerProductId(barcode);
  if (!productId) return null; // a code Kroger's format can't represent — skip the call entirely

  const token = await getKrogerToken();
  if (!token) return null;

  const url = `${PRODUCTS_URL}?filter.productId=${encodeURIComponent(productId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  // 400 is Kroger answering "this identifier cannot exist in my catalog" —
  // a definitive not-found, not a transient failure. 401/5xx stay thrown:
  // search's allSettled degrades that one candidate, and the scan path
  // catches at the call site (corroboration must never break a scan).
  if (res.status === 400) return null;
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
