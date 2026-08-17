import { dbGet, dbSet, STORE_APP } from "./db";

const KEY = "favoriteOpenings";

export const loadFavorites = async (): Promise<Set<string>> =>
  new Set((await dbGet<string[]>(STORE_APP, KEY)) ?? []);

export const saveFavorites = (favs: Set<string>) => dbSet(STORE_APP, KEY, [...favs]);

export function toggleFavorite(favs: Set<string>, id: string): Set<string> {
  const next = new Set(favs);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
