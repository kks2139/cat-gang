import {
  loadFullScreenAd,
  showFullScreenAd,
  TossAds,
} from "@apps-in-toss/web-framework";

/**
 * 배너 광고(TossAds)를 이 환경에서 쓸 수 있는지 확인해요.
 * 개발 브라우저나 미지원 토스앱 버전(5.241.0 미만)에서는 false예요.
 */
export function isBannerAdSupported(): boolean {
  try {
    return TossAds.initialize.isSupported() && TossAds.attachBanner.isSupported();
  } catch {
    return false;
  }
}

/**
 * 전면형/보상형 광고를 이 환경에서 쓸 수 있는지 확인해요.
 * 토스앱 5.247.0 이상(ver2)에서 지원해요.
 */
export function isFullScreenAdSupported(): boolean {
  try {
    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

let initializePromise: Promise<boolean> | null = null;

/**
 * 배너 광고 SDK 초기화를 앱 전체에서 1회만 수행하고 결과를 공유해요.
 * 여러 AdBanner가 붙어도 중복 호출되지 않고, 실패 시에도 대기 중인 호출자가 같은 결과를 받아요.
 */
export function ensureBannerAdInitialized(): Promise<boolean> {
  if (!isBannerAdSupported()) return Promise.resolve(false);

  initializePromise ??= new Promise<boolean>((resolve) => {
    TossAds.initialize({
      callbacks: {
        onInitialized: () => resolve(true),
        onInitializationFailed: (error) => {
          console.error("Toss 광고 SDK 초기화 실패:", error);
          resolve(false);
        },
      },
    });
  });

  return initializePromise;
}
