<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { OpeningNode } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";
import { ExplorerOptions, fetchExplorer, total } from "../lib/explorer";
import { analyze, findBrilliantMove, initEngine } from "../lib/engine";
import { arrowSquares, sanForUci } from "../lib/uci";
import {
  Difficulty,
  DIFFICULTY_LABELS,
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
  isOutOfBook,
  pickOpponentMove,
} from "../lib/practice";
import {
  Repertoire,
  addToRepertoire,
  recordWeakness,
  saveRepertoire,
} from "../lib/repertoire";

<<<<<<< HEAD
// 정석 통계가 현재 레이팅대에서 바닥나면 한 번 더 넓혀서 물어본다.
const BROAD_EXPLORER_OPTIONS: ExplorerOptions = {
  ratings: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500],
  speeds: ["blitz", "rapid"],
};

interface HintArrow {
  uci: string;
  color: string;
  label: string;
}
=======
// 화살표 색. CSS 변수는 SVG 속성에서 안 먹을 수 있어 값을 직접 쓴다.
const C_ANSWER = "#e6e0d0"; // 오답 뒤 알려주는 내 레퍼토리 수
const C_MAIN = "#c08a3e"; // 메인라인
const C_STANDOUT = "#7f9a6a"; // 탁월 수

type Arrow = [Square, Square, string];
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

interface Miss {
  fen: string;
  played: string;
  expected: string[];
<<<<<<< HEAD
  ply: number;
=======
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
<<<<<<< HEAD
  const [historyLen, setHistoryLen] = useState(0); // 트레이너가 이 세션에서 되돌릴 수 있는 수 개수 판단용
  const [difficulty, setDifficulty] = useState<Difficulty>("frequency");
  const [status, setStatus] = useState<Status>({ kind: "playing" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [arrows, setArrows] = useState<[Square, Square, string][]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [unknownFen, setUnknownFen] = useState<{ fen: string; san: string } | null>(
    null
  );
  const [hints, setHints] = useState<HintArrow[] | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  // 요청을 식별해, 응답이 오기 전에 수가 진행되거나 새 힌트를 눌러도
  // 낡은 응답이 hintLoading 을 계속 true 로 묶어 두지 않게 한다.
  const hintToken = useRef(0);

  // 워커를 미리 띄워 둔다. 첫 힌트 요청에서 엔진 파일(약 7MB) 로딩을 기다리지 않도록.
  useEffect(() => {
    void initEngine().catch(() => {});
  }, []);

  const isPlayerTurn = useMemo(() => {
    if (!fen) return false;
    try {
      return new Chess(fen).turn() === side;
    } catch {
      return false;
    }
  }, [fen, side]);

  const clearHints = useCallback(() => {
    hintToken.current++; // 진행 중인 요청이 있었다면 응답이 와도 무시된다.
    setHints(null);
    setHintError(null);
    setHintLoading(false);
  }, []);

  async function showHint() {
    const myToken = ++hintToken.current;
    const hintFen = gameRef.current.fen();
    setHintLoading(true);
    setHintError(null);
    setHints(null);

    try {
      const [explorerResult, engineLines] = await Promise.all([
        fetchExplorer(hintFen, explorerOptions).catch(() => null),
        analyze(hintFen, { multiPv: 3, movetimeMs: 1200 }).catch(() => []),
      ]);

      if (hintToken.current !== myToken) return; // 그 사이 수가 진행되거나 새 힌트를 눌렀다.

      if (!explorerResult && !engineLines.length) {
        setHintError("힌트를 불러오지 못했습니다. 엔진 파일이 준비됐는지 확인하세요.");
        return;
      }

      const mainlineMove = explorerResult?.moves.find((m) => total(m) > 0);
      const brilliant = findBrilliantMove(engineLines);
      const items: HintArrow[] = [];

      if (mainlineMove) {
        const share = explorerResult
          ? (total(mainlineMove) / total(explorerResult)) * 100
          : 0;
        const alsoBest = brilliant?.line.uci === mainlineMove.uci;
        items.push({
          uci: mainlineMove.uci,
          color: "var(--accent)",
          label: `메인라인 · ${mainlineMove.san} — 실전 ${share.toFixed(0)}% 선택${
            alsoBest ? " · 엔진도 최선으로 봄" : ""
          }`,
        });
      }

      if (brilliant && brilliant.line.uci !== mainlineMove?.uci) {
        items.push({
          uci: brilliant.line.uci,
          color: "var(--good)",
          label: `탁월한 수 · ${sanForUci(hintFen, brilliant.line.uci)} — 다른 후보보다 +${(
            brilliant.gapCp / 100
          ).toFixed(1)} 더 좋음 (엔진 평가)`,
        });
      } else if (!mainlineMove && engineLines[0]) {
        items.push({
          uci: engineLines[0].uci,
          color: "var(--good)",
          label: `엔진 추천 · ${sanForUci(hintFen, engineLines[0].uci)}`,
        });
      }

      setHints(items);
    } finally {
      if (hintToken.current === myToken) setHintLoading(false);
    }
  }

  function syncBoard(g: Chess) {
    setFen(g.fen());
    setHistoryLen(g.history().length);
  }

  const openingPly = opening.moves.length; // 트레이너가 미리 깔아둔 수는 되돌리지 않는다
  // 되돌릴 내 수가 실제로 있어야 한다 (상대가 먼저 두는 국면이면 상대 수 하나만 있을 수 있다 —
  // 그 경우 되돌려도 취소할 내 수가 없어 상대가 다시 둘 뿐이라 버튼 자체를 막는다).
  const canUndo = status.kind === "playing" && historyLen >= openingPly + 2;
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

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
<<<<<<< HEAD
    setHistoryLen(g.history().length);
    setStatus({ kind: "playing" });
    setFeedback(null);
    setArrows([]);
    setMisses([]);
    setAttempts(0);
    setUnknownFen(null);
    clearHints();
  }, [opening, clearHints]);

  useEffect(reset, [reset, difficulty]);

  function undoLastMove() {
    const g = gameRef.current;
    if (!canUndo) return;
    g.undo(); // 상대가 마지막으로 둔 수 취소
    if (g.history().length > openingPly) {
      g.undo(); // 그 앞의 내 수까지 마저 취소해서 다시 두게 한다
    }
    syncBoard(g);
    setStatus({ kind: "playing" });
    setFeedback("마지막 수를 취소했습니다. 다시 둬 보세요.");
    setArrows([]);
    clearHints();
    setUnknownFen(null);
    setAttempts((n) => Math.max(0, n - 1));
    setMisses((prev) => {
      const last = prev[prev.length - 1];
      return last && last.ply === g.history().length + 1 ? prev.slice(0, -1) : prev;
    });
  }

  /** 정석 통계가 바닥나면 엔진이 대신 상대 역할을 한다. */
  async function engineRespond(g: Chess, isAlive: () => boolean) {
    const lines = await analyze(g.fen(), { multiPv: 3, movetimeMs: 800 });
    if (!isAlive()) return;
    if (!lines.length) {
      setStatus({ kind: "ended", reason: "이 국면에서 둘 수 있는 수가 없습니다." });
      return;
    }
    // 매번 1등 수만 두면 예측 가능해지니, 상위 후보 중 가중 추첨으로 약간의 다양성을 준다.
    const top = lines.slice(0, Math.min(3, lines.length));
    const weights = top.map((_, i) => 1 / (i + 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let idx = top.length - 1;
    for (let i = 0; i < top.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    const picked = top[idx];
    const before = g.fen();
    const san = sanForUci(before, picked.uci);
    g.move({
      from: picked.uci.slice(0, 2),
      to: picked.uci.slice(2, 4),
      promotion: picked.uci.length > 4 ? picked.uci.slice(4) : undefined,
    });
    syncBoard(g);
    setFeedback(`상대(엔진): ${san} — 정석 범위를 벗어나 엔진이 대신 뒀습니다.`);
    setArrows([]);
    clearHints();
    setStatus({ kind: "playing" });
  }

  /** 상대 차례면 Explorer 통계로, 통계가 바닥나면 엔진으로 한 수 둔다. */
  useEffect(() => {
    const g = gameRef.current;
    if (!fen || status.kind === "ended") return;
    if (g.turn() === side) return;
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
    if (g.isGameOver()) {
      setStatus({ kind: "ended", reason: "대국이 끝났습니다." });
      return;
    }

    let alive = true;
    setStatus({ kind: "thinking" });

<<<<<<< HEAD
    (async () => {
      try {
        let result = await fetchExplorer(g.fen(), explorerOptions);
        let usedBroad = false;
        if (isOutOfBook(result)) {
          result = await fetchExplorer(g.fen(), BROAD_EXPLORER_OPTIONS);
          usedBroad = true;
        }
        if (!alive) return;

        if (!isOutOfBook(result)) {
          const picked = pickOpponentMove(result, difficulty, g.turn());
          if (picked) {
            g.move(picked.move.san);
            syncBoard(g);
            setFeedback(
              `상대: ${picked.move.san} — 실전에서 ${(picked.shareOfPlay * 100).toFixed(
                0
              )}%의 빈도로 나오는 수입니다.${usedBroad ? " (넓은 레이팅대 기준)" : ""}`
            );
            setArrows([]);
            clearHints();
            setStatus({ kind: "playing" });
            return;
          }
        }

        // 정석 범위를 완전히 벗어났다 — 엔진이 이어서 상대 역할을 한다.
        await engineRespond(g, () => alive);
      } catch (e) {
        if (alive) setStatus({ kind: "ended", reason: (e as Error).message });
      }
    })();
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

    return () => {
      alive = false;
    };
<<<<<<< HEAD
  }, [fen, side, difficulty, explorerOptions, status.kind]);

  /** SAN 을 from/to 로 바꿔 화살표를 그린다. */
  function arrowFor(san: string): [Square, Square, string] | null {
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
    const g = gameRef.current;
    try {
      const mv = g.move(san);
      g.undo();
<<<<<<< HEAD
      return [mv.from, mv.to, "var(--accent)"];
=======
      return [mv.from, mv.to, color];
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
    } catch {
      return null;
    }
  }

<<<<<<< HEAD
  function onDrop(from: string, to: string) {
    const g = gameRef.current;
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
<<<<<<< HEAD
    clearHints();
=======
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

    if (!expected || expected.length === 0) {
      setUnknownFen({ fen: before, san: played.san });
      setFeedback(
        `${played.san} — 아직 레퍼토리에 없는 국면입니다. 이 수로 등록해 두면 다음부터 채점합니다.`
      );
<<<<<<< HEAD
      setArrows([]);
      syncBoard(g);
=======
      setAnswerArrows([]);
      setFen(g.fen());
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
      return true;
    }

    if (expected.includes(played.san)) {
      setFeedback(`${played.san} — 맞습니다.`);
<<<<<<< HEAD
      setArrows([]);
      setUnknownFen(null);
      syncBoard(g);
=======
      setAnswerArrows([]);
      setUnknownFen(null);
      setFen(g.fen());
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
      return true;
    }

    // 오답: 되돌리고 정답을 화살표로 보여준다.
    g.undo();
<<<<<<< HEAD
    const arrow = expected.map(arrowFor).filter(Boolean) as [
      Square,
      Square,
      string
    ][];
    setArrows(arrow);
    setFeedback(
      `${played.san} 이 아니라 ${expected.join(" 또는 ")} 입니다. 화살표를 보고 다시 두세요.`
    );
    const miss: Miss = {
      fen: before,
      played: played.san,
      expected,
      ply: g.history().length,
    };
    setMisses((m) => [...m, miss]);
=======
    setAnswerArrows(
      expected.map((s) => arrowFor(s, C_ANSWER)).filter(Boolean) as Arrow[]
    );
    setFeedback(
      `${played.san} 이 아니라 ${expected.join(
        " 또는 "
      )} 입니다. 화살표를 보고 다시 두세요.`
    );
    setMisses((m) => [...m, { fen: before, played: played.san, expected }]);
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
    void recordWeakness({
      fen: before,
      expected,
      played: played.san,
      line: g.history(),
      openingName: opening.name,
    });
<<<<<<< HEAD
    syncBoard(g);
    return false;
  }

=======
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

>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
<<<<<<< HEAD
        <div className="board-frame">
          {fen && (
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={side === "w" ? "white" : "black"}
              customArrows={[
                ...arrows,
                ...(hints ?? []).map(
                  (h) => [...arrowSquares(h.uci), h.color] as [Square, Square, string]
                ),
              ]}
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
<<<<<<< HEAD
          <p className="line">
            {side === "w" ? "백" : "흑"}을 잡고 둡니다
          </p>
=======
          <p className="line">{side === "w" ? "백" : "흑"}을 잡고 둡니다</p>
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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

<<<<<<< HEAD
        <div className="field hint-panel">
          <button
            className="btn"
            onClick={showHint}
            disabled={!isPlayerTurn || status.kind !== "playing" || hintLoading}
          >
            {hintLoading ? "분석 중…" : "힌트 보기"}
          </button>
          <p className="hint">
            메인라인과, 엔진이 확실히 더 좋다고 보는 수가 있으면 화살표로
            보여줍니다. 첫 사용 시 엔진 파일(약 7MB)을 내려받습니다.
          </p>
          {hintError && <p className="notice">{hintError}</p>}
          {hints && hints.length > 0 && (
            <ul className="hint-list">
              {hints.map((h) => (
                <li key={h.uci}>
                  <span className="dot" style={{ background: h.color }} />
                  {h.label}
                </li>
              ))}
            </ul>
          )}
          {hints && hints.length === 0 && (
            <p className="notice">이 수에 대해 보여줄 힌트가 없습니다.</p>
          )}
        </div>
=======
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
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

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
<<<<<<< HEAD
          <p className={`feedback${arrows.length ? " is-wrong" : ""}`}>
=======
          <p className={`feedback${answerArrows.length ? " is-wrong" : ""}`}>
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
<<<<<<< HEAD
                <p className="hint">
                  틀린 국면은 약점 목록에 저장했습니다.
                </p>
=======
                <p className="hint">틀린 국면은 약점 목록에 저장했습니다.</p>
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
              </>
            )}
          </div>
        )}

        <div className="actions">
<<<<<<< HEAD
          <button className="btn" onClick={undoLastMove} disabled={!canUndo}>
            ◂ 이전 수
          </button>
=======
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
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
