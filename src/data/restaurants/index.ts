import type { CatalogComponent, MenuItem, RestaurantChain } from '../../types/restaurant';
import { CHICK_FIL_A, CHICK_FIL_A_ITEMS } from './chick-fil-a';
import { CHICK_FIL_A_CATALOG } from './chick-fil-a-catalog';
import { CULVERS, CULVERS_ITEMS } from './culvers';
import { DAIRY_QUEEN, DAIRY_QUEEN_ITEMS } from './dairy-queen';
import { DAIRY_QUEEN_CATALOG } from './dairy-queen-catalog';
import { PANERA, PANERA_ITEMS } from './panera';
import { JIMMY_JOHNS, JIMMY_JOHNS_ITEMS } from './jimmy-johns';
import { JIMMY_JOHNS_CATALOG } from './jimmy-johns-catalog';
import { SUBWAY, SUBWAY_ITEMS } from './subway';
import { SUBWAY_CATALOG } from './subway-catalog';
import { PANDA_EXPRESS, PANDA_EXPRESS_ITEMS } from './panda-express';

export const CHAINS: RestaurantChain[] = [
  CHICK_FIL_A, CULVERS, DAIRY_QUEEN, PANERA, JIMMY_JOHNS, SUBWAY, PANDA_EXPRESS,
];

export const MENU_ITEMS: MenuItem[] = [
  ...CHICK_FIL_A_ITEMS, ...CULVERS_ITEMS, ...DAIRY_QUEEN_ITEMS, ...PANERA_ITEMS,
  ...JIMMY_JOHNS_ITEMS, ...SUBWAY_ITEMS, ...PANDA_EXPRESS_ITEMS,
];

export const CATALOG: CatalogComponent[] = [
  ...CHICK_FIL_A_CATALOG, ...DAIRY_QUEEN_CATALOG, ...JIMMY_JOHNS_CATALOG, ...SUBWAY_CATALOG,
];

export function getChain(id: string): RestaurantChain | undefined {
  return CHAINS.find(c => c.id === id);
}

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}

export function getCatalogComponent(id: string): CatalogComponent | undefined {
  return CATALOG.find(c => c.id === id);
}
