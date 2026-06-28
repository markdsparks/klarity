import type { OFFProduct, OFFResponse } from '../types/off';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

// Only fetch the fields we actually use — keeps response small
const FIELDS = [
  'product_name', 'brands', 'serving_size', 'serving_quantity',
  'quantity', 'nutriments', 'additives_tags', 'ingredients_text',
  'image_url', 'image_front_url',
].join(',');

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
