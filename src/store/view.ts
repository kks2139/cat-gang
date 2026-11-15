import type { Map as MaplibreMap } from "maplibre-gl";
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
  map: MaplibreMap | null;
  // 내 위치 포커스 해제
  isStopFocusMe: boolean;
  isBattleOn: boolean;
  // 맵 초기 로딩중 ("찾는중" UI 노출중) 여부
  isMapLoading: boolean;
  actions: {
    addToastMessage: (message: Omit<Message, "id">) => void;
    removeToastMessage: () => void;
    setMap: (map: MaplibreMap | null) => void;
    setIsStopFocusMe: (value: boolean) => void;
    setIsBattleOn: (value: boolean) => void;
    setIsMapLoading: (value: boolean) => void;
  };
}

export const useViewStore = create<ViewStore>()(
  immer((set, get) => ({
    toastMessages: [],
    map: null,
    isStopFocusMe: false,
    isBattleOn: false,
    isMapLoading: false,
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
          // maplibre 인스턴스는 immer 프록시로 감싸지 않는다 (GL 내부 구조 보호)
          state.map = map as never;
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
      setIsMapLoading(value) {
        set((state) => {
          state.isMapLoading = value;
        });
      },
    },
  })),
);
