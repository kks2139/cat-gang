import { UserKey } from "@/utils/native";

import { supabase } from "./supabase";

/**
 * 캣 타워 상태 (DB 저장용) — 유저당 여러 행(완공된 타워는 남고, 건설중은 1개).
 * 높이 성장은 클라이언트가 계산한다(heightAt 기준 + 부하별 근무 적립) —
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
  /** 타워 이름 (cat_towers.name 컬럼 — 컬럼 추가 전/미입력엔 null) */
  name: string | null;
  /** 시즌 효과 (cat_towers.season 컬럼 — spring/summer/fall/winter, 컬럼 추가 전/미선택엔 null) */
  season: string | null;
  /** 조명(빔) 표시 여부 (cat_towers.beams 컬럼 — 밤낮 무관, 컬럼 추가 전엔 true) */
  beams: boolean;
  /** 완공 시각 (ms epoch) — 건설중엔 null */
  completedAt: number | null;
}

// 컬럼 추가 순서대로 폴백한다 — 반드시 "최신 컬럼부터" 하나씩 뺀다:
// - beams: 2026-11-26 조명 토글 (supabase/sql/cat_towers_beams.sql)
// - season: 2026-11-26 계절 효과 (supabase/sql/cat_towers_season.sql)
// - name: 2026-11-26 타워 이름 (supabase/sql/cat_towers_name.sql)
// - id/completed_at: 2026-11-24 다중 타워 마이그레이션 (supabase/sql/cat_towers_multi.sql)
// - color: 2026-11-23 꾸미기 색 (supabase/sql/cat_towers_color.sql)
// 중간 단계에서 오래된 컬럼(id/completed_at)을 함께 빼면 안 된다 — 완공 시각이
// 조회에서 유실되면 완공 타워가 매번 재완공되고, 저장이 id 없이 upsert되면
// 매번 중복 행이 생긴다.
const COLUMNS_FULL =
  "id, position, height_at, attached_keys, updated_at, created_at, completed_at, color, name, season, beams";
const COLUMNS_NO_BEAMS =
  "id, position, height_at, attached_keys, updated_at, created_at, completed_at, color, name, season";
const COLUMNS_NO_SEASON =
  "id, position, height_at, attached_keys, updated_at, created_at, completed_at, color, name";
const COLUMNS_NO_NAME =
  "id, position, height_at, attached_keys, updated_at, created_at, completed_at, color";
const COLUMNS_NO_ID =
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
  name?: string | null;
  season?: string | null;
  beams?: boolean | null;
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
    ({ data, error } = (await query(COLUMNS_NO_BEAMS)) as unknown as CatTowerListResult);
  }

  if (error) {
    ({ data, error } = (await query(COLUMNS_NO_SEASON)) as unknown as CatTowerListResult);
  }

  if (error) {
    ({ data, error } = (await query(COLUMNS_NO_NAME)) as unknown as CatTowerListResult);
  }

  if (error) {
    ({ data, error } = (await query(COLUMNS_NO_ID)) as unknown as CatTowerListResult);
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
        name: typeof data.name === "string" && data.name ? data.name : null,
        season: typeof data.season === "string" && data.season ? data.season : null,
        beams: typeof data.beams === "boolean" ? data.beams : true,
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
    name: record.name,
    season: record.season,
    beams: record.beams,
  };
  // 생성 타입에 컬럼이 생기기 전까지 초과 프로퍼티 검사를 우회한다
  let { error } = await supabase
    .from("cat_towers")
    .upsert(fullRow as never);

  // beams 컬럼이 아직 없으면(2026-11-26 이전) 조명 플래그를 뺀 상태로 저장한다
  if (error) {
    const noBeamsRow = {
      user_id: fullRow.user_id,
      id: fullRow.id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
      completed_at: fullRow.completed_at,
      color: fullRow.color,
      name: fullRow.name,
      season: fullRow.season,
    };

    ({ error } = await supabase.from("cat_towers").upsert(noBeamsRow as never));
  }

  // season 컬럼이 아직 없으면(2026-11-26 이전) 계절을 뺀 상태로 저장한다
  if (error) {
    const noSeasonRow = {
      user_id: fullRow.user_id,
      id: fullRow.id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
      completed_at: fullRow.completed_at,
      color: fullRow.color,
      name: fullRow.name,
    };

    ({ error } = await supabase.from("cat_towers").upsert(noSeasonRow as never));
  }

  // name 컬럼이 아직 없으면(2026-11-26 이전) 이름을 뺀 상태로 저장한다 —
  // id/completed_at은 유지해야 기존 행이 갱신된다 (빼면 중복 행이 생긴다)
  if (error) {
    const noNameRow = {
      user_id: fullRow.user_id,
      id: fullRow.id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
      completed_at: fullRow.completed_at,
      color: fullRow.color,
    };

    ({ error } = await supabase.from("cat_towers").upsert(noNameRow as never));
  }

  // id/completed_at 컬럼이 아직 없으면(2026-11-24 이전) 둘을 뺀 상태라도 저장한다 —
  // 이때는 user_id가 PK라 단일 타워 upsert로 계속 동작한다
  if (error) {
    const noIdRow = {
      user_id: fullRow.user_id,
      position: fullRow.position,
      height_at: fullRow.height_at,
      attached_keys: fullRow.attached_keys,
      created_at: fullRow.created_at,
      updated_at: fullRow.updated_at,
      color: fullRow.color,
    };

    ({ error } = await supabase.from("cat_towers").upsert(noIdRow as never));
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
