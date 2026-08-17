import { useEffect, useState } from "react";
import { OpeningNode, shortName, sortChildren } from "../lib/openingTree";
import { toKorean } from "../lib/i18n";
import {
  ExplorerResult,
  scoreFor,
  total,
} from "../lib/explorer";
import { fetchIdea, ideasEnabled } from "../lib/ideas";
import WinBar from "./WinBar";

interface Props {
  node: OpeningNode;
  ancestors: OpeningNode[];
  stats: ExplorerResult | null;
  statsError: string | null;
  loading: boolean;
  sideToMove: "w" | "b";
  /** 이 국면의 실전 통계 기반 자식 정렬용 */
  childCounts?: Record<string, number>;
  onSelect: (n: OpeningNode) => void;
  onPractice: (side: "w" | "b") => void;
  onAddToRepertoire: (side: "w" | "b") => void;
}

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function pgnLine(moves: string[]) {
  return moves
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
    .join(" ");
}

function Idea({ node, stats, sideToMove }: Pick<Props, "node" | "stats" | "sideToMove">) {
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  useEffect(() => {
    if (!ideasEnabled()) return;
    let alive = true;
    setText(null);
    setState("loading");
    fetchIdea(node.eco, node.name, node.moves, stats, sideToMove)
      .then((t) => alive && (setText(t), setState("idle")))
      .catch(() => alive && setState("failed"));
    return () => {
      alive = false;
    };
    // stats 는 첫 로드 후 바뀌지 않으므로 노드 기준으로만 다시 부른다.
  }, [node.id]);

  if (!ideasEnabled() || state === "failed") return null;

  return (
    <section className="block">
      <h3 className="eyebrow">핵심 아이디어</h3>
      {state === "loading" ? (
        <p className="idea skeleton">불러오는 중</p>
      ) : (
        <p className="idea">{text}</p>
      )}
    </section>
  );
}

export default function OpeningPanel({
  node,
  ancestors,
  stats,
  statsError,
  loading,
  sideToMove,
  childCounts,
  onSelect,
  onPractice,
  onAddToRepertoire,
}: Props) {
  const t = stats ? total(stats) : 0;
  const children = sortChildren(node, childCounts);

  return (
    <div className="panel">
      <nav className="crumbs">
        {ancestors.slice(0, -1).map((a) => (
          <button key={a.id} onClick={() => onSelect(a)}>
            {toKorean(shortName(a, null).split(":")[0])}
          </button>
        ))}
      </nav>

      <header className="panel-head">
        <span className="eco-chip">{node.eco}</span>
        <h1>{toKorean(node.name)}</h1>
        <p className="en-name">{node.name}</p>
        <p className="line">{pgnLine(node.moves)}</p>
      </header>

      <div className="actions">
        <button className="btn btn-primary" onClick={() => onPractice("w")}>
          백으로 연습
        </button>
        <button className="btn btn-primary" onClick={() => onPractice("b")}>
          흑으로 연습
        </button>
        <button className="btn" onClick={() => onAddToRepertoire(sideToMove)}>
          이 수순을 레퍼토리에 추가
        </button>
      </div>

      {statsError ? (
        <p className="notice">{statsError}</p>
      ) : loading ? (
        <p className="notice">통계를 불러오는 중</p>
      ) : stats && t > 0 ? (
        <>
          <section className="block">
            <h3 className="eyebrow">
              실전 결과 <span className="count">{fmtCount(t)}판</span>
            </h3>
            <WinBar {...stats} showLabels />
          </section>

          <section className="block">
            <h3 className="eyebrow">
              이 국면에서 많이 두는 수
              <span className="count">{sideToMove === "w" ? "백" : "흑"} 차례</span>
            </h3>
            <table className="moves">
              <thead>
                <tr>
                  <th>수</th>
                  <th>선택 비율</th>
                  <th>결과</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {stats.moves.slice(0, 5).map((m) => {
                  const share = (total(m) / t) * 100;
                  return (
                    <tr key={m.uci}>
                      <td className="san">{m.san}</td>
                      <td className="share">
                        <span className="share-bar">
                          <span style={{ width: `${Math.min(share, 100)}%` }} />
                        </span>
                        {share.toFixed(0)}%
                      </td>
                      <td className="mini">
                        <WinBar {...m} />
                      </td>
                      <td className="score">
                        {scoreFor(m, sideToMove).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <p className="notice">
          이 국면은 실전 표본이 거의 없습니다. 정석 범위를 벗어난 수순입니다.
        </p>
      )}

      <Idea node={node} stats={stats} sideToMove={sideToMove} />

      <section className="block">
        <h3 className="eyebrow">
          하위 변화
          <span className="count">
            {children.length}개{childCounts ? " · 실전 빈도순" : ""}
          </span>
        </h3>
        {children.length ? (
          <ul className="subs">
            {children.map((c) => (
              <li key={c.id}>
                <button onClick={() => onSelect(c)}>
                  <span className="san">{c.moves[c.moves.length - 1]}</span>
                  <span className="nm">{toKorean(shortName(c, node))}</span>
                  <span className="eco">{c.eco}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            이름이 붙은 하위 변화가 없습니다. 여기서부터는 직접 수를 두며
            살펴보세요.
          </p>
        )}
      </section>
    </div>
  );
}
