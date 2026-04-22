"use client";

import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import type { ZoomAnimEvent } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

import { useViewStore } from "@/store/view";
import { getRandomNumber } from "@/utils/helper";

import { INIT_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "..";
import styles from "./index.module.scss";

const cx = classNames.bind(styles);

const CLOUDS = Array.from({ length: 12 }, (_, i) => ({
  index: i,
  top: getRandomNumber(60),
  left: getRandomNumber(90),
  animationDelay: getRandomNumber(10),
}));

const scaleUpBy = (scale: number, by = 0.3) => {
  return scale * by + by;
};

export default function SkyLayer() {
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
        const boxSpeed = 0.3;
        box.style.transform = `translate(${moveX * boxSpeed}px, ${moveY * boxSpeed}px)`;

        // shadow setting
        const shadowSpeed = 0.2;
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
      .on("zoomanim", zoomHandler);

    // 초기 1회 scale 적용
    updateScale();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId);

      map.off("dragstart", dragStartHandler);
      map.off("drag", dragHandler);
      map.off("zoomanim", zoomHandler);
    };
  }, [map]);

  return (
    <div ref={divRef} className={cx("SkyLayer")}>
      <AnimatePresence>
        {CLOUDS.slice(0, 4 * additionalCloudCount).map(
          ({ index, top, left, animationDelay }) => {
            // const top = getRandomNumber(60);
            // const left = getRandomNumber(90);
            // const animationDelay = getRandomNumber(10);

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                key={index}
                data-wrapper
                className={cx("wrapper")}
                style={{ top: `${top}%`, left: `${left}%` }}
              >
                <div
                  className={cx("floating-wrapper")}
                  style={{ animationDelay: `-${animationDelay}s` }}
                >
                  <div data-box className={cx("box")}></div>
                  <div data-shadow className={cx("shadow")}></div>
                </div>
              </motion.div>
            );
          },
        )}
      </AnimatePresence>
    </div>
  );
}
