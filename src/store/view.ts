import L from "leaflet";
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
  map: L.Map | null;
  actions: {
    addToastMessage: (message: Omit<Message, "id">) => void;
    removeToastMessage: () => void;
    setMap: (map: L.Map | null) => void;
  };
}

export const useViewStore = create<ViewStore>()(
  immer((set, get) => ({
    toastMessages: [],
    map: null,
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
      setMap(map) {
        set((state) => {
          state.map = map;
        });
      },
    },
  })),
);
