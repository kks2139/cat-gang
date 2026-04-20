"use client";

import classNames from "classnames/bind";
import { useEffect, useRef } from "react";

import { getRandomNumber } from "@/utils/helper";

import styles from "./index.module.scss";

const cx = classNames.bind(styles);

export default function SkyLayer() {
  const divRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef(1);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    let rafId: number | null = null;
    let wheelRafId: number | null = null;
    let mouseX = 0;
    let mouseY = 0;

    const updateTransforms = () => {
      const wrappers = div.querySelectorAll("[data-wrapper]");

      wrappers.forEach((el) => {
        const wrapper = el as HTMLDivElement;
        const box = wrapper.querySelector("[data-box]") as HTMLDivElement;
        const shadow = wrapper.querySelector("[data-shadow]") as HTMLDivElement;

        if (!box || !shadow) return;

        // box setting
        const boxSpeed = 0.5;
        box.style.transform = `translate(${mouseX * boxSpeed}px, ${mouseY * boxSpeed}px)`;

        // shadow setting
        const shadowSpeed = 0.4;
        shadow.style.transform = `translate(${mouseX * shadowSpeed}px, ${mouseY * shadowSpeed}px)`;
      });
    };

    const updateScale = () => {
      const wrappers = div.querySelectorAll("[data-wrapper]");
      wrappers.forEach((el) => {
        const wrapper = el as HTMLDivElement;
        wrapper.style.transform = `scale(${wheelRef.current})`;
      });
    };

    const mouseMoveHandler = (e: MouseEvent) => {
      mouseX = e.offsetX;
      mouseY = e.offsetY;

      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        updateTransforms();
        rafId = null;
      });
    };

    const wheelHandler = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        wheelRef.current += 0.1;
      } else {
        wheelRef.current -= 0.1;
      }

      if (wheelRafId !== null) return;

      wheelRafId = requestAnimationFrame(() => {
        updateScale();
        wheelRafId = null;
      });
    };

    div.addEventListener("mousemove", mouseMoveHandler);
    div.addEventListener("wheel", wheelHandler);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (wheelRafId !== null) cancelAnimationFrame(wheelRafId);
      div.removeEventListener("mousemove", mouseMoveHandler);
      div.removeEventListener("wheel", wheelHandler);
    };
  }, []);

  return (
    <div ref={divRef} className={cx("SkyLayer")}>
      {Array.from({ length: 8 }, (_, i) => {
        const top = getRandomNumber(90);
        const left = getRandomNumber(65);
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
