// Chess.com 공개 API (인증 불필요). /api/chesscom 프록시(vite.config.ts)를 거쳐 부른다.
import { dbGet, dbSet, STORE_APP, STORE_GAMES } from "./db";

const USERNAME_KEY = "chesscomUsername";

export const loadChesscomUsername = () => dbGet<string>(STORE_APP, USERNAME_KEY);
export const saveChesscomUsername = (name: string) =>
  dbSet(STORE_APP, USERNAME_KEY, name.trim());

export interface ChesscomPlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChesscomGame {
  url: string;
  pgn: string;
  end_time: number; // unix seconds
  time_class: string; // bullet | blitz | rapid | daily
  rules: string; // chess | chess960 | ...
  white: ChesscomPlayer;
  black: ChesscomPlayer;
}

export interface ArchiveMonth {
  year: number;
  month: number; // 1~12
  url: string;
}

interface ArchivesResponse {
  archives: string[];
}

interface GamesResponse {
  games: ChesscomGame[];
}

async function getJson<T>(url: string): Promise<T> {
  // 브라우저 HTTP 캐시를 끈다. 이번 달 대국 목록처럼 계속 바뀌는 응답을 앱 쪽
  // IndexedDB 캐시 로직과 무관하게 브라우저가 조용히 옛 응답으로 되돌려 주는 걸 막는다.
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) {
    throw new Error("이 아이디를 찾을 수 없습니다. 철자를 확인하세요.");
  }
  if (!res.ok) {
    throw new Error(`Chess.com 요청에 실패했습니다 (${res.status})`);
  }
  return res.json();
}

function parseArchiveUrl(url: string): ArchiveMonth {
  const m = /\/(\d{4})\/(\d{2})$/.exec(url);
  if (!m) throw new Error(`아카이브 URL 형식을 알 수 없습니다: ${url}`);
  return { year: Number(m[1]), month: Number(m[2]), url };
}

/** 아카이브가 있는 달 목록. 최신 달이 앞에 오도록 뒤집는다. */
export async function fetchArchiveMonths(username: string): Promise<ArchiveMonth[]> {
  const data = await getJson<ArchivesResponse>(
    `/api/chesscom/pub/player/${encodeURIComponent(username)}/games/archives`
  );
  return data.archives.map(parseArchiveUrl).reverse();
}

function isCurrentMonth(year: number, month: number) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

const monthCacheKey = (username: string, year: number, month: number) =>
  `${username.toLowerCase()}|${year}-${String(month).padStart(2, "0")}`;

/**
 * 한 달치 대국 목록 (최신 대국이 앞). 지난 달은 더 이상 안 바뀌므로 캐싱하고,
 * 이번 달은 계속 대국이 쌓이므로 매번 새로 받는다.
 */
export async function fetchMonthGames(
  username: string,
  year: number,
  month: number
): Promise<ChesscomGame[]> {
  const key = monthCacheKey(username, year, month);
  const cacheable = !isCurrentMonth(year, month);

  if (cacheable) {
    const cached = await dbGet<ChesscomGame[]>(STORE_GAMES, key);
    if (cached) return cached;
  }

  const mm = String(month).padStart(2, "0");
  const data = await getJson<GamesResponse>(
    `/api/chesscom/pub/player/${encodeURIComponent(username)}/games/${year}/${mm}`
  );
  const games = [...data.games].sort((a, b) => b.end_time - a.end_time);

  if (cacheable) await dbSet(STORE_GAMES, key, games);
  return games;
}

export const RECENT_LIMIT = 20;

/** 최신 달부터 훑으며 최근 대국을 RECENT_LIMIT 개 모을 때까지 이어서 불러온다. */
export async function loadRecentGames(user: string): Promise<ChesscomGame[]> {
  const monthList = await fetchArchiveMonths(user); // 최신 달이 앞
  const collected: ChesscomGame[] = [];
  for (const m of monthList) {
    if (collected.length >= RECENT_LIMIT) break;
    const monthGames = (await fetchMonthGames(user, m.year, m.month)).filter(
      (g) => g.rules === "chess"
    );
    collected.push(...monthGames);
  }
  return collected.sort((a, b) => b.end_time - a.end_time).slice(0, RECENT_LIMIT);
}

export function myColor(game: ChesscomGame, username: string): "w" | "b" | null {
  const u = username.toLowerCase();
  if (game.white.username.toLowerCase() === u) return "w";
  if (game.black.username.toLowerCase() === u) return "b";
  return null;
}

const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

/** 저장된 아이디 기준 승/무/패. 그 아이디가 이 대국에 없으면 null. */
export function myResult(game: ChesscomGame, username: string): "승" | "패" | "무" | null {
  const side = myColor(game, username);
  if (!side) return null;
  const raw = (side === "w" ? game.white : game.black).result;
  if (raw === "win") return "승";
  if (DRAW_RESULTS.has(raw)) return "무";
  return "패";
}

const TIME_CLASS_LABEL: Record<string, string> = {
  bullet: "불릿",
  blitz: "블리츠",
  rapid: "래피드",
  daily: "일일",
};

export const timeClassLabel = (t: string) => TIME_CLASS_LABEL[t] ?? t;
