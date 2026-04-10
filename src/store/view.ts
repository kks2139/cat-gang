import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { getRandomNumber } from "@/utils/helper";

interface Message {
  message: string;
  id: number;
  duration?: number;
}

interface ViewStore {
  toastMessages: Message[];
  actions: {
    addToastMessage: (message: Omit<Message, "id">) => void;
    removeToastMessage: () => void;
  };
}

export const useViewStore = create<ViewStore>()(
  immer((set, get) => ({
    toastMessages: [],
    actions: {
      addToastMessage({ message, duration = 2000 }) {
        set((state) => {
          state.toastMessages.unshift({
            message,
            id: getRandomNumber(10000),
          });

          setTimeout(() => {
            get().actions.removeToastMessage();
          }, duration);
        });
      },
      removeToastMessage() {
        set((state) => {
          state.toastMessages.pop();
        });
      },
    },
  }))
);
