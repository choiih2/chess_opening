// Gemini API 로 텍스트 하나를 생성하는 공용 헬퍼. explain.ts(실수 설명)와
// ideas.ts(핵심 아이디어 요약)가 함께 쓴다.
import { hasGeminiKey } from "./env";

export const geminiAvailable = hasGeminiKey;

const GEMINI_MODEL = "gemini-3.7-flash";

export async function generateText(prompt: string, label = "응답"): Promise<string> {
  const res = await fetch(
    `/api/gemini/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) throw new Error(`${label}을 불러오지 못했습니다 (${res.status})`);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error(`${label}이 비어 있습니다`);
  return text;
}
