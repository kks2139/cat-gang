"use client";

import classNames from "classnames/bind";
import type { ZoomAnimEvent } from "leaflet";
import { useEffect, useRef } from "react";

import { useViewStore } from "@/store/view";
import { getRandomNumber } from "@/utils/helper";

import { INIT_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "..";
import styles from "./index.module.scss";

const cx = classNames.bind(styles);

const scaleUpBy = (scale: number, by = 0.5) => {
  return scale * by + by;
};

export default function SkyLayer() {
  const divRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const map = useViewStore((s) => s.map);

  useEffect(() => {
    const div = divRef.current;
    if (!div || !map) return;

    let rafId: number | null = null;
    let wheelRafId: number | null = null;

    let startX: number;
    let startY: number;
    let scale = scaleUpBy(INIT_ZOOM_LEVEL - MIN_ZOOM_LEVEL + 1);

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
        const boxSpeed = 0.02;
        box.style.transform = `translate(${moveX * boxSpeed}px, ${moveY * boxSpeed}px)`;

        // shadow setting
        const shadowSpeed = 0.015;
        shadow.style.transform = `translate(${moveX * shadowSpeed}px, ${moveY * shadowSpeed}px)`;
      });
    };

    const updateScale = () => {
      const wrappers = div.querySelectorAll("[data-wrapper]");
      wrappers.forEach((el, i) => {
        const wrapper = el as HTMLDivElement;
        const num = i * 0.1;
        const randomScale = i % 2 === 0 ? scale + num : scale - num;

        wrapper.style.transform = `scale(${randomScale})`;
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
      {Array.from({ length: 6 }, (_, i) => {
        const top = getRandomNumber(60);
        const left = getRandomNumber(90);
        const animationDelay = getRandomNumber(10);

        return (
          <div
            key={i}
            data-wrapper
            ref={wrapperRef}
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
          </div>
        );
      })}
    </div>
  );
}
