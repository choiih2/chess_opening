// Chess.com 공개 데이터 API. 인증은 필요 없고 CORS 회피용으로만 거친다.
export default async function handler(req, res) {
  // req.query.path 는 Vercel 라우팅에서 간헐적으로 비게 나와, req.url 의 경로를 직접 잘라 쓴다.
  const { pathname, search } = new URL(req.url, "http://internal");
  const path = pathname.replace(/^\/api\/chesscom\//, "");

  try {
    const upstream = await fetch(`https://api.chess.com/${path}${search}`, {
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
