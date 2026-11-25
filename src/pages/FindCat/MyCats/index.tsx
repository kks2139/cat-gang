import classNames from "classnames/bind";
import { format, isToday, isYesterday } from "date-fns";

import Skeleton from "@/components/Skeleton";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getCat } from "@/utils/cats";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 포획 시각 문구 — 오늘이면 "오늘 HH:mm", 어제면 "어제 HH:mm", 그 전은 날짜 표기
const formatCaptureDate = (createdAt: string) => {
  const date = createdAt ? new Date(createdAt) : new Date();

  if (isToday(date)) {
    return `오늘 ${format(date, "HH:mm")}`;
  }

  if (isYesterday(date)) {
    return `어제 ${format(date, "HH:mm")}`;
  }

  return format(date, "yy-MM-dd HH:mm");
};

export interface CatCatched {
  lat: number;
  lng: number;
  createdAt: string;
}

type Rarity = CatInfo["rarity"];

const RARITY_LABEL: Record<Rarity, string> = {
  common: "일반",
  rare: "레어",
  unique: "유니크",
  legend: "레전드",
};

interface Props {
  className?: string;
  onClickCat: (info: CatCatched) => void;
}

export default function MyCats({ className, onClickCat }: Props) {
  const map = useViewStore((s) => s.map);

  const { data, isLoading } = useMyCatsQuery();

  const myCats = data
    ?.filter(({ cat_name }) => catCharacters.some((c) => c.name === cat_name))
    .map((c) => {
      const { lat, lng } = c.position as Pick<CatCatched, "lat" | "lng">;

      return {
        ...getCat(c.cat_name),
        lat,
        lng,
        createdAt: c.created_at,
      };
    }) as (CatInfo & CatCatched)[];

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
      <div className={cn("wrapper", className)}>
        {myCats?.length ? (
          <ul>
            {myCats.map((cat, i) => {
              const { name, rarity, img, crying, lat, lng, createdAt } = cat;

              return (
                <li key={name + i}>
                  <button
                    type="button"
                    data-rarity={rarity}
                    onClick={() => {
                      if (!map) {
                        return;
                      }

                      // 마커가 화면 하단(패딩 영역)에 가리지 않게 위로 띄우기 —
                      // 현재 줌 레벨의 지상 해상도(m/px)를 이용해 120픽셀을 미터로 환산
                      const zoom = map.getZoom() || 0;
                      const metersPerPixel =
                        (156543.03392 * Math.cos((lat * Math.PI) / 180)) /
                        Math.pow(2, zoom + 1); // MapLibre 512px 타일 기준
                      const offsetLat =
                        (metersPerPixel * 120) / 111320; // 120px만큼 위로

                      map.jumpTo({ center: [lng, lat - offsetLat] });
                      onClickCat({ lat, lng, createdAt });
                    }}
                  >
                    <img src={img} alt={name} width={100} height={100} />
                    <div className={cn("info")}>
                      <div className={cn("row")}>
                        <span className={cn("name")}>{name}</span>
                        {rarity !== "common" && (
                          <span className={cn("rarity")}>
                            {RARITY_LABEL[rarity]}
                          </span>
                        )}
                      </div>
                      <p className={cn("crying")}>{crying}</p>
                      <p className={cn("date")}>
                        포획 · {formatCaptureDate(createdAt)}
                      </p>
                    </div>
                    <span className={cn("locate")} aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={cn("empty")}>크흠.. 아무도 없군..</div>
        )}
      </div>
    </div>
  );
}
