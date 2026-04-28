import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { CatCatched } from "@/pages/FindCat/MyCats";

import { type CatInfo } from "../utils/cats";

interface CatStore {
  isShowStage: boolean;
  selectedCat?: CatInfo;
  clickedOwnCat?: CatCatched;
  actions: {
    setIsShowStage: (value: boolean) => void;
    setSelectedCat: (value: CatInfo | undefined) => void;
    setClickedOwnCat: (value: CatCatched | undefined) => void;
  };
}

export const useCatStore = create<CatStore>()(
  immer((set) => ({
    isShowStage: false,
    selectedCat: undefined,
    clickedOwnCat: undefined,
    actions: {
      setIsShowStage(value) {
        set((state) => {
          state.isShowStage = value;
        });
      },
      setSelectedCat(value) {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.selectedCat = value as any;
        });
      },
      setClickedOwnCat(value) {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.clickedOwnCat = value as any;
        });
      },
    },
  })),
);
