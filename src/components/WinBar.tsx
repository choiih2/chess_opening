interface Props {
  white: number;
  draws: number;
  black: number;
  showLabels?: boolean;
  /** 세로로 길게 (체스판 옆에 붙이는 용도). 기본은 가로. */
  vertical?: boolean;
}

export default function WinBar({ white, draws, black, showLabels, vertical }: Props) {
  const t = white + draws + black;
  const pc = (n: number) => (t ? (n / t) * 100 : 0);
  const dim = vertical ? "height" : "width";

  return (
    <div className={`winbar-wrap${vertical ? " is-vertical" : ""}`}>
      <div
        className={`winbar${vertical ? " is-vertical" : ""}${t ? "" : " winbar-empty"}`}
        role="img"
        aria-label={
          t
            ? `백 승 ${pc(white).toFixed(0)}퍼센트, 무 ${pc(draws).toFixed(
                0
              )}퍼센트, 흑 승 ${pc(black).toFixed(0)}퍼센트`
            : "실전 표본 없음"
        }
      >
        <span className="seg seg-white" style={{ [dim]: `${pc(white)}%` }} />
        <span className="seg seg-draw" style={{ [dim]: `${pc(draws)}%` }} />
        <span className="seg seg-black" style={{ [dim]: `${pc(black)}%` }} />
      </div>
      {showLabels && (
        <div className={`winbar-labels${vertical ? " is-vertical" : ""}`}>
          <span>백 {pc(white).toFixed(0)}%</span>
          <span>무 {pc(draws).toFixed(0)}%</span>
          <span>흑 {pc(black).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
