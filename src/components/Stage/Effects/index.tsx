import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";

import { type Side } from "../Control";
import type { ItemType } from "../Inventory";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export type EffectType = "punch" | "seduce" | "lose" | "run" | "item";

interface Props {
  effectType?: EffectType;
  punchDuration: number;
  enabled: boolean;
  target?: Side;
  usedItem?: ItemType;
}

export default function Effects({
  effectType,
  punchDuration,
  enabled,
  target = "me",
  usedItem,
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
              style={
                {
                  "--punch-duration": `${punchDuration}s`,
                } as React.CSSProperties
              }
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

      {usedItem && enabled && (
        <div className={cn("item", { "to-enemy": usedItem === "fish" })}>
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
