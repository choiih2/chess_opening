import { useState } from "react";
import { Chess } from "chess.js";
import { ChesscomGame, myColor, myResult, timeClassLabel } from "../lib/chesscom";
import { OpeningNode, identifyOpening } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";

interface Props {
  byId: Map<string, OpeningNode>;
  username: string | null | undefined; // undefined = 저장된 아이디 불러오는 중
  games: ChesscomGame[];
  loading: boolean;
  error: string | null;
  onSubmitUsername: (name: string) => void;
  onSwitchUser: () => void;
  onRefresh: () => void;
  onPick: (game: ChesscomGame, username: string) => void;
  onHome: () => void;
}

function fmtDate(unixSeconds: number) {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function openingOf(pgn: string, byId: Map<string, OpeningNode>): OpeningNode | null {
  try {
    const g = new Chess();
    g.loadPgn(pgn);
    return identifyOpening(g.history(), byId);
  } catch {
    return null;
  }
}

export default function GameList({
  byId,
  username,
  games,
  loading,
  error,
  onSubmitUsername,
  onSwitchUser,
  onRefresh,
  onPick,
  onHome,
}: Props) {
  const [input, setInput] = useState("");

  function submitUsername() {
    const name = input.trim();
    if (!name) return;
    onSubmitUsername(name);
  }

  if (username === undefined) {
    return null; // 저장된 아이디를 불러오는 아주 짧은 순간
  }

  if (!username) {
    return (
      <div className="review-shell">
        <button className="home-link" onClick={onHome}>
          ‹ 모드 선택
        </button>
        <p className="eyebrow">복기</p>
        <h1>Chess.com 아이디를 입력하세요</h1>
        <p className="lede">
          공개 대국 기록만 가져옵니다. 로그인이나 비밀번호는 필요 없습니다.
        </p>
        <div className="actions">
          <input
            className="search"
            style={{ maxWidth: 280 }}
            value={input}
            placeholder="chess.com 아이디"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitUsername()}
          />
          <button className="btn btn-primary" onClick={submitUsername}>
            불러오기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review-shell">
      <div className="review-head">
        <button className="home-link" onClick={onHome}>
          ‹ 모드 선택
        </button>
        <button className="home-link" onClick={onSwitchUser}>
          다른 아이디 쓰기
        </button>
      </div>
      <p className="eyebrow">복기 · {username}</p>
      <div className="review-head">
        <h1>최근 대국 {games.length ? `${games.length}개` : ""}</h1>
        <button className="btn" onClick={onRefresh} disabled={loading}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>
      <p className="hint">
        방금 끝낸 대국이 안 보이면 Chess.com 이 기록을 반영할 때까지 잠깐 걸릴 수
        있습니다. 새로고침을 눌러 다시 확인하세요.
      </p>

      {error && <p className="notice">{error}</p>}

      <ul className="game-list">
        {games.map((g) => {
          const side = myColor(g, username);
          const opponent = side === "w" ? g.black : side === "b" ? g.white : null;
          const result = myResult(g, username);
          const opening = openingOf(g.pgn, byId);
          return (
            <li key={g.url}>
              <button className="game-row" onClick={() => onPick(g, username)}>
                <span
                  className={`result result-${
                    result === "승" ? "win" : result === "패" ? "loss" : "draw"
                  }`}
                >
                  {result ?? "?"}
                </span>
                <span className="opp">
                  {opponent?.username ?? "상대"}
                  <span className="rating"> ({opponent?.rating ?? "?"})</span>
                </span>
                <span className="nm">{opening ? toKorean(opening.name) : "미상 오프닝"}</span>
                <span className="tc">{timeClassLabel(g.time_class)}</span>
                <span className="date">{fmtDate(g.end_time)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {games.length === 0 && !loading && !error && (
        <p className="notice">불러올 대국이 없습니다.</p>
      )}
    </div>
  );
}
