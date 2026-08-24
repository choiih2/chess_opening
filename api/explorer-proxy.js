// Vercel 서버리스 함수. 개발 서버의 vite 프록시와 같은 일을 배포 환경에서 한다.
// 토큰은 Vercel 대시보드의 환경 변수(LICHESS_TOKEN)에서 읽으므로
// 브라우저로 내려가는 코드에는 들어가지 않는다.
//
// vercel.json 의 rewrite 가 /api/explorer/(.*) 를 여기로 보내면서 잡힌 경로를
// ?path= 쿼리로 넘긴다. Vercel 의 [...path].js 자동 catch-all 라우팅이 세그먼트
// 2개 이상인 경로를 못 잡는 문제가 있어, 파일명 기반 동적 라우팅 대신 명시적
// rewrite 로 우회한다.
export default async function handler(req, res) {
  const token = process.env.LICHESS_TOKEN;
  if (!token) {
    return res
      .status(500)
      .json({ error: "LICHESS_TOKEN 환경 변수가 설정되지 않았습니다." });
  }

  const { search } = new URL(req.url, "http://internal");
  const params = new URLSearchParams(search);
  const path = params.get("path") ?? "";
  params.delete("path");
  const qs = params.toString();
  const target = `https://explorer.lichess.ovh/${path}${qs ? `?${qs}` : ""}`;

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
