// node_modules 에 설치된 stockfish 엔진 파일을 public/stockfish/ 로 복사한다.
// Worker 로 로드하려면 정적 URL 로 서빙돼야 하는데 node_modules 안의 파일은
// Vite 개발 서버가 그대로 주지 않는다. lite/single-thread 빌드를 쓰므로
// COOP/COEP 헤더 없이도 모든 브라우저에서 돌아간다 (~7MB, 최초 1회만 받는다).

import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "node_modules/stockfish/bin");
const OUT = resolve(ROOT, "public/stockfish");
const FILES = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  if (!(await exists(SRC))) {
    console.error(
      "node_modules/stockfish 를 찾을 수 없습니다. `npm install` 을 먼저 실행하세요."
    );
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  for (const f of FILES) {
    const dst = resolve(OUT, f);
    if (await exists(dst)) continue;
    await copyFile(resolve(SRC, f), dst);
    console.log(`엔진 파일 복사: ${f}`);
  }
}

main();
