# 오프닝 트레이너

3단계 범위(오프닝 브라우저 + 랜덤 연습 모드)를 구현한 프로젝트입니다.
1·2단계 중 3단계가 의존하는 부분(레퍼토리 저장, 약점 기록)도 최소 형태로 들어 있습니다.

## 실행

```bash
npm install
npm run dev
```

`npm run dev`가 먼저 `scripts/build-openings.mjs`를 돌려 lichess-org/chess-openings의
TSV 5개를 받아 `src/data/openings.json`(3,810개, 약 500KB)을 만듭니다.
이미 있으면 건너뜁니다. 새로 받으려면 `node scripts/build-openings.mjs --force`.

### 토큰 설정

```bash
cp .env.example .env
```

**LICHESS_TOKEN (필수)** — Lichess 오프닝 익스플로러는 2026년 DDoS 대응으로
인증을 요구하게 바뀌었습니다. 토큰이 없으면 통계가 401로 실패하고 연습 모드도
상대 수를 고르지 못합니다. <https://lichess.org/account/oauth/token/create> 에서
이름만 적고 만들면 됩니다. 권한은 하나도 체크할 필요가 없습니다.

**ANTHROPIC_API_KEY (선택)** — "핵심 아이디어" 요약용. 없으면 그 섹션만 숨습니다.

두 값 모두 Vite 개발 서버가 프록시하면서 헤더로 붙이므로 **브라우저 번들에
들어가지 않습니다**(`vite.config.ts`의 `server.proxy`). 정적 호스팅으로 배포할
때는 이 프록시가 사라지므로, 서버리스 함수 하나를 두고 `/api/*`를 넘기면 됩니다.

## 구조

```
scripts/build-openings.mjs   TSV → openings.json 변환
src/lib/openingTree.ts       수순 접두사로 트리 구성, 검색, 정렬
src/lib/i18n.ts              오프닝 이름 한글 변환
src/lib/env.ts               .env 플래그
src/lib/explorer.ts          Lichess Explorer 클라이언트 (순차 큐 + IndexedDB 캐시)
src/lib/practice.ts          상대 수 선택 알고리즘 4종
src/lib/repertoire.ts        레퍼토리 / 약점 목록 저장
src/lib/ideas.ts             Claude API 요약 + 캐싱
src/lib/db.ts                IndexedDB 래퍼 (의존성 없음)
src/components/              트리, 상세 패널, 연습 모드, 승패 막대
```

## 설계 메모

**트리는 이름이 아니라 수순으로 만듭니다.** 각 오프닝을 "자기보다 짧은 접두사 중
가장 긴 것"에 붙이므로, 이름 규칙과 무관하게 실제 갈래대로 계층이 생깁니다.
Ruy Lopez는 하위 18개, 가장 깊은 라인은 36수(Marshall Attack, Spassky Variation)입니다.

**상대 수는 실전 빈도를 가중치로 씁니다.** 균등 랜덤은 3수 만에 실전에 없는 국면으로
빠져서 연습이 안 됩니다. 1.e4 이후 흑의 응수 분포로 각 모드를 비교하면:

| 모드 | 분포 |
|---|---|
| 실전 빈도 | c5 41% · e5 26% · e6 12% · c6 9% · … |
| 메인라인 | c5 100% |
| 함정 대비 | 표본 20판 미만 제외, 상대 승률을 4제곱으로 강조 |
| 완전 랜덤 | 상위 5수 균등 20%씩 |

표본이 50판 미만이면 북 이탈로 보고 세션을 끝냅니다(`MIN_GAMES`).

**이름은 구절 사전으로 한글화합니다.** 3,810개를 손으로 옮길 수는 없으니
"Ruy Lopez → 루이 로페즈" 같은 구절 90여 개를 먼저 치환하고, 남은 낱말을
낱말 사전 200여 개로 바꿉니다. 구조어(Defense/Variation/Gambit …)는 전부
덮이므로 흔한 오프닝은 완전히 한글로 나오고, 드문 고유명사만 영문으로 남습니다.
원문 이름은 제목 아래에 작게 함께 보여주고 검색도 한글·영문 양쪽으로 됩니다.

**트리 순서는 실전 빈도를 따릅니다.** 노드를 펼칠 때 그 국면의 통계를 받아
자식을 대국 수 순으로 놓습니다. 통계가 아직 없으면 "이름 붙은 하위 변화 개수"를
대용으로 씁니다 — 많이 연구된 오프닝일수록 변화가 많이 등재돼 있기 때문입니다.

**API 호출은 아끼도록 짜여 있습니다.** Explorer 응답은 FEN + 레이팅대 + 시간제한을
키로 IndexedDB에 저장하고, 요청은 300ms 간격 단일 큐로만 나갑니다(병렬 호출은 429).
트리를 빠르게 클릭해도 마지막 선택 하나만 요청합니다.

## 아직 안 된 것

- **Chess.com 기보 연동(2단계)** — 프록시는 이미 뚫어 뒀습니다.
  `/api/chesscom/pub/player/{아이디}/games/archives` 로 월별 URL 목록을 받고
  각 월을 순차 호출하면 됩니다. 프록시를 거치므로 CORS 문제가 없습니다.
- **간격 반복(4단계)** — 약점 목록에 `misses`와 `lastSeen`이 이미 쌓이므로
  SM-2나 FSRS를 얹을 자리는 마련돼 있습니다.
- **Stockfish 평가(5단계)**
