import { useCallback, useEffect, useState } from "react";
import {
  ChesscomGame,
  loadChesscomUsername,
  loadRecentGames,
  saveChesscomUsername,
} from "../lib/chesscom";
import { OpeningNode } from "../lib/openingTree";
import GameList from "./GameList";
import GameBoard from "./GameBoard";

interface Props {
  byId: Map<string, OpeningNode>;
  onHome: () => void;
}

export default function GameReview({ byId, onHome }: Props) {
  const [picked, setPicked] = useState<{ game: ChesscomGame; username: string } | null>(null);
  const [username, setUsername] = useState<string | null | undefined>(undefined); // undefined = 저장된 아이디 불러오는 중
  const [games, setGames] = useState<ChesscomGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChesscomUsername().then(setUsername);
  }, []);

  const reload = useCallback((user: string) => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadRecentGames(user)
      .then((found) => alive && setGames(found))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // 이 컴포넌트는 복기 모드에 들어올 때 한 번만 마운트된다. 대국 목록 <->
  // 대국 화면을 오가도(setPicked) 다시 마운트되지 않으므로, 여기서 목록을
  // 들고 있으면 "다른 대국 고르기"를 누를 때마다 다시 불러오지 않는다.
  useEffect(() => {
    if (!username) return;
    return reload(username);
  }, [username, reload]);

  if (picked) {
    return (
      <GameBoard
        game={picked.game}
        username={picked.username}
        byId={byId}
        onBack={() => setPicked(null)}
        onHome={onHome}
      />
    );
  }

  return (
    <GameList
      byId={byId}
      username={username}
      games={games}
      loading={loading}
      error={error}
      onSubmitUsername={(name) => {
        void saveChesscomUsername(name);
        setUsername(name);
      }}
      onSwitchUser={() => {
        setUsername(null);
        setGames([]);
      }}
      onRefresh={() => username && reload(username)}
      onPick={(game, user) => setPicked({ game, username: user })}
      onHome={onHome}
    />
  );
}
