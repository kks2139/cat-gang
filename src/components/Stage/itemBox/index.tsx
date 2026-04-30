import classNames from "classnames/bind";
import { motion } from "framer-motion";

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

function ItemSlot({ img, count, onClick }: ItemProps) {
  const isEmpty = !img || count === 0;
  if (isEmpty) return <div className={cn("itemSlot", "empty")} />;

  return (
    <div className={cn("itemSlot")} onClick={onClick}>
      <img src={img} alt="item" />
      {count !== undefined && count > 0 && (
        <div className={cn("countBadge")}>{count}</div>
      )}
    </div>
  );
}

interface Props {
  onClose: () => void;
  onSelect: (item: "gukbab" | "fish" | "catnip") => void;
}

export default function ItemBox({ onClose, onSelect }: Props) {
  const { data: itemCount } = useItemQuery();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("ItemBox")}
    >
      <motion.div
        initial={{ scale: 0.5, translateY: 100, opacity: 0 }}
        animate={{ scale: 1, translateY: 0, opacity: 1 }}
        exit={{ scale: 0.8, translateY: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 150 }}
        className={cn("inventoryPanel")}
      >
        <div className={cn("header")}>
          <h2>인벤토리</h2>
          <button className={cn("closeButton")} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={cn("content")}>
          <div className={cn("grid")}>
            <ItemSlot
              img={ImgGukbab}
              count={itemCount?.gukbab}
              onClick={() => onSelect("gukbab")}
            />
            <ItemSlot
              img={ImgFish}
              count={itemCount?.fish}
              onClick={() => onSelect("fish")}
            />
            <ItemSlot
              img={ImgCatnip}
              count={itemCount?.catnip}
              onClick={() => onSelect("catnip")}
            />
            {new Array(3).fill(null).map((_, i) => (
              <ItemSlot key={i} img="" />
            ))}
          </div>
        </div>

        <div className={cn("footer")}>뭘 쓸까옹~?</div>
      </motion.div>
    </motion.div>
  );
}
