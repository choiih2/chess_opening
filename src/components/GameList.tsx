import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import {
  ChesscomGame,
  fetchArchiveMonths,
  fetchMonthGames,
  loadChesscomUsername,
  myColor,
  myResult,
  saveChesscomUsername,
  timeClassLabel,
} from "../lib/chesscom";
import { OpeningNode, identifyOpening } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";

interface Props {
  byId: Map<string, OpeningNode>;
  onPick: (game: ChesscomGame, username: string) => void;
  onHome: () => void;
}

const RECENT_LIMIT = 10;

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

/** 최신 달부터 훑으며 최근 대국을 RECENT_LIMIT 개 모을 때까지 이어서 불러온다. */
async function loadRecentGames(user: string): Promise<ChesscomGame[]> {
  const monthList = await fetchArchiveMonths(user); // 최신 달이 앞
  const collected: ChesscomGame[] = [];
  for (const m of monthList) {
    if (collected.length >= RECENT_LIMIT) break;
    const monthGames = (await fetchMonthGames(user, m.year, m.month)).filter(
      (g) => g.rules === "chess"
    );
    collected.push(...monthGames);
  }
  return collected.sort((a, b) => b.end_time - a.end_time).slice(0, RECENT_LIMIT);
}

export default function GameList({ byId, onPick, onHome }: Props) {
  const [username, setUsername] = useState<string | null | undefined>(undefined); // undefined = 로딩 중
  const [input, setInput] = useState("");
  const [games, setGames] = useState<ChesscomGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChesscomUsername().then((u) => setUsername(u));
  }, []);

  useEffect(() => {
    if (!username) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setGames([]);

    loadRecentGames(username)
      .then((found) => alive && setGames(found))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [username]);

  function submitUsername() {
    const name = input.trim();
    if (!name) return;
    void saveChesscomUsername(name);
    setUsername(name);
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
        <button className="home-link" onClick={() => setUsername(null)}>
          다른 아이디 쓰기
        </button>
      </div>
      <p className="eyebrow">복기 · {username}</p>
      <h1>최근 대국 {games.length ? `${games.length}개` : ""}</h1>

      {loading && <p className="notice">불러오는 중…</p>}
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
