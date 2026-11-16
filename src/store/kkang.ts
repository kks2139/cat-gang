import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { DAILY_KKANG_COUNT, getTodayKkang, storeTodayKkang } from "@/utils/storage";

interface KkangStore {
  /** 오늘 남은 깡 개수 (하루 DAILY_KKANG_COUNT개, 자정 리셋) */
  count: number;
  /** storage 로드 완료 여부 — 로드 전에는 전투 게이트 클릭을 무시한다 */
  isInitialized: boolean;
  actions: {
    /** storage에서 오늘 깡을 로드한다. 값이 없으면(오늘 첫 접속) 기본 개수로 초기화 */
    init: () => Promise<void>;
    /** 깡 1개 소모 (전투 시작). 0 이하면 아무것도 하지 않는다 */
    consumeOne: () => void;
    /** 깡 충전 (광고 보상) — 일일 기본 개수와 별도로 보상분은 초과 허용 */
    add: (amount: number) => void;
  };
}

export const useKkangStore = create<KkangStore>()(
  immer((set) => ({
    count: 0,
    isInitialized: false,
    actions: {
      async init() {
        const stored = await getTodayKkang();
        const count = stored > 0 ? stored : DAILY_KKANG_COUNT;

        set((state) => {
          state.count = count;
          state.isInitialized = true;
        });

        // 오늘 첫 접속이면 기본 개수를 저장해 둔다
        await storeTodayKkang(count);
      },
      consumeOne() {
        set((state) => {
          if (state.count <= 0) {
            return;
          }

          state.count -= 1;
          // storage 저장은 fire-and-forget — 실패해도 다음 변이가 전체 값을 다시 쓴다
          void storeTodayKkang(state.count);
        });
      },
      add(amount) {
        set((state) => {
          // 광고 보상으로 얻은 깡은 일일 기본 개수를 초과해도 그대로 누적한다
          // (일일 상한으로 막으면 깡이 가득 찼을 때 광고 보상이 사라진다)
          state.count += amount;
          void storeTodayKkang(state.count);
        });
      },
    },
  })),
);
