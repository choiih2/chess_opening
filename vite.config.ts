import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 외부 API 를 개발 서버가 대신 호출한다.
// 토큰과 키가 브라우저 번들에 들어가지 않고, CORS 도 신경 쓸 필요가 없다.
//
//   LICHESS_TOKEN   오프닝 통계용. 2026년부터 Lichess 익스플로러는 인증을 요구한다.
//   GEMINI_API_KEY  "핵심 아이디어" 요약과 복기 모드 실수 설명용. 없으면 그 섹션만 숨는다.
export default defineConfig(({ mode }) => {
  // .env 파일과 실제 환경변수를 모두 본다.
  // 로컬에서는 .env 가, Vercel 에서는 대시보드에 넣은 환경변수가 잡힌다.
  const env = loadEnv(mode, process.cwd(), "");
  const lichessToken = env.LICHESS_TOKEN || process.env.LICHESS_TOKEN;
  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  const proxy: Record<string, unknown> = {
    "/api/explorer": {
      target: "https://explorer.lichess.ovh",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/explorer/, ""),
      configure: (proxy: any) => {
        proxy.on("proxyReq", (req: any) => {
          if (lichessToken) {
            req.setHeader("Authorization", `Bearer ${lichessToken}`);
          }
        });
      },
    },
    // Chess.com 공개 API. 브라우저에서 직접 부르면 CORS 로 막힐 수 있어 함께 태운다.
    "/api/chesscom": {
      target: "https://api.chess.com",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/chesscom/, ""),
    },
  };

  if (geminiKey) {
    proxy["/api/gemini"] = {
      target: "https://generativelanguage.googleapis.com",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/gemini/, ""),
      configure: (proxy: any) => {
        proxy.on("proxyReq", (req: any) => {
          req.setHeader("x-goog-api-key", geminiKey);
        });
      },
    };
  }

  return {
    plugins: [react()],
    define: {
      __HAS_LICHESS_TOKEN__: JSON.stringify(Boolean(lichessToken)),
      __HAS_GEMINI_KEY__: JSON.stringify(Boolean(geminiKey)),
    },
    server: { proxy: proxy as any },
  };
});
