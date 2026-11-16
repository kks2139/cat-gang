import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import { type Message, useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

function ToastMessages({ messages }: { messages: Message[] }) {
  return (
    <AnimatePresence>
      {messages.slice(0, 5).map(({ message, id }, index) => (
        <motion.div
          key={id}
          className={cn("messages")}
          layout
          initial={{ opacity: 0, y: 24, scale: 0.92, rotateX: -12 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1 - index * 0.04,
            rotateX: 0,
            zIndex: 100 - index,
          }}
          exit={{
            opacity: 0,
            scale: 0.9,
            y: 16,
            transition: { duration: 0.18, ease: "easeOut" },
          }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 26,
            mass: 0.9,
          }}
        >
          {message}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function ToastMessage() {
  const toastMessages = useViewStore((s) => s.toastMessages);

  const bottomMessages = toastMessages.filter(
    (toast) => toast.position !== "center"
  );
  const centerMessages = toastMessages.filter(
    (toast) => toast.position === "center"
  );

  return (
    <>
      <div className={cn("ToastMessage")}>
        <ToastMessages messages={bottomMessages} />
      </div>

      {/* 보상 지급 같은 강조 토스트 — 화면 중앙에 노출 */}
      <div className={cn("ToastMessage", "center")}>
        <ToastMessages messages={centerMessages} />
      </div>
    </>
  );
}
