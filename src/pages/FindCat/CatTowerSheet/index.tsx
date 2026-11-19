import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import Skeleton from "@/components/Skeleton";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useCatTowerStore } from "@/store/catTower";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getCat } from "@/utils/cats";
import { NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

type SheetCat = CatInfo & { key: string };

interface Props {
  isShow: boolean;
  /** full: 타워 상태 + 고양이 목록 전체 관리 / cats: 작업고양이 추가용 목록만 노출 */
  mode?: "full" | "cats";
  onClose: () => void;
}

/** 캣 타워 관리 시트 — 부하 고양이를 타워에 붙여 일을 시키거나 뗀다 */
export default function CatTowerSheet({ isShow, mode = "full", onClose }: Props) {
  const tower = useCatTowerStore((s) => s.tower);
  const height = useCatTowerStore((s) => s.height);
  const { attach, detach } = useCatTowerStore((s) => s.actions);
  const { addToastMessage } = useViewStore((s) => s.actions);

  const { data, isLoading } = useMyCatsQuery();

  const attachedCount = tower?.attachedKeys.length ?? 0;

  // 유효한 고양이만 매핑 (키: `${name}_${createdAt}`)
  const myCats = (data
    ?.filter(({ cat_name }) => catCharacters.some((c) => c.name === cat_name))
    .map((c) => ({
      ...getCat(c.cat_name),
      key: `${c.cat_name}_${c.created_at}`,
    })) || []) as SheetCat[];

  return (
    <AnimatePresence>
      {isShow && (
        <motion.div
          className={cn("overlay")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const el = target.closest("[data-bottom-sheet]");

            if (!el) {
              onClose();
            }
          }}
        >
          <motion.div
            data-bottom-sheet
            className={cn("sheet-container")}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className={cn("sheet-header")}>
              <div className={cn("title-row")}>
                <h3 className={cn("sheet-title")}>
                  {mode === "cats" ? "작업고양이 추가" : "캣 타워"}
                </h3>
                {mode === "full" && (
                  <span className={cn("tower-status")}>
                    <NumberFlow
                      value={height}
                      format={{
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }}
                      spinTiming={NUMBER_FLOW_SPIN_TIMING}
                    />
                    m · 일하는 중 {attachedCount}마리
                  </span>
                )}
              </div>
              <button
                type="button"
                className={cn("close-btn")}
                onClick={onClose}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {mode === "full" && (
              <p className={cn("sheet-hint")}>
                부하를 붙이면 즉시 2.5m 오르고, 붙어있는 동안 부하 1마리당
                30분에 1m씩 자라난다옹!
              </p>
            )}

            <div className={cn("sheet-body")}>
              {isLoading ? (
                <ul className={cn("loading")}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i}>
                      <Skeleton w={56} h={56} />
                      <Skeleton w={140} h={20} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={cn("cat-list")}>
                  {myCats?.length ? (
                    myCats.map((cat) => {
                      const isAttached = tower?.attachedKeys.includes(
                        cat.key
                      );

                      return (
                        <li key={cat.key}>
                          <div
                            className={cn("cat-row")}
                            data-rarity={cat.rarity}
                            data-attached={isAttached}
                          >
                            <img src={cat.img} alt={cat.name} />
                            <div className={cn("info")}>
                              <div className={cn("row")}>
                                <span className={cn("name")}>{cat.name}</span>
                                {cat.rarity !== "common" && (
                                  <span className={cn("rarity")}>
                                    {cat.rarity === "unique" ? "유니크" : "레어"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={cn("toggle-btn", {
                                detached: isAttached,
                              })}
                              onClick={() => {
                                if (isAttached) {
                                  detach(cat.key);
                                  addToastMessage({
                                    message: `${cat.name}가 캣 타워에서 내려왔다옹!`,
                                  });
                                } else {
                                  attach(cat.key);
                                  addToastMessage({
                                    message: `${cat.name}가 캣 타워에 붙었다옹!`,
                                  });
                                }
                              }}
                            >
                              {isAttached ? "떼기" : "붙이기"}
                            </button>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className={cn("empty")}>크흠.. 아무도 없군..</li>
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
