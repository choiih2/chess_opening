import { dbGet, dbSet, STORE_APP } from "./db";

/** FEN -> 그 국면에서 내가 두기로 한 수(SAN)들 */
export type Repertoire = Record<string, string[]>;

export interface Weakness {
  fen: string;
  expected: string[]; // 레퍼토리에 등록된 수
  played: string; // 내가 실제로 둔 수
  line: string[]; // 이 국면까지의 수순
  openingName: string;
  misses: number;
  lastSeen: number;
}

const REP_KEY = "repertoire";
const WEAK_KEY = "weaknesses";

export const loadRepertoire = async () =>
  (await dbGet<Repertoire>(STORE_APP, REP_KEY)) ?? {};

export const saveRepertoire = (r: Repertoire) =>
  dbSet(STORE_APP, REP_KEY, r);

export function addToRepertoire(rep: Repertoire, fen: string, san: string) {
  const next = { ...rep };
  const cur = next[fen] ?? [];
  next[fen] = cur.includes(san) ? cur : [...cur, san];
  return next;
}

export function removeFromRepertoire(rep: Repertoire, fen: string, san: string) {
  const next = { ...rep };
  const cur = (next[fen] ?? []).filter((m) => m !== san);
  if (cur.length) next[fen] = cur;
  else delete next[fen];
  return next;
}

/** 오프닝 수순 전체를 한 번에 레퍼토리로 등록한다. side 차례의 수만 담는다. */
export function ingestLine(
  rep: Repertoire,
  fens: string[], // fens[i] = moves[i] 를 두기 직전의 국면
  moves: string[],
  side: "w" | "b"
) {
  let next = rep;
  moves.forEach((san, i) => {
    const isWhiteMove = i % 2 === 0;
    if ((side === "w") === isWhiteMove) next = addToRepertoire(next, fens[i], san);
  });
  return next;
}

export const loadWeaknesses = async () =>
  (await dbGet<Weakness[]>(STORE_APP, WEAK_KEY)) ?? [];

export async function recordWeakness(w: Omit<Weakness, "misses" | "lastSeen">) {
  const list = await loadWeaknesses();
  const found = list.find((x) => x.fen === w.fen);
  if (found) {
    found.misses += 1;
    found.lastSeen = Date.now();
    found.played = w.played;
  } else {
    list.push({ ...w, misses: 1, lastSeen: Date.now() });
  }
  list.sort((a, b) => b.misses - a.misses || b.lastSeen - a.lastSeen);
  await dbSet(STORE_APP, WEAK_KEY, list);
  return list;
}

export const clearWeaknesses = () => dbSet(STORE_APP, WEAK_KEY, []);
