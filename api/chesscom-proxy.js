// Chess.com 공개 데이터 API. 인증은 필요 없고 CORS 회피용으로만 거친다.
//
// vercel.json 의 rewrite 가 /api/chesscom/(.*) 를 여기로 보내면서 잡힌 경로를
// ?path= 쿼리로 넘긴다. Vercel 의 [...path].js 자동 catch-all 라우팅이 세그먼트
// 2개 이상인 경로(예: pub/player/x/games/archives)를 못 잡는 문제가 있어,
// 파일명 기반 동적 라우팅 대신 명시적 rewrite 로 우회한다.
export default async function handler(req, res) {
  const { search } = new URL(req.url, "http://internal");
  const params = new URLSearchParams(search);
  const path = params.get("path") ?? "";
  params.delete("path");
  const qs = params.toString();

  try {
    const upstream = await fetch(`https://api.chess.com/${path}${qs ? `?${qs}` : ""}`, {
      headers: { "User-Agent": "chess-opening-trainer (personal study app)" },
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // 이번 달 대국 목록처럼 계속 바뀌는 응답이 CDN 에 오래 눌러앉지 않도록 캐싱하지 않는다.
    // (지난 달처럼 안 바뀌는 데이터의 캐싱은 클라이언트 쪽 IndexedDB 가 이미 맡고 있다.)
    res.setHeader("Cache-Control", "no-store");
    return res.send(body);
  } catch (e) {
    return res.status(502).json({ error: `Chess.com 연결 실패: ${e.message}` });
  }
}
