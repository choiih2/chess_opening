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
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    return res.send(body);
  } catch (e) {
    return res.status(502).json({ error: `Chess.com 연결 실패: ${e.message}` });
  }
}
