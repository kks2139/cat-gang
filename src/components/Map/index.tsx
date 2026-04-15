import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatMe from "@/assets/img/cat_me.png";
import { useCatStore } from "@/store/cat";
import { catCharacters } from "@/utils/cats";
import {
  calculateDistanceOverMeters,
  createCustomOverlay,
  getCurrentPosition,
  getRandomLocationInCircle,
  getRandomNumber,
} from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

const MAX_ZOOM_LEVEL = 3;
const BOUNDARY_METER_OF_ME = 50;
const POLLING_MS = 3000;

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

export default function Map({
  className,
  onClickCat,
  ownCats,
  onClickOwnCat,
}: Props) {
  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isInitLoading, setIsInitLoading] = useState(false);
  const [kakaoMap, setKakaoMap] = useState<kakao.maps.Map>();

  const isRendered = useRef(false);
  const currentPositionTimer = useRef(0);
  const zoomLevel = useRef<1 | 2>(1);
  const prevPosition = useRef<GeolocationCoordinates>(undefined);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map>(null);

  const myCatOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const catOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const ownCatOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  const drawMe = useCallback(async (usePanTo = true) => {
    if (!mapRef.current || !navigator.geolocation) {
      return;
    }
    const coords = await getCurrentPosition();

    if (!coords) {
      return;
    }

    const { latitude, longitude } = coords;
    const position = new kakao.maps.LatLng(latitude, longitude);
    const { overlay } = createCustomOverlay({
      type: "me",
      position,
      imgUrl: ImgCatMe,
      map: mapRef.current,
    });

    if (myCatOverlayRef.current) {
      myCatOverlayRef.current.setMap(null);
    }

    myCatOverlayRef.current = overlay;

    if (usePanTo) {
      mapRef.current!.panTo(overlay.getPosition());
    }

    return {
      coords,
    };
  }, []);

  const drawCats = useCallback(() => {
    if (!myCatOverlayRef.current) {
      return;
    }

    const myPosition = myCatOverlayRef.current.getPosition();

    // 내 고양이 이전좌표랑 20m 이상 차이날때만 cats 새로 그린다
    const needToDraw = calculateDistanceOverMeters(prevPosition.current, {
      latitude: myPosition.getLat(),
      longitude: myPosition.getLng(),
    });

    if (!needToDraw) {
      return;
    }

    // 이전에 생성한 랜덤 마커들 해제
    catOverlaysRef.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    catOverlaysRef.current = [];

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
        myPosition.getLat(),
        myPosition.getLng(),
        BOUNDARY_METER_OF_ME,
      );

      const { overlay, container } = createCustomOverlay({
        type: "enemy",
        catName: cat.name,
        position: randomLatLng,
        imgUrl: cat.img,
        map: mapRef.current!,
      });

      container.addEventListener("click", (e) => {
        const elem = e.currentTarget as HTMLElement;

        if (elem.dataset.status !== "none") {
          return;
        }

        setSelectedCat({ ...cat, overlay, overlayContent: container });

        onClickCat?.();
      });

      catOverlaysRef.current.push(overlay);
    });
  }, [onClickCat, setSelectedCat]);

  const drawOwnCats = useCallback(() => {
    if (!mapRef.current) {
      return;
    }

    // 이전에 생성한 랜덤 마커들 해제
    ownCatOverlaysRef.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    ownCatOverlaysRef.current = [];

    // 잡은 고양이들 overlay 그리기
    ownCats?.forEach((cat) => {
      const { position } = cat;

      const pos = new kakao.maps.LatLng(position.lat, position.lng);

      const { overlay, container } = createCustomOverlay({
        position: pos,
        type: "owned",
        map: mapRef.current!,
      });

      container.addEventListener("click", () => {
        onClickOwnCat?.(cat);
      });

      ownCatOverlaysRef.current.push(overlay);
    });
  }, [onClickOwnCat, ownCats]);

  const createMeAndCats = useCallback(async () => {
    const result = await drawMe();
    drawCats();

    // 고양이들 그린 후 내위치 기록
    prevPosition.current = result?.coords;
  }, [drawCats, drawMe]);

  const pollCurrentPosition = useCallback(() => {
    if (currentPositionTimer.current) {
      clearTimeout(currentPositionTimer.current);
    }

    currentPositionTimer.current = setTimeout(async () => {
      await createMeAndCats();

      // eslint-disable-next-line react-hooks/immutability
      pollCurrentPosition();
    }, POLLING_MS);
  }, [createMeAndCats]);

  const initMap = useCallback(() => {
    const initialize = async () => {
      if (!mapContainerRef.current) {
        return;
      }

      // 지도를 생성합니다
      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(37.566826, 126.9786567),
        level: zoomLevel.current,
        draggable: false,
      });

      // 줌 가능 단계 세팅
      map.setZoomable(true);
      map.setMaxLevel(MAX_ZOOM_LEVEL);
      map.setMinLevel(1);

      mapRef.current = map;
      const kakaoLink = mapContainerRef.current.querySelector("a");

      if (kakaoLink) {
        kakaoLink.style.display = "none";
      }

      setKakaoMap(map);

      await createMeAndCats();
      // 맵생성 후 나, 고양이 오버레이 위치 폴링
      pollCurrentPosition();

      // 맵 이벤트 등록
      kakao.maps.event.addListener(map, "zoom_changed", () => {
        const pos = myCatOverlayRef.current?.getPosition();

        if (pos) {
          map.setCenter(pos);
        }
      });
    };

    kakao.maps.load(async () => {
      setIsInitLoading(true);

      await initialize();

      setIsInitLoading(false);
    });
  }, [createMeAndCats, pollCurrentPosition]);

  useEffect(() => {
    if (mapRef.current || isRendered.current) {
      return;
    }

    if (window.kakao?.maps) {
      initMap();

      return;
    }

    const appKey = import.meta.env.VITE_KKO_MAP_KEY;
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      initMap();
    };

    document.head.appendChild(script);

    isRendered.current = true;
  }, [initMap]);

  useEffect(() => {
    if (!window.kakao?.maps) {
      return;
    }

    if (kakaoMap) {
      drawOwnCats();
    }
  }, [drawOwnCats, kakaoMap, ownCats]);

  return (
    <>
      <div className={cn("Map", className)}>
        <div
          ref={mapContainerRef}
          className={cn("map-content", { skeleton: !mapContainerRef.current })}
        ></div>

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
                <div className={cn("paw")} />
                <div className={cn("paw")} />
                <div className={cn("paw")} />
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
    </>
  );
}
