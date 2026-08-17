import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { OpeningNode } from "../lib/openingTree";
import { useBoardWidth } from "../lib/useBoardWidth";
import { toKorean } from "../lib/i18n";
import { ExplorerOptions, fetchExplorer } from "../lib/explorer";
import {
  Difficulty,
  DIFFICULTY_LABELS,
  Hints,
  analyzeHints,
  isOutOfBook,
  pickOpponentMove,
} from "../lib/practice";
import {
  Repertoire,
  addToRepertoire,
  recordWeakness,
  saveRepertoire,
} from "../lib/repertoire";

// 화살표 색. CSS 변수는 SVG 속성에서 안 먹을 수 있어 값을 직접 쓴다.
const C_ANSWER = "#e6e0d0"; // 오답 뒤 알려주는 내 레퍼토리 수
const C_MAIN = "#c08a3e"; // 메인라인
const C_STANDOUT = "#7f9a6a"; // 탁월 수

type Arrow = [Square, Square, string];

interface Miss {
  fen: string;
  played: string;
  expected: string[];
}

interface Props {
  opening: OpeningNode;
  side: "w" | "b";
  repertoire: Repertoire;
  setRepertoire: (r: Repertoire) => void;
  explorerOptions: ExplorerOptions;
  onExit: () => void;
}

type Status =
  | { kind: "playing" }
  | { kind: "thinking" }
  | { kind: "ended"; reason: string };

export default function PracticeMode({
  opening,
  side,
  repertoire,
  setRepertoire,
  explorerOptions,
  onExit,
}: Props) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("frequency");
  const [status, setStatus] = useState<Status>({ kind: "playing" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answerArrows, setAnswerArrows] = useState<Arrow[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [unknownFen, setUnknownFen] = useState<{
    fen: string;
    san: string;
  } | null>(null);

  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<Hints | null>(null);
  // 휴대폰에서는 드래그가 불안정해서 "탭 -> 탭" 으로도 둘 수 있게 한다.
  const [picked, setPicked] = useState<Square | null>(null);
  const board = useBoardWidth();

  const reset = useCallback(() => {
    const g = new Chess();
    for (const m of opening.moves) {
      try {
        g.move(m);
      } catch {
        break;
      }
    }
    gameRef.current = g;
    setFen(g.fen());
    setStatus({ kind: "playing" });
    setFeedback(null);
    setAnswerArrows([]);
    setMisses([]);
    setAttempts(0);
    setUnknownFen(null);
    setHints(null);
    setPicked(null);
  }, [opening]);

  useEffect(reset, [reset, difficulty]);

  const myTurn = fen ? gameRef.current.turn() === side : false;

  /** 상대 차례면 Explorer 통계로 한 수 둔다. */
  useEffect(() => {
    const g = gameRef.current;
    if (!fen || status.kind === "ended" || myTurn) return;
    if (g.isGameOver()) {
      setStatus({ kind: "ended", reason: "대국이 끝났습니다." });
      return;
    }

    let alive = true;
    setStatus({ kind: "thinking" });

    fetchExplorer(g.fen(), explorerOptions)
      .then((result) => {
        if (!alive) return;
        if (isOutOfBook(result)) {
          setStatus({
            kind: "ended",
            reason:
              "정석 범위를 벗어났습니다. 이 국면부터는 실전 표본이 거의 없습니다.",
          });
          return;
        }
        const reply = pickOpponentMove(result, difficulty, g.turn());
        if (!reply) {
          setStatus({
            kind: "ended",
            reason: "이 국면에서 상대가 둘 수 있는 기록된 수가 없습니다.",
          });
          return;
        }
        g.move(reply.move.san);
        setFen(g.fen());
        setFeedback(
          `상대: ${reply.move.san} — 실전에서 ${(
            reply.shareOfPlay * 100
          ).toFixed(0)}%의 빈도로 나오는 수입니다.`
        );
        setAnswerArrows([]);
        setStatus({ kind: "playing" });
      })
      .catch((e: Error) => {
        if (alive) setStatus({ kind: "ended", reason: e.message });
      });

    return () => {
      alive = false;
    };
  }, [fen, myTurn, difficulty, explorerOptions, status.kind]);

  /** 내 차례이고 힌트가 켜져 있으면 이 국면의 메인라인과 탁월 수를 계산한다. */
  useEffect(() => {
    if (!fen || !showHints || !myTurn || status.kind === "ended") {
      setHints(null);
      return;
    }
    let alive = true;
    fetchExplorer(fen, explorerOptions)
      .then((r) => alive && setHints(analyzeHints(r, side)))
      .catch(() => alive && setHints(null));
    return () => {
      alive = false;
    };
  }, [fen, showHints, myTurn, side, explorerOptions, status.kind]);

  /** SAN 을 from/to 로 바꾼다. 국면은 건드리지 않는다. */
  function arrowFor(san: string, color: string): Arrow | null {
    const g = gameRef.current;
    try {
      const mv = g.move(san);
      g.undo();
      return [mv.from, mv.to, color];
    } catch {
      return null;
    }
  }

  const hintArrows: Arrow[] = [];
  if (showHints && myTurn && hints && status.kind === "playing") {
    const a = arrowFor(hints.mainline.san, C_MAIN);
    if (a) hintArrows.push(a);
    if (hints.standout) {
      const b = arrowFor(hints.standout.san, C_STANDOUT);
      if (b) hintArrows.push(b);
    }
  }

  function tryMove(from: string, to: string) {
    const g = gameRef.current;
    setPicked(null);
    if (status.kind !== "playing" || g.turn() !== side) return false;

    const before = g.fen();
    let played;
    try {
      played = g.move({ from, to, promotion: "q" });
    } catch {
      return false; // 불법 수는 그냥 되돌린다.
    }

    const expected = repertoire[before];
    setAttempts((n) => n + 1);

    if (!expected || expected.length === 0) {
      setUnknownFen({ fen: before, san: played.san });
      setFeedback(
        `${played.san} — 아직 레퍼토리에 없는 국면입니다. 이 수로 등록해 두면 다음부터 채점합니다.`
      );
      setAnswerArrows([]);
      setFen(g.fen());
      return true;
    }

    if (expected.includes(played.san)) {
      setFeedback(`${played.san} — 맞습니다.`);
      setAnswerArrows([]);
      setUnknownFen(null);
      setFen(g.fen());
      return true;
    }

    // 오답: 되돌리고 정답을 화살표로 보여준다.
    g.undo();
    setAnswerArrows(
      expected.map((s) => arrowFor(s, C_ANSWER)).filter(Boolean) as Arrow[]
    );
    setFeedback(
      `${played.san} 이 아니라 ${expected.join(
        " 또는 "
      )} 입니다. 화살표를 보고 다시 두세요.`
    );
    setMisses((m) => [...m, { fen: before, played: played.san, expected }]);
    void recordWeakness({
      fen: before,
      expected,
      played: played.san,
      line: g.history(),
      openingName: opening.name,
    });
    setFen(g.fen());
    return false;
  }

  /** 첫 탭은 말 고르기, 두 번째 탭은 그 칸으로 두기. */
  function onSquareClick(square: Square) {
    const g = gameRef.current;
    if (status.kind !== "playing" || g.turn() !== side) return;

    if (picked && picked !== square) {
      const legal = g
        .moves({ square: picked, verbose: true })
        .some((m) => m.to === square);
      if (legal) {
        tryMove(picked, square);
        return;
      }
    }

    const piece = g.get(square);
    setPicked(piece && piece.color === side ? square : null);
  }

  /** 고른 말과 그 말이 갈 수 있는 칸을 표시한다. */
  const squareStyles: Record<string, CSSProperties> = {};
  if (picked && status.kind === "playing") {
    squareStyles[picked] = { boxShadow: "inset 0 0 0 3px #c08a3e" };
    for (const m of gameRef.current.moves({ square: picked, verbose: true })) {
      squareStyles[m.to] = m.captured
        ? { boxShadow: "inset 0 0 0 3px rgba(192,138,62,.65)" }
        : {
            background:
              "radial-gradient(circle, rgba(192,138,62,.55) 22%, transparent 24%)",
          };
    }
  }

  function registerUnknown() {
    if (!unknownFen) return;
    const next = addToRepertoire(repertoire, unknownFen.fen, unknownFen.san);
    setRepertoire(next);
    void saveRepertoire(next);
    setFeedback(`${unknownFen.san} 을 레퍼토리에 등록했습니다.`);
    setUnknownFen(null);
  }

  const correct = attempts - misses.length;
  const rate = attempts ? Math.round((correct / attempts) * 100) : 0;

  return (
    <div className="practice">
      <div className="practice-board">
        <div className="board-frame" ref={board.ref}>
          {fen && (
            <Chessboard
              position={fen}
              boardWidth={board.width}
              onPieceDrop={tryMove}
              onSquareClick={onSquareClick}
              customSquareStyles={squareStyles}
              boardOrientation={side === "w" ? "white" : "black"}
              customArrows={[...answerArrows, ...hintArrows]}
              arePiecesDraggable={status.kind === "playing"}
              customBoardStyle={{ borderRadius: 0 }}
              customDarkSquareStyle={{ backgroundColor: "#4E5B4C" }}
              customLightSquareStyle={{ backgroundColor: "#D7CFB8" }}
              animationDuration={180}
            />
          )}
        </div>
      </div>

      <div className="practice-side">
        <header className="practice-head">
          <span className="eyebrow">연습 중</span>
          <h2>{toKorean(opening.name)}</h2>
          <p className="line">{side === "w" ? "백" : "흑"}을 잡고 둡니다</p>
        </header>

        <div className="field">
          <label className="eyebrow" htmlFor="diff">
            상대가 두는 방식
          </label>
          <select
            id="diff"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((k) => (
              <option key={k} value={k}>
                {DIFFICULTY_LABELS[k].name}
              </option>
            ))}
          </select>
          <p className="hint">{DIFFICULTY_LABELS[difficulty].hint}</p>
        </div>

        <button
          className={`btn toggle${showHints ? " is-on" : ""}`}
          onClick={() => setShowHints((v) => !v)}
          aria-pressed={showHints}
        >
          힌트 화살표 {showHints ? "끄기" : "켜기"}
        </button>

        {showHints && myTurn && status.kind === "playing" && (
          <div className="hints">
            {hints ? (
              <>
                <div className="hint-row">
                  <span className="swatch" style={{ background: C_MAIN }} />
                  <span className="san">{hints.mainline.san}</span>
                  <span className="tag">메인라인</span>
                  <span className="figs">
                    {hints.mainline.share.toFixed(0)}% 선택 · 승률{" "}
                    {hints.mainline.score.toFixed(0)}%
                  </span>
                </div>
                {hints.standout ? (
                  <div className="hint-row">
                    <span
                      className="swatch"
                      style={{ background: C_STANDOUT }}
                    />
                    <span className="san">{hints.standout.san}</span>
                    <span className="tag tag-good">탁월 수</span>
                    <span className="figs">
                      {hints.standout.share.toFixed(0)}% 선택 · 승률{" "}
                      {hints.standout.score.toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <p className="hint">
                    메인라인보다 뚜렷하게 나은 수는 없는 국면입니다.
                  </p>
                )}
              </>
            ) : (
              <p className="hint">힌트를 계산하는 중</p>
            )}
          </div>
        )}

        <div className="scoreline">
          <span>
            <strong>{correct}</strong>/{attempts} 정답
          </span>
          <span className="rate">{rate}%</span>
        </div>

        {status.kind === "thinking" && (
          <p className="notice">상대가 수를 고르는 중</p>
        )}

        {feedback && (
          <p className={`feedback${answerArrows.length ? " is-wrong" : ""}`}>
            {feedback}
          </p>
        )}

        {unknownFen && (
          <button className="btn btn-primary" onClick={registerUnknown}>
            이 수를 레퍼토리에 등록
          </button>
        )}

        {status.kind === "ended" && (
          <div className="summary">
            <h3 className="eyebrow">세션 종료</h3>
            <p className="reason">{status.reason}</p>
            <p className="big">
              {correct}/{attempts} · {rate}%
            </p>
            {misses.length > 0 && (
              <>
                <h4 className="eyebrow">틀린 수</h4>
                <ul className="miss-list">
                  {misses.map((m, i) => (
                    <li key={i}>
                      <span className="san bad">{m.played}</span>
                      <span className="arrow">→</span>
                      <span className="san">{m.expected.join(", ")}</span>
                    </li>
                  ))}
                </ul>
                <p className="hint">틀린 국면은 약점 목록에 저장했습니다.</p>
              </>
            )}
          </div>
        )}

        <div className="actions">
          <button className="btn" onClick={reset}>
            다시 시작
          </button>
          <button className="btn" onClick={onExit}>
            오프닝으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
