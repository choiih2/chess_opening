// lichess-org/chess-openings 의 a.tsv ~ e.tsv 를 받아 src/data/openings.json 생성.
// 컬럼은 eco, name, pgn 3개뿐이다 (uci 는 dist/ 에 따로 있으므로 여기서는 쓰지 않는다).
// 파일이 이미 있으면 다시 받지 않는다. 강제로 새로 받으려면: node scripts/build-openings.mjs --force

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/data/openings.json");
const BASE =
  "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"];

const exists = (p) => access(p).then(() => true, () => false);

/** "1. e4 e5 2. Nf3" -> ["e4","e5","Nf3"] */
function pgnToMoves(pgn) {
  return pgn
    .replace(/\d+\.(\.\.)?/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

async function main() {
  const force = process.argv.includes("--force");
  if (!force && (await exists(OUT))) {
    console.log("openings.json 이미 있음. 건너뜀 (--force 로 새로 받기)");
    return;
  }

  const rows = [];
  for (const f of FILES) {
    const res = await fetch(`${BASE}/${f}`);
    if (!res.ok) throw new Error(`${f} 다운로드 실패: HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split("\n").slice(1); // 헤더 제거
    for (const line of lines) {
      if (!line.trim()) continue;
      const [eco, name, pgn] = line.split("\t");
      if (!eco || !name || !pgn) continue;
      rows.push({ eco, name: name.trim(), moves: pgnToMoves(pgn) });
    }
    console.log(`${f}: ${lines.length - 1}행`);
  }

  // 같은 수순이 중복될 수 있으므로 수순 문자열 기준 중복 제거
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    const key = r.moves.join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(r);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(uniq), "utf8");
  console.log(`총 ${uniq.length}개 오프닝 -> src/data/openings.json`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
