// 실전 한 판을 처음부터 순서대로 엔진에 돌려 수마다 판정을 매긴다.
import { EngineLine, analyze, comparableScore, findBrilliantMove } from "./engine";

export interface ReviewInputMove {
  san: string;
  lan: string; // uci 형태, 예: "e2e4"
  before: string; // 이 수를 두기 직전 FEN
  after: string; // 이 수를 둔 직후 FEN
  color: "w" | "b";
}

export type MoveTag = "blunder" | "mistake" | "inaccuracy" | "fine";

export const TAG_LABEL: Record<MoveTag, string> = {
  blunder: "블런더",
  mistake: "실수",
  inaccuracy: "부정확",
  fine: "정확",
};

const THRESHOLDS = { blunder: 300, mistake: 150, inaccuracy: 70 };

export function classify(lossCp: number): MoveTag {
  if (lossCp >= THRESHOLDS.blunder) return "blunder";
  if (lossCp >= THRESHOLDS.mistake) return "mistake";
  if (lossCp >= THRESHOLDS.inaccuracy) return "inaccuracy";
  return "fine";
}

export interface PlyReview {
  ply: number; // 1부터
  san: string;
  color: "w" | "b";
  lossCp: number;
  tag: MoveTag;
  /** 이 수를 두기 직전 국면에 뚜렷이 더 좋은 수가 따로 있었는데 놓쳤다면. */
  trap: { uci: string; gapCp: number } | null;
  bestUci: string;
  /** 둔 수 자체가 다른 후보보다 확실히 튀는 "탁월한 수" 였다면. */
  brilliant: boolean;
}

export interface MoveClassification {
  tag: MoveTag;
  lossCp: number;
  brilliant: boolean;
  bestUci: string;
}

/**
 * 한 수만 따로 채점한다 (실시간 연습/학습 화면용). reviewGame 처럼 앞뒤 수를
 * 이어 붙여 분석을 재사용하지 못하니, 직전/직후 국면을 매번 새로 분석한다.
 */
export async function classifyMove(
  beforeFen: string,
  afterFen: string,
  playedUci: string,
  movetimeMs = DEFAULT_MOVETIME_MS
): Promise<MoveClassification> {
  const [before, after] = await Promise.all([
    analyze(beforeFen, { multiPv: 2, movetimeMs }),
    analyze(afterFen, { multiPv: 2, movetimeMs }),
  ]);
  if (!before.length || !after.length) {
    return { tag: "fine", lossCp: 0, brilliant: false, bestUci: playedUci };
  }
  const lossCp = Math.max(
    0,
    Math.round(comparableScore(before[0]) + comparableScore(after[0]))
  );
  const brilliant = findBrilliantMove(before);
  return {
    tag: classify(lossCp),
    lossCp,
    brilliant: brilliant?.line.uci === playedUci,
    bestUci: before[0].uci,
  };
}

export interface ReviewProgress {
  done: number;
  total: number;
}

export const DEFAULT_MAX_PLIES = 60; // 30수. 오프닝~초반 미들게임 범위.
export const DEFAULT_MOVETIME_MS = 500;

export async function reviewGame(
  moves: ReviewInputMove[],
  opts: { maxPlies?: number; movetimeMs?: number } = {},
  onProgress?: (p: ReviewProgress) => void
): Promise<PlyReview[]> {
  const maxPlies = Math.min(moves.length, opts.maxPlies ?? DEFAULT_MAX_PLIES);
  const movetimeMs = opts.movetimeMs ?? DEFAULT_MOVETIME_MS;
  if (maxPlies === 0) return [];

  // 수마다 "직전" 국면을 분석한다. 마지막 수가 얼마나 좋았는지 재려면
  // 그 수를 둔 직후 국면의 평가도 있어야 하므로 하나 더 붙인다.
  const positions = moves.slice(0, maxPlies).map((m) => m.before);
  positions.push(moves[maxPlies - 1].after);

  const lines: EngineLine[][] = [];
  for (let i = 0; i < positions.length; i++) {
    lines.push(await analyze(positions[i], { multiPv: 2, movetimeMs }));
    onProgress?.({ done: i + 1, total: positions.length });
  }

  const reviews: PlyReview[] = [];
  for (let i = 0; i < maxPlies; i++) {
    const before = lines[i];
    const after = lines[i + 1];
    if (!before.length || !after.length) continue; // 이 국면 분석 실패(드묾)는 건너뛴다

    // 관점이 매 수 뒤집히므로 두 최선 평가를 그냥 더하면 손해(centipawn loss)가 나온다.
    const lossCp = Math.max(
      0,
      Math.round(comparableScore(before[0]) + comparableScore(after[0]))
    );

    const brilliant = findBrilliantMove(before);
    const trap =
      brilliant && brilliant.line.uci !== moves[i].lan
        ? { uci: brilliant.line.uci, gapCp: brilliant.gapCp }
        : null;

    reviews.push({
      ply: i + 1,
      san: moves[i].san,
      color: moves[i].color,
      lossCp,
      tag: classify(lossCp),
      trap,
      bestUci: before[0].uci,
      brilliant: brilliant?.line.uci === moves[i].lan,
    });
  }

  return reviews;
}
