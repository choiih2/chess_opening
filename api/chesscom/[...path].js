// Chess.com 공개 데이터 API. 인증은 필요 없고 CORS 회피용으로만 거친다.
export default async function handler(req, res) {
  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path ?? "";
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";

  try {
    const upstream = await fetch(`https://api.chess.com/${path}${qs}`, {
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
