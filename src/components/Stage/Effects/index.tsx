import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";

import { type Side } from "../Control";
import type { ItemType } from "../Inventory";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export type EffectType = "punch" | "seduce" | "lose" | "run" | "item" | "win";

const DEBRIS_COUNT = 8;
const HEART_COUNT = 5;
const SPARKLE_COUNT = 4;
const WIN_CONFETTI = 10;
const WIN_SPARKLES = 4;

// 하트마다 크기/출발 위치를 다르게 해서 자연스러운 연출
const HEART_VARIANTS = [
  { x: -24, y: 6, s: 0.7 },
  { x: -6, y: -10, s: 1.0 },
  { x: 12, y: 2, s: 0.85 },
  { x: 28, y: -14, s: 1.15 },
  { x: 2, y: 18, s: 0.6 },
];

// 스파클(반짝임) 위치
const SPARKLE_VARIANTS = [
  { x: -34, y: -46 },
  { x: 30, y: -18 },
  { x: -6, y: 36 },
  { x: 46, y: -54 },
];

// 아이템 비행 중 반짝이는 트레일 위치 (아이템 주위)
const ITEM_TRAILS = [
  { x: -78, y: -40 },
  { x: 66, y: -58 },
  { x: -52, y: 44 },
  { x: 76, y: 26 },
  { x: -4, y: -76 },
];

interface Props {
  effectType?: EffectType;
  punchDuration: number;
  enabled: boolean;
  target?: Side;
  usedItem?: ItemType;
}

const cssVars = (vars: Record<string, string | number>) =>
  vars as React.CSSProperties;

export default function Effects({
  effectType,
  punchDuration,
  enabled,
  target = "me",
  usedItem,
}: Props) {
  return (
    <AnimatePresence>
      {effectType === "punch" && enabled && (
        <motion.div
          key="punch"
          className={cn("punch", target)}
          style={cssVars({ "--punch-duration": `${punchDuration}s` })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.15 } }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* 공격자 쪽에서 날아드는 발톱 스윙 */}
          <div className={cn("swipe")}>
            <span />
            <span />
            <span />
          </div>

          {/* 발바닥 2연타 스탬프 */}
          {Array.from({ length: 2 }, (_, i) => (
            <div
              className={cn("paw-stamp", { second: i === 1 })}
              key={`paw-${i}`}
            >
              <div className={cn("toe")} />
              <div className={cn("toe")} />
              <div className={cn("toe")} />
              <div className={cn("pad")} />
            </div>
          ))}

          {/* 타격 임팩트 (버스트 + 스피드라인 + 파편) */}
          {Array.from({ length: 2 }, (_, i) => (
            <div
              className={cn("impact", { second: i === 1 })}
              key={`impact-${i}`}
            >
              <div className={cn("burst")} />
              <div className={cn("speed-lines")} />
              {Array.from({ length: DEBRIS_COUNT }, (_, j) => (
                <span
                  key={j}
                  className={cn("debris")}
                  style={cssVars({
                    "--angle": `${j * (360 / DEBRIS_COUNT)}deg`,
                  })}
                />
              ))}
            </div>
          ))}
        </motion.div>
      )}

      {effectType === "seduce" && enabled && (
        <motion.div
          key="seduce"
          className={cn("seduce", target)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {Array.from({ length: HEART_COUNT }, (_, i) => (
            <div
              key={i}
              className={cn("heart")}
              style={cssVars({
                "--i": i,
                "--s": HEART_VARIANTS[i].s,
                left: `${HEART_VARIANTS[i].x - 11}px`,
                top: `${HEART_VARIANTS[i].y - 11}px`,
              })}
            />
          ))}
          {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
            <div
              key={`sparkle-${i}`}
              className={cn("sparkle")}
              style={cssVars({
                "--i": i,
                left: `${SPARKLE_VARIANTS[i].x}px`,
                top: `${SPARKLE_VARIANTS[i].y}px`,
              })}
            />
          ))}
        </motion.div>
      )}

      {effectType === "win" && enabled && (
        <motion.div
          key="win"
          className={cn("win-fx")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {/* 승리자 머리 위 왕관 */}
          <div className={cn("crown")}>👑</div>

          {/* 사방으로 반복 분사되는 컨페티 */}
          <div className={cn("confetti-wrap")}>
            {Array.from({ length: WIN_CONFETTI }, (_, i) => (
              <span
                key={i}
                className={cn("confetti")}
                style={cssVars({
                  "--i": i,
                  "--angle": `${i * (360 / WIN_CONFETTI) + (i % 2) * 18}deg`,
                  "--dist": `${60 + (i % 3) * 20}px`,
                })}
              />
            ))}
          </div>

          {/* 반짝임 */}
          {Array.from({ length: WIN_SPARKLES }, (_, i) => (
            <span
              key={`s-${i}`}
              className={cn("win-sparkle")}
              style={cssVars({
                "--i": i,
                left: `${SPARKLE_VARIANTS[i].x}px`,
                top: `${SPARKLE_VARIANTS[i].y}px`,
              })}
            />
          ))}
        </motion.div>
      )}

      {usedItem && enabled && (
        <div className={cn("item", { "to-enemy": usedItem === "fish" })}>
          {ITEM_TRAILS.map((pos, i) => (
            <span
              key={i}
              className={cn("trail")}
              style={cssVars({
                "--i": i,
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              })}
            />
          ))}
          <img
            src={
              usedItem === "gukbab"
                ? ImgGukbab
                : usedItem === "fish"
                  ? ImgFish
                  : ImgCatnip
            }
          />
        </div>
      )}
    </AnimatePresence>
  );
}
