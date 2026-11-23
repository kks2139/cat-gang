import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import Skeleton from "@/components/Skeleton";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import {
  getActiveTower,
  useCatTowerStore,
} from "@/store/catTower";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getCat } from "@/utils/cats";
import {
  resolveTowerColor,
  TOWER_THEMES,
} from "@/utils/catTowerThemes";
import { NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";
import { formatDuration } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

type SheetCat = CatInfo & { key: string };

interface Props {
  isShow: boolean;
  /**
   * list: 내 캣타워 목록 (높이/진행상태, 클릭 시 해당 타워로 포커싱)
   * cats: 작업고양이 추가용 목록만 노출 / decor: 타워 색상(꾸미기) 선택만 노출
   */
  mode?: "list" | "cats" | "decor";
  /** cats/decor 모드의 대상 타워 id (decor는 완공 타워에도 쓴다) */
  targetTowerId?: string;
  /** 목록에서 타워를 클릭 — 해당 타워로 지도 카메라를 옮긴다 */
  onSelectTower?: (towerId: string) => void;
  /** "새 캣타워 건설" 클릭 — 지도 위치 지정 모드로 진입한다 */
  onBuildTower?: () => void;
  onClose: () => void;
}

/** 캣 타워 바텀시트 — 내 캣타워 목록 / 작업고양이 추가 / 꾸미기 */
export default function CatTowerSheet({
  isShow,
  mode = "list",
  targetTowerId,
  onSelectTower,
  onBuildTower,
  onClose,
}: Props) {
  const towers = useCatTowerStore((s) => s.towers);
  const heights = useCatTowerStore((s) => s.heights);
  const activeTower = useCatTowerStore((s) => getActiveTower(s.towers));
  const { attach, detach, setColor } = useCatTowerStore((s) => s.actions);
  const { addToastMessage } = useViewStore((s) => s.actions);

  const { data, isLoading } = useMyCatsQuery();

  // cats 모드의 대상은 항상 건설중 타워 — 부하는 거기에만 붙는다
  const attachedKeys = activeTower?.attachedKeys ?? [];
  const currentColor = resolveTowerColor(
    towers.find((tower) => tower.id === targetTowerId)?.color
  ).id;

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
          className={cn("overlay", { "decor-overlay": mode === "decor" })}
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
                  {mode === "cats"
                    ? "작업고양이 추가"
                    : mode === "decor"
                      ? "타워 꾸미기"
                      : "캣 타워"}
                </h3>
                {mode === "list" && (
                  <span className={cn("tower-status")}>
                    {towers.length}동 보유 중
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

            {mode === "list" && (
              <p className={cn("sheet-hint")}>
                타워를 누르면 그 타워로 이동한다옹! 1000m를 채우면 완공되고
                새 타워를 세울 수 있다옹!
              </p>
            )}

            {mode === "cats" && (
              <p className={cn("sheet-hint")}>
                부하 1마리당 30분에 1m씩 자라난다옹! 레어는 1.5배, 유니크는
                2배로 일한다옹!
              </p>
            )}

            {mode === "decor" && (
              <p className={cn("sheet-hint")}>
                색을 골라 타워를 꾸며본다옹! 언제든 다시 바꿀 수 있다옹!
              </p>
            )}

            <div className={cn("sheet-body")}>
              {mode === "list" ? (
                <>
                  <ul className={cn("tower-list")}>
                    {towers.length > 0 ? (
                      towers.map((tower) => {
                        const height = heights[tower.id] ?? 0;
                        const isCompleted = !!tower.completedAt;

                        return (
                          <li key={tower.id}>
                            <button
                              type="button"
                              className={cn("tower-row")}
                              data-completed={isCompleted}
                              onClick={() => onSelectTower?.(tower.id)}
                            >
                              <span className={cn("tower-icon")}>🗼</span>
                              <div className={cn("info")}>
                                <div className={cn("height-row")}>
                                  <NumberFlow
                                    className={cn("height")}
                                    value={height}
                                    format={{
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    }}
                                    spinTiming={NUMBER_FLOW_SPIN_TIMING}
                                  />
                                  <span className={cn("unit")}>m</span>
                                  <span
                                    className={cn("status")}
                                    data-completed={isCompleted}
                                  >
                                    {isCompleted
                                      ? `완공 (${formatDuration(
                                          (tower.completedAt ?? 0) -
                                            tower.createdAt
                                        )})`
                                      : "건설중"}
                                  </span>
                                </div>
                                <div className={cn("sub")}>
                                  {isCompleted
                                    ? "부하들이 쉬고 있다옹"
                                    : `${tower.attachedKeys.length}마리 일하는 중`}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className={cn("empty")}>
                        아직 캣 타워가 없다옹!
                        <br />
                        새 캣타워를 세워 부하들을 붙여보자옹!
                      </li>
                    )}
                  </ul>

                  {!activeTower && (
                    <button
                      type="button"
                      className={cn("build-btn")}
                      onClick={onBuildTower}
                    >
                      🏗️ 새 캣타워 건설
                    </button>
                  )}
                </>
              ) : mode === "decor" ? (
                <ul className={cn("color-grid")}>
                  {TOWER_THEMES.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={cn("color-swatch")}
                        data-selected={currentColor === t.id}
                        onClick={() => {
                          if (!targetTowerId) {
                            return;
                          }

                          setColor(targetTowerId, t.id);
                          addToastMessage({
                            message: `타워 색을 ${t.name}으로 바꿨다옹!`,
                          });
                        }}
                      >
                        <span className={cn("chips")}>
                          <i style={{ background: t.day.trunkA }} />
                          <i style={{ background: t.day.trunkB }} />
                          <i style={{ background: t.day.nest }} />
                        </span>
                        <span className={cn("name")}>{t.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : isLoading ? (
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
                      const isAttached = attachedKeys.includes(cat.key);

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
                                    {cat.rarity === "unique"
                                      ? "유니크"
                                      : "레어"}
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
                              {isAttached ? "휴식하기" : "일 시키기"}
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
