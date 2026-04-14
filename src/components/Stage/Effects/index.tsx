import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

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

          return (
            <motion.div
              className={cn("punch", { [target]: true })}
              key={i}
              initial={{
                opacity: 0,
                scale: 2,
                rotate: isFirst ? -30 : 30,
                x: isFirst ? -80 : 80,
              }}
              animate={{
                opacity: 1,
                scale: 0.8,
                rotate: isFirst ? -10 : 10,
                x: isFirst ? -22 : 22,
              }}
              transition={{
                duration: punchDuration * 0.4,
                delay: isFirst ? 0 : 0.05,
                ease: "circOut",
              }}
            >
              <div className={cn("paw-stamp")}>
                <div className={cn("toe")} />
                <div className={cn("toe")} />
                <div className={cn("toe")} />
                <div className={cn("pad")} />
              </div>
            </motion.div>
          );
        })}

      {effectType === "seduce" && enabled && (
        <div className={cn("seduce", { [target]: true })}>
          <div className={cn("heart")} />
          <div className={cn("heart")} />
          <div className={cn("heart")} />
        </div>
      )}
    </AnimatePresence>
  );
}
