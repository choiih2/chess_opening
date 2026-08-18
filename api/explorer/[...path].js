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
  // req.query.path 는 Vercel 라우팅에서 간헐적으로 비게 나와, req.url 의 경로를
  // 직접 잘라 쓴다 (경로가 비면 도메인 루트로 가서 사람용 분석 페이지로 리다이렉트된다).
  const { pathname, search } = new URL(req.url, "http://internal");
  const path = pathname.replace(/^\/api\/explorer\//, "");
  const target = `https://explorer.lichess.ovh/${path}${search}`;

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
