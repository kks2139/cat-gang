import classNames from "classnames/bind";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import Dialog from "@/components/Dialog";
import type { OwnCat } from "@/components/Map";
import { getCat } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  onClose?: () => void;
  isShow?: boolean;
  ownCat?: OwnCat;
}

export default function OwnCatInfoDialog({ onClose, isShow, ownCat }: Props) {
  const selectedOwnCat = getCat(ownCat?.name || "");

  return (
    <Dialog
      isShow={isShow}
      title="내 부하"
      buttonLable="확인"
      onButtonClick={() => {
        onClose?.();
      }}
    >
      {selectedOwnCat && (
        <div className={cn("OwnCatInfoDialog")}>
          <div className={cn("cat-image-wrapper")}>
            <div className={cn("rarity-badge", selectedOwnCat.rarity)}>
              {selectedOwnCat.rarity.toUpperCase()}
            </div>
            <img
              src={selectedOwnCat.img}
              alt={selectedOwnCat.name}
              className={cn("cat-image")}
            />
          </div>

          <div className={cn("cat-details")}>
            <div className={cn("name")}>{selectedOwnCat.name}</div>
            <div className={cn("crying")}>"{selectedOwnCat.crying}"</div>

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
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
