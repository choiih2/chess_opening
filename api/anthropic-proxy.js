// "핵심 아이디어" 요약용. 키가 없으면 501 을 돌려주고 앱은 그 섹션을 숨긴다.
//
// vercel.json 의 rewrite 가 /api/anthropic/(.*) 를 여기로 보내면서 잡힌 경로를
// ?path= 쿼리로 넘긴다. Vercel 의 [...path].js 자동 catch-all 라우팅이 세그먼트
// 2개 이상인 경로(v1/messages)를 못 잡는 문제가 있어, 파일명 기반 동적 라우팅
// 대신 명시적 rewrite 로 우회한다.
export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(501).json({ error: "요약 기능이 꺼져 있습니다." });
  }

  const { search } = new URL(req.url, "http://internal");
  const params = new URLSearchParams(search);
  const path = params.get("path") ?? "";

  try {
    const upstream = await fetch(`https://api.anthropic.com/${path}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(body);
  } catch (e) {
    return res.status(502).json({ error: `요약 서버 연결 실패: ${e.message}` });
  }
}
