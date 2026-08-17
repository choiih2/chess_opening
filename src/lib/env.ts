declare const __HAS_API_KEY__: boolean;
declare const __HAS_LICHESS_TOKEN__: boolean;

/** .env 에 ANTHROPIC_API_KEY 가 있으면 "핵심 아이디어" 섹션이 켜진다. */
export const hasAnthropicKey = () => __HAS_API_KEY__;

/** .env 에 LICHESS_TOKEN 이 있으면 오프닝 통계를 받을 수 있다. */
export const hasLichessToken = () => __HAS_LICHESS_TOKEN__;
