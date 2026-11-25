import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";

import { AdBanner } from "@/components/Ads";
import Skeleton from "@/components/Skeleton";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import {
  getActiveTower,
  TOWER_REST_RECOVERY_RATE,
  TOWER_WORK_MS_BY_RARITY,
  useCatTowerStore,
} from "@/store/catTower";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getCat } from "@/utils/cats";
import { resolveTowerColor, TOWER_THEMES } from "@/utils/catTowerThemes";
import { NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";
import { formatDuration } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 휴식 회복 표시용 — 근무 1분이 회복되는 데 걸리는 휴식 시간 (분)
const REST_MIN_PER_WORK_MIN = Math.round(1 / TOWER_REST_RECOVERY_RATE);

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
  // 부하별 오늘 남은 근무 ms — 일하는 중/퇴근 표시에 쓴다
  const workLeft = useCatTowerStore((s) => s.workLeft);
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
                    ? "작업 고양이 추가"
                    : mode === "decor"
                    ? "타워 꾸미기"
                    : "캣 타워"}
                </h3>
                {mode === "list" && (
                  <span className={cn("tower-status")}>
                    {towers.length}채 보유 중
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
              <ul className={cn("sheet-hint-list")}>
                <li>
                  <span aria-hidden>👆</span>타워를 누르면 그 타워로 이동한다옹
                </li>
                <li>
                  <span aria-hidden>🎉</span>1000m를 채우면 완공 — 새 타워를
                  세울 수 있다옹
                </li>
              </ul>
            )}

            {mode === "cats" && (
              <ul className={cn("sheet-hint-list")}>
                <li>
                  <span className={cn("hint-icon")} aria-hidden>
                    🏗️
                  </span>
                  <span className={cn("hint-text")}>
                    부하 1마리가 <b>30분에 1m</b>씩 타워를 키운다옹 — 하루 근무
                    일반 <b>1시간</b> · 레어 <b>2시간</b> · 유니크{" "}
                    <b>3시간</b>
                  </span>
                </li>
                <li>
                  <span className={cn("hint-icon")} aria-hidden>
                    🛌
                  </span>
                  <span className={cn("hint-text")}>
                    근무 시간은 <b>다음 날</b> 다시 채워진다옹 — 휴식{" "}
                    <b>{REST_MIN_PER_WORK_MIN}분</b>당 <b>1분</b> 회복
                  </span>
                </li>
              </ul>
            )}

            {mode === "decor" && (
              <ul className={cn("sheet-hint-list")}>
                <li>
                  <span aria-hidden>🎨</span>색을 골라 타워를 꾸며본다옹
                </li>
                <li>
                  <span aria-hidden>🔄</span>언제든 다시 바꿀 수 있다옹
                </li>
              </ul>
            )}

            <div className={cn("sheet-body")}>
              {mode === "list" ? (
                <>
                  <ul className={cn("tower-list")}>
                    {towers.length > 0 ? (
                      towers.map((tower) => {
                        const height = heights[tower.id] ?? 0;
                        const isCompleted = !!tower.completedAt;
                        // 근무 중(오늘 근무가 남은) 부하 수 — 전원 퇴근이면 표시가 바뀐다
                        const workingCount = tower.attachedKeys.filter(
                          (key) => (workLeft[key] ?? 1) > 0
                        ).length;

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
                                    : tower.attachedKeys.length === 0
                                    ? "일하는 부하가 없다옹"
                                    : workingCount === 0
                                    ? "부하가 모두 퇴근했다옹"
                                    : `${workingCount}마리 일하는 중`}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className={cn("empty")}>
                        아직 캣 타워가 없다옹!
                        <br />새 캣타워를 세워 부하들을 붙여보자옹!
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
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i}>
                      <Skeleton w={64} h={64} />
                      <Skeleton w={"100%"} h={8} />
                      <Skeleton w={"70%"} h={20} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={cn("cat-list")}>
                  {myCats?.length ? (
                    myCats.map((cat) => {
                      const isAttached = attachedKeys.includes(cat.key);
                      // 오늘 근무 기록이 있으면 남은 시간, 없으면 등급 예산 그대로
                      const totalMs = TOWER_WORK_MS_BY_RARITY[cat.rarity];
                      const leftMs = workLeft[cat.key] ?? totalMs;
                      const isOffWork = leftMs <= 0;
                      const isWorking = isAttached && !isOffWork;
                      // 미부착 = 휴식 — 근무 시간이 회복되는 중 (예산까지 채움)
                      const isResting = !isAttached;
                      const progress = Math.max(
                        0,
                        Math.min(1, leftMs / totalMs)
                      );

                      return (
                        <li key={cat.key}>
                          <div
                            className={cn("cat-row")}
                            data-rarity={cat.rarity}
                            data-attached={isWorking}
                          >
                            <img src={cat.img} alt={cat.name} />
                            <div className={cn("who")}>
                              <div className={cn("name-col")}>
                                <span className={cn("name")}>{cat.name}</span>
                                {cat.rarity !== "common" && (
                                  <span className={cn("rarity")}>
                                    {cat.rarity === "unique"
                                      ? "유니크"
                                      : "레어"}
                                  </span>
                                )}
                              </div>
                              {/* 일하는 중 — 망치질 모션 + 상태 표기 */}
                              {isWorking && (
                                <span className={cn("work-stamp")} aria-hidden>
                                  <span className={cn("stamp-icon")}>🔨</span>
                                  <span className={cn("stamp-label")}>
                                    작업중
                                  </span>
                                </span>
                              )}
                              {/* 휴식 중 회복이 진행되는 동안만 낮잠 모션 — 시간이 꽉 찼으면 없음 */}
                              {isResting && leftMs < totalMs && (
                                <span
                                  className={cn("work-stamp", "resting")}
                                  aria-hidden
                                >
                                  <span className={cn("stamp-icon")}>💤</span>
                                  <span className={cn("stamp-label")}>
                                    휴식중
                                  </span>
                                </span>
                              )}
                            </div>
                            {/* 남은 근무는 붙어있든 아니든 오늘 예산 기준으로 모두 표시.
                                휴식 중이면 바가 다시 차오른다 */}
                            {isAttached && isOffWork ? (
                              <span className={cn("off-label")}>
                                퇴근 (휴식하면 회복)
                              </span>
                            ) : (
                              <div
                                className={cn("work-row")}
                                data-full={isResting && leftMs >= totalMs}
                              >
                                <div
                                  className={cn("work-bar")}
                                  role="progressbar"
                                  aria-label={`${cat.name} 남은 근무 시간`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(progress * 100)}
                                >
                                  <span
                                    className={cn("fill")}
                                    style={{ width: `${progress * 100}%` }}
                                  />
                                </div>
                                {/* 남은 시간은 분 단위로만 표기 — 회복 직후엔 회복 중 */}
                                <em className={cn("time")}>
                                  {!isAttached && isOffWork
                                    ? "회복 중"
                                    : `${Math.max(1, Math.ceil(leftMs / 60000))}분`}
                                </em>
                              </div>
                            )}
                            {/* 휴식/일시키기는 언제든 전환 가능 — 근무 시간이
                                0인 부하도 붙일 수 있다(기여 0, 떼면 회복) */}
                            <button
                              type="button"
                              className={cn("toggle-btn", {
                                detached: isAttached,
                              })}
                              onClick={() => {
                                if (isAttached) {
                                  detach(cat.key);
                                  addToastMessage({
                                    message: `${cat.name}가 휴식하며 근무 시간을 회복한다옹!`,
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

            {/* 시트 하단 배너 광고 (시트 닫힘 시 언마운트 → 자동 destroy) */}
            <AdBanner
              className={cn("sheet-ad")}
              adGroupId="ait-ad-test-banner-id"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
