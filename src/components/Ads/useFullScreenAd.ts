import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useRef, useState } from "react";

import { isFullScreenAdSupported } from "./core";

export interface FullScreenAdReward {
  unitType: string;
  unitAmount: number;
}

export interface UseFullScreenAdCallbacks {
  /** 보상형 광고에서 보상 획득 이벤트가 온 경우 (전면형에는 오지 않아요) */
  onEarnedReward?: (reward: FullScreenAdReward) => void;
  /** 광고를 시청하고 닫았을 때. 보상을 받았는지 여부도 함께 전달해요. */
  onDismissed?: (payload: { earnedReward: boolean }) => void;
  /** 로드/표시 중 에러가 발생했을 때 */
  onError?: (error: Error) => void;
}

/**
 * 전면형/보상형 광고를 다루는 훅이에요.
 * 광고 타입(전면/보상형)은 콘솔에서 등록한 광고 그룹(adGroupId)으로 결정되고, 호출부는 동일한 API를 써요.
 *
 * `load → show → (다음 load)` 순서를 지켜야 하고, 같은 adGroupId엔 동시에 하나만 로드할 수 있어요.
 * show에 성공하면 로드된 광고가 소진되어 isLoaded가 false로 돌아가니, 재사용하려면 load를 다시 호출해요.
 *
 * @example
 * const { isSupported, isLoaded, load, show } = useFullScreenAd(AD_GROUP_ID, {
 *   onEarnedReward: () => rewardFish(),
 * });
 *
 * useEffect(() => { load(); }, [load]); // 화면 진입 시 미리 로드
 */
export function useFullScreenAd(
  adGroupId: string,
  callbacks: UseFullScreenAdCallbacks = {},
) {
  const [isSupported] = useState(() => isFullScreenAdSupported());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  // 콜백(show 이후 onDismissed 등)에서 다시 load()를 호출할 수 있도록
  // isLoaded의 최신값을 ref로 유지 — 클로저에 갇힌 옛값 가드에 걸리지 않게
  const isLoadedRef = useRef(false);

  const isLoadingRef = useRef(false);
  const unsubscribeLoadRef = useRef<(() => void) | null>(null);
  const unsubscribeShowRef = useRef<(() => void) | null>(null);

  // 최신 콜백을 ref로 유지 (렌더 중 변이를 피하기 위해 effect에서 갱신)
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const load = useCallback(() => {
    if (!isSupported || isLoadingRef.current || isLoadedRef.current) return;

    isLoadingRef.current = true;
    unsubscribeLoadRef.current?.();

    unsubscribeLoadRef.current = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type !== "loaded") return;
        isLoadingRef.current = false;
        isLoadedRef.current = true;
        unsubscribeLoadRef.current?.();
        unsubscribeLoadRef.current = null;
        setIsLoaded(true);
      },
      onError: (error) => {
        isLoadingRef.current = false;
        isLoadedRef.current = false;
        unsubscribeLoadRef.current?.();
        unsubscribeLoadRef.current = null;
        console.error("전면 광고 로드 실패:", error);
        callbacksRef.current.onError?.(error);
      },
    });
  }, [adGroupId, isSupported]);

  const show = useCallback(() => {
    if (!isSupported || !isLoadedRef.current || isShowing) return;

    setIsShowing(true);
    let earnedReward = false;
    unsubscribeShowRef.current?.();

    unsubscribeShowRef.current = showFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case "userEarnedReward":
            earnedReward = true;
            callbacksRef.current.onEarnedReward?.(event.data);
            break;

          case "dismissed":
            setIsShowing(false);
            isLoadedRef.current = false;
            setIsLoaded(false);
            callbacksRef.current.onDismissed?.({ earnedReward });
            break;

          case "failedToShow":
            setIsShowing(false);
            isLoadedRef.current = false;
            setIsLoaded(false);
            console.error("전면 광고 표시 실패:", event.type);
            break;

          // requested / show / impression / clicked
          default:
            break;
        }

        // 종료 이벤트(dismissed, failedToShow)에서는 구독을 정리해요.
        if (event.type === "dismissed" || event.type === "failedToShow") {
          unsubscribeShowRef.current?.();
          unsubscribeShowRef.current = null;
        }
      },
      onError: (error) => {
        setIsShowing(false);
        isLoadedRef.current = false;
        setIsLoaded(false);
        console.error("전면 광고 표시 실패:", error);
        callbacksRef.current.onError?.(error);
      },
    });
  }, [adGroupId, isSupported, isShowing]);

  // 언마운트 시 구독 정리
  useEffect(() => {
    return () => {
      unsubscribeLoadRef.current?.();
      unsubscribeShowRef.current?.();
      unsubscribeLoadRef.current = null;
      unsubscribeShowRef.current = null;
    };
  }, []);

  return { isSupported, isLoaded, isShowing, load, show } as const;
}
