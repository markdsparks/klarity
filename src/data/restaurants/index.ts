import type { CatalogComponent, MenuItem, RestaurantChain } from '../../types/restaurant';
import { CHICK_FIL_A, CHICK_FIL_A_ITEMS } from './chick-fil-a';
import { CHICK_FIL_A_CATALOG } from './chick-fil-a-catalog';

export const CHAINS: RestaurantChain[] = [CHICK_FIL_A];

export const MENU_ITEMS: MenuItem[] = [...CHICK_FIL_A_ITEMS];

export const CATALOG: CatalogComponent[] = [...CHICK_FIL_A_CATALOG];

export function getChain(id: string): RestaurantChain | undefined {
  return CHAINS.find(c => c.id === id);
}

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}

export function getCatalogComponent(id: string): CatalogComponent | undefined {
  return CATALOG.find(c => c.id === id);
}
