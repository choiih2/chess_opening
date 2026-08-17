// 의존성 없는 얇은 IndexedDB 래퍼. 스토어는 key-value 하나씩만 쓴다.
const DB_NAME = "opening-trainer";
<<<<<<< HEAD
const VERSION = 3;
export const STORE_EXPLORER = "explorer"; // FEN -> ExplorerResult
export const STORE_IDEAS = "ideas"; // eco+수순 -> 요약 텍스트
export const STORE_APP = "app"; // 레퍼토리, 약점 목록, 설정 등
export const STORE_ENGINE = "engine"; // FEN+옵션 -> 엔진 분석 결과
export const STORE_GAMES = "games"; // 아이디+연월 -> chess.com 월별 대국 목록
=======
const VERSION = 1;
export const STORE_EXPLORER = "explorer"; // FEN -> ExplorerResult
export const STORE_IDEAS = "ideas"; // eco+수순 -> 요약 텍스트
export const STORE_APP = "app"; // 레퍼토리, 약점 목록 등
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
<<<<<<< HEAD
      for (const s of [STORE_EXPLORER, STORE_IDEAS, STORE_APP, STORE_ENGINE, STORE_GAMES]) {
=======
      for (const s of [STORE_EXPLORER, STORE_IDEAS, STORE_APP]) {
>>>>>>> 1c4ad35ce796730ee570be28e85def78e24e8f26
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

export async function dbGet<T>(store: string, key: string): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(store, "readonly").objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null; // 캐시 실패는 조용히 무시하고 네트워크로 넘어간다.
  }
}

export async function dbSet(store: string, key: string, value: unknown) {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* 저장 실패는 치명적이지 않다 */
  }
}
