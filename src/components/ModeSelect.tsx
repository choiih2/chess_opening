interface Props {
  onSelect: (mode: "study" | "practice" | "review") => void;
}

export default function ModeSelect({ onSelect }: Props) {
  return (
    <div className="mode-select">
      <p className="eyebrow">오프닝 트레이너</p>
      <h1>무엇을 하시겠어요?</h1>

      <div className="mode-cards">
        <button className="mode-card" onClick={() => onSelect("study")}>
          <span className="mode-tag">학습</span>
          <h2>학습 모드</h2>
          <p>
            오프닝을 고르면 어떤 수가 메인라인이고, 거기서 어떤 방향으로
            갈라지는지 실전 통계와 함께 보여줍니다.
          </p>
        </button>

        <button className="mode-card" onClick={() => onSelect("practice")}>
          <span className="mode-tag">연습</span>
          <h2>연습 모드</h2>
          <p>
            고른 오프닝으로 직접 두면서 레퍼토리를 채점받습니다. 상대는 실전
            빈도대로 수를 둡니다.
          </p>
        </button>

        <button className="mode-card" onClick={() => onSelect("review")}>
          <span className="mode-tag">복기</span>
          <h2>내 경기 복기</h2>
          <p>
            Chess.com 아이디로 지난 대국을 불러와 한 수씩 다시 보고, 엔진으로
            실수와 놓친 함정 지점을 찾아봅니다.
          </p>
        </button>
      </div>
    </div>
  );
}
