import { useState } from "react";
import { ChesscomGame } from "../lib/chesscom";
import { OpeningNode } from "../lib/openingTree";
import GameList from "./GameList";
import GameBoard from "./GameBoard";

interface Props {
  byId: Map<string, OpeningNode>;
  onHome: () => void;
}

export default function GameReview({ byId, onHome }: Props) {
  const [picked, setPicked] = useState<{ game: ChesscomGame; username: string } | null>(null);

  if (!picked) {
    return (
      <GameList
        byId={byId}
        onPick={(game, username) => setPicked({ game, username })}
        onHome={onHome}
      />
    );
  }

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
