import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatGuide from "@/assets/img/cat_guide.png";
import ImgCatMe from "@/assets/img/cat_me.png";
import { useCatStore } from "@/store/cat";
import { catCharacters } from "@/utils/cats";
import { getRandomLocation, getRandomNumber } from "@/utils/helper";

import Button from "../Button";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

type OverlayType = "me" | "owned";

interface CreateOverlayOptions {
  position: kakao.maps.LatLng;
  imgUrl?: string;
  type?: OverlayType;
  catName?: string;
}

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

  const [isLoading, setIsLoading] = useState(false);
  const [kakaoMap, setKakaoMap] = useState<kakao.maps.Map>();

  const isRendered = useRef(false);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map>(null);
  const myCatOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const catOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const ownCatOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  const createCatOverlay = useCallback(
    ({ position, imgUrl, type }: CreateOverlayOptions) => {
      // 최상위 컨테이너
      const container = document.createElement("div");
      container.dataset.cat = "true";
      container.dataset.status = "none";
      container.classList.add("cat-overlay");
      container.style.animationDelay = `-${getRandomNumber(10)}s`;

      if (imgUrl) {
        // 고양이 이미지
        const catImg = document.createElement("img");
        catImg.src = imgUrl;

        container.appendChild(catImg);
      }

      // 내 고양이일때
      if (type === "me") {
        container.classList.add("no-animation");

        const wrapper = document.createElement("div");
        wrapper.className = "arrow-3d-wrapper";
        const arrow = document.createElement("div");
        arrow.className = "arrow-3d";

        wrapper.appendChild(arrow);
        container.appendChild(wrapper);
      }

      // 잡은 고양이일때
      if (type === "owned") {
        container.classList.add("no-animation", "small-shadow");

        const flagWrapper = document.createElement("div");
        flagWrapper.className = "flag-wrapper";

        const pole = document.createElement("div");
        pole.className = "pole";

        const flag = document.createElement("div");
        flag.className = "flag";

        flagWrapper.appendChild(pole);
        flagWrapper.appendChild(flag);

        container.appendChild(flagWrapper);
      }

      // overlay 생성
      const overlay = new kakao.maps.CustomOverlay({
        position: position,
        content: container,
        xAnchor: 0.5,
        yAnchor: 1,
      });

      if (type === "me") {
        overlay.setZIndex(99);
      }

      // 지도에 overlay 표시
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
          const { overlay } = createCatOverlay({
            type: "me",
            position,
            imgUrl: ImgCatMe,
          });

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

      const { overlay, container } = createCatOverlay({
        position: randomLatLng,
        imgUrl: cat.img,
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
  }, [createCatOverlay, onClickCat, setSelectedCat, showMyPosition]);

  const drwaOwnCats = useCallback(() => {
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
      const { name, position } = cat;

      const pos = new kakao.maps.LatLng(position.lat, position.lng);

      const { overlay, container } = createCatOverlay({
        position: pos,
        catName: name,
        type: "owned",
      });

      container.addEventListener("click", () => {
        onClickOwnCat?.(cat);
      });

      ownCatOverlaysRef.current.push(overlay);
    });
  }, [createCatOverlay, onClickOwnCat, ownCats]);

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
      setKakaoMap(map);

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

  useEffect(() => {
    if (!window.kakao?.maps) {
      return;
    }

    if (kakaoMap) {
      drwaOwnCats();
    }
  }, [drwaOwnCats, kakaoMap, ownCats]);

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
