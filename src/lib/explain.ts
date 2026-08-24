import { dbGet, dbSet, STORE_IDEAS } from "./db";
import { hasGeminiKey } from "./env";

export const explainAvailable = hasGeminiKey;

const GEMINI_MODEL = "gemini-3.7-flash";

const explainKey = (fenBefore: string, playedSan: string, betterSan: string) =>
  `mistake|${fenBefore}|${playedSan}|${betterSan}`;

/** 실수/블런더 수를 왜 나쁜 수였는지, 더 좋은 수는 왜 좋은지 자연어로 설명한다. */
export async function explainMistake(
  movesSoFar: string[], // 이 수 직전까지의 SAN 목록
  playedSan: string,
  betterSan: string,
  lossCp: number,
  fenBefore: string
): Promise<string> {
  const key = explainKey(fenBefore, playedSan, betterSan);
  const cached = await dbGet<string>(STORE_IDEAS, key);
  if (cached) return cached;

  const pgn = movesSoFar
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
    .join(" ");

  const prompt = `체스 대국입니다. 지금까지 수순: ${pgn || "(첫 수)"}

이 국면에서 ${playedSan} 를 뒀는데, 엔진 분석으로는 ${betterSan} 가 약 ${(
    lossCp / 100
  ).toFixed(1)}폰 더 좋은 수였습니다.

한국어 2~3문장으로, 초보자도 이해할 수 있게 다음을 설명해 주세요:
- ${playedSan} 가 왜 아쉬운 수인지 (놓친 위협, 약해진 자리, 빗나간 계획 등)
- ${betterSan} 가 그 국면에서 왜 더 좋은지

체스 좌표(FEN)를 그대로 언급하지 말고, 머리말이나 목록 없이 문단으로만 답하세요.`;

  const res = await fetch(
    `/api/gemini/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) throw new Error(`설명을 불러오지 못했습니다 (${res.status})`);
  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!text) throw new Error("설명이 비어 있습니다");
  await dbSet(STORE_IDEAS, key, text);
  return text;
}
