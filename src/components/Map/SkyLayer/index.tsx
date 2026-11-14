"use client";

import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import type { Point as LeafletPoint } from "leaflet";
import { useEffect, useMemo, useRef } from "react";

import { useViewStore } from "@/store/view";
import { getRandomNumber } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const CLOUDS = Array.from({ length: 12 }, (_, i) => ({
  index: i,
  top: getRandomNumber(70),
  left: getRandomNumber(90),
  animationDelay: getRandomNumber(14),
  // 구름마다 다른 속도로 떠다니도록 (10~18초)
  animationDuration: 10 + (i % 5) * 2,
  // 지도 이동을 따라가는 패럴랙스 속도 (구름마다 달라 깊이감 + 재생성 시점 분산)
  speed: 0.06 + (i % 5) * 0.025,
  // 구름 크기 다양화 (줌이 고정되어 정적 스케일 사용)
  scale: [1, 0.8, 1.2, 0.9, 1.1][i % 5],
}));

// 화면 밖 여유 크기 (구름 최대 크기 + 부유 이동 범위)
const CLOUD_MARGIN = 140;

// 랩어라운드: v를 [0, span) 범위로 정규화
const wrap = (v: number, span: number) => {
  return ((v % span) + span) % span;
};

interface Props {
  useDayNight?: boolean;
  isNight?: boolean;
  hours?: number;
}

export default function SkyLayer({
  useDayNight = true,
  isNight,
  hours = 0,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  const map = useViewStore((s) => s.map);

  // 구름 개수: 화면 하단부만 쓰므로 일부만 표시 (기존 줌 스케일 기반 로직 대신 고정)
  const additionalCloudCount = useMemo(() => {
    return 3;
  }, []);

  useEffect(() => {
    const div = divRef.current;
    if (!div || !map) return;

    let rafId: number | null = null;

    // 지도 이동 누적량 (픽셀) — 구름은 이 값 * 구름별 속도만큼만 움직인다
    let panX = 0;
    let panY = 0;
    let lastCenterPoint: LeafletPoint | null = null;

    // 구름 위치 렌더: 누적 이동량 * 구름별 속도를 화면 범위(여유 포함) 안으로 랩어라운드.
    // 화면 밖으로 나간 구름은 반대편에서 새 구름처럼 등장한다.
    const render = () => {
      const wrappers = div.querySelectorAll<HTMLElement>("[data-wrapper]");
      const width = div.clientWidth;
      const height = div.clientHeight;
      const spanW = width + CLOUD_MARGIN * 2;
      const spanH = height + CLOUD_MARGIN * 2;

      wrappers.forEach((el, i) => {
        const cloud = CLOUDS[i];
        if (!cloud) return;

        const baseX = (cloud.left / 100) * width;
        const baseY = (cloud.top / 100) * height;
        const targetX =
          wrap(baseX + panX * cloud.speed + CLOUD_MARGIN, spanW) -
          CLOUD_MARGIN;
        const targetY =
          wrap(baseY + panY * cloud.speed + CLOUD_MARGIN, spanH) -
          CLOUD_MARGIN;

        el.style.transform = `translate(${(targetX - baseX).toFixed(1)}px, ${(targetY - baseY).toFixed(1)}px) scale(${cloud.scale})`;
      });
    };

    // 지도 이동(드래그 + 캐릭터 따라가는 panTo 포함) 시 누적 후 rAF로 렌더
    const moveHandler = () => {
      const centerPoint = map.latLngToLayerPoint(map.getCenter());

      if (!lastCenterPoint) {
        lastCenterPoint = centerPoint;
        return;
      }

      panX += lastCenterPoint.x - centerPoint.x;
      panY += lastCenterPoint.y - centerPoint.y;
      lastCenterPoint = centerPoint;

      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        render();
        rafId = null;
      });
    };

    map.on("move", moveHandler);

    // 초기 기준점 설정 및 렌더
    lastCenterPoint = map.latLngToLayerPoint(map.getCenter());
    render();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);

      map.off("move", moveHandler);
    };
  }, [map]);

  return (
    <div ref={divRef} className={cn("SkyLayer")}>
      <AnimatePresence>
        {useDayNight && !isNight && (
          <motion.div
            style={{ left: `${((hours - 6) / 12) * 100}%` }}
            className={cn("sun")}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 2 }}
          ></motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {CLOUDS.slice(0, 3 * additionalCloudCount).map(
          ({ index, top, left, animationDelay, animationDuration }) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              key={index}
              data-wrapper
              className={cn("wrapper")}
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div
                className={cn("floating-wrapper")}
                style={{
                  animationDelay: `-${animationDelay}s`,
                  animationDuration: `${animationDuration}s`,
                }}
              >
                <div data-box className={cn("box")}></div>
                <div data-shadow className={cn("shadow")}></div>
              </div>
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
