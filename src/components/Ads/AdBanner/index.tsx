import { TossAds } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { useEffect, useRef, useState } from "react";

import { ensureBannerAdInitialized, isBannerAdSupported } from "../core";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export interface AdBannerProps {
  /** 앱인토스 콘솔에서 발급받은 광고 그룹 ID */
  adGroupId: string;
  /** `auto`면 시스템 다크 모드 설정을 따라가요 */
  theme?: "auto" | "light" | "dark";
  tone?: "blackAndWhite" | "grey";
  variant?: "card" | "expanded";
  className?: string;
}

/**
 * 배너 광고를 부착하는 컴포넌트예요.
 * 컨테이너 내부는 광고 SDK가 채우기 때문에 비워 두어야 해요.
 * 광고를 쓸 수 없는 환경(개발 브라우저, 미지원 토스앱 버전)에서는 아무것도 렌더링하지 않아요.
 */
export default function AdBanner({
  adGroupId,
  theme = "auto",
  tone = "blackAndWhite",
  variant = "card",
  className,
}: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 광고를 쓸 수 있는 환경에서는 초기화 전에도 슬롯 공간을 유지해요 (레이아웃 시프트 방지)
  const [isSupported] = useState(() => isBannerAdSupported());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;
    ensureBannerAdInitialized().then((initialized) => {
      if (!cancelled && initialized) setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  useEffect(() => {
    const container = containerRef.current;
    if (!isReady || !container) return;

    const attached = TossAds.attachBanner(adGroupId, container, {
      theme,
      tone,
      variant,
      callbacks: {
        onNoFill: (payload) => {
          console.warn("표시할 배너 광고가 없어요:", payload.slotId);
        },
        onAdFailedToRender: (payload) => {
          console.error("배너 광고 렌더링 실패:", payload.error.message);
        },
      },
    });

    return () => {
      attached.destroy();
    };
  }, [isReady, adGroupId, theme, tone, variant]);

  if (!isSupported) return null;

  return <div ref={containerRef} className={cn("AdBanner", className)} />;
}
