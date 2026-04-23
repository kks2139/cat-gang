"use client";

import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import type { ZoomAnimEvent } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

import { useViewStore } from "@/store/view";
import { getRandomNumber } from "@/utils/helper";

import { INIT_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "..";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const CLOUDS = Array.from({ length: 12 }, (_, i) => ({
  index: i,
  top: getRandomNumber(70),
  left: getRandomNumber(90),
  animationDelay: getRandomNumber(10),
}));

// 누적 드래그 픽셀이 이 값을 넘으면 구름 위치 리셋
const RESET_THRESHOLD = 500;

const scaleUpBy = (scale: number, by = 0.3) => {
  return scale * by + by;
};

interface Props {
  isNight?: boolean;
  hours?: number;
}

export default function SkyLayer({ isNight, hours = 0 }: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  const map = useViewStore((s) => s.map);

  const [currentScale, setCurrentScale] = useState(1);

  const additionalCloudCount = useMemo(() => {
    return currentScale > 1 ? 1 : currentScale > 0.7 ? 2 : 3;
  }, [currentScale]);

  useEffect(() => {
    const div = divRef.current;
    if (!div || !map) return;

    let rafId: number | null = null;
    let wheelRafId: number | null = null;

    let startX: number;
    let startY: number;
    let scale = scaleUpBy(INIT_ZOOM_LEVEL - MIN_ZOOM_LEVEL + 1);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentScale(scale);

    const resetTransforms = (animate = true) => {
      const wrappers = div.querySelectorAll("[data-wrapper]");

      wrappers.forEach((el) => {
        const wrapper = el as HTMLDivElement;
        const box = wrapper.querySelector("[data-box]") as HTMLDivElement;
        const shadow = wrapper.querySelector("[data-shadow]") as HTMLDivElement;

        if (!box || !shadow) return;

        if (animate) {
          box.style.transition = "6s";
          shadow.style.transition = "6s";

          setTimeout(() => {
            box.style.transition = "";
            shadow.style.transition = "";
          }, 6000);
        }

        box.style.transform = "translate(0, 0)";
        shadow.style.transform = "translate(0, 0)";
      });
    };

    const updateTransforms = () => {
      const wrappers = div.querySelectorAll("[data-wrapper]");

      const { x, y } = map.latLngToLayerPoint(map.getCenter());
      const moveX = startX - x;
      const moveY = startY - y;

      wrappers.forEach((el) => {
        const wrapper = el as HTMLDivElement;
        const box = wrapper.querySelector("[data-box]") as HTMLDivElement;
        const shadow = wrapper.querySelector("[data-shadow]") as HTMLDivElement;

        if (!box || !shadow) return;

        // box setting
        const boxSpeed = 0.2;
        box.style.transform = `translate(${moveX * boxSpeed}px, ${moveY * boxSpeed}px)`;

        // shadow setting
        const shadowSpeed = 0.1;
        shadow.style.transform = `translate(${moveX * shadowSpeed}px, ${moveY * shadowSpeed}px)`;
      });
    };

    const updateScale = () => {
      const wrappers = div.querySelectorAll("[data-wrapper]");
      wrappers.forEach((el, i) => {
        const wrapper = el as HTMLDivElement;
        const num = Math.max(i * 0.1, 0.3);
        const mod = i % 3;
        const randomScale =
          mod === 0 ? scale : mod === 1 ? scale + num : scale - num;

        wrapper.style.transform = `scale(${Math.max(randomScale, 0.5).toFixed(1)})`;
      });
    };

    const dragStartHandler = () => {
      const center = map.getCenter();
      const { x, y } = map.latLngToLayerPoint(center);

      if (startX === undefined || startY === undefined) {
        startX = x;
        startY = y;
      }
    };

    const dragHandler = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        updateTransforms();
        rafId = null;
      });
    };

    const dragEndHandler = () => {
      if (startX === undefined || startY === undefined) return;

      const { x, y } = map.latLngToLayerPoint(map.getCenter());
      const totalMoveX = Math.abs(startX - x);
      const totalMoveY = Math.abs(startY - y);

      // 누적 이동량이 임계값을 초과하면 구름 리셋
      if (totalMoveX > RESET_THRESHOLD || totalMoveY > RESET_THRESHOLD) {
        resetTransforms();
        // startX/Y를 현재 center로 갱신해 다음 드래그 기준점 초기화
        startX = x;
        startY = y;
      }
    };

    const zoomHandler = (e: ZoomAnimEvent) => {
      scale = scaleUpBy(e.zoom - MIN_ZOOM_LEVEL + 1);
      setCurrentScale(scale);

      if (wheelRafId !== null) return;

      wheelRafId = requestAnimationFrame(() => {
        updateScale();
        wheelRafId = null;
      });
    };

    map
      .on("dragstart", dragStartHandler)
      .on("drag", dragHandler)
      .on("dragend", dragEndHandler)
      .on("zoomanim", zoomHandler);

    // 초기 1회 scale 적용
    updateScale();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId);

      map.off("dragstart", dragStartHandler);
      map.off("drag", dragHandler);
      map.off("dragend", dragEndHandler);
      map.off("zoomanim", zoomHandler);
    };
  }, [map]);

  return (
    <div ref={divRef} className={cn("SkyLayer")}>
      <AnimatePresence>
        {!isNight && (
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
        {CLOUDS.slice(0, 5 * additionalCloudCount).map(
          ({ index, top, left, animationDelay }) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              key={index}
              data-wrapper
              className={cn("wrapper")}
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div
                className={cn("floating-wrapper")}
                style={{ animationDelay: `-${animationDelay}s` }}
              >
                <div data-box className={cn("box", { night: isNight })}></div>
                <div
                  data-shadow
                  className={cn("shadow", { night: isNight })}
                ></div>
              </div>
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
