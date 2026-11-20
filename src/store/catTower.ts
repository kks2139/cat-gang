import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { type CatInfo, getCat } from "@/utils/cats";
import {
  type CatTowerRecord,
  fetchCatTower,
  saveCatTower,
} from "@/utils/db/catTower";

/**
 * 캣 타워 — 부하 고양이들을 붙여 일을 시키면 시간이 지남에 따라 높이가 자라는 타워.
 * 높이는 "마지막 기준 높이(heightAt) + 붙어있는 부하 수 × 경과 시간"으로 계산하므로
 * 앱을 끈 사이에도 시간 경과만큼 자라고, 다시 켜면 일제히 반영된다.
 * 상태는 Supabase `cat_towers` 테이블(유저당 1행)에 저장된다.
 */

// 부하 1마리당 성장 속도: 30분에 1m (기존 10분에서 1/3로 완화 — 너무 빨라 화면을 벗어나는 문제 대응)
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
// 높이 상한 (m)
export const TOWER_MAX_HEIGHT = 999;

export interface CatTowerState {
  lat: number;
  lng: number;
  /** 이 시점 높이 기준으로 성장을 적분한다 (ms epoch) */
  updatedAt: number;
  /** updatedAt 시점의 높이 (m) */
  heightAt: number;
  /** 타워에 붙어 일하는 부하 목록 (own_cat 키: `${name}_${createdAt}`) */
  attachedKeys: string[];
}

interface CatTowerStore {
  /** 타워가 세워져 있으면 상태, 없으면 null */
  tower: CatTowerState | null;
  /** 높이 계산 결과 (m) — 1초 틱으로 갱신되는 실시간 값 */
  height: number;
  /** 위치 지정 모드 여부 (지도에서 타워를 세울/옮길 위치를 고르는 중) */
  isPlacingTower: boolean;
  /** 위치 지정 모드가 "기존 타워 이동"인지 여부 (새로 세우기가 아니라) */
  isMoveTower: boolean;
  actions: {
    /** DB에서 타워를 복원하고 경과 시간만큼 성장을 반영한다 */
    init: () => Promise<void>;
    startPlacing: () => void;
    /** 기존 타워의 위치를 옮기는 위치 지정 모드로 전환한다 */
    startMoving: () => void;
    cancelPlacing: () => void;
    /** 새 타워를 세운다 (타워가 없을 때만) */
    place: (lat: number, lng: number) => void;
    /** 기존 타워를 해당 위치로 옮긴다 (높이/부하 유지) */
    moveTo: (lat: number, lng: number) => void;
    attach: (key: string) => void;
    detach: (key: string) => void;
    /** 실시간 높이 재계산 (타이머에서 주기 호출 — 표시 전용, 저장 없음) */
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
  immer((set, get) => ({
    tower: null,
    height: 0,
    isPlacingTower: false,
    isMoveTower: false,
    actions: {
      async init() {
        let record: CatTowerRecord | null = null;

        try {
          record = await fetchCatTower();
        } catch (e) {
          console.error("캣 타워 복원 실패:", e);
        }

        set((state) => {
          state.tower = (record as never) ?? null;
          state.height = record ? computeHeight(record, Date.now()) : 0;
        });
      },
      startPlacing() {
        set((state) => {
          state.isPlacingTower = true;
          state.isMoveTower = false;
        });
      },
      startMoving() {
        set((state) => {
          state.isPlacingTower = true;
          state.isMoveTower = true;
        });
      },
      cancelPlacing() {
        set((state) => {
          state.isPlacingTower = false;
          state.isMoveTower = false;
        });
      },
      place(lat, lng) {
        // 유저당 타워는 1개 — 이미 있으면 새로 세우지 않는다
        if (get().tower) {
          return;
        }

        const tower: CatTowerState = {
          lat,
          lng,
          updatedAt: Date.now(),
          heightAt: 0,
          attachedKeys: [],
        };

        set((state) => {
          state.tower = tower as never;
          state.height = 0;
          state.isPlacingTower = false;
          state.isMoveTower = false;
        });

        void saveCatTower(tower);
      },
      moveTo(lat, lng) {
        const { tower } = get();

        if (!tower) {
          return;
        }

        // 위치만 바꾸고 높이/부하는 그대로 유지 (기준점 스냅샷 후 저장)
        const next = snapshot(tower, computeHeight(tower, Date.now()));
        next.lat = lat;
        next.lng = lng;

        set((state) => {
          state.tower = next as never;
          state.isPlacingTower = false;
          state.isMoveTower = false;
        });

        void saveCatTower(next);
      },
      attach(key) {
        const { tower } = get();

        if (!tower || tower.attachedKeys.includes(key)) {
          return;
        }

        const next = snapshot(tower, computeHeight(tower, Date.now()));
        next.attachedKeys = [...next.attachedKeys, key];

        set((state) => {
          state.tower = next as never;
        });

        void saveCatTower(next);
      },
      detach(key) {
        const { tower } = get();

        if (!tower || !tower.attachedKeys.includes(key)) {
          return;
        }

        const next = snapshot(tower, computeHeight(tower, Date.now()));
        next.attachedKeys = next.attachedKeys.filter((k) => k !== key);

        set((state) => {
          state.tower = next as never;
        });

        void saveCatTower(next);
      },
      tick() {
        const { tower } = get();

        if (!tower) {
          return;
        }

        const height = computeHeight(tower, Date.now());

        if (height !== get().height) {
          set((state) => {
            state.height = height;
          });
        }
      },
    },
  }))
);
