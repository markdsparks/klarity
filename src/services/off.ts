import type { OFFProduct, OFFResponse, OFFSearchProduct } from '../types/off';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Only fetch the fields we actually use — keeps response small
const FIELDS = [
  'product_name', 'brands', 'serving_size', 'serving_quantity',
  'quantity', 'nutriments', 'additives_tags', 'ingredients_text',
  'image_url', 'image_front_url',
].join(',');

// OFF dedicated search service — supports full-text query, returns hits sorted by relevance
const SEARCH_BASE = 'https://search.openfoodfacts.org/search';

// Extra fields let us score by US presence and data completeness before returning results
const SEARCH_FIELDS = 'code,product_name,brands,quantity,countries_tags,nutriments';

type SearchHit = {
  code: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
};

function hitScore(h: SearchHit): number {
  let s = 0;
  if (h.countries_tags?.includes('en:united-states')) s += 3;
  if (h.nutriments && Object.keys(h.nutriments).length > 2) s += 2;
  if (h.product_name?.trim()) s += 1;
  return s;
}

export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&page_size=25&fields=${SEARCH_FIELDS}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'Klarity/1.0 (contact@klarity.app)' } });
  } catch {
    throw new Error('NETWORK');
  }
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data: { hits?: SearchHit[] } = await res.json();
  return (data.hits ?? [])
    .filter(h => h.code && h.product_name)
    .sort((a, b) => hitScore(b) - hitScore(a))
    .slice(0, 8)
    .map(h => ({
      code: h.code,
      product_name: h.product_name ?? '',
      brands: Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands ?? ''),
      additives_tags: [],
    } as OFFSearchProduct));
}

export async function fetchProduct(barcode: string): Promise<OFFProduct | null> {
  const url = `${BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // OFF asks that apps identify themselves with a User-Agent
        'User-Agent': 'Klarity/1.0 (contact@klarity.app)',
      },
    });
  } catch {
    throw new Error('NETWORK');
  }
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data: OFFResponse = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}
