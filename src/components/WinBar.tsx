interface Props {
  white: number;
  draws: number;
  black: number;
  showLabels?: boolean;
}

export default function WinBar({ white, draws, black, showLabels }: Props) {
  const t = white + draws + black;
  if (!t) return <div className="winbar winbar-empty" />;
  const pc = (n: number) => (n / t) * 100;

  return (
    <div className="winbar-wrap">
      <div
        className="winbar"
        role="img"
        aria-label={`백 승 ${pc(white).toFixed(0)}퍼센트, 무 ${pc(
          draws
        ).toFixed(0)}퍼센트, 흑 승 ${pc(black).toFixed(0)}퍼센트`}
      >
        <span className="seg seg-white" style={{ width: `${pc(white)}%` }} />
        <span className="seg seg-draw" style={{ width: `${pc(draws)}%` }} />
        <span className="seg seg-black" style={{ width: `${pc(black)}%` }} />
      </div>
      {showLabels && (
        <div className="winbar-labels">
          <span>백 {pc(white).toFixed(0)}%</span>
          <span>무 {pc(draws).toFixed(0)}%</span>
          <span>흑 {pc(black).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
