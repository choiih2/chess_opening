// 체스판 위 특정 칸에 ??(블런더) / !!(탁월한 수) 표시를 겹쳐 그린다.
// react-chessboard 내부 렌더링을 건드리지 않고, .board-frame 위에 절대 위치로 얹는다.
import type { Square } from "chess.js";

export interface SquareBadge {
  square: Square;
  text: "??" | "!!";
}

interface Props {
  badges: SquareBadge[];
  boardWidth: number;
  orientation: "white" | "black";
}

const FILES = "abcdefgh";

function squareTopRight(
  square: Square,
  boardWidth: number,
  orientation: "white" | "black"
) {
  const size = boardWidth / 8;
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { left: col * size + size, top: row * size };
}

export default function BoardBadges({ badges, boardWidth, orientation }: Props) {
  if (!boardWidth || badges.length === 0) return null;
  return (
    <>
      {badges.map((b) => {
        const { left, top } = squareTopRight(b.square, boardWidth, orientation);
        return (
          <span
            key={`${b.square}-${b.text}`}
            className={`board-badge ${b.text === "??" ? "is-blunder" : "is-brilliant"}`}
            style={{ left, top }}
          >
            {b.text}
          </span>
        );
      })}
    </>
  );
}
