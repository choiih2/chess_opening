import { ExplorerMove, ExplorerResult, scoreFor, total } from "./explorer";

export type Difficulty = "frequency" | "mainline" | "trappy" | "random" | "blunders";

export const DIFFICULTY_LABELS: Record<
  Difficulty,
  { name: string; hint: string }
> = {
  frequency: {
    name: "실전 빈도",
    hint: "실제로 자주 나오는 순서대로 둡니다. 기본값입니다.",
  },
  mainline: {
    name: "메인라인",
    hint: "항상 최빈수만 둡니다. 정석 수순을 굳힐 때 쓰세요.",
  },
  trappy: {
    name: "함정 대비",
    hint: "드물지만 상대 승률이 높은 수를 우선합니다.",
  },
  random: {
    name: "완전 랜덤",
    hint: "상위 5수 중 균등하게 고릅니다. 변칙 대응 훈련용입니다.",
  },
  blunders: {
    name: "실수 유도",
    hint: "상대가 두면 자주 지는 수를 오히려 즐겨 둡니다. 응징하는 공격을 연습하세요.",
  },
};

/** 이 국면의 표본이 너무 작으면 정석 범위를 벗어난 것으로 본다. */
export const MIN_GAMES = 50;

export function isOutOfBook(result: ExplorerResult) {
  return total(result) < MIN_GAMES;
}

function weightsFor(
  moves: ExplorerMove[],
  mode: Difficulty,
  side: "w" | "b"
): number[] {
  switch (mode) {
    case "mainline":
      return moves.map((_, i) => (i === 0 ? 1 : 0));

    case "random": {
      return moves.map((_, i) => (i < 5 ? 1 : 0));
    }

    case "trappy": {
      // 상대 입장 승률을 강조하되, 표본이 지나치게 작은 수는 제외한다.
      return moves.map((m) => {
        const t = total(m);
        if (t < 20) return 0;
        const s = scoreFor(m, side) / 100;
        return Math.sqrt(t) * Math.pow(s, 4);
      });
    }

    case "blunders": {
      // trappy 의 반대: 상대 입장 승률이 낮은(=내가 응징하기 좋은) 수를 우선한다.
      return moves.map((m) => {
        const t = total(m);
        if (t < 20) return 0;
        const s = scoreFor(m, side) / 100;
        return Math.sqrt(t) * Math.pow(1 - s, 4);
      });
    }

    case "frequency":
    default:
      return moves.map((m) => total(m));
  }
}

export interface PickedMove {
  move: ExplorerMove;
  probability: number; // 이 모드에서 뽑힐 확률 (0~1)
  shareOfPlay: number; // 실전에서 이 수가 나올 비율 (0~1)
}

export function pickOpponentMove(
  result: ExplorerResult,
  mode: Difficulty,
  side: "w" | "b",
  rng: () => number = Math.random
): PickedMove | null {
  const moves = result.moves.filter((m) => total(m) > 0);
  if (!moves.length) return null;

  let w = weightsFor(moves, mode, side);
  let sum = w.reduce((a, b) => a + b, 0);

  // 모드 조건에 맞는 수가 하나도 없으면 실전 빈도로 되돌린다.
  if (sum <= 0) {
    w = weightsFor(moves, "frequency", side);
    sum = w.reduce((a, b) => a + b, 0);
    if (sum <= 0) return null;
  }

  const playTotal = moves.reduce((a, m) => a + total(m), 0);
  let r = rng() * sum;
  for (let i = 0; i < moves.length; i++) {
    r -= w[i];
    if (r <= 0) {
      return {
        move: moves[i],
        probability: w[i] / sum,
        shareOfPlay: total(moves[i]) / playTotal,
      };
    }
  }
  const last = moves.length - 1;
  return {
    move: moves[last],
    probability: w[last] / sum,
    shareOfPlay: total(moves[last]) / playTotal,
  };
}
