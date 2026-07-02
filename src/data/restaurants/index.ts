import type { MenuItem, RestaurantChain } from '../../types/restaurant';
import { CHICK_FIL_A, CHICK_FIL_A_ITEMS } from './chick-fil-a';

export const CHAINS: RestaurantChain[] = [CHICK_FIL_A];

export const MENU_ITEMS: MenuItem[] = [...CHICK_FIL_A_ITEMS];

export function getChain(id: string): RestaurantChain | undefined {
  return CHAINS.find(c => c.id === id);
}

export function getMenuItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}
