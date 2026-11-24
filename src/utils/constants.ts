import { Environment } from "@apps-in-toss/web-framework";

import type { CatInfo } from "./cats";

export const isDev = import.meta.env.MODE === "development";

export const operEnv = (() => {
  // 로컬 dev 서버는 devtools mock SDK가 "sandbox"를 반환해 실기기로 오판한다.
  // 로컬에서는 브라우저 폴백(navigator.geolocation, localStorage)을 쓴다.
  if (isDev) {
    return null;
  }

  try {
    return Environment.environment;
  } catch {
    return null;
  }
})();

/** 깡 충전(보상형) 광고로 지급하는 깡 개수 */
export const KKANG_AD_REWARD_COUNT = 2;

/** 전투 1회당 소모되는 깡 개수 — 상대 고양이 등급이 높을수록 많이 든다 */
export const KKANG_COST_BY_RARITY: Record<CatInfo["rarity"], number> = {
  common: 1,
  rare: 2,
  unique: 3,
  legend: 4,
};

/** 아이템 충전(보상형) 광고로 지급하는 아이템 개수 */
export const ITEM_AD_REWARD_COUNT = 2;

/**
 * 전면(보상형) 광고 그룹 ID — 지면별로 분리해 성과를 개별 측정한다.
 * 실제 배포 시 앱인토스 콘솔에서 발급받은 광고 그룹 ID로 교체할 것.
 */
export const KKANG_RECHARGE_AD_GROUP_ID = "ait-ad-test-fullscreen-kkang-id";
export const ITEM_RECHARGE_AD_GROUP_ID = "ait-ad-test-fullscreen-item-id";

/** 숫자 모션 공통 duration — 깡/아이템 증감 애니메이션 (number-flow) */
export const NUMBER_FLOW_SPIN_TIMING = { duration: 1500, easing: "ease-out" };
