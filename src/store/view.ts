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

// 메시지별 제거 타이머 — duration이 섞여도 만료 순서가 어긋나지 않는다
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

// 스토어 보유 상한 (화면 노출은 ToastMessage에서 최근 4개로 제한, 나머지는 숨김 스택)
const MAX_STORED_TOASTS = 10;

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
    removeToastMessage: (id?: number) => void;
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
          const id = ++toastIdSeq;
          state.toastMessages.unshift({ message, id, position });
          toastTimers.set(
            id,
            setTimeout(() => get().actions.removeToastMessage(id), duration)
          );

          // 스토어 보유 상한 — 초과분은 즉시 폐기 (화면 노출은 렌더러에서 제한)
          if (state.toastMessages.length > MAX_STORED_TOASTS) {
            const dropped = state.toastMessages.pop();
            if (dropped) {
              const droppedTimer = toastTimers.get(dropped.id);
              if (droppedTimer) clearTimeout(droppedTimer);
              toastTimers.delete(dropped.id);
            }
          }
        });
      },
      removeToastMessage(id?: number) {
        set((state) => {
          // id 지정 시 해당 토스트만, 미지정 시 가장 오래된 것 제거 (하위 호환)
          const index =
            id === undefined
              ? state.toastMessages.length - 1
              : state.toastMessages.findIndex((toast) => toast.id === id);
          if (index === -1) return;
          const removed = state.toastMessages.splice(index, 1)[0];
          if (removed) {
            const timer = toastTimers.get(removed.id);
            if (timer) clearTimeout(timer);
            toastTimers.delete(removed.id);
          }
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
