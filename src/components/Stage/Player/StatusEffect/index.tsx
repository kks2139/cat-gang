import classNames from "classnames/bind";

import ImgPinkHeart from "@/assets/img/etc/pink-heart.png";
import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";

import type { DialogType } from "../../Control";
import type { ItemType } from "../../Inventory";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export type BuffAndDebuff =
  | Extract<ItemType, "fish" | "catnip">
  | Extract<DialogType, "seduce">;

export interface StatusEffectInfo {
  effect: BuffAndDebuff;
  endTurn: number;
}

const ImgMap: Record<BuffAndDebuff, string> = {
  catnip: ImgCatnip,
  fish: ImgFish,
  seduce: ImgPinkHeart,
};

interface Props {
  effect: BuffAndDebuff;
  restTurn?: number;
  className?: string;
}

export default function StatusEffect({ effect }: Props) {
  return (
    <div className={cn("StatusEffect")}>
      <div className={cn("wrapper")}>
        <img src={ImgMap[effect] || ""} alt="효과" />
      </div>
    </div>
  );
}
