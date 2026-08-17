import { dbGet, dbSet, STORE_EXPLORER } from "./db";

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string } | null;
}

export const total = (m: {
  white: number;
  draws: number;
  black: number;
}) => m.white + m.draws + m.black;

/** 해당 수를 둔 쪽 기준 승률(%). 무승부는 0.5로 계산한다. */
export function scoreFor(
  m: { white: number; draws: number; black: number },
  side: "w" | "b"
) {
  const t = total(m);
  if (!t) return 0;
  const win = side === "w" ? m.white : m.black;
  return ((win + m.draws / 2) / t) * 100;
}

export interface ExplorerOptions {
  ratings: number[]; // 1000,1200,1400,1600,1800,2000,2200,2500
  speeds: string[]; // bullet,blitz,rapid,classical
}

export const DEFAULT_OPTIONS: ExplorerOptions = {
  ratings: [1600, 1800, 2000],
  speeds: ["blitz", "rapid"],
};

const cacheKey = (fen: string, o: ExplorerOptions) =>
  `${fen}|${o.ratings.join(",")}|${o.speeds.join(",")}`;

// 요청을 하나씩만 보낸다. Explorer 는 병렬 호출에 429 를 준다.
let chain: Promise<unknown> = Promise.resolve();
const GAP_MS = 300;

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const r = await job();
    await new Promise((res) => setTimeout(res, GAP_MS));
    return r;
  });
  chain = run.catch(() => {});
  return run as Promise<T>;
}

export async function fetchExplorer(
  fen: string,
  opts: ExplorerOptions = DEFAULT_OPTIONS
): Promise<ExplorerResult> {
  const key = cacheKey(fen, opts);
  const cached = await dbGet<ExplorerResult>(STORE_EXPLORER, key);
  if (cached) return cached;

  return enqueue(async () => {
    // 큐에서 대기하는 동안 다른 호출이 채웠을 수 있다.
    const again = await dbGet<ExplorerResult>(STORE_EXPLORER, key);
    if (again) return again;

    const url = new URL("/api/explorer/lichess", location.origin);
    url.searchParams.set("variant", "standard");
    url.searchParams.set("fen", fen);
    url.searchParams.set("ratings", opts.ratings.join(","));
    url.searchParams.set("speeds", opts.speeds.join(","));
    url.searchParams.set("topGames", "0");
    url.searchParams.set("recentGames", "0");
    url.searchParams.set("moves", "20");

    const res = await fetch(url.toString());
    if (res.status === 401) {
      throw new Error(
        "Lichess 오프닝 통계는 이제 인증이 필요합니다. .env 파일에 LICHESS_TOKEN 을 넣고 서버를 다시 시작하세요."
      );
    }
    if (res.status === 429)
      throw new Error("요청이 많습니다. 잠시 후 다시 시도하세요.");
    if (!res.ok)
      throw new Error(`오프닝 통계를 불러오지 못했습니다 (${res.status})`);

    const raw = await res.json();
    const data: ExplorerResult = {
      white: raw.white ?? 0,
      draws: raw.draws ?? 0,
      black: raw.black ?? 0,
      opening: raw.opening ?? null,
      moves: (raw.moves ?? []).map((m: ExplorerMove) => ({
        uci: m.uci,
        san: m.san,
        white: m.white,
        draws: m.draws,
        black: m.black,
        averageRating: m.averageRating,
      })),
    };
    await dbSet(STORE_EXPLORER, key, data);
    return data;
  });
}
