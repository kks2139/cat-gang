import type { Map as MaplibreMap } from "maplibre-gl";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface Message {
  message: string;
  id: number;
  duration?: number;
  /** 노출 위치 (기본: 하단) — top은 상단 캡슐 아래, center는 강조 메시지용 중앙 */
  position?: "top" | "center";
}

// 토스트 id — 유일성만 필요하므로 단조 증가 카운터로 보장 (랜덤 중복 방지)
let toastIdSeq = 0;

interface ViewStore {
  toastMessages: Message[];
  map: MaplibreMap | null;
  // 내 위치 포커스 해제
  isStopFocusMe: boolean;
  isBattleOn: boolean;
  // 맵 초기 로딩중 ("찾는중" UI 노출중) 여부
  isMapLoading: boolean;
  // 맵 진입 리빌(CloudReveal 구름/안개)이 완전히 끝났는지 — 진입 연출 위에
  // 뭔가를 띄우지 말아야 할 때(캣 타워 완공 축하 연출 등) 판단용
  isMapRevealDone: boolean;
  // 맵(/find-cat) 첫 진입 여부 — keep-alive 유지 판단용 (진행 후 되돌릴 일 없음)
  isFindCatCached: boolean;
  actions: {
    addToastMessage: (message: Omit<Message, "id">) => void;
    removeToastMessage: () => void;
    setMap: (map: MaplibreMap | null) => void;
    setIsStopFocusMe: (value: boolean) => void;
    setIsBattleOn: (value: boolean) => void;
    setIsMapLoading: (value: boolean) => void;
    setIsMapRevealDone: (value: boolean) => void;
    setIsFindCatCached: (value: boolean) => void;
  };
}

export const useViewStore = create<ViewStore>()(
  immer((set, get) => ({
    toastMessages: [],
    map: null,
    isStopFocusMe: false,
    isBattleOn: false,
    isMapLoading: false,
    isMapRevealDone: false,
    isFindCatCached: false,
    actions: {
      addToastMessage({ message, duration = 2500, position }) {
        set((state) => {
          state.toastMessages.unshift({
            message,
            id: ++toastIdSeq,
            position,
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
      setIsMapRevealDone(value) {
        set((state) => {
          state.isMapRevealDone = value;
        });
      },
      setIsFindCatCached(value) {
        set((state) => {
          state.isFindCatCached = value;
        });
      },
    },
  }))
);
