import classNames from "classnames/bind";
import { differenceInCalendarDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";

import Dialog from "@/components/Dialog";
import type { OwnCat } from "@/components/Map";
import { type CatInfo, getCat } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 등급 뱃지 문구
const RARITY_LABEL: Record<CatInfo["rarity"], string> = {
  common: "일반",
  rare: "레어",
  unique: "유니크",
  legend: "레전드",
};

interface Props {
  onClose?: () => void;
  isShow?: boolean;
  ownCat?: OwnCat;
}

export default function OwnCatInfoDialog({ onClose, isShow, ownCat }: Props) {
  const selectedOwnCat = getCat(ownCat?.name || "");

  // 현재 시각 — 마운트 시점 1회 평가 (렌더 중 순수성 유지)
  const [now] = useState(() => Date.now());

  // 함께한 일수 — 포획한 날을 1일째로 세는 달력 일수 (24시간 몫 계산은
  // 시계 오차로 "-1일째"가 되는 문제가 있어 폐기)
  const daysTogether = ownCat?.createdAt
    ? differenceInCalendarDays(now, new Date(ownCat.createdAt)) + 1
    : undefined;

  return (
    <Dialog
      isShow={isShow}
      title="내 부하"
      isTitleLeft
      buttonLable="확인"
      onButtonClick={() => {
        onClose?.();
      }}
    >
      {selectedOwnCat && (
        <div className={cn("OwnCatInfoDialog")}>
          <div className={cn("cat-top")}>
            <div className={cn("cat-image-wrapper", selectedOwnCat.rarity)}>
              <img
                src={selectedOwnCat.img}
                alt={selectedOwnCat.name}
                className={cn("cat-image")}
              />
              <span className={cn("rarity-badge", selectedOwnCat.rarity)}>
                {RARITY_LABEL[selectedOwnCat.rarity]}
              </span>
            </div>

            <div className={cn("cat-side")}>
              <div className={cn("name")}>{selectedOwnCat.name}</div>
              <div className={cn("crying")}>“{selectedOwnCat.crying}”</div>

              {selectedOwnCat.activeTime && (
                <div className={cn("active-chip", selectedOwnCat.activeTime)}>
                  <span className={cn("chip-dot")} />
                  {selectedOwnCat.activeTime === "night" ? "야행성" : "주행성"}
                </div>
              )}
            </div>
          </div>

          <div className={cn("cat-details")}>
            <div className={cn("stats")}>
              {(
                [
                  ["HP", selectedOwnCat.hp, 20],
                  ["PWR", selectedOwnCat.punchPower, 10],
                  ["DEF", selectedOwnCat.defense, 10],
                ] as const
              ).map(([label, value, max]) => (
                <div className={cn("stat-item")} key={label}>
                  <span className={cn("label")}>{label}</span>
                  <div className={cn("bar-container")}>
                    <div
                      className={cn("bar", label.toLowerCase())}
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                  <span className={cn("value")}>{value}</span>
                </div>
              ))}
            </div>

            <div className={cn("catch-info")}>
              <div className={cn("catch-header")}>
                <span className={cn("icon")}>📅</span>
                <span className={cn("catch-label")}>포획 기록</span>
              </div>
              {ownCat?.createdAt && (
                <div className={cn("catch-data")}>
                  <div className={cn("date")}>
                    {format(ownCat.createdAt, "yyyy. MM. dd", {
                      locale: ko,
                    })}
                  </div>
                  <div className={cn("time")}>
                    {format(ownCat.createdAt, "(EEE) HH:mm", {
                      locale: ko,
                    })}
                  </div>
                </div>
              )}
              {daysTogether !== undefined && (
                <div className={cn("days-badge")}>{daysTogether}일째 함께</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
