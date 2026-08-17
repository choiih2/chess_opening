import { dbGet, dbSet, STORE_IDEAS } from "./db";
import { ExplorerResult, scoreFor, total } from "./explorer";

import { hasAnthropicKey } from "./env";

export const ideasEnabled = hasAnthropicKey;

export async function fetchIdea(
  eco: string,
  name: string,
  moves: string[],
  stats: ExplorerResult | null,
  sideToMove: "w" | "b"
): Promise<string> {
  const key = `${eco}|${moves.join(" ")}`;
  const cached = await dbGet<string>(STORE_IDEAS, key);
  if (cached) return cached;

  const topMoves = (stats?.moves ?? [])
    .slice(0, 5)
    .map(
      (m) =>
        `${m.san}: ${((total(m) / (stats ? total(stats) : 1)) * 100).toFixed(
          0
        )}% 선택, 두는 쪽 승률 ${scoreFor(m, sideToMove).toFixed(0)}%`
    )
    .join("\n");

  const prompt = `체스 오프닝 "${name}" (ECO ${eco})를 공부하는 사람에게 설명해 주세요.

수순: ${moves.join(" ")}
${topMoves ? `\n이 국면에서 실전 통계:\n${topMoves}` : ""}

한국어 3~4문장으로, 다음을 담아 주세요:
- 이 오프닝으로 각 진영이 노리는 것 (중앙, 말 배치, 폰 구조)
- 초보자가 흔히 저지르는 실수 하나
- 통계가 주어졌다면 그 수치가 실전에서 뜻하는 바

머리말이나 목록 없이 문단 형태로만 답하세요.`;

  const res = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`요약을 불러오지 못했습니다 (${res.status})`);
  const data = await res.json();
  const text: string = (data.content ?? [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("요약이 비어 있습니다");
  await dbSet(STORE_IDEAS, key, text);
  return text;
}
