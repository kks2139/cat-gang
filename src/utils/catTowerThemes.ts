/**
 * 캣 타워 꾸미기 — 타워 색 테마 팔레트.
 * 테마 id는 Supabase `cat_towers.color` 컬럼(text)에 그대로 저장된다.
 * 구성: 원목(기본) + 비비드 무지개 7색(빨주노초파남보) + 파스텔 4색 + 블랙.
 * 각 테마는 같은 역할의 5색(몸통 밴드 2 + 가지 + 둥지 발판 + 꼭대기 발판)을
 * 낮/밤 팔레트로 함께 정의한다 — 밤 팔레트는 어두운 지도 위에서 보이도록 명도를 올린다.
 */

export interface CatTowerPalette {
  /** 몸통 어두운 밴드 */
  trunkA: string;
  /** 몸통 밝은 밴드 */
  trunkB: string;
  /** 가지 (몸통보다 한 톤 어둡게) */
  branch: string;
  /** 둥지 발판 (가장 밝게 — 고양이가 앉는 자리) */
  nest: string;
  /** 꼭대기 발판 */
  perch: string;
}

export interface CatTowerTheme {
  id: string;
  name: string;
  day: CatTowerPalette;
  night: CatTowerPalette;
  /** UI 노출 여부 — 과거 선택분 렌더 보존용으로만 남기는 테마에 true */
  hidden?: boolean;
}

export const TOWER_THEMES: CatTowerTheme[] = [
  // ----- 원목 (기본) -----
  {
    id: "oak",
    name: "원목",
    day: {
      trunkA: "#a06b42",
      trunkB: "#c99a68",
      branch: "#8a5a34",
      nest: "#d9b98a",
      perch: "#dfb887",
    },
    night: {
      trunkA: "#c08c5c",
      trunkB: "#e6c394",
      branch: "#b07a48",
      nest: "#eecfa0",
      perch: "#f0d0a2",
    },
  },
  // ----- 비비드 무지개 (빨주노초파남보) -----
  {
    id: "red",
    name: "빨강",
    day: {
      trunkA: "#a83232",
      trunkB: "#cc5050",
      branch: "#8a2626",
      nest: "#e08585",
      perch: "#ea9494",
    },
    night: {
      trunkA: "#c65656",
      trunkB: "#e57a7a",
      branch: "#ad4040",
      nest: "#f0a3a3",
      perch: "#f6b3b3",
    },
  },
  {
    id: "orange",
    name: "주황",
    day: {
      trunkA: "#b85c14",
      trunkB: "#d97e2e",
      branch: "#994a0e",
      nest: "#ebae72",
      perch: "#f0bc82",
    },
    night: {
      trunkA: "#d67a2a",
      trunkB: "#ef9a48",
      branch: "#b66120",
      nest: "#f4c58e",
      perch: "#f8d0a0",
    },
  },
  {
    id: "yellow",
    name: "노랑",
    day: {
      trunkA: "#b09a1a",
      trunkB: "#d1ba38",
      branch: "#8f7c12",
      nest: "#e6d878",
      perch: "#ede088",
    },
    night: {
      trunkA: "#c9b230",
      trunkB: "#e3cf50",
      branch: "#a69320",
      nest: "#efe38e",
      perch: "#f5ec9e",
    },
  },
  {
    id: "green",
    name: "초록",
    day: {
      trunkA: "#2e7d3a",
      trunkB: "#4f9c58",
      branch: "#23632d",
      nest: "#8ecf99",
      perch: "#9edba8",
    },
    night: {
      trunkA: "#449752",
      trunkB: "#67b871",
      branch: "#357a41",
      nest: "#a8ddb2",
      perch: "#b6e6bf",
    },
  },
  {
    id: "blue",
    name: "파랑",
    day: {
      trunkA: "#2e64a8",
      trunkB: "#4f86c6",
      branch: "#235088",
      nest: "#86b4e0",
      perch: "#96c1ea",
    },
    night: {
      trunkA: "#4a80c0",
      trunkB: "#6da2da",
      branch: "#3a6ca4",
      nest: "#a0c8ec",
      perch: "#aed3f2",
    },
  },
  {
    id: "indigo",
    name: "남색",
    day: {
      trunkA: "#2f3a8c",
      trunkB: "#4c58b0",
      branch: "#232c70",
      nest: "#8b94d8",
      perch: "#98a1e2",
    },
    night: {
      trunkA: "#4550a8",
      trunkB: "#6472c8",
      branch: "#34408e",
      nest: "#a3abe4",
      perch: "#b0b8ec",
    },
  },
  {
    id: "violet",
    name: "보라",
    day: {
      trunkA: "#6d35a4",
      trunkB: "#8a55c0",
      branch: "#562a86",
      nest: "#bb9de2",
      perch: "#c8aeea",
    },
    night: {
      trunkA: "#8550bd",
      trunkB: "#a273d4",
      branch: "#6c3c9e",
      nest: "#cdb4ea",
      perch: "#d8c2f2",
    },
  },
  // ----- 파스텔 (2026-11-26 UI에서 제거 — 기존 선택분 렌더 보존용으로만 유지) -----
  {
    id: "pastel-pink",
    name: "파스텔 핑크",
    hidden: true,
    day: {
      trunkA: "#d8a0b0",
      trunkB: "#eac2cd",
      branch: "#c48799",
      nest: "#f7dfe6",
      perch: "#fae9ee",
    },
    night: {
      trunkA: "#e6b4c2",
      trunkB: "#f4d3dc",
      branch: "#d49cab",
      nest: "#fbecf0",
      perch: "#fdf4f6",
    },
  },
  {
    id: "pastel-sky",
    name: "파스텔 하늘",
    hidden: true,
    day: {
      trunkA: "#a3c4de",
      trunkB: "#c6dcec",
      branch: "#8aadc9",
      nest: "#e2f0f9",
      perch: "#ebf5fb",
    },
    night: {
      trunkA: "#b7d3e8",
      trunkB: "#d5e7f4",
      branch: "#9fc0d8",
      nest: "#ecf6fc",
      perch: "#f3fafd",
    },
  },
  {
    id: "pastel-mint",
    name: "파스텔 민트",
    hidden: true,
    day: {
      trunkA: "#9cc7ab",
      trunkB: "#c0e0cb",
      branch: "#83af92",
      nest: "#dff0e5",
      perch: "#e9f6ee",
    },
    night: {
      trunkA: "#b2d5be",
      trunkB: "#d2eadd",
      branch: "#96c2a4",
      nest: "#eaf6ef",
      perch: "#f1faf4",
    },
  },
  {
    id: "pastel-lavender",
    name: "파스텔 라벤더",
    hidden: true,
    day: {
      trunkA: "#b0a2d8",
      trunkB: "#cdc3e9",
      branch: "#9788c1",
      nest: "#e9e3f7",
      perch: "#f0ecfa",
    },
    night: {
      trunkA: "#c2b6e4",
      trunkB: "#dbd3f0",
      branch: "#a89ad3",
      nest: "#f0ebfa",
      perch: "#f6f2fd",
    },
  },
  // ----- 블랙 -----
  {
    id: "black",
    name: "블랙",
    day: {
      trunkA: "#2e2e34",
      trunkB: "#4a4a52",
      branch: "#232329",
      nest: "#6e6e78",
      perch: "#7e7e88",
    },
    night: {
      trunkA: "#45454e",
      trunkB: "#63636d",
      branch: "#36363e",
      nest: "#868691",
      perch: "#96969f",
    },
  },
];

export const DEFAULT_TOWER_COLOR = "oak";

// 저장된 색 id를 테마로 복원 — 모르는 값(삭제된 테마 등)이면 기본 테마로 폴백
export const resolveTowerColor = (color?: string | null): CatTowerTheme =>
  TOWER_THEMES.find((t) => t.id === color) ?? TOWER_THEMES[0];

// hex(#rrggbb)를 지정 배율만큼 어둡게 — 기초 지반 같은 테마 파생 톤에 사용
const darken = (hex: string, factor: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

// 기초 지반(흙) 색 — 선택한 테마의 몸통 어두운 밴드보다 한 톤 더 어둡게.
// 밤엔 덜 어둡게 해 어두운 지도 위에서 지반이 사라지지 않게 한다
export const towerFoundationColor = (
  theme: CatTowerTheme,
  isNight: boolean
): string => darken((isNight ? theme.night : theme.day).trunkA, isNight ? 0.8 : 0.72);
