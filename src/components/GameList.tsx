import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import {
  ArchiveMonth,
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

/** cursor 부터 시작해, 대국이 하나라도 나오거나 달이 바닥날 때까지 이어서 불러온다. */
async function loadMoreMonths(
  user: string,
  monthList: ArchiveMonth[],
  fromCursor: number
): Promise<{ cursor: number; games: ChesscomGame[] }> {
  let cursor = fromCursor;
  let found: ChesscomGame[] = [];
  while (cursor < monthList.length) {
    const m = monthList[cursor];
    cursor++;
    const monthGames = (await fetchMonthGames(user, m.year, m.month)).filter(
      (g) => g.rules === "chess"
    );
    if (monthGames.length) {
      found = monthGames;
      break;
    }
  }
  return { cursor, games: found };
}

export default function GameList({ byId, onPick, onHome }: Props) {
  const [username, setUsername] = useState<string | null | undefined>(undefined); // undefined = 로딩 중
  const [input, setInput] = useState("");
  const [months, setMonths] = useState<ArchiveMonth[]>([]);
  const [monthCursor, setMonthCursor] = useState(0);
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
    setMonthCursor(0);

    (async () => {
      const monthList = await fetchArchiveMonths(username);
      if (!alive) return;
      setMonths(monthList);
      const { cursor, games: found } = await loadMoreMonths(username, monthList, 0);
      if (!alive) return;
      setGames(found);
      setMonthCursor(cursor);
    })()
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [username]);

  function handleLoadMore() {
    if (!username || loading) return;
    setLoading(true);
    setError(null);
    loadMoreMonths(username, months, monthCursor)
      .then(({ cursor, games: found }) => {
        setGames((prev) => [...prev, ...found]);
        setMonthCursor(cursor);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

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
      <h1>대국을 고르세요</h1>

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

      {monthCursor < months.length && (
        <button className="btn" onClick={handleLoadMore} disabled={loading}>
          {loading ? "불러오는 중…" : "이전 달 더 보기"}
        </button>
      )}
    </div>
  );
}
