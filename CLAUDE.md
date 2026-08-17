# 오프닝 트레이너

체스 오프닝을 실전 통계로 익히는 개인용 웹앱. React + Vite + TypeScript.

## 실행

```
npm run dev              # openings.json 자동 생성 후 vite 실행
npm run dev -- --host    # 같은 Wi-Fi 의 휴대폰에서 접속할 때
```

## 구조

- `scripts/build-openings.mjs` — lichess TSV 를 `src/data/openings.json` 으로 변환
- `src/lib/openingTree.ts` — 수순 접두사로 트리 구성, 검색, 정렬
- `src/lib/explorer.ts` — Lichess 익스플로러 클라이언트
- `src/lib/practice.ts` — 상대 수 선택 알고리즘, 힌트 판정
- `src/lib/i18n.ts` — 오프닝 이름 한글 변환 사전
- `api/*/[...path].js` — Vercel 배포용 서버리스 프록시

## 반드시 지킬 것

- **Lichess 익스플로러는 인증 필수.** 2026년부터 401 을 준다.
  토큰은 개발 중에는 vite 프록시가, 배포 후에는 `api/explorer` 함수가 붙인다.
  절대 클라이언트 코드에 토큰을 넣지 말 것.
- **Explorer 호출은 300ms 간격 단일 큐.** 병렬로 부르면 429 가 난다.
- **응답은 FEN + 레이팅대 + 시간제한을 키로 IndexedDB 캐싱.** 같은 국면을 두 번 부르지 않는다.
- **localStorage 말고 IndexedDB.** 래퍼는 `src/lib/db.ts` 에 있다.
- **`npm audit fix --force` 금지.** Vite 를 메이저 단위로 갈아치워 빌드가 깨진다.

## 스타일

- 주석과 UI 문구는 한국어. 변수·함수명은 영어.
- 색과 서체는 `src/styles.css` 상단의 CSS 변수만 사용.
- 새 의존성은 꼭 필요할 때만. 현재 런타임 의존성은 react, chess.js, react-chessboard 뿐이다.

## 아직 안 된 것

- Chess.com 기보 연동 (프록시는 `api/chesscom` 에 준비됨)
- 간격 반복 복습 (약점 목록에 misses, lastSeen 이 이미 쌓임)
- Stockfish 엔진 평가
