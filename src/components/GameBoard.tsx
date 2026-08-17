import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChesscomGame, myColor, myResult, timeClassLabel } from "../lib/chesscom";
import { OpeningNode, identifyOpening } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";
import {
  DEFAULT_MAX_PLIES,
  PlyReview,
  ReviewInputMove,
  ReviewProgress,
  TAG_LABEL,
  reviewGame,
} from "../lib/gameAnalysis";
import { arrowSquares, sanForUci } from "../lib/uci";

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

  const total = parsed.moves.length;
  const boardFen =
    viewIndex === 0 ? parsed.moves[0]?.before ?? START_FEN : parsed.moves[viewIndex - 1].after;
  const upcoming = viewIndex < total ? parsed.moves[viewIndex] : null;
  const review = analysis?.[viewIndex] ?? null;

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
          <div className="board-frame">
            <Chessboard
              position={boardFen}
              arePiecesDraggable={false}
              boardOrientation={side === "b" ? "black" : "white"}
              customArrows={arrows}
              customBoardStyle={{ borderRadius: 0 }}
              customDarkSquareStyle={{ backgroundColor: "#4E5B4C" }}
              customLightSquareStyle={{ backgroundColor: "#D7CFB8" }}
              animationDuration={180}
            />
          </div>

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

          {review && (
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
