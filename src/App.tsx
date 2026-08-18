import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  OpeningNode,
  OpeningRow,
  ancestorsOf,
  buildTree,
  indexById,
} from "./lib/openingTree";
import {
  DEFAULT_OPTIONS,
  ExplorerOptions,
  ExplorerResult,
  fetchExplorer,
} from "./lib/explorer";
import {
  Repertoire,
  ingestLine,
  loadRepertoire,
  saveRepertoire,
} from "./lib/repertoire";
import { toKorean } from "./lib/i18n";
import { hasLichessToken } from "./lib/env";
import { loadFavorites, saveFavorites, toggleFavorite } from "./lib/favorites";
import { useBoardWidth } from "./lib/useBoardWidth";
import OpeningTree from "./components/OpeningTree";
import OpeningPanel from "./components/OpeningPanel";
import PracticeMode from "./components/PracticeMode";
import ModeSelect from "./components/ModeSelect";
import GameReview from "./components/GameReview";

const RATING_BANDS = [
  { label: "1000 – 1400", value: [1000, 1200] },
  { label: "1400 – 1800", value: [1400, 1600] },
  { label: "1600 – 2000", value: [1600, 1800, 2000] },
  { label: "2000 이상", value: [2000, 2200, 2500] },
];

/** 수순을 적용하며 각 수 직전의 FEN 배열과 최종 FEN을 만든다. */
function replay(moves: string[]) {
  const g = new Chess();
  const fens: string[] = [];
  for (const m of moves) {
    fens.push(g.fen());
    try {
      g.move(m);
    } catch {
      break;
    }
  }
  return { fens, fen: g.fen(), turn: g.turn() as "w" | "b" };
}

export default function App() {
  const [rows, setRows] = useState<OpeningRow[] | null>(null);
  const [selected, setSelected] = useState<OpeningNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<ExplorerResult | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [practice, setPractice] = useState<"w" | "b" | null>(null);
  const [mode, setMode] = useState<"study" | "practice" | "review" | null>(null);
  const [repertoire, setRepertoire] = useState<Repertoire>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [band, setBand] = useState(2);
  const [viewPly, setViewPly] = useState(0); // 보드에 몇 수까지 보여줄지 (학습용 되감기)
  // 국면(노드 id) -> { SAN: 대국 수 }. 트리를 실전 빈도순으로 놓는 데 쓴다.
  const [moveCounts, setMoveCounts] = useState<
    Map<string, Record<string, number>>
  >(new Map());
  const board = useBoardWidth(440);

  const explorerOptions: ExplorerOptions = useMemo(
    () => ({ ratings: RATING_BANDS[band].value, speeds: DEFAULT_OPTIONS.speeds }),
    [band]
  );

  // openings.json 은 500KB 남짓이라 첫 화면을 막지 않도록 나중에 불러온다.
  useEffect(() => {
    import("./data/openings.json").then((m) =>
      setRows(m.default as OpeningRow[])
    );
    loadRepertoire().then(setRepertoire);
    loadFavorites().then(setFavorites);
  }, []);

  function toggleFav(id: string) {
    setFavorites((prev) => {
      const next = toggleFavorite(prev, id);
      void saveFavorites(next);
      return next;
    });
  }

  // 화면 "깊이"를 히스토리 항목에 실어 둔다. 이게 없으면 뒤로가기(브라우저나
  // 안드로이드 제스처)가 앱 내부 화면을 되짚는 대신 곧바로 사이트를 벗어나 버린다.
  // 0 = 모드 선택, 1 = 모드 선택 후 화면(학습/복기/연습 설정), 2 = 연습 진행 중.
  const skipNextPush = useRef(false);

  useEffect(() => {
    if (!history.state || typeof history.state.depth !== "number") {
      history.replaceState({ depth: 0 }, "");
    }
    const onPopState = (e: PopStateEvent) => {
      const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
      skipNextPush.current = true;
      if (depth < 2) setPractice(null);
      if (depth < 1) setMode(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const depth = practice ? 2 : mode ? 1 : 0;
    if ((history.state as { depth?: number } | null)?.depth !== depth) {
      history.pushState({ depth }, "");
    }
  }, [mode, practice]);

  const { roots, byId } = useMemo(() => {
    if (!rows) return { roots: [] as OpeningNode[], byId: new Map() };
    const r = buildTree(rows);
    return { roots: r, byId: indexById(r) };
  }, [rows]);

  const position = useMemo(
    () => (selected ? replay(selected.moves) : null),
    [selected]
  );

  // 선택이 바뀌면 통계를 다시 부른다. 300ms 안에 또 바뀌면 앞 요청은 버린다.
  useEffect(() => {
    if (!position) return;
    let alive = true;
    setStats(null);
    setStatsError(null);
    setLoadingStats(true);

    const timer = setTimeout(() => {
      fetchExplorer(position.fen, explorerOptions)
        .then((r) => {
          if (!alive) return;
          setStats(r);
          setLoadingStats(false);
          rememberCounts(selected?.id ?? "", r);
        })
        .catch(
          (e: Error) => alive && (setStatsError(e.message), setLoadingStats(false))
        );
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [position, explorerOptions]);

  function rememberCounts(id: string, r: ExplorerResult) {
    const rec: Record<string, number> = {};
    for (const m of r.moves) rec[m.san] = m.white + m.draws + m.black;
    setMoveCounts((prev) => new Map(prev).set(id, rec));
  }

  /** 펼칠 때 그 국면의 통계를 미리 받아 자식 순서를 정한다. */
  function ensureCounts(node: OpeningNode | null) {
    const id = node?.id ?? "";
    if (moveCounts.has(id)) return;
    const fen = node ? replay(node.moves).fen : new Chess().fen();
    fetchExplorer(fen, explorerOptions)
      .then((r) => rememberCounts(id, r))
      .catch(() => {
        /* 통계가 없으면 하위 변화 개수 순으로 놓는다 */
      });
  }

  // 첫 화면의 루트 순서를 위해 초기 국면 통계를 한 번 받는다.
  useEffect(() => {
    if (rows) ensureCounts(null);
  }, [rows, explorerOptions]);

  function select(node: OpeningNode) {
    setSelected(node);
    setViewPly(node.moves.length); // 새로 고르면 일단 마지막 수까지 보여준다
    // 선택한 노드까지의 조상을 모두 펼친다.
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestorsOf(node, byId).forEach((a) => next.add(a.id));
      return next;
    });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        ensureCounts(byId.get(id) ?? null);
      }
      return next;
    });
  }

  useEffect(() => {
    setMoveCounts(new Map());
  }, [band]);

  function addLine(side: "w" | "b") {
    if (!selected || !position) return;
    const next = ingestLine(repertoire, position.fens, selected.moves, side);
    setRepertoire(next);
    void saveRepertoire(next);
  }

  if (!rows) {
    return (
      <div className="boot">
        <p className="eyebrow">오프닝 데이터를 여는 중</p>
      </div>
    );
  }

  if (!mode) {
    return <ModeSelect onSelect={setMode} />;
  }

  if (mode === "review") {
    return <GameReview byId={byId} onHome={() => setMode(null)} />;
  }

  if (practice && selected) {
    return (
      <PracticeMode
        opening={selected}
        side={practice}
        repertoire={repertoire}
        setRepertoire={setRepertoire}
        explorerOptions={explorerOptions}
        onExit={() => setPractice(null)}
      />
    );
  }

  return (
    <div className="app">
      <OpeningTree
        roots={roots}
        allRows={rows}
        byId={byId}
        selectedId={selected?.id ?? null}
        expanded={expanded}
        moveCounts={moveCounts}
        mode={mode}
        favorites={favorites}
        onToggle={toggle}
        onSelect={select}
        onToggleFavorite={toggleFav}
        onHome={() => setMode(null)}
      />

      <main className="main">
        {!hasLichessToken() && (
          <div className="banner">
            <strong>오프닝 통계가 꺼져 있습니다.</strong> Lichess 익스플로러는
            2026년부터 인증을 요구합니다.{" "}
            <a
              href="https://lichess.org/account/oauth/token/create"
              target="_blank"
              rel="noreferrer"
            >
              토큰을 발급받아
            </a>{" "}
            <code>.env</code> 에 <code>LICHESS_TOKEN=</code> 으로 넣고 서버를
            다시 시작하세요. 권한은 아무것도 선택하지 않아도 됩니다.
          </div>
        )}
        {selected && position ? (
          <div className="split">
            <div className="board-col">
              <div className="board-frame" ref={board.ref}>
                <Chessboard
                  position={viewPly < selected.moves.length ? position.fens[viewPly] : position.fen}
                  boardWidth={board.width}
                  arePiecesDraggable={false}
                  customBoardStyle={{ borderRadius: 0 }}
                  customDarkSquareStyle={{ backgroundColor: "#4E5B4C" }}
                  customLightSquareStyle={{ backgroundColor: "#D7CFB8" }}
                  animationDuration={180}
                />
              </div>

              <div className="actions">
                <button className="btn" onClick={() => setViewPly(0)} disabled={viewPly === 0}>
                  처음
                </button>
                <button
                  className="btn"
                  onClick={() => setViewPly((p) => Math.max(0, p - 1))}
                  disabled={viewPly === 0}
                >
                  ◂ 이전
                </button>
                <button
                  className="btn"
                  onClick={() => setViewPly((p) => Math.min(selected.moves.length, p + 1))}
                  disabled={viewPly === selected.moves.length}
                >
                  다음 ▸
                </button>
                <button
                  className="btn"
                  onClick={() => setViewPly(selected.moves.length)}
                  disabled={viewPly === selected.moves.length}
                >
                  마지막
                </button>
              </div>

              <div className="field">
                <label className="eyebrow" htmlFor="band">
                  통계 기준 레이팅
                </label>
                <select
                  id="band"
                  value={band}
                  onChange={(e) => setBand(Number(e.target.value))}
                >
                  {RATING_BANDS.map((b, i) => (
                    <option key={b.label} value={i}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <OpeningPanel
              node={selected}
              ancestors={ancestorsOf(selected, byId)}
              stats={stats}
              statsError={statsError}
              loading={loadingStats}
              sideToMove={position.turn}
              childCounts={moveCounts.get(selected.id)}
              mode={mode}
              favorites={favorites}
              onSelect={select}
              onPractice={setPractice}
              onAddToRepertoire={addLine}
              onSwitchToPractice={() => setMode("practice")}
              onToggleFavorite={toggleFav}
            />
          </div>
        ) : (
          <div className="welcome">
            <p className="eyebrow">오프닝 트레이너</p>
            <h1>
              왼쪽에서 오프닝을 고르면
              <br />
              정석 수순과 실전 통계를 보여줍니다.
            </h1>
            <p className="lede">
              {rows.length.toLocaleString()}개 오프닝을 수순 순서대로 정리했습니다.
              변화를 펼쳐 가며 어디로 갈라지는지 보고, 마음에 드는 라인을 골라
              바로 연습을 시작하세요. 연습에서 상대는 실제 대국에서 그 수가
              나오는 빈도대로 둡니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
