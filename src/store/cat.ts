import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { type CatInfo } from "../utils/cats";

interface CatStore {
  selectedCat?: CatInfo;
  isShowStage: boolean;
  actions: {
    setSelectedCat: (value: CatInfo | undefined) => void;
    setIsShowStage: (value: boolean) => void;
  };
}

export const useCatStore = create<CatStore>()(
  immer((set) => ({
    selectedCat: undefined,
    isShowStage: false,
    actions: {
      setSelectedCat(value) {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.selectedCat = value as any;
        });
      },
      setIsShowStage(value) {
        set((state) => {
          state.isShowStage = value;
        });
      },
    },
  })),
);
