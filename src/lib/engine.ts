// Stockfish 18 (lite/single-thread) 을 Web Worker 로 돌리는 얇은 래퍼.
// public/stockfish/ 에 정적 파일로 있어야 한다 (scripts/copy-engine.mjs 가 채워 넣음).
import { dbGet, dbSet, STORE_ENGINE } from "./db";

const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

export interface EngineLine {
  multipv: number;
  depth: number;
  cp?: number; // 센티폰. 없으면 mate 가 있다.
  mate?: number; // 이 값의 부호를 가진 쪽이 n 수 안에 메이트.
  uci: string; // 이 라인의 첫 수, 예: "e2e4"
  pv: string[]; // 전체 변화 (uci)
}

let worker: Worker | null = null;
let handshake: Promise<void> | null = null;

function getWorker(): Worker {
  if (!worker) worker = new Worker(ENGINE_URL);
  return worker;
}

/** uci/isready 핸드셰이크. 워커를 미리 띄워 두면 첫 힌트 요청이 덜 기다린다. */
export function initEngine(): Promise<void> {
  if (handshake) return handshake;
  const w = getWorker();
  handshake = new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent<string>) => {
      if (e.data === "uciok") {
        w.postMessage("isready");
      } else if (e.data === "readyok") {
        w.removeEventListener("message", onMsg);
        resolve();
      }
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", (e) => reject(e.error ?? new Error("엔진을 불러오지 못했습니다")), {
      once: true,
    });
    w.postMessage("uci");
  });
  return handshake;
}

// 분석은 한 번에 하나씩만 보낸다. 겹쳐 들어오면 진행 중인 탐색을 멈추고 이어간다.
let chain: Promise<unknown> = Promise.resolve();

export interface AnalyzeOptions {
  multiPv?: number;
  movetimeMs?: number;
}

export function analyze(
  fen: string,
  { multiPv = 3, movetimeMs = 1200 }: AnalyzeOptions = {}
): Promise<EngineLine[]> {
  const key = `${fen}|mpv${multiPv}|mt${movetimeMs}`;
  const run = chain.then(async () => {
    const cached = await dbGet<EngineLine[]>(STORE_ENGINE, key);
    if (cached) return cached;
    const result = await runSearch(fen, multiPv, movetimeMs);
    await dbSet(STORE_ENGINE, key, result);
    return result;
  });
  chain = run.catch(() => {});
  return run;
}

function runSearch(
  fen: string,
  multiPv: number,
  movetimeMs: number
): Promise<EngineLine[]> {
  return initEngine().then(
    () =>
      new Promise<EngineLine[]>((resolve) => {
        const w = getWorker();
        const lines = new Map<number, EngineLine>();

        function onMsg(e: MessageEvent<string>) {
          const text = e.data;
          if (typeof text !== "string") return;

          if (text.startsWith("info") && text.includes(" pv ")) {
            const mv = /\bmultipv (\d+)/.exec(text);
            const d = /\bdepth (\d+)/.exec(text);
            const cp = /\bscore cp (-?\d+)/.exec(text);
            const mate = /\bscore mate (-?\d+)/.exec(text);
            const pv = /\bpv (.+)$/.exec(text);
            if (mv && d && pv) {
              const idx = Number(mv[1]);
              const moves = pv[1].trim().split(/\s+/);
              lines.set(idx, {
                multipv: idx,
                depth: Number(d[1]),
                cp: cp ? Number(cp[1]) : undefined,
                mate: mate ? Number(mate[1]) : undefined,
                uci: moves[0],
                pv: moves,
              });
            }
          } else if (text.startsWith("bestmove")) {
            w.removeEventListener("message", onMsg);
            resolve([...lines.values()].sort((a, b) => a.multipv - b.multipv));
          }
        }

        w.addEventListener("message", onMsg);
        w.postMessage(`setoption name MultiPV value ${multiPv}`);
        w.postMessage(`position fen ${fen}`);
        w.postMessage(`go movetime ${movetimeMs}`);
      })
  );
}

/** mate 를 포함해 한 스케일로 비교할 수 있는 점수. 클수록 좋다 (탐색 시점의 차례 기준). */
export function comparableScore(l: EngineLine): number {
  if (l.mate !== undefined) return l.mate > 0 ? 100_000 - l.mate : -100_000 - l.mate;
  return l.cp ?? 0;
}

const BRILLIANT_GAP_CP = 150; // 1.5폰 이상 차이 나야 "탁월한 수"로 본다.

/**
 * 후보 중 확실히 튀는 수가 있으면 돌려준다. 정식 "brilliant" 판정(희생 여부 등)은
 * 아니고, 다른 대안보다 평가치 차이가 크게 나는 수를 근사치로 잡는 것이다.
 */
export function findBrilliantMove(
  lines: EngineLine[]
): { line: EngineLine; gapCp: number } | null {
  if (lines.length < 2) return null;
  const sorted = [...lines].sort(
    (a, b) => comparableScore(b) - comparableScore(a)
  );
  const gapCp = comparableScore(sorted[0]) - comparableScore(sorted[1]);
  if (gapCp >= BRILLIANT_GAP_CP) return { line: sorted[0], gapCp };
  return null;
}
