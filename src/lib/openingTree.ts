import { toKorean } from "./i18n";

export interface OpeningRow {
  eco: string;
  name: string;
  moves: string[];
}

export interface OpeningNode extends OpeningRow {
  id: string; // 수순을 이어붙인 문자열. 트리 내에서 유일하다.
  depth: number;
  parentId: string | null;
  children: OpeningNode[];
  /** 자기 아래에 달린 모든 변화의 수. 통계가 오기 전 정렬 기준으로 쓴다. */
  descendants: number;
}

/**
 * 수순 접두사 관계로 트리를 만든다.
 * "가장 깊은 접두사 조상"에 붙이므로 Ruy Lopez > Berlin Defense > Berlin Wall 처럼
 * 이름 규칙과 무관하게 실제 수순대로 계층이 생긴다.
 */
export function buildTree(rows: OpeningRow[]): OpeningNode[] {
  const sorted = [...rows].sort((a, b) => a.moves.length - b.moves.length);
  const byId = new Map<string, OpeningNode>();
  const roots: OpeningNode[] = [];

  for (const row of sorted) {
    const id = row.moves.join(" ");
    const node: OpeningNode = {
      ...row,
      id,
      depth: row.moves.length,
      parentId: null,
      children: [],
      descendants: 0,
    };

    // 자기보다 짧은 접두사 중 가장 긴 것을 부모로 삼는다.
    let parent: OpeningNode | null = null;
    for (let i = row.moves.length - 1; i >= 1; i--) {
      const cand = byId.get(row.moves.slice(0, i).join(" "));
      if (cand) {
        parent = cand;
        break;
      }
    }

    if (parent) {
      node.parentId = parent.id;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    byId.set(id, node);
  }

  // 잘 연구된 오프닝일수록 이름 붙은 하위 변화가 많다. 통계 대용으로 쓴다.
  const count = (n: OpeningNode): number => {
    n.descendants = n.children.reduce((a, c) => a + count(c) + 1, 0);
    return n.descendants;
  };
  roots.forEach(count);

  return roots;
}

/**
 * 자식을 정렬한다. 해당 국면의 실전 통계(수 -> 대국 수)가 있으면 그 순서로,
 * 없으면 하위 변화 개수 순으로 놓는다.
 */
export function sortChildren(
  node: OpeningNode,
  counts?: Record<string, number>
): OpeningNode[] {
  const lastMove = (n: OpeningNode) => n.moves[n.moves.length - 1];
  return [...node.children].sort((a, b) => {
    if (counts) {
      const ca = counts[lastMove(a)] ?? -1;
      const cb = counts[lastMove(b)] ?? -1;
      if (ca !== cb) return cb - ca;
    }
    return b.descendants - a.descendants || a.name.localeCompare(b.name);
  });
}

export function indexById(roots: OpeningNode[]): Map<string, OpeningNode> {
  const map = new Map<string, OpeningNode>();
  const walk = (n: OpeningNode) => {
    map.set(n.id, n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return map;
}

/** 루트부터 해당 노드까지의 조상 경로 (브레드크럼용) */
export function ancestorsOf(
  node: OpeningNode,
  map: Map<string, OpeningNode>
): OpeningNode[] {
  const path: OpeningNode[] = [];
  let cur: OpeningNode | undefined = node;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return path;
}

/** 이름에서 부모와 겹치는 앞부분을 떼어 트리에 짧게 표시한다. */
export function shortName(node: OpeningNode, parent?: OpeningNode | null) {
  if (!parent) return node.name;
  if (node.name.startsWith(parent.name)) {
    const rest = node.name.slice(parent.name.length).replace(/^[:,]\s*/, "");
    return rest || node.name;
  }
  return node.name;
}

export function searchOpenings(
  rows: OpeningRow[],
  query: string,
  limit = 40
): OpeningRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: OpeningRow[] = [];
  const contains: OpeningRow[] = [];
  for (const r of rows) {
    const en = r.name.toLowerCase();
    const ko = toKorean(r.name).toLowerCase();
    if (en.startsWith(q) || ko.startsWith(q) || r.eco.toLowerCase() === q)
      starts.push(r);
    else if (en.includes(q) || ko.includes(q)) contains.push(r);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
