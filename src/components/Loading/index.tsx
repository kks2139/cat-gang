import classNames from "classnames/bind";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  text?: string;
  className?: string;
}

export default function Loading({ text, className }: Props) {
  return (
    <div className={cn("Loading", className)}>
      <div className={cn("paw-animation")}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={cn("paw")} />
        ))}
      </div>

      {text && (
        <div className={cn("loading-text")}>
          {text.split("").map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
      )}
    </div>
  );
}
