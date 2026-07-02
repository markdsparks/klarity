import type { CatalogComponent, MenuItem, RestaurantChain } from '../../types/restaurant';
import { CHICK_FIL_A, CHICK_FIL_A_ITEMS } from './chick-fil-a';
import { CHICK_FIL_A_CATALOG } from './chick-fil-a-catalog';
import { DAIRY_QUEEN, DAIRY_QUEEN_ITEMS } from './dairy-queen';
import { DAIRY_QUEEN_CATALOG } from './dairy-queen-catalog';

export const CHAINS: RestaurantChain[] = [CHICK_FIL_A, DAIRY_QUEEN];

export const MENU_ITEMS: MenuItem[] = [...CHICK_FIL_A_ITEMS, ...DAIRY_QUEEN_ITEMS];

export const CATALOG: CatalogComponent[] = [...CHICK_FIL_A_CATALOG, ...DAIRY_QUEEN_CATALOG];

export function getChain(id: string): RestaurantChain | undefined {
  return CHAINS.find(c => c.id === id);
}

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}

export function getCatalogComponent(id: string): CatalogComponent | undefined {
  return CATALOG.find(c => c.id === id);
}
