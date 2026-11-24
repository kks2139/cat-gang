import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { AdBanner } from "@/components/Ads";
import Button from "@/components/Button";
import Loading from "@/components/Loading";
import { type RankingRow, useRankingsQuery } from "@/queries/useRankingsQuery";
import { catCharacters } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const TABS = [
  { id: "book", label: "도감 수집률" },
  { id: "distance", label: "총 산책거리" },
  { id: "minions", label: "부하 수" },
  { id: "tower", label: "캣 타워" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MAX_RANKERS = 50;

interface Props {
  isShow: boolean;
  onClose: () => void;
}

interface RankedRow {
  row: RankingRow;
  rank: number;
}

// 탭별 정렬 키 + 동률 동순위 처리
const getRankedRows = (rows: RankingRow[], tab: TabId): RankedRow[] => {
  const key =
    tab === "book"
      ? "book_count"
      : tab === "distance"
      ? "total_distance"
      : tab === "tower"
      ? "tower_height"
      : "minion_count";

  const sorted = [...rows]
    .sort((a, b) => b[key] - a[key])
    .slice(0, MAX_RANKERS);

  let currentRank = 0;
  let prevValue = Number.POSITIVE_INFINITY;

  return sorted.map((row, index) => {
    const value = row[key];

    if (value !== prevValue) {
      currentRank = index + 1;
      prevValue = value;
    }

    return { row, rank: currentRank };
  });
};

const getTabValue = (row: RankingRow, tab: TabId) => {
  if (tab === "book") {
    const rate = Math.round((row.book_count / catCharacters.length) * 100);
    return {
      number: `${rate}`,
      unit: "%",
      sub: `${row.book_count}/${catCharacters.length}`,
      subUnit: "종",
    };
  }

  if (tab === "distance") {
    return {
      number: `${(row.total_distance / 1000).toFixed(2)}`,
      unit: "km",
      sub: undefined,
      subUnit: undefined,
    };
  }

  if (tab === "tower") {
    // RPC가 아직 타워 지표를 반환 전(마이그레이션 전) 환경 폴백
    return {
      number: `${Math.round(row.tower_height ?? 0)}`,
      unit: "m",
      sub: `${row.tower_count ?? 0}`,
      subUnit: "채",
    };
  }

  return {
    number: `${row.minion_count}`,
    unit: "마리",
    sub: undefined,
    subUnit: undefined,
  };
};

export default function RankingSheet({ isShow, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("book");
  const { data, isLoading, isError, refetch } = useRankingsQuery({
    enabled: isShow,
  });

  const ranked = data ? getRankedRows(data.rows, activeTab) : [];

  return (
    <AnimatePresence>
      {isShow && (
        <motion.div
          className={cn("ranking-modal")}
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
              <h3 className={cn("sheet-title")}>랭킹</h3>
              <button
                type="button"
                className={cn("close-btn")}
                onClick={onClose}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 카테고리 탭 */}
            <div className={cn("tabs")} role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={cn("tab", { active: activeTab === tab.id })}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="ranking-tab-pill"
                      className={cn("tab-pill")}
                      transition={{ type: "spring", damping: 28, stiffness: 320 }}
                      aria-hidden
                    />
                  )}
                  <span className={cn("tab-label")}>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 랭킹 목록 */}
            <div className={cn("sheet-body")}>
              {isLoading ? (
                <div className={cn("state")}>
                  <Loading noBackground />
                </div>
              ) : isError ? (
                <div className={cn("state")}>
                  <p className={cn("state-text")}>랭킹을 불러오지 못했다옹…</p>
                  <Button
                    color="primary"
                    size="small"
                    onClick={() => void refetch()}
                  >
                    재시도
                  </Button>
                </div>
              ) : ranked.length === 0 ? (
                <div className={cn("state")}>
                  <p className={cn("state-text")}>아직 랭커가 없다옹</p>
                </div>
              ) : (
                <ol className={cn("ranking-list")}>
                  {ranked.map(({ row, rank }) => {
                    const { number, unit, sub, subUnit } = getTabValue(
                      row,
                      activeTab
                    );

                    return (
                      <li key={row.user_id} className={cn("ranking-row")}>
                        <span
                          className={cn("rank", {
                            top: rank <= 3,
                            [`rank-${rank}`]: rank >= 1 && rank <= 3,
                          })}
                        >
                          {rank}
                        </span>
                        <div className={cn("name-cell")}>
                          <span className={cn("name")}>{row.name}</span>
                          {row.user_id === data?.myUserId && (
                            <span className={cn("my-badge")}>나</span>
                          )}
                        </div>
                        <span className={cn("value")}>
                          <span className={cn("value-number")}>{number}</span>
                          <em className={cn("value-unit")}>{unit}</em>
                          {sub && (
                            <>
                              <i className={cn("value-divider")} aria-hidden />
                              <em className={cn("value-sub")}>{sub}</em>
                              {subUnit && (
                                <em className={cn("value-unit")}>
                                  {subUnit}
                                </em>
                              )}
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* 시트 하단 배너 광고 (시트 닫힘 시 언마운트 → 자동 destroy) */}
            <AdBanner className={cn("sheet-ad")} adGroupId="ait-ad-test-banner-id" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
