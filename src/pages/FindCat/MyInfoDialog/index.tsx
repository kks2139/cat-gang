import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
import Dialog from "@/components/Dialog";
import type { ItemType } from "@/components/Stage/Inventory";
import { useItemQuery } from "@/queries/useItemQuery";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { catCharacters, getGangInfo, MyCat } from "@/utils/cats";
import { NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

/** 보유 아이템 목록 — 클릭 시 광고 보상으로 2개를 추가한다 */
const INVENTORY_ITEMS: ReadonlyArray<{
  type: ItemType;
  name: string;
  img: string;
}> = [
  { type: "catnip", name: "캣잎", img: ImgCatnip },
  { type: "fish", name: "생선", img: ImgFish },
  { type: "gukbab", name: "국밥", img: ImgGukbab },
];

interface Props {
  onClose?: () => void;
  isShow?: boolean;
  /** 보유 아이템 클릭 — 광고 충전 다이얼로그는 FindCat 레벨에서 띄운다 (뒤로가기 이중 발화 방지) */
  onItemAdClick?: (itemType: ItemType) => void;
}

export default function MyInfoDialog({ onClose, isShow, onItemAdClick }: Props) {
  const { data: itemCount } = useItemQuery();
  const { data: catList } = useMyCatsQuery();

  const myCat = MyCat.getInstance().getMyCat();

  // 세력 정보: 부하 수 기반 칭호 + 보너스 표시용
  const minions = catList || [];
  const uniqueMinionCount = new Set(
    minions
      .filter(
        ({ cat_name }) =>
          catCharacters.find((c) => c.name === cat_name)?.rarity === "unique",
      )
      .map(({ cat_name }) => cat_name),
  ).size;
  const gangInfo = getGangInfo(minions.length, uniqueMinionCount);

  return (
    <Dialog
      className={cn("MyInfoDialog")}
      isShow={isShow}
      title="내 고양이"
      buttonLable="확인"
      onButtonClick={() => {
        onClose?.();
      }}
    >
      <div className={cn("profile-card")}>
        <div className={cn("cat-image-wrapper")}>
          <div className={cn("rarity-badge", myCat.rarity)}>
            {myCat.rarity.toUpperCase()}
          </div>
          <img src={ImgCatMe} alt={myCat.name} className={cn("cat-image")} />
        </div>

        <div className={cn("cat-details")}>
          <div className={cn("gang-title")}>{gangInfo.title}</div>
          <div className={cn("name")}>{myCat.name}</div>
          <div className={cn("crying")}>“{myCat.crying}”</div>

          <div className={cn("stats")}>
            <div className={cn("stat-item")}>
              <span className={cn("label")}>HP</span>
              <div className={cn("bar-container")}>
                <div
                  className={cn("bar", "hp")}
                  style={{ width: `${(myCat.hp / 20) * 100}%` }}
                ></div>
              </div>
              <span className={cn("value")}>{myCat.hp}</span>
            </div>
            <div className={cn("stat-item")}>
              <span className={cn("label")}>PWR</span>
              <div className={cn("bar-container")}>
                <div
                  className={cn("bar", "pwr")}
                  style={{ width: `${(myCat.punchPower / 10) * 100}%` }}
                ></div>
              </div>
              <span className={cn("value")}>{myCat.punchPower}</span>
            </div>
            <div className={cn("stat-item")}>
              <span className={cn("label")}>DEF</span>
              <div className={cn("bar-container")}>
                <div
                  className={cn("bar", "def")}
                  style={{ width: `${(myCat.defense / 10) * 100}%` }}
                ></div>
              </div>
              <span className={cn("value")}>{myCat.defense}</span>
            </div>
          </div>

          <div className={cn("gang-summary")}>
            부하 {gangInfo.minionCount}마리
            {gangInfo.hpBonus > 0 && ` · HP+${gangInfo.hpBonus}`}
            {gangInfo.punchBonus > 0 && ` · PWR+${gangInfo.punchBonus}`}
            {gangInfo.defBonus > 0 && ` · DEF+${gangInfo.defBonus}`}
          </div>
        </div>
      </div>

      <div className={cn("inventory-section")}>
        <div className={cn("section-title")}>보유 아이템</div>
        <div className={cn("inventory-wrapper")}>
          <ul className={cn("inventory-grid")}>
            {INVENTORY_ITEMS.map(({ type, name, img }) => (
              <li key={type}>
                <button
                  type="button"
                  className={cn("item-slot")}
                  onClick={() => onItemAdClick?.(type)}
                  aria-label={`${name} 광고 보고 충전`}
                >
                  <img src={img} alt={name} />
                  <NumberFlow
                    className={cn("count")}
                    value={itemCount?.[type] || 0}
                    spinTiming={NUMBER_FLOW_SPIN_TIMING}
                  />
                  <span className={cn("item-name")}>{name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
