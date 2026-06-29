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

type SearchHit = {
  code: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
};

export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&page_size=20`;
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
