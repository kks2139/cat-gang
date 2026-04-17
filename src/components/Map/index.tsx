import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
// Marker 아이콘 깨짐 방지 (특정 환경에서 아이콘 경로가 인식 안 될 때 필요)
import { MapContainer, ScaleControl, TileLayer, useMap } from "react-leaflet";

import ImgCatMe from "@/assets/img/cat_me.png";
import { useCatStore } from "@/store/cat";
import { catCharacters } from "@/utils/cats";
import {
  animateMarker,
  createMarker,
  getCurrentPosition,
  getRandomLocationInCircle,
  getRandomNumber,
  removeMarkerWithMotion,
  watchPosition,
} from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const MAX_ZOOM_LEVEL = 19;
const MIN_ZOOM_LEVEL = 16;
const BOUNDARY_METER_OF_ME = 50;

export interface OwnCat {
  name: string;
  position: { lat: number; lng: number };
  createdAt?: string;
}

interface Props {
  className?: string;
  onClickCat?: () => void;
  ownCats?: OwnCat[];
  onClickOwnCat?: (value: OwnCat) => void;
}

function MapContent({ onClickCat, ownCats, onClickOwnCat }: Props) {
  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isInitLoading, setIsInitLoading] = useState(false);

  const isRendered = useRef(false);
  const isMapReady = useRef(false);
  const isWatchPositionReady = useRef(false);
  const centerPositionOfCats = useRef<L.LatLng>(undefined);
  const skyDecorationRef = useRef<HTMLDivElement>(null);

  const myCatRef = useRef<L.Marker>(null);
  const catMarkersRef = useRef<L.Marker[]>([]);
  const ownCatMarkersRef = useRef<L.Marker[]>([]);

  const map = useMap();

  const drawMe = useCallback(
    async (usePanTo?: boolean) => {
      const coords = await getCurrentPosition();

      if (!coords) {
        return;
      }

      if (myCatRef.current) {
        animateMarker(myCatRef.current, [coords.latitude, coords.longitude]);
      } else {
        const marker = createMarker({
          type: "me",
          imgUrl: ImgCatMe,
          map,
          position: [coords.latitude, coords.longitude],
        });

        marker.setZIndexOffset(99);

        myCatRef.current = marker;
      }

      // 현재 위치로 지도 중심 이동
      if (usePanTo) {
        map.panTo([coords.latitude, coords.longitude], { duration: 1 });
      } else {
        map.setView([coords.latitude, coords.longitude]);
      }

      return {
        coords,
      };
    },
    [map],
  );

  const drawCats = useCallback(() => {
    if (!myCatRef.current) {
      return;
    }

    const myPosition = myCatRef.current.getLatLng();

    if (centerPositionOfCats.current) {
      console.log(myPosition.distanceTo(centerPositionOfCats.current));
    }

    // 내 고양이 이전좌표랑 일정m 이상 차이날때만 cats 새로 그린다
    const canSkipDraw = centerPositionOfCats.current
      ? myPosition.distanceTo(centerPositionOfCats.current) <= 40
      : false;

    if (canSkipDraw) {
      return;
    }

    // 고양이들 그릴 중심점 업데이트
    centerPositionOfCats.current = myPosition;

    // 이전에 생성한 랜덤 마커들 해제
    catMarkersRef.current.forEach((marker) => {
      removeMarkerWithMotion(marker);
    });
    catMarkersRef.current = [];

    const filteredCats = catCharacters.filter(({ rarity }) => {
      const num = getRandomNumber(100);

      switch (rarity) {
        case "rare":
          return num < 20; // 그릴 확률
        case "unique":
          return num < 10; //
        default:
          return num < 40;
      }
    });

    filteredCats.forEach((cat) => {
      const randomLatLng = getRandomLocationInCircle(
        myPosition.lat,
        myPosition.lng,
        BOUNDARY_METER_OF_ME,
      );

      const marker = createMarker({
        type: "enemy",
        catName: cat.name,
        position: randomLatLng,
        imgUrl: cat.img,
        map: map,
      }).on("click", (e) => {
        const target = e.target as L.Marker;
        const el = target.getElement()?.querySelector("[data-status]") as
          | HTMLElement
          | undefined;

        if (el?.dataset.status !== "none") {
          return;
        }

        setSelectedCat({ ...cat, marker });

        onClickCat?.();
      });

      catMarkersRef.current.push(marker);
    });
  }, [map, onClickCat, setSelectedCat]);

  const drawOwnCats = useCallback(() => {
    // 이전에 생성한 랜덤 마커들 해제
    ownCatMarkersRef.current.forEach((marker) => {
      marker.remove();
    });
    ownCatMarkersRef.current = [];

    // 잡은 고양이들 overlay 그리기
    ownCats?.forEach((cat) => {
      const { position } = cat;

      const marker = createMarker({
        position: [position.lat, position.lng],
        type: "owned",
        map,
      }).on("click", () => {
        onClickOwnCat?.(cat);
      });

      ownCatMarkersRef.current.push(marker);
    });
  }, [map, onClickOwnCat, ownCats]);

  const createMeAndCats = useCallback(
    async (usePanTo?: boolean) => {
      await drawMe(usePanTo);
      drawCats();
    },
    [drawCats, drawMe],
  );

  const setCloudScale = (scale: number) => {
    skyDecorationRef.current?.style.setProperty("--cloud-zoom", String(scale));
  };

  useEffect(() => {
    if (!isRendered.current) {
      return;
    }

    // 잡은 고양이들 변경 시, 다시 그리기
    drawOwnCats();
  }, [drawOwnCats, ownCats]);

  useEffect(() => {
    if (isRendered.current) {
      return;
    }

    isRendered.current = true;

    (async () => {
      setIsInitLoading(true);

      await createMeAndCats();

      setIsInitLoading(false);
      isRendered.current = true;
    })();
  }, [createMeAndCats, map]);

  useEffect(() => {
    if (isInitLoading || isWatchPositionReady.current) {
      return;
    }

    isWatchPositionReady.current = true;

    (async () => {
      // 위치변화 감지 시, 다시 그리기
      const watchId = await watchPosition(() => {
        if (!myCatRef.current) {
          return;
        }

        createMeAndCats(true);
      });

      return () => {
        navigator.geolocation.clearWatch(watchId || 0);
      };
    })();
  }, [createMeAndCats, isInitLoading]);

  useEffect(() => {
    // map 세팅 및 이벤트 등록
    if (!map || isMapReady.current) {
      return;
    }

    isMapReady.current = true;

    // 구름 스케일 초기화
    setCloudScale(MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL + 1);

    map
      .on("zoomend", () => {
        const pos = myCatRef.current?.getLatLng();

        if (pos) {
          map.setView([pos.lat, pos.lng]);
        }
      })
      .on("zoomanim", (e) => {
        setCloudScale(e.zoom - MIN_ZOOM_LEVEL + 1);
      });
  }, [map]);

  return (
    <div className={cn("map-content")}>
      <div ref={skyDecorationRef} className={cn("sky-decoration")}>
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className={cn("cloud", `c${i + 1}`)} />
        ))}
      </div>

      <AnimatePresence>
        {isInitLoading && (
          <motion.div
            className={cn("loading")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <div className={cn("paw-animation")}>
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={cn("paw")} />
              ))}
            </div>
            <div className={cn("loading-text")}>
              {["찾", "는", "중", ".", ".", "."].map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Map({ className, ...rest }: Props) {
  const [isNight, setIsNight] = useState(false);

  useEffect(() => {
    const hours = new Date().getHours();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNight(hours >= 18 || hours < 6);
  }, []);

  return (
    <MapContainer
      className={cn("Map", className)}
      center={[37.5665, 126.978]} // 센터 기본값 서울시청
      zoom={MAX_ZOOM_LEVEL}
      maxZoom={MAX_ZOOM_LEVEL}
      minZoom={MIN_ZOOM_LEVEL}
      zoomControl={false}
      scrollWheelZoom={"center"}
      doubleClickZoom={"center"}
      touchZoom={"center"}
      attributionControl={false} // 하단 저작권 표시줄 전체 삭제
      dragging={false}
      bounceAtZoomLimits={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      <MapContent {...rest} />

      <ScaleControl
        position="bottomleft" // 위치 설정 (topleft, topright, bottomleft, bottomright)
        imperial={false} // 마일(mi) 단위 표시 여부 (false면 미터법만 표시)
        maxWidth={100} // 축척 바의 최대 길이 (픽셀 단위)
      />
      {isNight && <div className={cn("night-overlay")} />}
    </MapContainer>
  );
}
