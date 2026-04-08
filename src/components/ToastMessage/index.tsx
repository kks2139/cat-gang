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
        {toastMessages.map(({ message, id }) => (
          <motion.div
            key={id}
            className={cn("messages")}
            layout
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}
