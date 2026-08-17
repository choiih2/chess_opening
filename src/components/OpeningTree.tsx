import { useMemo, useState } from "react";
import {
  OpeningNode,
  OpeningRow,
  searchOpenings,
  shortName,
  sortChildren,
} from "../lib/openingTree";
import { toKorean } from "../lib/i18n";

interface Props {
  roots: OpeningNode[];
  allRows: OpeningRow[];
  byId: Map<string, OpeningNode>;
  selectedId: string | null;
  expanded: Set<string>;
  /** 국면별 실전 통계. 있으면 그 순서로 자식을 늘어놓는다. */
  moveCounts: Map<string, Record<string, number>>;
  mode: "study" | "practice";
  favorites: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: OpeningNode) => void;
  onToggleFavorite: (id: string) => void;
  onHome: () => void;
}

function moveNumber(depth: number) {
  // depth 는 그 노드까지의 수 개수. 마지막 수의 표기를 만든다.
  const n = Math.ceil(depth / 2);
  return depth % 2 === 1 ? `${n}.` : `${n}...`;
}

function FavStar({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`fav-star${active ? " is-fav" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      title={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function Row({
  node,
  parent,
  level,
  props,
}: {
  node: OpeningNode;
  parent: OpeningNode | null;
  level: number;
  props: Props;
}) {
  const { selectedId, expanded, moveCounts, favorites, onToggle, onSelect, onToggleFavorite } =
    props;
  const isOpen = expanded.has(node.id);
  const hasKids = node.children.length > 0;
  const lastMove = node.moves[node.moves.length - 1];
  const kids = isOpen ? sortChildren(node, moveCounts.get(node.id)) : [];

  return (
    <li>
      <div
        className={`tree-row${selectedId === node.id ? " is-selected" : ""}`}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        <button
          className={`twist${hasKids ? "" : " is-leaf"}`}
          onClick={() => hasKids && onToggle(node.id)}
          aria-label={isOpen ? "접기" : "펼치기"}
          aria-expanded={hasKids ? isOpen : undefined}
          tabIndex={hasKids ? 0 : -1}
        >
          {hasKids ? (isOpen ? "−" : "+") : "·"}
        </button>

        <button className="tree-label" onClick={() => onSelect(node)}>
          <span className="mv">
            <span className="mv-num">{moveNumber(node.depth)}</span>
            {lastMove}
          </span>
          <span className="nm">{toKorean(shortName(node, parent))}</span>
          {hasKids && <span className="kids">{node.children.length}</span>}
        </button>

        <FavStar
          active={favorites.has(node.id)}
          onToggle={() => onToggleFavorite(node.id)}
        />
      </div>

      {isOpen && hasKids && (
        <ul>
          {kids.map((c) => (
            <Row
              key={c.id}
              node={c}
              parent={node}
              level={level + 1}
              props={props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OpeningTree(props: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchOpenings(props.allRows, query),
    [props.allRows, query]
  );
  const favoriteNodes = useMemo(
    () =>
      [...props.favorites]
        .map((id) => props.byId.get(id))
        .filter((n): n is OpeningNode => !!n),
    [props.favorites, props.byId]
  );

  return (
    <aside className="tree-pane">
      <div className="tree-head">
        <div className="tree-head-top">
          <button className="home-link" onClick={props.onHome}>
            ‹ 모드 선택
          </button>
          <span className="mode-pill">
            {props.mode === "study" ? "학습" : "연습"}
          </span>
        </div>
        <h2 className="eyebrow">오프닝</h2>
        <input
          className="search"
          type="search"
          value={query}
          placeholder="한글·영문 이름이나 ECO 코드"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="tree-scroll">
        {!query.trim() && favoriteNodes.length > 0 && (
          <div className="fav-section">
            <h3 className="eyebrow">즐겨찾기</h3>
            <ul className="flat">
              {favoriteNodes.map((n) => (
                <li key={n.id}>
                  <div
                    className={`tree-row flat-row${
                      props.selectedId === n.id ? " is-selected" : ""
                    }`}
                  >
                    <button className="tree-label" onClick={() => props.onSelect(n)}>
                      <span className="eco">{n.eco}</span>
                      <span className="nm">{toKorean(n.name)}</span>
                    </button>
                    <FavStar active onToggle={() => props.onToggleFavorite(n.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {query.trim() ? (
          results.length ? (
            <ul className="flat">
              {results.map((r) => {
                const id = r.moves.join(" ");
                const node = props.byId.get(id);
                return (
                  <li key={id}>
                    <div
                      className={`tree-row flat-row${
                        props.selectedId === id ? " is-selected" : ""
                      }`}
                    >
                      <button
                        className="tree-label"
                        onClick={() => node && props.onSelect(node)}
                      >
                        <span className="eco">{r.eco}</span>
                        <span className="nm">{toKorean(r.name)}</span>
                      </button>
                      <FavStar
                        active={props.favorites.has(id)}
                        onToggle={() => props.onToggleFavorite(id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">
              "{query}"에 맞는 오프닝이 없습니다. 철자를 바꾸거나 ECO 코드로
              찾아보세요.
            </p>
          )
        ) : (
          <ul>
            {[...props.roots]
              .sort((a, b) => {
                const c = props.moveCounts.get("");
                if (c) {
                  const ca = c[a.moves[0]] ?? -1;
                  const cb = c[b.moves[0]] ?? -1;
                  if (ca !== cb) return cb - ca;
                }
                return b.descendants - a.descendants;
              })
              .map((n) => (
                <Row key={n.id} node={n} parent={null} level={0} props={props} />
              ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
