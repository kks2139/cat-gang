import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { type CatInfo } from "@/utils/cats";
import { getRandomNumber } from "@/utils/helper";

import Button from "../../Button";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const MOTION_DATA = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.2 },
};

const Typing = ({ text, speed = 60 }: { text: string; speed?: number }) => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    setDisplayText("");

    let currentIndex = 0;

    const timer = setInterval(() => {
      if (currentIndex < text.length) {
        const nextChar = text.charAt(currentIndex);

        setDisplayText((prev) => prev + nextChar);
        currentIndex++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <div className={cn("text")}>
      <p>{displayText}</p>
    </div>
  );
};

export type DialogType = keyof CatInfo["dialog"] | "system";

export type Side = "me" | "enemy";

export interface DialogInfo {
  side?: Side;
  type: DialogType;
  speaker: string;
  text: string | string[];
  nextTurn?: Side;
}

interface Props {
  isShow: boolean;
  onPunch: () => void;
  onSeduce: () => void;
  onRun: () => void;
  onShowItems: () => void;
  dialogInfo?: DialogInfo;
  onDialogConfirmClick: (info: {
    type?: DialogType;
    causedBy: Side;
    nextTurn?: Side;
  }) => void;
}

export default function Control({
  isShow,
  onPunch,
  onSeduce,
  onRun,
  onShowItems,
  dialogInfo,
  onDialogConfirmClick,
}: Props) {
  const [menuType, setMenuType] = useState<"default" | "battle">();

  const content = useMemo(() => {
    if (Array.isArray(dialogInfo?.text)) {
      const index = getRandomNumber(dialogInfo.text.length);

      return dialogInfo.text[index];
    }

    return dialogInfo?.text || "";
  }, [dialogInfo?.text]);

  return (
    <div className={cn("Control")}>
      <AnimatePresence>
        {isShow ? (
          dialogInfo ? (
            <motion.div
              key="dialog"
              {...MOTION_DATA}
              whileTap={{ scale: 0.98, filter: "brightness(0.95)" }}
              className={cn("dialog")}
              onClick={() => {
                onDialogConfirmClick({
                  type: dialogInfo.type,
                  causedBy: dialogInfo.side || "me",
                  nextTurn: dialogInfo.nextTurn,
                });
              }}
            >
              <div className={cn("wrapper")}>
                <div className={cn("guide-text")}>click {"→"} 넘기기</div>
                <div className={cn("speaker")}>{`${dialogInfo.speaker}`}</div>
                <Typing text={content} />
              </div>
            </motion.div>
          ) : (
            <div className={cn("menu")}>
              {menuType === "battle" ? (
                <motion.ul key="fight" {...MOTION_DATA}>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        onPunch();
                      }}
                    >
                      냥냥펀치
                    </Button>
                  </li>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        onSeduce();
                      }}
                    >
                      유혹
                    </Button>
                  </li>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        onShowItems();
                      }}
                    >
                      인벤토리
                    </Button>
                  </li>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        setMenuType("default");
                      }}
                    >
                      뒤로
                    </Button>
                  </li>
                </motion.ul>
              ) : (
                <motion.ul key="default" {...MOTION_DATA}>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        setMenuType("battle");
                      }}
                    >
                      싸운다
                    </Button>
                  </li>
                  <li>
                    <Button
                      size="large"
                      onClick={() => {
                        onRun();
                      }}
                    >
                      튄다
                    </Button>
                  </li>
                </motion.ul>
              )}
            </div>
          )
        ) : null}
      </AnimatePresence>
    </div>
  );
}
