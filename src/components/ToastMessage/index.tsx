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
            initial={{ opacity: 0, y: 20, scale: 0.7 }}
            animate={{
              opacity: 0.9,
              y: 0,
              scale: 1 - index * 0.05,
              zIndex: 100 - index,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              y: 20,
              transition: { duration: 0.2 },
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.8,
            }}
          >
            {message}
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}
