import { UserKey } from "@/utils/native";

import { supabase } from "./supabase";

/**
 * 캣 타워 상태 (DB 저장용) — 유저당 여러 행(완공된 타워는 남고, 건설중은 1개).
 * 높이 성장은 클라이언트가 `heightAt + attachedKeys × 경과시간`으로 계산하므로
 * 붙이기/떼기 등 기준점이 바뀔 때만 저장하면 된다.
 */
export interface CatTowerRecord {
  /** 타워 식별자 (DB uuid — 마이그레이션 전 단일 타워 행은 created_at 유사값으로 대체) */
  id: string;
  lat: number;
  lng: number;
  /** 건설 시작 시각 (ms epoch) — 완공 소요 시간 표시용 */
  createdAt: number;
  /** 이 시점 높이(heightAt)를 기준으로 성장 적분 (ms epoch) */
  updatedAt: number;
  /** updatedAt 시점의 높이 (m) */
  heightAt: number;
  /** 타워에 붙은 부하 목록 (own_cat 키: `${name}_${createdAt}`) */
  attachedKeys: string[];
  /** 꾸미기 색 테마 id (cat_towers.color 컬럼 — 컬럼 추가 전엔 기본값으로 폴백) */
  color: string;
  /** 완공 시각 (ms epoch) — 건설중엔 null */
  completedAt: number | null;
}

// 컬럼 추가 순서대로 폴백한다:
// - id/completed_at: 2026-11-24 다중 타워 마이그레이션 (supabase/sql/cat_towers_multi.sql)
// - color: 2026-11-23 꾸미기 색 (supabase/sql/cat_towers_color.sql)
// 마이그레이션 전 환경(컬럼 없음)에서도 단일 타워 저장은 계속 동작하게 3단 폴백.
const COLUMNS_FULL =
  "id, position, height_at, attached_keys, updated_at, created_at, completed_at, color";
const COLUMNS_MID =
  "position, height_at, attached_keys, updated_at, created_at, color";
const COLUMNS_BASE = "position, height_at, attached_keys, updated_at, created_at";

type CatTowerRow = {
  id?: string | null;
  position: { lat?: number; lng?: number } | null;
  height_at: number | null;
  attached_keys: unknown;
  updated_at: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  color?: string | null;
};

type CatTowerListResult = {
  data: CatTowerRow[] | null;
  error: { message: string } | null;
};

// 마이그레이션 전 단일 타워 행의 식별자 — created_at은 행마다 유일하므로
// 세션 간에도 안정적인 임시 id로 쓴다 (post-migration 저장 시엔 쓰이지 않는다)
const legacyTowerId = (createdAt: string | null | undefined) =>
  `t${createdAt ?? "unknown"}`;

// SELECT는 컬럼 부재 에러에 따라 3단으로 재시도한다
const fetchTowerRows = async (userKey: string): Promise<CatTowerRow[]> => {
  const query = (columns: string) =>
    supabase
      .from("cat_towers")
      .select(columns)
      .eq("user_id", userKey)
      .order("created_at", { ascending: true });

  let { data, error } = (await query(COLUMNS_FULL)) as unknown as CatTowerListResult;

  if (error) {
    ({ data, error } = (await query(COLUMNS_MID)) as unknown as CatTowerListResult);
  }

  if (error) {
    ({ data, error } = (await query(COLUMNS_BASE)) as unknown as CatTowerListResult);
  }

  if (error) {
    console.error("캣 타워 조회 실패:", error);
    return [];
  }

  return data ?? [];
};

export const fetchCatTowers = async (): Promise<CatTowerRecord[]> => {
  const userKey = await UserKey.getInstance().getKey();

  if (!userKey) {
    return [];
  }

  const rows = await fetchTowerRows(userKey);

  return rows
    .map((data): CatTowerRecord | null => {
      const position = data.position as { lat?: number; lng?: number } | null;

      if (
        typeof position?.lat !== "number" ||
        typeof position?.lng !== "number"
      ) {
        return null;
      }

      const attachedKeys = Array.isArray(data.attached_keys)
        ? data.attached_keys.filter(
            (key): key is string => typeof key === "string"
          )
        : [];

      return {
        // id 컬럼이 아직 없으면(마이그레이션 전) created_at 기반 임시 id
        id: typeof data.id === "string" ? data.id : legacyTowerId(data.created_at),
        lat: position.lat,
        lng: position.lng,
        createdAt: data.created_at
          ? new Date(data.created_at).getTime()
          : Date.now(),
        heightAt: data.height_at ?? 0,
        attachedKeys,
        // 컬럼이 아직 없으면 조회 결과에 color가 없다 — 기본 테마로 폴백
        color: typeof data.color === "string" ? data.color : "oak",
        completedAt: data.completed_at
          ? new Date(data.completed_at).getTime()
          : null,
        updatedAt: data.updated_at
          ? new Date(data.updated_at).getTime()
          : Date.now(),
      };
    })
    .filter((record): record is CatTowerRecord => record !== null);
};

export const saveCatTower = async (
  record: CatTowerRecord
): Promise<boolean> => {
  const userKey = await UserKey.getInstance().getKey();

  if (!userKey) {
    return false;
  }

  const fullRow = {
    user_id: userKey,
    id: record.id,
    position: { lat: record.lat, lng: record.lng },
    height_at: record.heightAt,
    attached_keys: record.attachedKeys,
    created_at: new Date(record.createdAt).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString(),
    completed_at: record.completedAt
      ? new Date(record.completedAt).toISOString()
      : null,
    color: record.color,
  };
  // 생성 타입에 컬럼이 생기기 전까지 초과 프로퍼티 검사를 우회한다
  let { error } = await supabase
    .from("cat_towers")
    .upsert(fullRow as never);

  // id/completed_at 컬럼이 아직 없으면(마이그레이션 전) 둘을 뺀 상태라도 저장한다 —
  // 이때는 user_id가 PK라 단일 타워 upsert로 계속 동작한다
  if (error) {
    const midRow = {
      user_id: fullRow.user_id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
      color: fullRow.color,
    };

    ({ error } = await supabase.from("cat_towers").upsert(midRow as never));
  }

  // color 컬럼이 아직 없으면 색까지 뺀 나머지 상태라도 저장한다
  if (error) {
    const baseRow = {
      user_id: fullRow.user_id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
    };

    ({ error } = await supabase.from("cat_towers").upsert(baseRow as never));
  }

  if (error) {
    console.error("캣 타워 저장 실패:", error);
    return false;
  }

  return true;
};
