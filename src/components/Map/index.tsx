import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatGuide from "@/assets/img/cat_guide.png";
import ImgCatMe from "@/assets/img/cat_me.png";
import { useCatStore } from "@/store/cat";
import { catCharacters } from "@/utils/cats";
import {
  createCustomOverlay,
  getCurrentPosition,
  getRandomLocationInCircle,
} from "@/utils/helper";

import Button from "../Button";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map>(null);

  const myCatOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const spreadOutOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const catOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const ownCatOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  const drawSpreadOut = useCallback((position: kakao.maps.LatLng) => {
    if (!mapRef.current) {
      return;
    }

    if (spreadOutOverlayRef.current) {
      spreadOutOverlayRef.current.setMap(null);
    }

    // 내 위치 표시 overlay
    const { overlay } = createCustomOverlay({
      type: "loacation-spread-out",
      position,
      map: mapRef.current,
    });

    spreadOutOverlayRef.current = overlay;
  }, []);

  const drawMe = useCallback(
    async (usePanTo = true) => {
      if (!mapRef.current || !navigator.geolocation) {
        return;
      }
      const coords = await getCurrentPosition();

      if (!coords) {
        return;
      }

      if (myCatOverlayRef.current) {
        myCatOverlayRef.current.setMap(null);
      }

      const { latitude, longitude } = coords;
      const position = new kakao.maps.LatLng(latitude, longitude);
      const { overlay } = createCustomOverlay({
        type: "me",
        position,
        imgUrl: ImgCatMe,
        map: mapRef.current,
      });

      myCatOverlayRef.current = overlay;

      if (usePanTo) {
        mapRef.current!.panTo(overlay.getPosition());
      }

      // 내 위치 표시 overlay
      drawSpreadOut(position);
    },
    [drawSpreadOut]
  );

  const drawCats = useCallback(() => {
    if (!myCatOverlayRef.current) {
      return;
    }

    const myPosition = myCatOverlayRef.current.getPosition();

    // 이전에 생성한 랜덤 마커들 해제
    catOverlaysRef.current.forEach((overlay) => {
      overlay.setMap(null);
    });
    catOverlaysRef.current = [];

    catCharacters.forEach((cat) => {
      const randomLatLng = getRandomLocationInCircle(
        myPosition.getLat(),
        myPosition.getLng(),
        BOUNDARY_METER_OF_ME
      );

      const { overlay, container } = createCustomOverlay({
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

  const pollCurrentPosition = useCallback(() => {
    if (currentPositionTimer.current) {
      clearTimeout(currentPositionTimer.current);
    }

    currentPositionTimer.current = setTimeout(async () => {
      await drawMe(false);

      // eslint-disable-next-line react-hooks/immutability
      pollCurrentPosition();
    }, 3_000);
  }, [drawMe]);

  const initMap = useCallback(() => {
    const initialize = async () => {
      if (!mapContainerRef.current) {
        return;
      }

      // 지도를 생성합니다
      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(37.566826, 126.9786567),
        level: 1,
      });

      map.setZoomable(true);

      mapRef.current = map;
      setKakaoMap(map);

      // 맵생성 후 세팅
      await drawMe();
      drawCats();
      pollCurrentPosition();
    };

    kakao.maps.load(async () => {
      setIsInitLoading(true);

      await initialize();

      setIsInitLoading(false);
    });
  }, [drawCats, drawMe, pollCurrentPosition]);

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
        <div ref={mapContainerRef} className={cn("map-content")}></div>

        <AnimatePresence>
          {isInitLoading && (
            <motion.div
              className={cn("loading")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <img src={ImgCatGuide} alt="" width={50} height={50} />
              {["찾", "는", "중", ".", ".", "."].map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn("buttons")}>
          <Button
            size="small"
            onClick={() => {
              if (isInitLoading) {
                return;
              }

              drawMe();
            }}
          >
            내 위치
          </Button>
        </div>
      </div>
    </>
  );
}
