/**
 * 캣 타워 시즌 효과 — 타워 주변을 휘날리는 파티클(꽃잎/잎/눈송이) 정의.
 * season id는 Supabase `cat_towers.season` 컬럼(text)에 그대로 저장된다.
 * 파티클 렌더는 DOM/CSS(맵 렌더 비용 0) — CatTower의 시즌 모션이 사용한다.
 */

export type TowerSeason = "spring" | "summer" | "fall" | "winter";

export interface SeasonParticle {
  /** 파티클 종류 — CSS 클래스/도형 결정에 쓴다 */
  kind: "petal" | "leaf" | "leaf-red" | "snow";
  /** 파티클 색 (CSS 배경) */
  color: string;
}

export interface TowerSeasonInfo {
  id: TowerSeason;
  name: string;
  /** 휘날리는 파티클 목록 (여러 색 섞기) */
  particles: SeasonParticle[];
  /** 타워 주변 동시 표시 파티클 수 */
  particleCount: number;
  /** 발판에 쌓는 덮개(눈/꽃/낙엽) 지물 색 — null이면 덮개 없음 */
  mantleColor: string | null;
  /** 덮개 두께 (축소 스케일 m) */
  mantleThicknessM: number;
}

export const TOWER_SEASONS: TowerSeasonInfo[] = [
  {
    id: "spring",
    name: "봄",
    // 벚꽃(핑크) + 노랑 꽃잎
    particles: [
      { kind: "petal", color: "#ffb7d5" },
      { kind: "petal", color: "#ffd9e8" },
      { kind: "petal", color: "#ffe28a" },
    ],
    particleCount: 24,
    mantleColor: "#ffd9e8", // 발판 위 얇은 꽃잎 층
    mantleThicknessM: 0.12,
  },
  {
    id: "summer",
    name: "여름",
    // 녹색 나뭇잎
    particles: [
      { kind: "leaf", color: "#7ed957" },
      { kind: "leaf", color: "#4fae52" },
    ],
    particleCount: 18,
    mantleColor: null,
    mantleThicknessM: 0,
  },
  {
    id: "fall",
    name: "가을",
    // 갈색 + 붉은 낙엽
    particles: [
      { kind: "leaf-red", color: "#d9772f" },
      { kind: "leaf-red", color: "#b84a2a" },
      { kind: "leaf-red", color: "#e0a458" },
    ],
    particleCount: 24,
    mantleColor: "#c97a3d", // 발판 위 낙엽 층
    mantleThicknessM: 0.16,
  },
  {
    id: "winter",
    name: "겨울",
    // 눈송이
    particles: [
      { kind: "snow", color: "#ffffff" },
      { kind: "snow", color: "#dff1ff" },
    ],
    particleCount: 30,
    mantleColor: "#f4f9ff", // 발판 위 눈 층
    mantleThicknessM: 0.2,
  },
];

export const DEFAULT_TOWER_SEASON: TowerSeason | null = null;

// 저장된 season id 복원 — 모르는 값이면 효과 없음(null)으로 폴백
export const resolveTowerSeason = (
  season?: string | null
): TowerSeasonInfo | null =>
  TOWER_SEASONS.find((s) => s.id === season) ?? null;
