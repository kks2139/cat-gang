import { Storage } from "@apps-in-toss/web-framework";
import { isToday } from "date-fns";

import { operEnv } from "./constants";

const STORAGE_KEY = "TODAY_WALK";
const KKANG_STORAGE_KEY = "TODAY_KKANG";
const TOWER_CELEBRATED_KEY = "TOWER_CELEBRATED";

/** 하루에 주어지는 깡 개수 (전투 1회당 1개 소모) */
export const DAILY_KKANG_COUNT = 5;

export interface TodayWalkData {
  /** 오늘 누적 산책 거리 (m) */
  distance: number;
  /** 이동 궤적 좌표 (발자국 트레일 복원용) */
  path: { lat: number; lng: number }[];
}

const emptyWalk: TodayWalkData = {
  distance: 0,
  path: [],
};

const parseWalkValue = (value: string | null): TodayWalkData => {
  if (!value) {
    return emptyWalk;
  }

  try {
    const data = JSON.parse(value) as {
      distance: number;
      path: { lat: number; lng: number }[];
      savedAt?: string;
    };

    if (!data?.savedAt || !isToday(new Date(data.savedAt))) {
      return emptyWalk;
    }

    if (typeof data.distance !== "number" || !Array.isArray(data.path)) {
      return emptyWalk;
    }

    return {
      distance: data.distance,
      path: data.path,
    };
  } catch {
    return emptyWalk;
  }
};

/** 오늘 산책 데이터 (거리 + 궤적)를 읽어온다. 오늘 날짜가 아니면 초기값 */
export const getTodayWalk = async (): Promise<TodayWalkData> => {
  // AIT 운영환경이면 네이티브 Storage, 아니면(로컬 브라우저 등) localStorage 사용
  if (operEnv) {
    try {
      return parseWalkValue(await Storage.getItem(STORAGE_KEY));
    } catch (e) {
      console.error("getTodayWalk 에러:", e);
      return emptyWalk;
    }
  }

  return parseWalkValue(localStorage.getItem(STORAGE_KEY));
};

/** 오늘 산책 데이터 (거리 + 궤적)를 저장한다 */
export const storeTodayWalk = async (data: TodayWalkData) => {
  const value = JSON.stringify({
    distance: data.distance,
    path: data.path,
    savedAt: new Date().toISOString(),
  });

  if (operEnv) {
    try {
      await Storage.setItem(STORAGE_KEY, value);
    } catch (e) {
      console.error("storeTodayWalk 에러:", e);
    }
    return;
  }

  localStorage.setItem(STORAGE_KEY, value);
};

// 오늘 저장된 깡 값이 없으면(첫 접속/날짜 지남) null, 있으면 그 값을 반환한다.
// 0개도 "저장된 값"이므로 null과 구분해야 소진 후 재진입 시 리셋되는 버그가 생기지 않는다
const parseKkangValue = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  try {
    const data = JSON.parse(value) as { count: number; savedAt?: string };

    // 저장 시점이 오늘이 아니면 리셋 대상 (자정 초기화)
    if (!data?.savedAt || !isToday(new Date(data.savedAt))) {
      return null;
    }

    if (typeof data.count !== "number" || data.count < 0) {
      return null;
    }

    // 광고 보상으로 일일 기본 개수(5)를 초과한 깡은 그대로 유지한다
    // (자정 리셋은 위 savedAt 체크에서 처리)
    return data.count;
  } catch {
    return null;
  }
};

/** 오늘 남은 깡 개수를 읽어온다. 오늘 저장된 값이 없으면 null (스토어에서 기본값으로 초기화) */
export const getTodayKkang = async (): Promise<number | null> => {
  if (operEnv) {
    try {
      return parseKkangValue(await Storage.getItem(KKANG_STORAGE_KEY));
    } catch (e) {
      console.error("getTodayKkang 에러:", e);
      return null;
    }
  }

  return parseKkangValue(localStorage.getItem(KKANG_STORAGE_KEY));
};

/** 오늘 남은 깡 개수를 저장한다 */
export const storeTodayKkang = async (count: number) => {
  const value = JSON.stringify({
    count,
    savedAt: new Date().toISOString(),
  });

  if (operEnv) {
    try {
      await Storage.setItem(KKANG_STORAGE_KEY, value);
    } catch (e) {
      console.error("storeTodayKkang 에러:", e);
    }
    return;
  }

  localStorage.setItem(KKANG_STORAGE_KEY, value);
};

// ----- 캣 타워 완공 축하 연출 노출 여부 (타워별 1회) -----

const parseCelebratedIds = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const data = JSON.parse(value) as { ids?: unknown };

    return Array.isArray(data?.ids)
      ? data.ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

/** 완공 축하 연출을 이미 노출한 타워 id 목록을 읽어온다 */
export const getCelebratedTowerIds = async (): Promise<string[]> => {
  if (operEnv) {
    try {
      return parseCelebratedIds(await Storage.getItem(TOWER_CELEBRATED_KEY));
    } catch (e) {
      console.error("getCelebratedTowerIds 에러:", e);
      return [];
    }
  }

  return parseCelebratedIds(localStorage.getItem(TOWER_CELEBRATED_KEY));
};

/** 해당 타워의 완공 축하 연출을 노출한 것으로 기록한다 */
export const markTowerCelebrated = async (towerId: string) => {
  const ids = await getCelebratedTowerIds();

  if (ids.includes(towerId)) {
    return;
  }

  const value = JSON.stringify({ ids: [...ids, towerId] });

  if (operEnv) {
    try {
      await Storage.setItem(TOWER_CELEBRATED_KEY, value);
    } catch (e) {
      console.error("markTowerCelebrated 에러:", e);
    }
    return;
  }

  localStorage.setItem(TOWER_CELEBRATED_KEY, value);
};
