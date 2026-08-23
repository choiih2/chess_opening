// openings.json 에 있는 오프닝 3,810개를 Lichess Explorer 실전 통계로 전부 조회해
// 대국 수 기준 상위 150개를 뽑는다. 결과는 src/data/top-openings.json 에 저장한다.
//
// 앱 자체가 아니라 콘텐츠 준비용 1회성 스크립트라, 프로젝트 규칙대로 Explorer 호출을
// 300ms 간격 단일 큐로 보낸다 (병렬 호출은 429). 3,810개 x 0.3초 ≈ 19분 걸린다.
//
// 실행: node scripts/rank-openings-by-frequency.mjs

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OPENINGS_PATH = resolve(ROOT, "src/data/openings.json");
const CANDIDATES_PATH = resolve(ROOT, "src/data/.candidates.json");
const OUT_PATH = resolve(ROOT, "src/data/top-openings.json");
const CACHE_PATH = resolve(ROOT, "src/data/.frequency-cache.json");
const TOP_N = 150;
const GAP_MS = 600; // 넉넉하게 잡아 레이트리밋을 덜 건드린다.

// 전체를 한 번에 돌리면 오래 걸려 백그라운드 프로세스가 멈추는 걸로 보이는 환경이 있어,
// --start/--count 로 구간을 잘라 여러 번 실행할 수 있게 한다. 중간 결과는 캐시 파일에
// 이어붙이고, 인자 없이 실행하면 캐시를 모아 상위 150개를 뽑아 최종 파일을 만든다.
function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => a.replace(/^--/, "").split("="))
  );
  return {
    start: args.start ? Number(args.start) : 0,
    count: args.count ? Number(args.count) : Infinity,
    finalize: "finalize" in args,
    prepareCandidates: args["prepare-candidates"] ? Number(args["prepare-candidates"]) : null,
  };
}

/**
 * openingTree.ts 의 buildTree 와 같은 방식(수순 접두사 트리)으로 "하위 변화 개수"를
 * 오프라인으로 계산한다. 네트워크 없이 순위를 대강 매겨 후보를 추릴 때 쓴다.
 */
function computeDescendants(rows) {
  const sorted = [...rows].sort((a, b) => a.moves.length - b.moves.length);
  const byId = new Map();
  const roots = [];
  for (const row of sorted) {
    const id = row.moves.join(" ");
    const node = { ...row, id, children: [], descendants: 0 };
    let parent = null;
    for (let i = row.moves.length - 1; i >= 1; i--) {
      const cand = byId.get(row.moves.slice(0, i).join(" "));
      if (cand) {
        parent = cand;
        break;
      }
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
    byId.set(id, node);
  }
  const count = (n) => {
    n.descendants = n.children.reduce((a, c) => a + count(c) + 1, 0);
    return n.descendants;
  };
  roots.forEach(count);
  return [...byId.values()];
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function saveCache(list) {
  await writeFile(CACHE_PATH, JSON.stringify(list));
}

async function loadEnvToken() {
  try {
    const text = await readFile(resolve(ROOT, ".env"), "utf8");
    const m = text.match(/^LICHESS_TOKEN=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function fenOf(moves) {
  const g = new Chess();
  for (const m of moves) {
    try {
      g.move(m);
    } catch {
      return null; // 데이터에 이상한 수가 섞여 있으면 건너뛴다.
    }
  }
  return g.fen();
}

const MAX_ATTEMPTS = 5;

async function fetchTotalGames(fen, token, attempt = 0) {
  const url = new URL("https://explorer.lichess.ovh/lichess");
  url.searchParams.set("variant", "standard");
  url.searchParams.set("fen", fen);
  url.searchParams.set("ratings", "1000,1200,1400,1600,1800,2000,2200,2500");
  url.searchParams.set("speeds", "blitz,rapid");
  url.searchParams.set("topGames", "0");
  url.searchParams.set("recentGames", "0");
  url.searchParams.set("moves", "0");

  const retry = async (reason) => {
    if (attempt >= MAX_ATTEMPTS - 1) throw new Error(`${reason} (${attempt + 1}회 시도 후 포기)`);
    // 지수 백오프: 1초, 2초, 4초, 8초 ... 일시적인 레이트리밋/오류가 가라앉을 시간을 준다.
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return fetchTotalGames(fen, token, attempt + 1);
  };

  // fetch 는 서버가 응답을 안 주면 그냥 무기한 걸려 있을 수 있어, 직접 타임아웃을 건다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
  } catch (e) {
    return retry(`fetch 실패: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429 || res.status >= 500) {
    return retry(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // 가끔 200 인데도 HTML 오류 페이지(레이트리밋 안내 등)가 오는 경우가 있어,
  // JSON 파싱 실패도 재시도 대상으로 다룬다.
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return retry(`JSON 파싱 실패: ${text.slice(0, 40).replace(/\s+/g, " ")}`);
  }
  return (data.white ?? 0) + (data.draws ?? 0) + (data.black ?? 0);
}

async function main() {
  const { start, count, finalize, prepareCandidates } = parseArgs();
  const allRows = JSON.parse(await readFile(OPENINGS_PATH, "utf8"));

  if (prepareCandidates) {
    const withDescendants = computeDescendants(allRows);
    withDescendants.sort((a, b) => b.descendants - a.descendants);
    const picked = withDescendants
      .slice(0, prepareCandidates)
      .map((n) => ({ eco: n.eco, name: n.name, moves: n.moves }));
    await writeFile(CANDIDATES_PATH, JSON.stringify(picked));
    console.log(
      `하위 변화 개수 기준으로 후보 ${picked.length}개를 추렸습니다 (네트워크 호출 없음). ` +
        `${CANDIDATES_PATH} 에 저장. 이제 --start/--count 로 이 후보만 조회합니다.`
    );
    return;
  }

  // 후보를 미리 추려 뒀으면 그것만, 아니면 전체를 대상으로 조회한다.
  let rows = allRows;
  try {
    rows = JSON.parse(await readFile(CANDIDATES_PATH, "utf8"));
  } catch {
    /* 후보 파일이 없으면 전체 목록 사용 */
  }

  if (finalize) {
    const cached = await loadCache();
    // 청크 구간이 겹쳤을 수 있어 eco+수순 키로 중복을 제거한다.
    const byKey = new Map();
    for (const r of cached) byKey.set(`${r.eco}|${r.moves.join(" ")}`, r);
    const deduped = [...byKey.values()];
    deduped.sort((a, b) => b.games - a.games);
    const top = deduped.slice(0, TOP_N);
    await writeFile(OUT_PATH, JSON.stringify(top, null, 2) + "\n");
    console.log(
      `완료. 캐시 ${cached.length}건(중복 제거 후 ${deduped.length}건) 중 상위 ${top.length}개를 ${OUT_PATH} 에 저장했습니다.`
    );
    console.log(`1위: ${top[0]?.name} (${top[0]?.games.toLocaleString()}판)`);
    console.log(`150위: ${top[top.length - 1]?.name} (${top[top.length - 1]?.games.toLocaleString()}판)`);
    return;
  }

  const token = await loadEnvToken();
  if (!token) {
    console.error(".env 에 LICHESS_TOKEN 이 없습니다. 먼저 채워 넣으세요.");
    process.exit(1);
  }

  const slice = rows.slice(start, start + count);
  console.log(
    `${start}~${start + slice.length - 1} (${slice.length}개) 조회 시작. 약 ${Math.ceil(
      (slice.length * GAP_MS) / 60000
    )}분 예상.`
  );

  const results = await loadCache();
  let done = 0;
  let errors = 0;

  for (const row of slice) {
    const fen = fenOf(row.moves);
    if (fen) {
      try {
        const games = await fetchTotalGames(fen, token);
        results.push({ eco: row.eco, name: row.name, moves: row.moves, games });
      } catch (e) {
        errors++;
        console.error(`실패: ${row.eco} ${row.name} — ${e.message}`);
      }
    }
    done++;
    if (done % 50 === 0) {
      await saveCache(results); // 도중에 끊겨도 여기까지는 남는다.
      console.log(`${done}/${slice.length} (실패 ${errors}건, 누적 캐시 ${results.length}건)`);
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  await saveCache(results);
  console.log(`이 구간 완료. 누적 캐시 ${results.length}건. (--finalize 로 최종 파일 생성)`);
}

main();
