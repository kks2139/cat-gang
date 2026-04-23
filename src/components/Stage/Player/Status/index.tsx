import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { motion, type MotionNodeAnimationOptions } from "framer-motion";

import { type CatInfo } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

type HpEffect = "up" | "down";

export interface StatusProps {
  isMe?: boolean;
  cat?: CatInfo;
  introMotion?: MotionNodeAnimationOptions;
  hp: number;
  hpEffect?: HpEffect;
  defense: number;
}

export function Status({ isMe, cat, introMotion, hp, hpEffect }: StatusProps) {
  const hpMax = cat?.hp || 1;
  const hpPercent = (hp / hpMax) * 100;
  const barWidth = `${hpPercent}%`;

  const barColorClass =
    hpPercent > 50 ? "green" : hpPercent > 20 ? "orange" : "red";

  return (
    <motion.ul
      className={cn("Status", { me: isMe, [barColorClass]: true })}
      {...introMotion}
    >
      <li>
        <div className={cn("label")}>이름</div>
        <strong>{cat?.name}</strong>
      </li>
      <li>
        <div className={cn("label")}>울음</div>
        <strong>{cat?.crying}</strong>
      </li>
      <li className={cn("hp")}>
        <div className={cn("hp-header")}>
          <div className={cn("label")}>HP</div>
          <div className={cn("value")}>
            <NumberFlow
              className={cn("current", { red: hpEffect === "down" })}
              value={hp}
            />
            <span>{` / ${cat?.hp}`}</span>
          </div>
        </div>
        <div className={cn("hp-bar")}>
          <div
            className={cn("bar", { [barColorClass]: true })}
            style={{
              width: barWidth,
            }}
          />
          <div
            className={cn("effect")}
            style={{
              width: barWidth,
            }}
          />
        </div>
      </li>
    </motion.ul>
  );
}
