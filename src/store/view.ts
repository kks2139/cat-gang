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
  // 캣 타워 팝업(포커스)을 닫는 함수 — 팝업이 열려 있을 때만 CatTower가 등록한다.
  // 다른 UI 버튼(독/상단) 클릭 시 포커스를 함께 풀기 위해 외부에서 호출한다
  closeTowerPopup: (() => void) | null;
  // 내 위치로 카메라를 옮기는 함수 — Map이 등록하고, 하단 독의 내위치 버튼(FindCat)이 호출한다
  locateMe: (() => void) | null;
  actions: {
    setCloseTowerPopup: (close: (() => void) | null) => void;
    setLocateMe: (locate: (() => void) | null) => void;
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
    closeTowerPopup: null,
    locateMe: null,
    actions: {
      setCloseTowerPopup(close) {
        set((state) => {
          state.closeTowerPopup = close;
        });
      },
      setLocateMe(locate) {
        set((state) => {
          state.locateMe = locate;
        });
      },
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
