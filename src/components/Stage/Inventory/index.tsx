import classNames from "classnames/bind";
import { motion } from "framer-motion";
import { useMemo } from "react";

import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
import Loading from "@/components/Loading";
import { useItemQuery } from "@/queries/useItemQuery";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface ItemProps {
  img: string;
  count?: number;
  onClick?: () => void;
}

function Slot({ img, count, onClick }: ItemProps) {
  const isEmpty = !img || count === 0;
  if (isEmpty) return <div className={cn("slot", "empty")} />;

  return (
    <div className={cn("slot")} onClick={onClick}>
      <img src={img} alt="item" />
      {count !== undefined && count > 0 && (
        <div className={cn("countBadge")}>{count}</div>
      )}
    </div>
  );
}

export type ItemType = "gukbab" | "fish" | "catnip";

interface Props {
  onClose: () => void;
  onSelect: (item: ItemType, currCount: number) => void;
}

export default function Inventory({ onClose, onSelect }: Props) {
  const { data: itemCount, isLoading } = useItemQuery();
  const { gukbab = 0, fish = 0, catnip = 0 } = itemCount || {};

  const slots = useMemo(() => {
    const arr = [];

    if (gukbab)
      arr.push({
        img: ImgGukbab,
        count: gukbab,
        onClick: () => onSelect("gukbab", gukbab),
      });
    if (fish)
      arr.push({
        img: ImgFish,
        count: fish,
        onClick: () => onSelect("fish", fish),
      });
    if (catnip)
      arr.push({
        img: ImgCatnip,
        count: catnip,
        onClick: () => onSelect("catnip", catnip),
      });

    return arr;
  }, [catnip, fish, gukbab, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("Inventory")}
    >
      <motion.div
        initial={{ scale: 0.5, translateY: 100, opacity: 0 }}
        animate={{ scale: 1, translateY: 0, opacity: 1 }}
        exit={{ scale: 0.8, translateY: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 150 }}
        className={cn("inventoryPanel")}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={cn("header")}>
          <h2>인벤토리</h2>
          <button type="button" className={cn("closeButton")} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={cn("content")}>
          {isLoading ? (
            <Loading className={cn("loading")} noBackground />
          ) : (
            <div className={cn("grid")}>
              {slots.map((slot, i) => (
                <Slot
                  key={i}
                  img={slot.img}
                  count={slot.count}
                  onClick={slot.onClick}
                />
              ))}

              {Array.from({ length: 6 - slots.length }, (_, i) => (
                <Slot key={i} img="" />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
