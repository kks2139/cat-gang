import classNames from "classnames/bind";

import Skeleton from "@/components/Skeleton";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { catCharacters } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  onClose: () => void;
}

export default function MyCats({ onClose }: Props) {
  const { data, isLoading } = useMyCatsQuery();

  const myCats = catCharacters.filter(({ name }) =>
    data?.some((c) => c.cat_name === name)
  );

  if (isLoading) {
    return (
      <ul className={cn("loading")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i}>
            <Skeleton w={40} h={40} />
            <Skeleton w={160} h={20} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("MyCats")}>
      <button
        className={cn("close-button")}
        type="button"
        onClick={() => {
          onClose();
        }}
      >
        닫기
      </button>

      <div className={cn("wrapper")}>
        {myCats?.length ? (
          <ul>
            {myCats.map(({ name, img, crying }) => (
              <li key={name}>
                <img src={img} alt={name} width={50} height={50} />
                <span>{name} :</span>
                <span>{crying}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={cn("empty")}>크흡.. 부하가 하나도 없다니</div>
        )}
      </div>
    </div>
  );
}
