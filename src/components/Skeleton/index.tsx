import classNames from "classnames/bind";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  w?: number | string;
  h?: number | string;
  r?: number;
}

function Skeleton({ w, h = 15, r = 10 }: Props) {
  return (
    <div
      data-skeleton
      className={cn("Skeleton")}
      style={{
        width: w ? (typeof w === "number" ? `${w}px` : w) : "auto",
        height: h ? (typeof h === "number" ? `${h}px` : h) : "auto",
        borderRadius: r,
      }}
    ></div>
  );
}

export default Skeleton;
