import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChesscomGame, myColor, myResult, timeClassLabel } from "../lib/chesscom";
import { OpeningNode, identifyOpening } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";
import { DEFAULT_OPTIONS, ExplorerResult, fetchExplorer } from "../lib/explorer";
import {
  DEFAULT_MAX_PLIES,
  PlyReview,
  ReviewInputMove,
  ReviewProgress,
  TAG_LABEL,
  reviewGame,
} from "../lib/gameAnalysis";
import { arrowSquares, sanForUci } from "../lib/uci";
import { explainAvailable, explainMistake } from "../lib/explain";
import WinBar from "./WinBar";
import BoardBadges, { SquareBadge } from "./BoardBadges";
import { useBoardWidth } from "../lib/useBoardWidth";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface Props {
  game: ChesscomGame;
  username: string;
  byId: Map<string, OpeningNode>;
  onBack: () => void;
  onHome: () => void;
}

function moveNumber(plyIndex: number) {
  // plyIndex 는 0부터. 그 수의 표기를 만든다 (0,1 -> "1.", 2,3 -> "2." 식).
  const n = Math.floor(plyIndex / 2) + 1;
  return plyIndex % 2 === 0 ? `${n}.` : `${n}...`;
}

function parseGame(game: ChesscomGame, byId: Map<string, OpeningNode>) {
  try {
    const g = new Chess();
    g.loadPgn(game.pgn);
    const verbose = g.history({ verbose: true });
    const moves: ReviewInputMove[] = verbose.map((m) => ({
      san: m.san,
      lan: m.lan,
      before: m.before,
      after: m.after,
      color: m.color,
    }));
    const opening = identifyOpening(verbose.map((m) => m.san), byId);
    return { moves, opening, error: null as string | null };
  } catch {
    return { moves: [] as ReviewInputMove[], opening: null as OpeningNode | null, error: "기보를 불러오지 못했습니다." };
  }
}

export default function GameBoard({ game, username, byId, onBack, onHome }: Props) {
  const parsed = useMemo(() => parseGame(game, byId), [game, byId]);
  const side = myColor(game, username);
  const opponent = side === "w" ? game.black : side === "b" ? game.white : null;
  const result = myResult(game, username);

  const [viewIndex, setViewIndex] = useState(0); // 이 국면까지 몇 수가 진행됐는지
  const [analysis, setAnalysis] = useState<PlyReview[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [winStats, setWinStats] = useState<ExplorerResult | null>(null);
  // null 이면 실제 기보를 그대로 보여준다. 보드에서 직접 수를 둬 보면 여기에
  // 갈라져 나온 국면이 쌓이며 "탐색 중" 상태가 된다.
  const [exploreFen, setExploreFen] = useState<string | null>(null);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainState, setExplainState] = useState<"idle" | "loading" | "failed">("idle");
  const board = useBoardWidth();

  const total = parsed.moves.length;
  const boardFen =
    viewIndex === 0 ? parsed.moves[0]?.before ?? START_FEN : parsed.moves[viewIndex - 1].after;
  const displayFen = exploreFen ?? boardFen;
  const upcoming = viewIndex < total ? parsed.moves[viewIndex] : null;
  const review = analysis?.[viewIndex] ?? null;

  // 화살표나 함정 목록을 눌러 실제 기보를 다시 탐색하면 직접 두던 라인은 접는다.
  useEffect(() => {
    setExploreFen(null);
    setExplainText(null);
    setExplainState("idle");
  }, [viewIndex]);

  async function showExplanation() {
    if (!review || review.tag === "fine" || viewIndex === 0) return;
    setExplainState("loading");
    setExplainText(null);
    try {
      const altUci = review.trap?.uci ?? review.bestUci;
      const movesSoFar = parsed.moves.slice(0, viewIndex).map((m) => m.san);
      const text = await explainMistake(
        movesSoFar,
        review.san,
        sanForUci(parsed.moves[viewIndex].before, altUci),
        review.lossCp,
        parsed.moves[viewIndex].before
      );
      setExplainText(text);
      setExplainState("idle");
    } catch {
      setExplainState("failed");
    }
  }

  function handleBoardDrop(from: string, to: string) {
    const g = new Chess(exploreFen ?? boardFen);
    try {
      g.move({ from, to, promotion: "q" });
    } catch {
      return false; // 불법 수는 그냥 되돌린다.
    }
    setExploreFen(g.fen());
    return true;
  }

  // 지금 보고 있는 국면(직접 둬서 갈라져 나온 국면 포함)의 실전 승/무/패를 보드 옆 막대에 보여준다.
  useEffect(() => {
    let alive = true;
    setWinStats(null);
    const timer = setTimeout(() => {
      fetchExplorer(displayFen, DEFAULT_OPTIONS)
        .then((r) => alive && setWinStats(r))
        .catch(() => alive && setWinStats(null));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [displayFen]);

  async function analyzeGame() {
    setAnalyzing(true);
    setAnalysisError(null);
    setProgress(null);
    try {
      const result = await reviewGame(parsed.moves, {}, setProgress);
      setAnalysis(result);
    } catch (e) {
      setAnalysisError((e as Error).message || "분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  const traps = useMemo(() => (analysis ?? []).filter((r) => r.trap), [analysis]);

  const showAlt = review && (review.tag !== "fine" || review.trap);
  // 방금 둔 수(현재 국면 직전 수)에 ??/!! 표시를 얹는다.
  const playedReview = viewIndex > 0 ? analysis?.[viewIndex - 1] ?? null : null;
  const badges: SquareBadge[] = [];
  if (playedReview && !exploreFen) {
    const toSquare = arrowSquares(parsed.moves[viewIndex - 1].lan)[1];
    if (playedReview.tag === "blunder") badges.push({ square: toSquare, text: "??" });
    else if (playedReview.brilliant) badges.push({ square: toSquare, text: "!!" });
  }
  const arrows: [Square, Square, string][] = [];
  if (upcoming) {
    arrows.push([
      ...arrowSquares(upcoming.lan),
      review ? (review.tag === "blunder" || review.tag === "mistake" ? "var(--bad)" : "var(--accent)") : "var(--accent)",
    ] as [Square, Square, string]);
  }
  if (showAlt && review) {
    const altUci = review.trap?.uci ?? review.bestUci;
    if (altUci && altUci !== upcoming?.lan) {
      arrows.push([...arrowSquares(altUci), "var(--good)"] as [Square, Square, string]);
    }
  }

  return (
    <div className="review-shell review-board">
      <div className="review-head">
        <button className="home-link" onClick={onHome}>
          ‹ 모드 선택
        </button>
        <button className="home-link" onClick={onBack}>
          다른 대국 고르기
        </button>
      </div>

      <header className="panel-head">
        <span className="eco-chip">{result ?? "?"}</span>
        <h1>
          vs {opponent?.username ?? "상대"}
          <span className="en-name"> ({opponent?.rating ?? "?"})</span>
        </h1>
        <p className="line">
          {parsed.opening ? toKorean(parsed.opening.name) : "미상 오프닝"} ·{" "}
          {timeClassLabel(game.time_class)}
        </p>
        {parsed.error && <p className="notice">{parsed.error}</p>}
      </header>

      <div className="split">
        <div className="board-col">
          <div className="board-with-winbar">
            <div className="board-frame" ref={board.ref}>
              <Chessboard
                // 국면이 바뀔 때마다 완전히 새로 그려서, 이전 국면의 화살표가
                // react-chessboard 내부 상태에 남아 다음 국면까지 따라오지 않게 한다.
                key={viewIndex}
                position={displayFen}
                boardWidth={board.width}
                onPieceDrop={handleBoardDrop}
                arePiecesDraggable
                boardOrientation={side === "b" ? "black" : "white"}
                customArrows={exploreFen ? [] : arrows}
                customBoardStyle={{ borderRadius: 0 }}
                customDarkSquareStyle={{ backgroundColor: "#4E5B4C" }}
                customLightSquareStyle={{ backgroundColor: "#D7CFB8" }}
                animationDuration={180}
              />
              <div className="board-badge-layer">
                <BoardBadges
                  badges={badges}
                  boardWidth={board.width}
                  orientation={side === "b" ? "black" : "white"}
                />
              </div>
            </div>
            <div className="side-winbar" title="이 국면의 실전 백/무/흑 비율">
              <WinBar
                white={winStats?.white ?? 0}
                draws={winStats?.draws ?? 0}
                black={winStats?.black ?? 0}
                vertical
              />
            </div>
          </div>

          {exploreFen && (
            <p className="notice study-hint">
              직접 둬 보는 중입니다. 실전 기보와는 다른 수순이에요.{" "}
              <button className="btn" onClick={() => setExploreFen(null)}>
                실제 수순으로 돌아가기
              </button>
            </p>
          )}

          <div className="actions">
            <button className="btn" onClick={() => setViewIndex(0)} disabled={viewIndex === 0}>
              처음
            </button>
            <button
              className="btn"
              onClick={() => setViewIndex((i) => Math.max(0, i - 1))}
              disabled={viewIndex === 0}
            >
              ◂ 이전
            </button>
            <button
              className="btn"
              onClick={() => setViewIndex((i) => Math.min(total, i + 1))}
              disabled={viewIndex === total}
            >
              다음 ▸
            </button>
            <button
              className="btn"
              onClick={() => setViewIndex(total)}
              disabled={viewIndex === total}
            >
              마지막
            </button>
          </div>

          {!analysis && (
            <div className="field">
              <button className="btn btn-primary" onClick={analyzeGame} disabled={analyzing || total === 0}>
                {analyzing ? "분석 중…" : "이 판 분석하기"}
              </button>
              <p className="hint">
                처음 최대 {DEFAULT_MAX_PLIES / 2}수까지, 수마다 엔진을 짧게 돌려 실수와
                함정 지점을 찾습니다. 대국 하나당 20~30초 정도 걸립니다.
              </p>
              {analyzing && progress && (
                <div className="progress-bar">
                  <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              )}
              {analysisError && <p className="notice">{analysisError}</p>}
            </div>
          )}

          {review && !exploreFen && (
            <div className={`field ply-detail tag-${review.tag}`}>
              <p className="ply-head">
                {moveNumber(viewIndex)} {review.san} · {TAG_LABEL[review.tag]}
                {review.trap && <span className="badge-main">함정 지점</span>}
              </p>
              {review.tag !== "fine" && (
                <p className="hint">손해 약 {(review.lossCp / 100).toFixed(1)}폰.</p>
              )}
              {showAlt && (review.trap?.uci ?? review.bestUci) !== upcoming?.lan && (
                <p className="hint">
                  대신{" "}
                  <strong>
                    {sanForUci(parsed.moves[viewIndex].before, review.trap?.uci ?? review.bestUci)}
                  </strong>{" "}
                  이 더 좋았습니다.
                </p>
              )}
              {review.tag !== "fine" && explainAvailable() && (
                <>
                  {!explainText && explainState !== "loading" && (
                    <button className="btn" onClick={showExplanation}>
                      왜 그런지 설명 보기
                    </button>
                  )}
                  {explainState === "loading" && <p className="notice">설명을 불러오는 중</p>}
                  {explainState === "failed" && (
                    <p className="notice">설명을 불러오지 못했습니다.</p>
                  )}
                  {explainText && <p className="idea">{explainText}</p>}
                </>
              )}
            </div>
          )}

          {viewIndex >= (analysis?.length ?? 0) && analysis && viewIndex < total && (
            <p className="notice">이후 수순은 분석 범위(첫 {DEFAULT_MAX_PLIES / 2}수)를 벗어났습니다.</p>
          )}
        </div>

        <div className="panel">
          {analysis && (
            <section className="block trap-summary">
              <h3 className="eyebrow">
                찾은 함정 지점 <span className="count">{traps.length}곳</span>
              </h3>
              {traps.length === 0 ? (
                <p className="notice">이 판에서는 뚜렷한 함정 지점을 찾지 못했습니다.</p>
              ) : (
                <ul className="trap-list">
                  {traps.map((r) => (
                    <li key={r.ply}>
                      <button onClick={() => setViewIndex(r.ply - 1)}>
                        <span className="mv">
                          <span className="mv-num">{moveNumber(r.ply - 1)}</span>
                          {r.san}
                        </span>
                        <span className="nm">
                          {r.color === side ? "내가" : "상대가"} 놓친 수: {" "}
                          {sanForUci(parsed.moves[r.ply - 1].before, r.trap!.uci)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <h3 className="eyebrow">기보</h3>
          <ul className="move-list">
            {parsed.moves.map((m, i) => {
              const r = analysis?.[i];
              return (
                <li key={i}>
                  <button
                    className={`move-item${i === viewIndex ? " is-selected" : ""}`}
                    onClick={() => setViewIndex(i)}
                  >
                    <span className="mv-num">{moveNumber(i)}</span>
                    <span className="san">{m.san}</span>
                    {r && r.tag !== "fine" && (
                      <span className={`dot tag-dot-${r.tag}`} />
                    )}
                    {r?.trap && <span className="dot tag-dot-trap" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
