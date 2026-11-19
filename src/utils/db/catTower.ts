import { UserKey } from "@/utils/native";

import { supabase } from "./supabase";

/**
 * 캣 타워 상태 (DB 저장용) — 유저당 1행, upsert로 갱신한다.
 * 높이 성장은 클라이언트가 `heightAt + attachedKeys × 경과시간`으로 계산하므로
 * 붙이기/떼기 등 기준점이 바뀔 때만 저장하면 된다.
 */
export interface CatTowerRecord {
  lat: number;
  lng: number;
  /** 이 시점 높이(heightAt)를 기준으로 성장 적분 (ms epoch) */
  updatedAt: number;
  /** updatedAt 시점의 높이 (m) */
  heightAt: number;
  /** 타워에 붙은 부하 목록 (own_cat 키: `${name}_${createdAt}`) */
  attachedKeys: string[];
}

export const fetchCatTower = async (): Promise<CatTowerRecord | null> => {
  const userKey = await UserKey.getInstance().getKey();

  if (!userKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("cat_towers")
    .select("position, height_at, attached_keys, updated_at")
    .eq("user_id", userKey)
    .maybeSingle();

  if (error) {
    console.error("캣 타워 조회 실패:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const position = data.position as { lat?: number; lng?: number } | null;

  if (typeof position?.lat !== "number" || typeof position?.lng !== "number") {
    return null;
  }

  const attachedKeys = Array.isArray(data.attached_keys)
    ? data.attached_keys.filter(
        (key): key is string => typeof key === "string"
      )
    : [];

  return {
    lat: position.lat,
    lng: position.lng,
    heightAt: data.height_at ?? 0,
    attachedKeys,
    updatedAt: data.updated_at
      ? new Date(data.updated_at).getTime()
      : Date.now(),
  };
};

export const saveCatTower = async (
  record: CatTowerRecord
): Promise<boolean> => {
  const userKey = await UserKey.getInstance().getKey();

  if (!userKey) {
    return false;
  }

  const { error } = await supabase.from("cat_towers").upsert({
    user_id: userKey,
    position: { lat: record.lat, lng: record.lng },
    height_at: record.heightAt,
    attached_keys: record.attachedKeys,
    updated_at: new Date(record.updatedAt).toISOString(),
  });

  if (error) {
    console.error("캣 타워 저장 실패:", error);
    return false;
  }

  return true;
};
