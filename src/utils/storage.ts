import { Storage } from "@apps-in-toss/web-framework";
import { isToday } from "date-fns";

import { operEnv } from "./constants";

const STORAGE_KEY = "TODAY_WALK";
const KKANG_STORAGE_KEY = "TODAY_KKANG";

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

const parseKkangValue = (value: string | null): number => {
  if (!value) {
    return 0;
  }

  try {
    const data = JSON.parse(value) as { count: number; savedAt?: string };

    // 저장 시점이 오늘이 아니면 리셋 (자정 초기화)
    if (!data?.savedAt || !isToday(new Date(data.savedAt))) {
      return 0;
    }

    if (typeof data.count !== "number" || data.count < 0) {
      return 0;
    }

    return Math.min(data.count, DAILY_KKANG_COUNT);
  } catch {
    return 0;
  }
};

/** 오늘 남은 깡 개수를 읽어온다. 오늘 날짜가 아니면 0 (스토어에서 기본값으로 초기화) */
export const getTodayKkang = async (): Promise<number> => {
  if (operEnv) {
    try {
      return parseKkangValue(await Storage.getItem(KKANG_STORAGE_KEY));
    } catch (e) {
      console.error("getTodayKkang 에러:", e);
      return 0;
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
