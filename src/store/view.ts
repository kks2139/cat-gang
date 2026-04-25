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
  // 내 위치 포커스 해제
  isStopFocusMe: boolean;
  isBattleOn: boolean;
  actions: {
    addToastMessage: (message: Omit<Message, "id">) => void;
    removeToastMessage: () => void;
    setMap: (map: L.Map | null) => void;
    setIsStopFocusMe: (value: boolean) => void;
    setIsBattleOn: (value: boolean) => void;
  };
}

export const useViewStore = create<ViewStore>()(
  immer((set, get) => ({
    toastMessages: [],
    map: null,
    isStopFocusMe: false,
    isBattleOn: false,
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
      setIsStopFocusMe(value) {
        set((state) => {
          state.isStopFocusMe = value;
        });
      },
      setIsBattleOn(value) {
        set((state) => {
          state.isBattleOn = value;
        });
      },
    },
  })),
);
