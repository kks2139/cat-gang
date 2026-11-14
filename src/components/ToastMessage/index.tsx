import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import { useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);
export default function ToastMessage() {
  const toastMessages = useViewStore((s) => s.toastMessages);

  return (
    <AnimatePresence>
      <div className={cn("ToastMessage")}>
        {toastMessages.slice(0, 5).map(({ message, id }, index) => (
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
      </div>
    </AnimatePresence>
  );
}
