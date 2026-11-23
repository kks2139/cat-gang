import { addDays, format, startOfDay } from "date-fns";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { type CatInfo, getCat } from "@/utils/cats";
import { DEFAULT_TOWER_COLOR } from "@/utils/catTowerThemes";
import {
  type CatTowerRecord,
  fetchCatTowers,
  saveCatTower,
} from "@/utils/db/catTower";
import {
  getTowerWork,
  storeTowerWork,
  type TowerWorkData,
} from "@/utils/storage";

/**
 * 캣 타워 — 부하 고양이들을 붙여 일을 시키면 시간이 지남에 따라 높이가 자라는 타워.
 * 부하는 등급 무관 30분에 1m씩 기여하지만, 하루 근무 시간(예산)이 등급별로 다르다 —
 * 예산을 다 쓴 부하는 그날 퇴근(성장 기여 0)하고 자정에 새로 출근한다.
 * 높이는 "마지막 기준 높이(heightAt) + 구간별 근무 적립"으로 계산하므로 앱을 끈
 * 사이에도 소급 정확히 자란다 (구간 사이 attached 멤버십이 고정이라 각 부하
 * min(경과, 남은 예산) 적립으로 재현 가능).
 *
 * 타워는 유저당 여러 개를 보유할 수 있다 — 건설중(완공 안 된) 타워는 동시에
 * 1개만 존재하며, 1000m 완공 시 모든 부하가 일을 중단(휴식)하고 새 타워를
 * 세울 수 있게 된다. 상태는 Supabase `cat_towers` 테이블(타워당 1행)에 저장하고,
 * 근무 적립치는 storage(디바이스 로컬)에 저장한다.
 */

// 부하 1마리당 성장 속도: 30분에 1m — 등급 무관 동일하다
export const TOWER_METER_PER_CAT_PER_MS = 1 / (30 * 60 * 1000);
// 등급별 하루 근무 시간 (ms) — 대신 등급이 높은 부하일수록 하루를 더 오래 일한다
// (일반 1시간 / 레어 2시간 / 유니크 3시간 → 하루 기여량 2m / 4m / 6m)
export const TOWER_WORK_MS_BY_RARITY: Record<CatInfo["rarity"], number> = {
  common: 60 * 60 * 1000,
  rare: 2 * 60 * 60 * 1000,
  unique: 3 * 60 * 60 * 1000,
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
  /** 부하별 오늘 남은 근무 ms (분 단위 반올림) — 퇴근 배지/공사 모션/토스트용.
   * 오늘 근무 기록이 있는 부하(퇴근 후 휴식 포함)와 붙어 있는 부하가 모두 들어간다 */
  workLeft: Record<string, number>;
  /** 근무 적립치 — 타워 updatedAt 시점 기준(스토리지 값과 동기화) */
  baseWork: TowerWorkData | null;
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
    /** 건설중 타워에 부하를 붙인다 (오늘 근무가 남은 부하만) */
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
export const catNameOfKey = (key: string) => {
  const idx = key.lastIndexOf("_");

  return idx < 0 ? key : key.slice(0, idx);
};

// 부하 키의 고양이 희귀도 (모르는 이름이면 common으로 폴백)
const rarityOfKey = (key: string): CatInfo["rarity"] =>
  getCat(catNameOfKey(key))?.rarity ?? "common";

// 로컬 날짜 키 ("yyyy-MM-dd") — 자정 리셋/날짜 구간 판정 기준
const dayKeyOf = (ms: number) => format(new Date(ms), "yyyy-MM-dd");

// [from, to] 구간을 로컬 자정 기준으로 쪼갠 세그먼트 목록.
// 구간이 자정을 넘으면 날짜별로 근무 예산을 따로 적용해야 하기 때문이다
const splitByDay = (from: number, to: number): Array<[number, number]> => {
  const segments: Array<[number, number]> = [];
  let cursor = from;

  while (cursor < to) {
    const nextMidnight = addDays(startOfDay(cursor), 1).getTime();
    const end = Math.min(to, nextMidnight);

    segments.push([cursor, end]);
    cursor = end;
  }

  return segments;
};

// 성장/근무 적립 계산 — updatedAt → now 구간을 날짜별로 쪼개고, 각 부하는
// "그날 남은 근무 예산"만큼만 일한다(소진 시 퇴근). 구간 사이 attached 멤버십이
// 고정이므로 min(경과, 남은 예산) 적립으로 앱 종료 중 성장도 정확히 소급된다.
// baseWork는 updatedAt 시점 기준 적립치(스토리지 값)다.
const computeGrowth = (
  tower: CatTowerState,
  now: number,
  baseWork: TowerWorkData | null
): { height: number; work: TowerWorkData } => {
  if (now <= tower.updatedAt) {
    // 시계가 뒤로 간 경우 등 — 성장 없음, 기준 적립치를 그대로 되돌린다
    return {
      height: tower.heightAt,
      work: baseWork ?? { dateKey: dayKeyOf(tower.updatedAt), work: {} },
    };
  }

  // 첫 세그먼트는 updatedAt 날짜의 적립치에서 이어간다 — 스토리지 값이
  // updatedAt 날짜와 다르면(기록 없음/기기 변경) 그날 새로 출근한 것으로 본다
  let work: Record<string, number> =
    baseWork && baseWork.dateKey === dayKeyOf(tower.updatedAt)
      ? { ...baseWork.work }
      : {};
  let dateKey = dayKeyOf(tower.updatedAt);
  let grown = 0;

  splitByDay(tower.updatedAt, now).forEach(([segFrom, segTo]) => {
    // 날짜가 바뀌면 전원 새로 출근 (자정 리셋)
    const segDay = dayKeyOf(segFrom);

    if (segDay !== dateKey) {
      work = {};
      dateKey = segDay;
    }

    const span = segTo - segFrom;

    tower.attachedKeys.forEach((key) => {
      const budget = TOWER_WORK_MS_BY_RARITY[rarityOfKey(key)];
      const remaining = Math.max(0, budget - (work[key] ?? 0));
      const worked = Math.min(span, remaining);

      if (worked <= 0) {
        return;
      }

      work[key] = (work[key] ?? 0) + worked;
      grown += worked * TOWER_METER_PER_CAT_PER_MS;
    });
  });

  const height = Math.min(
    TOWER_MAX_HEIGHT,
    Math.max(0, Math.floor((tower.heightAt + grown) * 10) / 10)
  );

  return { height, work: { dateKey, work } };
};

// 부하별 오늘 남은 근무 ms — 오늘 적립치가 있는 부하(퇴근 후 휴식 포함)와
// 현재 붙어 있는 부하 모두 계산한다. 분 단위로 반올림해 UI 갱신 빈도를 줄인다
const workLeftOf = (workData: TowerWorkData, attachedKeys: string[]) => {
  const left: Record<string, number> = {};

  Object.keys(workData.work).forEach((key) => {
    const remaining =
      TOWER_WORK_MS_BY_RARITY[rarityOfKey(key)] - workData.work[key];

    left[key] = Math.max(0, Math.ceil(remaining / 60_000) * 60_000);
  });

  attachedKeys.forEach((key) => {
    if (!(key in left)) {
      left[key] = TOWER_WORK_MS_BY_RARITY[rarityOfKey(key)];
    }
  });

  return left;
};

// 두 workLeft 맵이 같은 내용인지 (틱에서 불필요한 갱신을 줄이는 데 쓴다)
const sameWorkLeft = (
  a: Record<string, number>,
  b: Record<string, number>
) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  return (
    keysA.length === keysB.length &&
    keysA.every((key) => a[key] === b[key])
  );
};

export const useCatTowerStore = create<CatTowerStore>()(
  immer((set, get) => {
    // 타워 상태를 교체하고 DB에 저장한다. 근무 적립치(work)는 스냅샷 시점
    // 기준으로 이미 스토리지에 저장돼 있어야 한다 — 스토리지 적립치는 항상
    // 타워 updatedAt 시점 기준이어야 재계산(앱 종료 소급)이 정확히 재현된다
    const replaceTower = (next: CatTowerState, work: TowerWorkData) => {
      set((state) => {
        const idx = state.towers.findIndex((t) => t.id === next.id);

        if (idx >= 0) {
          state.towers[idx] = next as never;
        }
        state.baseWork = work;
        state.workLeft = workLeftOf(work, next.attachedKeys) as never;
      });

      void saveCatTower(next);
    };

    // 기준점 스냅샷 — 현재까지의 성장/근무 적립을 확정해 기준점으로 삼는다
    // (경과 성장 이월 방지). 적립치는 같은 시점 기준으로 스토리지에 저장한다
    const snapshotTower = (
      tower: CatTowerState,
      now: number
    ): { tower: CatTowerState; work: TowerWorkData } => {
      const { height, work } = computeGrowth(tower, now, get().baseWork);

      void storeTowerWork(work);

      return { tower: { ...tower, heightAt: height, updatedAt: now }, work };
    };

    // 완공 판정 — 상한에 도달한 건설중 타워를 완공 처리한다.
    // 모든 부하를 내려 일을 중단시키고(휴식) 완공 시각을 기록해 저장한다.
    // 축하 연출은 이 completedAt을 본 UI가 스토리지 플래그와 비교해 노출한다
    const completeIfDone = () => {
      const now = Date.now();
      const done = get().towers.filter(
        (tower) =>
          !tower.completedAt &&
          computeGrowth(tower, now, get().baseWork).height >=
            TOWER_MAX_HEIGHT
      );

      if (done.length === 0) {
        return;
      }

      done.forEach((tower) => {
        const { tower: snapped, work } = snapshotTower(tower, now);

        replaceTower(
          {
            ...snapped,
            heightAt: TOWER_MAX_HEIGHT,
            completedAt: now,
            attachedKeys: [],
          },
          work
        );
        set((state) => {
          state.heights[tower.id] = TOWER_MAX_HEIGHT;
        });
      });
    };

    return {
      towers: [],
      heights: {},
      workLeft: {},
      baseWork: null,
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

          let workData: TowerWorkData | null = null;

          try {
            workData = await getTowerWork();
          } catch (e) {
            console.error("캣 타워 근무 기록 복원 실패:", e);
          }

          const now = Date.now();
          // 건설중 타워(동시 1개)의 성장은 부하 근무 상태 계산에도 쓴다
          const activeRecord = records.find(
            (record) => !record.completedAt
          ) as CatTowerState | undefined;
          const activeGrowth = activeRecord
            ? computeGrowth(activeRecord, now, workData)
            : null;

          set((state) => {
            state.towers = records as never;
            state.baseWork = workData;
            state.heights = {};
            state.workLeft = {};

            records.forEach((record) => {
              state.heights[record.id] = record.completedAt
                ? TOWER_MAX_HEIGHT
                : record.id === activeRecord?.id
                  ? (activeGrowth?.height ?? 0)
                  : computeGrowth(record as CatTowerState, now, workData)
                      .height;
            });

            if (activeRecord && activeGrowth) {
              state.workLeft = workLeftOf(
                activeGrowth.work,
                activeRecord.attachedKeys
              ) as never;
            }
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
            // 붙은 부하가 없는 새 타워 — 근무 적립치/남은 시간은 그대로 둔다
            // (다음 attach 스냅샷에서 스토리지 값이 기준 시점에 맞게 정리된다)
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
          const now = Date.now();
          const { tower: snapped, work } = snapshotTower(tower, now);
          const next: CatTowerState = { ...snapped, lat, lng };

          replaceTower(next, work);
          set((state) => {
            state.isPlacingTower = false;
            state.isMoveTower = false;
            state.movingTowerId = null;
          });
        },
        attach(key) {
          // 부하는 건설중 타워에만 붙는다 — 완공된 타워는 더 이상 일을 시키지 않는다
          const tower = getActiveTower(get().towers);

          if (!tower || tower.attachedKeys.includes(key)) {
            return;
          }

          const now = Date.now();
          // 오늘 근무를 다 끝낸(퇴근한) 부하는 붙여도 성장에 기여하지 못한다
          const { work } = computeGrowth(tower, now, get().baseWork);
          const remaining =
            TOWER_WORK_MS_BY_RARITY[rarityOfKey(key)] - (work.work[key] ?? 0);

          if (remaining <= 0) {
            return;
          }

          const { tower: snapped, work: snappedWork } = snapshotTower(
            tower,
            now
          );
          const next: CatTowerState = {
            ...snapped,
            attachedKeys: [...snapped.attachedKeys, key],
          };

          replaceTower(next, snappedWork);
        },
        detach(key) {
          const tower = getActiveTower(get().towers);

          if (!tower || !tower.attachedKeys.includes(key)) {
            return;
          }

          const { tower: snapped, work } = snapshotTower(tower, Date.now());
          const next: CatTowerState = {
            ...snapped,
            attachedKeys: snapped.attachedKeys.filter((k) => k !== key),
          };

          replaceTower(next, work);
        },
        setColor(id, color) {
          const tower = get().towers.find((t) => t.id === id);

          if (!tower || tower.color === color) {
            return;
          }

          // 색은 성장 계산과 무관 — 기준점 스냅샷 없이 그대로 저장한다
          void saveCatTower({ ...tower, color });
          set((state) => {
            const idx = state.towers.findIndex((t) => t.id === id);

            if (idx >= 0) {
              state.towers[idx].color = color;
            }
          });
        },
        tick() {
          // 상한 도달 타워 완공 처리 (완공 시 부하 전원 일중단)
          completeIfDone();

          const { towers, heights, baseWork } = get();
          const now = Date.now();
          const nextHeights: Record<string, number> = {};
          const nextWorkLeft: Record<string, number> = {};
          let heightChanged = false;

          towers.forEach((tower) => {
            if (tower.completedAt) {
              nextHeights[tower.id] = TOWER_MAX_HEIGHT;
            } else {
              const { height, work } = computeGrowth(tower, now, baseWork);

              nextHeights[tower.id] = height;
              // 건설중 타워(동시 1개)의 부하 근무 상태를 UI용으로 갱신한다
              Object.assign(
                nextWorkLeft,
                workLeftOf(work, tower.attachedKeys)
              );
            }

            if (heights[tower.id] !== nextHeights[tower.id]) {
              heightChanged = true;
            }
          });

          const workChanged = !sameWorkLeft(get().workLeft, nextWorkLeft);

          if (heightChanged || workChanged) {
            set((state) => {
              if (heightChanged) {
                state.heights = nextHeights as never;
              }
              if (workChanged) {
                state.workLeft = nextWorkLeft as never;
              }
            });
          }
        },
      },
    };
  })
);
