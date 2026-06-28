import type { OFFProduct, OFFResponse, OFFSearchProduct, OFFSearchResponse } from '../types/off';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Only fetch the fields we actually use — keeps response small
const FIELDS = [
  'product_name', 'brands', 'serving_size', 'serving_quantity',
  'quantity', 'nutriments', 'additives_tags', 'ingredients_text',
  'image_url', 'image_front_url',
].join(',');

const SEARCH_FIELDS = ['product_name', 'brands', 'code', 'additives_tags', 'serving_size'].join(',');

export async function searchProducts(query: string): Promise<OFFSearchProduct[]> {
  const url = `https://world.openfoodfacts.org/api/v2/search?q=${encodeURIComponent(query)}&fields=${SEARCH_FIELDS}&page_size=20&sort_by=unique_scans_n`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'Klarity/1.0 (contact@klarity.app)' } });
  } catch {
    throw new Error('NETWORK');
  }
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data: OFFSearchResponse = await res.json();
  return (data.products ?? []).filter(p => p.code && p.product_name);
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
