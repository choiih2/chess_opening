// 오프닝 이름을 한글로 옮긴다.
// 이름은 "Ruy Lopez: Berlin Defense, Rio de Janeiro Variation" 처럼
// 콜론과 쉼표로 구획이 나뉜다. 구획마다 긴 구절을 먼저 치환하고,
// 남은 낱말을 낱말 사전으로 바꾼다. 사전에 없는 고유명사는 원문을 남긴다.

/** 여러 낱말로 된 고유 명칭. 긴 것부터 적용된다. */
const PHRASES: [string, string][] = [
  ["King's Indian Defense", "킹스 인디언 방어"],
  ["Queen's Gambit Accepted", "퀸스 갬빗 수락"],
  ["Queen's Gambit Declined", "퀸스 갬빗 거절"],
  ["Queen's Gambit", "퀸스 갬빗"],
  ["King's Gambit Accepted", "킹스 갬빗 수락"],
  ["King's Gambit Declined", "킹스 갬빗 거절"],
  ["King's Gambit", "킹스 갬빗"],
  ["King's Indian Attack", "킹스 인디언 공격"],
  ["Queen's Indian Defense", "퀸스 인디언 방어"],
  ["Nimzo-Indian Defense", "님조 인디언 방어"],
  ["Bogo-Indian Defense", "보고 인디언 방어"],
  ["Old Indian Defense", "올드 인디언 방어"],
  ["Grünfeld Defense", "그륀펠트 방어"],
  ["Gruenfeld Defense", "그륀펠트 방어"],
  ["Sicilian Defense", "시실리안 방어"],
  ["French Defense", "프렌치 방어"],
  ["Caro-Kann Defense", "카로칸 방어"],
  ["Scandinavian Defense", "스칸디나비안 방어"],
  ["Alekhine Defense", "알레힌 방어"],
  ["Pirc Defense", "피르츠 방어"],
  ["Modern Defense", "모던 방어"],
  ["Philidor Defense", "필리도르 방어"],
  ["Petrov's Defense", "페트로프 방어"],
  ["Petroff Defense", "페트로프 방어"],
  ["Russian Game", "러시안 게임"],
  ["Two Knights Defense", "투 나이츠 방어"],
  ["Four Knights Game", "포 나이츠 게임"],
  ["Three Knights Opening", "쓰리 나이츠 오프닝"],
  ["Four Knights Opening", "포 나이츠 오프닝"],
  ["Italian Game", "이탈리안 게임"],
  ["Ruy Lopez", "루이 로페즈"],
  ["Spanish Game", "스페니시 게임"],
  ["Scotch Game", "스카치 게임"],
  ["Scotch Gambit", "스카치 갬빗"],
  ["Vienna Game", "비엔나 게임"],
  ["Vienna Gambit", "비엔나 갬빗"],
  ["Danish Gambit", "데니시 갬빗"],
  ["Evans Gambit", "에반스 갬빗"],
  ["Latvian Gambit", "라트비안 갬빗"],
  ["Elephant Gambit", "엘리펀트 갬빗"],
  ["Englund Gambit", "엥글룬드 갬빗"],
  ["Budapest Defense", "부다페스트 방어"],
  ["Benko Gambit", "벤코 갬빗"],
  ["Volga Gambit", "볼가 갬빗"],
  ["Benoni Defense", "베노니 방어"],
  ["Modern Benoni", "모던 베노니"],
  ["Old Benoni", "올드 베노니"],
  ["Dutch Defense", "더치 방어"],
  ["Slav Defense", "슬라브 방어"],
  ["Semi-Slav Defense", "세미 슬라브 방어"],
  ["Tarrasch Defense", "타라시 방어"],
  ["Chigorin Defense", "치고린 방어"],
  ["Albin Countergambit", "알빈 카운터갬빗"],
  ["Blackmar-Diemer Gambit", "블랙마 디머 갬빗"],
  ["Trompowsky Attack", "트롬포프스키 공격"],
  ["London System", "런던 시스템"],
  ["Colle System", "콜 시스템"],
  ["Torre Attack", "토레 공격"],
  ["Catalan Opening", "카탈란 오프닝"],
  ["English Opening", "잉글리시 오프닝"],
  ["Réti Opening", "레티 오프닝"],
  ["Reti Opening", "레티 오프닝"],
  ["Bird Opening", "버드 오프닝"],
  ["Larsen Opening", "라르센 오프닝"],
  ["Nimzowitsch-Larsen Attack", "님초비치 라르센 공격"],
  ["Nimzowitsch Defense", "님초비치 방어"],
  ["Van Geet Opening", "판 헤이트 오프닝"],
  ["Bongcloud Attack", "봉클라우드 공격"],
  ["Grob Opening", "그로브 오프닝"],
  ["Polish Opening", "폴리시 오프닝"],
  ["Sokolsky Opening", "소콜스키 오프닝"],
  ["Ware Opening", "웨어 오프닝"],
  ["Amar Opening", "아마르 오프닝"],
  ["Anderssen Opening", "안데르센 오프닝"],
  ["Clemenz Opening", "클레멘츠 오프닝"],
  ["Mieses Opening", "미제스 오프닝"],
  ["Saragossa Opening", "사라고사 오프닝"],
  ["Zukertort Opening", "추케르토르트 오프닝"],
  ["King's Pawn Game", "킹스 폰 게임"],
  ["Queen's Pawn Game", "퀸스 폰 게임"],
  ["Horwitz Defense", "호르비츠 방어"],
  ["Rat Defense", "랫 방어"],
  ["Owen Defense", "오웬 방어"],
  ["St. George Defense", "세인트 조지 방어"],
  ["Main Line", "메인라인"],
  ["Rio de Janeiro", "리우데자네이루"],
  ["Open Variation", "오픈 변화"],
  ["Closed Variation", "클로즈드 변화"],
];

/** 낱말 단위 사전. 고유명사는 음차, 일반명사는 번역한다. */
const WORDS: Record<string, string> = {
  // 구조어
  Variation: "변화",
  Variations: "변화",
  Defense: "방어",
  Defence: "방어",
  Attack: "공격",
  Gambit: "갬빗",
  Countergambit: "카운터갬빗",
  Counterattack: "역공",
  Opening: "오프닝",
  Game: "게임",
  System: "시스템",
  Line: "라인",
  Lines: "라인",
  Accepted: "수락",
  Declined: "거절",
  Deferred: "지연",
  Exchange: "교환",
  Advance: "전진",
  Main: "메인",
  Modern: "모던",
  Classical: "클래시컬",
  Normal: "일반형",
  Open: "오픈",
  Closed: "클로즈드",
  Semi_Open: "세미 오픈",
  Symmetrical: "대칭형",
  Asymmetrical: "비대칭형",
  Fianchetto: "피안케토",
  Hyperaccelerated: "초가속",
  Accelerated: "가속",
  Delayed: "지연",
  Early: "조기",
  Late: "후기",
  Quiet: "조용한",
  Wing: "윙",
  Center: "중앙",
  Centre: "중앙",
  Double: "더블",
  Doubled: "더블",
  Reversed: "리버스",
  Inverted: "역형",
  Improved: "개량형",
  Old: "올드",
  New: "뉴",
  Orthodox: "정통형",
  Anti: "안티",
  Pseudo: "의사",
  Neo: "네오",
  Super: "슈퍼",
  Ultra: "울트라",
  Hyper: "하이퍼",
  General: "일반",
  Traditional: "전통형",
  Alternative: "대안",
  Refused: "거절",
  Countergambits: "카운터갬빗",

  // 기물과 수
  Pawn: "폰",
  Pawns: "폰",
  Knight: "나이트",
  Knights: "나이츠",
  Bishop: "비숍",
  "Bishop's": "비숍",
  Rook: "룩",
  Queen: "퀸",
  "Queen's": "퀸스",
  King: "킹",
  "King's": "킹스",
  Two: "투",
  Three: "쓰리",
  Four: "포",
  Five: "파이브",
  Six: "식스",

  // 지역과 국가
  Sicilian: "시실리안",
  French: "프렌치",
  Italian: "이탈리안",
  Spanish: "스페니시",
  English: "잉글리시",
  Indian: "인디언",
  Dutch: "더치",
  Danish: "데니시",
  Polish: "폴리시",
  Russian: "러시안",
  Scotch: "스카치",
  Scandinavian: "스칸디나비안",
  Latvian: "라트비안",
  Icelandic: "아이슬란딕",
  Portuguese: "포르투갈",
  Hungarian: "헝가리안",
  Austrian: "오스트리안",
  Czech: "체코",
  Slav: "슬라브",
  "Semi-Slav": "세미 슬라브",
  Vienna: "비엔나",
  Berlin: "베를린",
  Leningrad: "레닌그라드",
  Stonewall: "스톤월",
  Catalan: "카탈란",
  Benoni: "베노니",
  Benko: "벤코",
  Grünfeld: "그륀펠트",
  Budapest: "부다페스트",
  Bogo: "보고",
  Nimzo: "님조",
  "Nimzo-Indian": "님조 인디언",
  "Caro-Kann": "카로칸",
  London: "런던",
  Colle: "콜",
  Torre: "토레",
  Dragon: "드래곤",
  Najdorf: "나이도르프",
  Scheveningen: "셰베닝겐",
  Sveshnikov: "스베시니코프",
  Taimanov: "타이마노프",
  Kan: "칸",
  Paulsen: "파울센",
  Richter: "리히터",
  Rauzer: "라우저",
  Yugoslav: "유고슬라브",
  Maroczy: "마로치",
  Hedgehog: "헤지호그",
  Alapin: "알라핀",
  Rossolimo: "로솔리모",
  Moscow: "모스크바",
  Smith: "스미스",
  Morra: "모라",
  Grand: "그랜드",
  Prix: "프리",
  Wilkes: "윌크스",
  Barre: "바레",

  // 인명
  Lopez: "로페즈",
  Ruy: "루이",
  Morphy: "모피",
  Steinitz: "슈타이니츠",
  Lasker: "라스커",
  Capablanca: "카파블랑카",
  Alekhine: "알레힌",
  Euwe: "오이베",
  Botvinnik: "보트비닉",
  Smyslov: "스미슬로프",
  Tal: "탈",
  Petrosian: "페트로시안",
  Spassky: "스파스키",
  Fischer: "피셔",
  Karpov: "카르포프",
  Kasparov: "카스파로프",
  Kramnik: "크람니크",
  Anand: "아난드",
  Carlsen: "칼슨",
  Nimzowitsch: "님초비치",
  Réti: "레티",
  Reti: "레티",
  Tarrasch: "타라시",
  Rubinstein: "루빈시테인",
  Marshall: "마셜",
  Schliemann: "슐리만",
  Jaenisch: "예니시",
  Cozio: "코지오",
  Bird: "버드",
  Chigorin: "치고린",
  Breyer: "브레이어",
  Zaitsev: "자이체프",
  Arkhangelsk: "아르한겔스크",
  Archangel: "아르한겔",
  Winawer: "비나베르",
  Rubinsteins: "루빈시테인",
  Philidor: "필리도르",
  Petrov: "페트로프",
  "Petrov's": "페트로프",
  Evans: "에반스",
  Greco: "그레코",
  Traxler: "트락슬러",
  Fried: "프라이드",
  Liver: "리버",
  Ponziani: "폰치아니",
  Larsen: "라르센",
  Sokolsky: "소콜스키",
  Zukertort: "추케르토르트",
  Mieses: "미제스",
  Anderssen: "안데르센",
  Grob: "그로브",
  Ware: "웨어",
  Amar: "아마르",
  Clemenz: "클레멘츠",
  Saragossa: "사라고사",
  Blackmar: "블랙마",
  Diemer: "디머",
  Albin: "알빈",
  Trompowsky: "트롬포프스키",
  Veresov: "베레소프",
  Pterodactyl: "프테로닥틸",
  Owen: "오웬",
  Horwitz: "호르비츠",
  Englund: "엥글룬드",
  Keres: "케레스",
  Geller: "겔러",
  Boleslavsky: "볼레슬라프스키",
  Polugaevsky: "폴루가옙스키",
  Velimirovic: "벨리미로비치",
  Sozin: "소진",
  Fianchettoed: "피안케토",
  Panov: "파노프",
  Botvinnik_Panov: "보트비닉 파노프",
  Bronstein: "브론시테인",
  Larsens: "라르센",
  Portisch: "포르티시",
  Hort: "호르트",
  Averbakh: "아베르바흐",
  Samisch: "제미시",
  Sämisch: "제미시",
  Petrosians: "페트로시안",
  Mar: "마르",
  del: "델",
  Plata: "플라타",

  // 자주 붙는 수식어
  with: "포함",
  without: "제외",
  and: "와",
  or: "또는",
  the: "",
  Attacks: "공격",
  Defenses: "방어",
  Formation: "포메이션",
  Setup: "셋업",
  Structure: "구조",
  Push: "푸시",
  Sacrifice: "희생",
  Trap: "함정",
  Swap: "교환",
};

const PHRASE_LIST = [...PHRASES].sort(
  (a, b) => b[0].length - a[0].length
);

function translateSegment(seg: string): string {
  let s = seg.trim();
  if (!s) return "";

  // 1) 긴 구절부터 통째로 치환
  const marks: string[] = [];
  for (const [en, ko] of PHRASE_LIST) {
    if (s.includes(en)) {
      const token = `\u0000${marks.length}\u0000`;
      marks.push(ko);
      s = s.split(en).join(token);
    }
  }

  // 2) 남은 낱말 치환
  s = s
    .split(/\s+/)
    .map((w) => {
      if (w.startsWith("\u0000")) return w;
      const bare = w.replace(/[.,]$/, "");
      const hit = WORDS[bare];
      return hit === undefined ? w : hit;
    })
    .filter(Boolean)
    .join(" ");

  // 3) 표시 자리 복원
  marks.forEach((ko, i) => {
    s = s.split(`\u0000${i}\u0000`).join(ko);
  });

  return s.replace(/\s+/g, " ").trim();
}

const cache = new Map<string, string>();

/** "Ruy Lopez: Berlin Defense" -> "루이 로페즈: 베를린 방어" */
export function toKorean(name: string): string {
  const hit = cache.get(name);
  if (hit) return hit;

  const out = name
    .split(":")
    .map((chunk) =>
      chunk
        .split(",")
        .map(translateSegment)
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean)
    .join(": ");

  const result = out || name;
  cache.set(name, result);
  return result;
}

/** 번역 결과가 원문과 같으면 영어 원문을 따로 보여줄 필요가 없다. */
export const isTranslated = (name: string) => toKorean(name) !== name;
