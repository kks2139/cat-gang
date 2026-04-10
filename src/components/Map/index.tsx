import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatGuide from "@/assets/img/cat_guide.png";
import ImgCatMe from "@/assets/img/cat_me.png";
import { useCatStore } from "@/store/cat";
import { catCharacters } from "@/utils/cats";
import { getRandomLocation } from "@/utils/helper";

import Button from "../Button";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  className?: string;
  onClickCatMarker?: () => void;
}

export default function Map({ className, onClickCatMarker }: Props) {
  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isLoading, setIsLoading] = useState(false);

  const isRendered = useRef(false);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map>(null);

  const myCatOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const catOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  const createCatOverlay = useCallback(
    (position: kakao.maps.LatLng, charImgUrl: string, isMe?: boolean) => {
      // 최상위 컨테이너
      const container = document.createElement("div");
      container.dataset.cat = "true";
      container.dataset.status = "none";
      container.classList.add("cat-overlay");
      container.style.animationDelay = `-${Math.floor(Math.random() * 10)}s`;

      if (isMe) {
        container.classList.add("no-animation");

        const wrapper = document.createElement("div");
        wrapper.className = "arrow-3d-wrapper";
        const arrow = document.createElement("div");
        arrow.className = "arrow-3d";

        wrapper.appendChild(arrow);
        container.appendChild(wrapper);
      }

      // 캐릭터 이미지
      const character = document.createElement("img");
      character.src = charImgUrl;

      container.appendChild(character);

      const overlay = new kakao.maps.CustomOverlay({
        position: position,
        content: container,
        xAnchor: 0.5,
        yAnchor: 1,
      });

      // 생성한 overlay 지도에 표시
      overlay.setMap(mapRef.current);

      return {
        overlay,
        container,
      };
    },
    []
  );

  const showMyPosition = useCallback(async () => {
    if (!mapRef.current || !navigator.geolocation) {
      return;
    }

    setIsLoading(true);

    return new Promise<void>((res) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          const position = new kakao.maps.LatLng(latitude, longitude);
          const { overlay } = createCatOverlay(position, ImgCatMe, true);

          myCatOverlayRef.current = overlay;
          mapRef.current!.panTo(overlay.getPosition());

          setIsLoading(false);
          res();
        },
        () => {
          setIsLoading(false);
          res();
        },
        {
          enableHighAccuracy: true,
        }
      );
    });
  }, [createCatOverlay]);

  const showRandomCatMarkers = useCallback(async () => {
    await showMyPosition();

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
      const randomLatLng = getRandomLocation(
        myPosition.getLat(),
        myPosition.getLng(),
        55
      );

      const { overlay, container } = createCatOverlay(randomLatLng, cat.img);

      container.addEventListener("click", (e) => {
        const elem = e.currentTarget as HTMLElement;

        if (elem.dataset.status !== "none") {
          return;
        }

        setSelectedCat({ ...cat, overlay, overlayContent: container });

        onClickCatMarker?.();
      });

      catOverlaysRef.current.push(overlay);
    });
  }, [createCatOverlay, onClickCatMarker, setSelectedCat, showMyPosition]);

  const initMap = useCallback(() => {
    kakao.maps.load(() => {
      if (!mapDivRef.current) {
        return;
      }

      // 지도를 생성합니다
      const map = new kakao.maps.Map(mapDivRef.current, {
        center: new kakao.maps.LatLng(37.566826, 126.9786567),
        level: -2, // 지도의 확대 레벨
      });

      // map.setZoomable(false);

      mapRef.current = map;

      showRandomCatMarkers();
    });
  }, [showRandomCatMarkers]);

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

  return (
    <>
      <div className={cn("Map", className)}>
        <div ref={mapDivRef} className={cn("map-content")}></div>

        <AnimatePresence>
          {isLoading && (
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
              if (isLoading) {
                return;
              }

              showMyPosition();
            }}
          >
            내 위치
          </Button>
          <Button
            size="small"
            onClick={() => {
              if (isLoading) {
                return;
              }

              showRandomCatMarkers();
            }}
          >
            내 주변 냥아치
          </Button>
        </div>
      </div>
    </>
  );
}
