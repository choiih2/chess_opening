// uci 표기("e2e4") 와 보드 좌표/SAN 을 오가는 작은 헬퍼.
// 엔진(engine.ts)과 Explorer(explorer.ts) 모두 수를 uci 로 주므로,
// 화살표를 그리거나 사람이 읽을 SAN 이 필요한 화면에서 공통으로 쓴다.
import { Chess, type Square } from "chess.js";

export function arrowSquares(uci: string): [Square, Square] {
  return [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square];
}

/** 주어진 국면에서 uci 수를 사람이 읽을 SAN 으로 바꾼다. */
export function sanForUci(fen: string, uci: string): string {
  try {
    const g = new Chess(fen);
    const mv = g.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4) : undefined,
    });
    return mv?.san ?? uci;
  } catch {
    return uci;
  }
}
