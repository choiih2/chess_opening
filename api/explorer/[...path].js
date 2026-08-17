// Vercel 서버리스 함수. 개발 서버의 vite 프록시와 같은 일을 배포 환경에서 한다.
// 토큰은 Vercel 대시보드의 환경 변수(LICHESS_TOKEN)에서 읽으므로
// 브라우저로 내려가는 코드에는 들어가지 않는다.
export default async function handler(req, res) {
  const token = process.env.LICHESS_TOKEN;
  if (!token) {
    return res
      .status(500)
      .json({ error: "LICHESS_TOKEN 환경 변수가 설정되지 않았습니다." });
  }

  // /api/explorer/lichess?fen=... -> https://explorer.lichess.ovh/lichess?fen=...
  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path ?? "";
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = `https://explorer.lichess.ovh/${path}${qs}`;

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await upstream.text();

    // 같은 국면은 계속 같은 답이 오므로 CDN 에 하루 재워 둔다.
    if (upstream.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=3600");
    }
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(body);
  } catch (e) {
    return res.status(502).json({ error: `익스플로러 연결 실패: ${e.message}` });
  }
}
