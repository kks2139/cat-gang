import classNames from "classnames/bind";

import { catCharacters } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  className?: string;
  catchedNames: Set<string>;
}

export default function CatBook({ className, catchedNames }: Props) {
  const collectedCount = catCharacters.filter((cat) =>
    catchedNames.has(cat.name),
  ).length;

  return (
    <div className={cn("CatBook", className)}>
      <div className={cn("progress-bar")}>
        <div className={cn("progress-fill")} />
        <span className={cn("progress-label")}>
          {collectedCount} / {catCharacters.length}종 수집
        </span>
      </div>

      <ul className={cn("grid")}>
        {catCharacters.map((cat) => {
          const isCatched = catchedNames.has(cat.name);
          const timeHint =
            cat.activeTime === "night"
              ? "밤에만 출몰"
              : cat.activeTime === "day"
                ? "낮에만 출몰"
                : "하루 종일";

          return (
            <li
              key={cat.name}
              className={cn("slot", { locked: !isCatched })}
              data-rarity={cat.rarity}
            >
              <img
                src={cat.img}
                alt={isCatched ? cat.name : "미수집"}
                className={cn("cat-img", { silhouette: !isCatched })}
              />
              <span className={cn("name")}>
                {isCatched ? cat.name : "???"}
              </span>
              <span className={cn("hint")}>{isCatched ? timeHint : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
