import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { type CatInfo, getCat } from "@/utils/cats";
import { DEFAULT_TOWER_COLOR } from "@/utils/catTowerThemes";
import {
  type CatTowerRecord,
  fetchCatTowers,
  saveCatTower,
} from "@/utils/db/catTower";

/**
 * 캣 타워 — 부하 고양이들을 붙여 일을 시키면 시간이 지남에 따라 높이가 자라는 타워.
 * 높이는 "마지막 기준 높이(heightAt) + 붙어있는 부하 수 × 경과 시간"으로 계산하므로
 * 앱을 끈 사이에도 시간 경과만큼 자라고, 다시 켜면 일제히 반영된다.
 *
 * 타워는 유저당 여러 개를 보유할 수 있다 — 건설중(완공 안 된) 타워는 동시에
 * 1개만 존재하며, 1000m 완공 시 모든 부하가 일을 중단(휴식)하고 새 타워를
 * 세울 수 있게 된다. 상태는 Supabase `cat_towers` 테이블(타워당 1행)에 저장.
 */

// 부하 1마리당 성장 속도: 30분에 1m
export const TOWER_METER_PER_CAT_PER_MS = 1 / (30 * 60 * 1000);
// 희귀도별 건설 기여도 배수 — 등급이 높은 부하일수록 타워를 빨리 세운다
export const TOWER_CONTRIBUTION_BY_RARITY: Record<
  CatInfo["rarity"],
  number
> = {
  common: 1,
  rare: 1.5,
  unique: 2,
};
// 높이 상한 (m) — 이 높이에 도달하면 완공된다
export const TOWER_MAX_HEIGHT = 1000;

export interface CatTowerState {
  /** 타워 식별자 (DB uuid) */
  id: string;
  lat: number;
  lng: number;
  /** 건설 시작 시각 (ms epoch) — 완공 소요 시간 표시용 */
  createdAt: number;
  /** updatedAt 시점 높이 기준으로 성장을 적분한다 (ms epoch) */
  updatedAt: number;
  /** updatedAt 시점의 높이 (m) */
  heightAt: number;
  /** 타워에 붙어 일하는 부하 목록 (own_cat 키: `${name}_${createdAt}`) */
  attachedKeys: string[];
  /** 꾸미기 색 테마 id (`utils/catTowerThemes.ts`의 TOWER_THEMES) */
  color: string;
  /** 완공 시각 (ms epoch) — 건설중엔 null */
  completedAt: number | null;
}

/** 건설중(완공되지 않은) 타워 — 동시에 최대 1개 */
export const getActiveTower = (towers: CatTowerState[]) =>
  towers.find((tower) => !tower.completedAt) ?? null;

// 타워 식별자 — crypto.randomUUID가 가능한 환경(AIT 웹뷰는 https)에선 그걸 쓰고,
// 아니면 시간+난수 조합으로 대체한다
const newTowerId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

interface CatTowerStore {
  /** 보유 중인 타워 목록 (완공된 타워 포함, 건설중은 1개 이하) */
  towers: CatTowerState[];
  /** 타워별 실시간 높이 (m) — 1초 틱으로 갱신. 완공 타워는 상한 그대로 */
  heights: Record<string, number>;
  /** 위치 지정 모드 여부 (지도에서 타워를 세울/옮길 위치를 고르는 중) */
  isPlacingTower: boolean;
  /** 위치 지정 모드가 "기존 타워 이동"인지 여부 (새로 세우기가 아니라) */
  isMoveTower: boolean;
  /** 이동 대상 타워 id (isMoveTower일 때만 유효) */
  movingTowerId: string | null;
  actions: {
    /** DB에서 타워들을 복원하고 경과 시간만큼 성장/완공을 반영한다 */
    init: () => Promise<void>;
    startPlacing: () => void;
    /** 기존 타워의 위치를 옮기는 위치 지정 모드로 전환한다 */
    startMoving: (id: string) => void;
    cancelPlacing: () => void;
    /** 새 타워를 세운다 (건설중인 타워가 없을 때만) */
    place: (lat: number, lng: number) => void;
    /** 기존 타워를 해당 위치로 옮긴다 (높이/부하 유지) */
    moveTo: (lat: number, lng: number) => void;
    /** 건설중 타워에 부하를 붙인다 */
    attach: (key: string) => void;
    /** 건설중 타워에서 부하를 뗀다 (휴식) */
    detach: (key: string) => void;
    /** 타워 색 테마 변경 (꾸미기) */
    setColor: (id: string, color: string) => void;
    /** 실시간 높이 재계산 + 완공 판정 (타이머에서 주기 호출) */
    tick: () => void;
  };
}

// 부하 키(`${name}_${createdAt}`)에서 이름 부분을 추출한다.
// created_at(타임스탬프)에는 언더스코어가 없으므로 뒤에서부터 잘라야
// 이름에 언더스코어가 섞여도 안전하다.
const catNameOfKey = (key: string) => {
  const idx = key.lastIndexOf("_");

  return idx < 0 ? key : key.slice(0, idx);
};

// 부하 키의 고양이 희귀도 (모르는 이름이면 common으로 폴백)
const rarityOfKey = (key: string): CatInfo["rarity"] =>
  getCat(catNameOfKey(key))?.rarity ?? "common";

// 성장 계산: heightAt + (붙은 부하의 기여도 합 × 경과시간 × 속도), 상한 캡
const computeHeight = (tower: CatTowerState, now: number) => {
  const contribution = tower.attachedKeys.reduce(
    (sum, key) => sum + TOWER_CONTRIBUTION_BY_RARITY[rarityOfKey(key)],
    0
  );
  const grown =
    tower.heightAt +
    contribution * TOWER_METER_PER_CAT_PER_MS * (now - tower.updatedAt);

  return Math.min(TOWER_MAX_HEIGHT, Math.max(0, Math.floor(grown * 10) / 10));
};

// 상태 변경 직후의 높이를 기준점으로 삼아 저장한다 (경과 성장 이월 방지)
const snapshot = (tower: CatTowerState, height: number): CatTowerState => ({
  ...tower,
  heightAt: height,
  updatedAt: Date.now(),
});

export const useCatTowerStore = create<CatTowerStore>()(
  immer((set, get) => {
    // 목록에서 타워 상태를 통째로 교체하고 저장한다
    const replaceTower = (next: CatTowerState) => {
      set((state) => {
        const idx = state.towers.findIndex((t) => t.id === next.id);

        if (idx >= 0) {
          state.towers[idx] = next as never;
        }
      });

      void saveCatTower(next);
    };

    // 완공 판정 — 상한에 도달한 건설중 타워를 완공 처리한다.
    // 모든 부하를 내려 일을 중단시키고(휴식) 완공 시각을 기록해 저장한다.
    // 축하 연출은 이 completedAt을 본 UI가 스토리지 플래그와 비교해 노출한다
    const completeIfDone = () => {
      const now = Date.now();
      const done = get().towers.filter(
        (tower) =>
          !tower.completedAt && computeHeight(tower, now) >= TOWER_MAX_HEIGHT
      );

      if (done.length === 0) {
        return;
      }

      done.forEach((tower) => {
        replaceTower({
          ...tower,
          heightAt: TOWER_MAX_HEIGHT,
          updatedAt: now,
          completedAt: now,
          attachedKeys: [],
        });
        set((state) => {
          state.heights[tower.id] = TOWER_MAX_HEIGHT;
        });
      });
    };

    return {
      towers: [],
      heights: {},
      isPlacingTower: false,
      isMoveTower: false,
      movingTowerId: null,
      actions: {
        async init() {
          let records: CatTowerRecord[] = [];

          try {
            records = await fetchCatTowers();
          } catch (e) {
            console.error("캣 타워 복원 실패:", e);
          }

          set((state) => {
            state.towers = records as never;
            state.heights = {};

            records.forEach((record) => {
              state.heights[record.id] = record.completedAt
                ? TOWER_MAX_HEIGHT
                : computeHeight(record as CatTowerState, Date.now());
            });
          });

          // 앱을 끈 사이에 상한에 도달했을 수 있다 — 복원 직후 완공 판정
          completeIfDone();
        },
        startPlacing() {
          // 건설중인 타워가 있으면 새로 세울 수 없다
          if (getActiveTower(get().towers)) {
            return;
          }

          set((state) => {
            state.isPlacingTower = true;
            state.isMoveTower = false;
            state.movingTowerId = null;
          });
        },
        startMoving(id) {
          set((state) => {
            state.isPlacingTower = true;
            state.isMoveTower = true;
            state.movingTowerId = id;
          });
        },
        cancelPlacing() {
          set((state) => {
            state.isPlacingTower = false;
            state.isMoveTower = false;
            state.movingTowerId = null;
          });
        },
        place(lat, lng) {
          // 건설중인 타워가 있으면 새로 세우지 않는다
          if (getActiveTower(get().towers)) {
            return;
          }

          const tower: CatTowerState = {
            id: newTowerId(),
            lat,
            lng,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            heightAt: 0,
            attachedKeys: [],
            color: DEFAULT_TOWER_COLOR,
            completedAt: null,
          };

          set((state) => {
            state.towers.push(tower as never);
            state.heights[tower.id] = 0;
            state.isPlacingTower = false;
            state.isMoveTower = false;
            state.movingTowerId = null;
          });

          void saveCatTower(tower);
        },
        moveTo(lat, lng) {
          const { movingTowerId, towers } = get();
          const tower = towers.find((t) => t.id === movingTowerId);

          if (!tower) {
            return;
          }

          // 위치만 바꾸고 높이/부하는 그대로 유지 (기준점 스냅샷 후 저장)
          const next = snapshot(tower, computeHeight(tower, Date.now()));
          next.lat = lat;
          next.lng = lng;

          set((state) => {
            const idx = state.towers.findIndex((t) => t.id === tower.id);

            if (idx >= 0) {
              state.towers[idx] = next as never;
            }
            state.isPlacingTower = false;
            state.isMoveTower = false;
            state.movingTowerId = null;
          });

          void saveCatTower(next);
        },
        attach(key) {
          // 부하는 건설중 타워에만 붙는다 — 완공된 타워는 더 이상 일을 시키지 않는다
          const tower = getActiveTower(get().towers);

          if (!tower || tower.attachedKeys.includes(key)) {
            return;
          }

          const next = snapshot(tower, computeHeight(tower, Date.now()));
          next.attachedKeys = [...next.attachedKeys, key];

          replaceTower(next);
        },
        detach(key) {
          const tower = getActiveTower(get().towers);

          if (!tower || !tower.attachedKeys.includes(key)) {
            return;
          }

          const next = snapshot(tower, computeHeight(tower, Date.now()));
          next.attachedKeys = next.attachedKeys.filter((k) => k !== key);

          replaceTower(next);
        },
        setColor(id, color) {
          const tower = get().towers.find((t) => t.id === id);

          if (!tower || tower.color === color) {
            return;
          }

          // 색은 성장 계산과 무관 — 기준점 스냅샷 없이 그대로 저장한다
          replaceTower({ ...tower, color });
        },
        tick() {
          // 상한 도달 타워 완공 처리 (완공 시 부하 전원 일중단)
          completeIfDone();

          const { towers, heights } = get();
          const now = Date.now();
          const nextHeights: Record<string, number> = {};
          let changed = false;

          towers.forEach((tower) => {
            const height = tower.completedAt
              ? TOWER_MAX_HEIGHT
              : computeHeight(tower, now);

            nextHeights[tower.id] = height;

            if (heights[tower.id] !== height) {
              changed = true;
            }
          });

          if (changed) {
            set((state) => {
              state.heights = nextHeights;
            });
          }
        },
      },
    };
  })
);
