import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { type CatInfo } from "../utils/cats";

interface CatStore {
  selectedCat?: CatInfo;
  catchedCats: CatInfo[];
  actions: {
    setSelectedCat: (value: CatInfo | undefined) => void;
    addCatchedCat: (value: CatInfo) => void;
  };
}

export const useCatStore = create<CatStore>()(
  immer((set) => ({
    selectedCat: undefined,
    catchedCats: [],
    actions: {
      setSelectedCat(value) {
        set((state) => {
          state.selectedCat = value;
        });
      },
      addCatchedCat(value) {
        set((state) => {
          state.catchedCats.push(value);
        });
      },
    },
  }))
);
