import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import ImgCatFoot from "@/assets/img/cat_foot.png";
import ImgHeart from "@/assets/img/heart.png";

import { type Side } from "../Control";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export type EffectType = "punch" | "seduce" | "provoke" | "lose" | "run";

interface Props {
  effectType?: EffectType;
  punchDuration: number;
  enabled: boolean;
  target?: Side;
}

export default function Effects({
  effectType,
  punchDuration,
  enabled,
  target = "me",
}: Props) {
  return (
    <AnimatePresence>
      {effectType === "punch" &&
        enabled &&
        Array.from({ length: 2 }, (_, i) => {
          const isFirst = i === 0;
          const moveX = 30;

          return (
            <motion.div
              className={cn("punch", { [target]: true })}
              key={i}
              initial={{ opacity: 0, x: isFirst ? -moveX : 0 }}
              animate={{ opacity: 1, x: isFirst ? 0 : moveX }}
              transition={{
                duration: punchDuration,
                delay: isFirst ? 0 : 0.2,
              }}
            >
              <img src={ImgCatFoot} alt="" width={30} height={60} />
            </motion.div>
          );
        })}

      {effectType === "seduce" && enabled && (
        <div className={cn("seduce", { [target]: true })}>
          <img src={ImgHeart} alt="" width={50} height={50} />
        </div>
      )}
    </AnimatePresence>
  );
}
