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
              className={cn("punch", { [target]: true, second: !isFirst })}
              key={i}
              style={{ "--punch-duration": `${punchDuration}s` } as React.CSSProperties}
              initial={{
                x: isFirst ? -30 : 20,
                y: isFirst ? -10 : 30,
                rotate: isFirst ? -15 : 15,
              }}
              animate={{
                x: isFirst ? -30 : 20,
                y: isFirst ? -10 : 30,
                rotate: isFirst ? -15 : 15,
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
