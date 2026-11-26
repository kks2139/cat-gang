import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import { type Message, useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 스택에서 밀릴 때(새 토스트 등장)의 레이아웃 이동 — 딜레이 없이 즉시 부드럽게
const LAYOUT_TRANSITION = { type: "spring", stiffness: 420, damping: 34 } as const;

// 개별 등장/정착 모션 — depth 스태거로 아래(최신)부터 순차적으로 떠오르는 느낌
const ENTRY_TRANSITION = {
  type: "spring",
  stiffness: 380,
  damping: 26,
  mass: 0.9,
} as const;

function ToastMessages({
  messages,
  reversed = false,
}: {
  messages: Message[];
  /** 하단 스택용 — 오래된 순으로 그려 최신 토스트가 아래 앵커에 고정 */
  reversed?: boolean;
}) {
  const visible = messages.slice(0, 4);
  const ordered = reversed ? [...visible].reverse() : visible;

  return (
    <AnimatePresence>
      {/* 최근 4개만 노출 — 나머지는 스택에서 숨겨 화면 가림을 막는다 */}
      {ordered.map(({ message, id }, index) => {
        // depth: 최신 토스트와의 거리 — 깊이 스타일/스태거 계산용
        const depth = reversed ? ordered.length - 1 - index : index;
        return (
          <motion.div
            key={id}
            className={cn("messages")}
            // scale은 아래 depth용으로 직접 애니메이션하므로 위치만 layout 처리
            layout="position"
            initial={{ opacity: 0, y: 28, scale: 0.92, rotateX: -12 }}
            animate={{
              opacity: 1 - depth * 0.25,
              y: 0,
              scale: 1 - depth * 0.04,
              rotateX: 0,
              zIndex: 100 - depth,
              // 뒤로 쌓인 토스트는 점점 어둡게 — depth가 바뀔 때 모션으로 부드럽게 전환
              filter:
                depth === 0 ? "brightness(1)" : "brightness(0.8)",
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
              // 스택 끝(가장 오래된) 토스트가 밀려 나가는 방향으로 사라짐
              y: reversed ? -20 : 20,
              transition: { duration: 0.2, ease: "easeOut" },
            }}
            transition={{
              // 스택 밀림(레이아웃)은 딜레이 없이 즉시 부드럽게
              layout: LAYOUT_TRANSITION,
              opacity: { duration: 0.25, delay: depth * 0.06 },
              y: { ...ENTRY_TRANSITION, delay: depth * 0.06 },
              scale: { ...ENTRY_TRANSITION, delay: depth * 0.06 },
              rotateX: { ...ENTRY_TRANSITION, delay: depth * 0.06 },
            }}
          >
            {message}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

export default function ToastMessage() {
  const toastMessages = useViewStore((s) => s.toastMessages);

  const bottomMessages = toastMessages.filter(
    (toast) => toast.position === undefined
  );
  const topMessages = toastMessages.filter(
    (toast) => toast.position === "top"
  );
  const centerMessages = toastMessages.filter(
    (toast) => toast.position === "center"
  );

  return (
    <>
      <div className={cn("ToastMessage")}>
        <ToastMessages messages={bottomMessages} reversed />
      </div>

      {/* 상단 토스트 — 오늘 산책 거리 캡슐 아래에 노출 */}
      <div className={cn("ToastMessage", "top")}>
        <ToastMessages messages={topMessages} />
      </div>

      {/* 보상 지급 같은 강조 토스트 — 화면 중앙에 노출 */}
      <div className={cn("ToastMessage", "center")}>
        <ToastMessages messages={centerMessages} />
      </div>
    </>
  );
}
