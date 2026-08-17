// "핵심 아이디어" 요약용. 키가 없으면 501 을 돌려주고 앱은 그 섹션을 숨긴다.
export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(501).json({ error: "요약 기능이 꺼져 있습니다." });
  }

  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path ?? "";

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
