import classNames from "classnames/bind";
import { motion } from "framer-motion";
import { useMemo } from "react";

import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
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
  onSelect: (item: ItemType) => void;
}

export default function Inventory({ onClose, onSelect }: Props) {
  const { data: itemCount } = useItemQuery();

  const slots = useMemo(() => {
    const arr = [];

    if (itemCount?.gukbab)
      arr.push({
        img: ImgGukbab,
        count: itemCount?.gukbab,
        onClick: () => onSelect("gukbab"),
      });
    if (itemCount?.fish)
      arr.push({
        img: ImgFish,
        count: itemCount?.fish,
        onClick: () => onSelect("fish"),
      });
    if (itemCount?.catnip)
      arr.push({
        img: ImgCatnip,
        count: itemCount?.catnip,
        onClick: () => onSelect("catnip"),
      });

    return arr;
  }, [itemCount?.catnip, itemCount?.fish, itemCount?.gukbab, onSelect]);

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
        </div>
      </motion.div>
    </motion.div>
  );
}
