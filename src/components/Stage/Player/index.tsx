import classNames from "classnames/bind";
import { motion, type MotionNodeAnimationOptions } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { type CatInfo } from "@/utils/cats";

import { type EffectType } from "../Effects";
import type { ItemType } from "../Inventory";
import styles from "./index.module.scss";
import { Status, type StatusProps } from "./Status";

const cn = classNames.bind(styles);

interface CatVisualProps {
  cat?: CatInfo;
  effectType?: EffectType;
  punchDuraion?: number;
  seduceDuraion?: number;
  catImgIntroMotion?: MotionNodeAnimationOptions;
  children?: React.ReactNode;
  usedItem?: ItemType;
}

function CatVisual({
  cat,
  effectType,
  catImgIntroMotion,
  children,
  usedItem,
}: CatVisualProps) {
  return (
    <motion.div
      {...catImgIntroMotion}
      className={cn("visual-wrap", { [usedItem || ""]: true })}
    >
      {!!cat && (
        <div className={cn("wrapper")}>
          <img
            className={cn("cat-img", {
              [effectType || ""]: true,
            })}
            src={cat.img || ""}
            alt={cat.name || ""}
          />
          <div className={cn("cat-shadow")} />
        </div>
      )}
      {children}
    </motion.div>
  );
}

interface Props extends StatusProps, CatVisualProps {
  side: "me" | "enemy";
  isSpeaking?: boolean;
  children?: React.ReactNode;
}

export default function Player({
  cat,
  hp,
  defense,
  introMotion,
  punchDuraion = 1,
  seduceDuraion = 1,
  effectType,
  catImgIntroMotion,
  children,
  side,
  isSpeaking,
  usedItem,
}: Props) {
  const [hpEffect, setHpEffect] = useState<StatusProps["hpEffect"]>();
  const prevHp = useRef(hp);

  const isMe = side === "me";

  const status = useMemo(
    () => (
      <Status
        cat={cat}
        hp={hp}
        defense={defense}
        introMotion={introMotion}
        hpEffect={hpEffect}
      />
    ),
    [cat, defense, hp, hpEffect, introMotion],
  );

  useEffect(() => {
    if (prevHp.current === hp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHpEffect(undefined);
    } else {
      setHpEffect(prevHp.current < hp ? "up" : "down");
      setTimeout(() => setHpEffect(undefined), 1000);
    }

    prevHp.current = hp;
  }, [hp]);

  return (
    <div className={cn("Player")}>
      {!isMe && status}

      <div
        className={cn("cat", {
          speaking: isSpeaking,
          "item-effect": effectType === "item",
        })}
      >
        <CatVisual
          cat={cat}
          effectType={effectType}
          punchDuraion={punchDuraion}
          seduceDuraion={seduceDuraion}
          catImgIntroMotion={catImgIntroMotion}
          usedItem={effectType && usedItem}
        />
        {children}
      </div>

      {isMe && status}
    </div>
  );
}
