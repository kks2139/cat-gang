import classNames from "classnames/bind";
import { motion, type MotionNodeAnimationOptions } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { type CatInfo } from "@/utils/cats";

import { type EffectType } from "../Effects";
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
}

function CatVisual({
  cat,
  effectType,
  catImgIntroMotion,
  children,
}: CatVisualProps) {
  return (
    <motion.div {...catImgIntroMotion} className={cn("visual-wrap")}>
      {!!cat && (
        <>
          <img
            className={cn("cat-img", {
              [effectType || ""]: true,
            })}
            src={cat.img || ""}
            alt={cat.name || ""}
            width={100}
            height={100}
          />
          <div className={cn("cat-shadow")} />
        </>
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
  introMotion,
  punchDuraion = 1,
  seduceDuraion = 1,
  effectType,
  catImgIntroMotion,
  children,
  side,
  isSpeaking,
}: Props) {
  const [hpEffect, setHpEffect] = useState<StatusProps["hpEffect"]>();
  const prevHp = useRef(hp);

  const isMe = side === "me";

  const status = useMemo(
    () => (
      <Status cat={cat} hp={hp} introMotion={introMotion} hpEffect={hpEffect} />
    ),
    [cat, hp, hpEffect, introMotion],
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

      <div className={cn("cat", { speaking: isSpeaking })}>
        <CatVisual
          cat={cat}
          effectType={effectType}
          punchDuraion={punchDuraion}
          seduceDuraion={seduceDuraion}
          catImgIntroMotion={catImgIntroMotion}
        />
        {children}
      </div>

      {isMe && status}
    </div>
  );
}
