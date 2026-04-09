import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatGuide from "@/assets/img/cat_guide.png";
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

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map>(null);
  const myMarkerRef = useRef<kakao.maps.Marker>(null);
  const myOverlayRef = useRef<kakao.maps.CustomOverlay>(null);
  const catOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const randomMarkersRef = useRef<kakao.maps.Marker[]>([]);

  // 지도에 마커를 표시하는 함수입니다
  const showMarker = useCallback(
    (map: kakao.maps.Map, position: kakao.maps.LatLng, imageSrc?: string) => {
      const markerImage = imageSrc
        ? new kakao.maps.MarkerImage(
            imageSrc,
            new kakao.maps.Size(40, 40), // 마커이미지의 크기입니다
            { offset: new kakao.maps.Point(0, 0) } // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.
          )
        : undefined;

      // 마커를 생성합니다
      const marker = new kakao.maps.Marker({
        map,
        position,
        image: markerImage,
      });

      return marker;
    },
    []
  );

  const showMyOverLay = useCallback(
    (marker: kakao.maps.Marker, content: string) => {
      if (!mapRef.current) {
        return;
      }

      const overlay =
        myOverlayRef.current ||
        new kakao.maps.CustomOverlay({
          map: mapRef.current,
          content,
          position: marker.getPosition(),
        });

      myOverlayRef.current = overlay;

      // 중심좌표를 해당 위치로 부드럽게 이동
      mapRef.current.panTo(marker.getPosition());
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
          const marker =
            myMarkerRef.current || showMarker(mapRef.current!, position);

          myMarkerRef.current = marker;

          showMyOverLay(
            marker,
            `<div class="my-overlay">
              <span>내 위치</span>
            </div>`
          );

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
  }, [showMarker, showMyOverLay]);

  const showRandomCatMarkers = useCallback(async () => {
    await showMyPosition();

    if (!myMarkerRef.current) {
      return;
    }

    const position = myMarkerRef.current.getPosition();

    // 이전에 생성한 랜덤 마커들 해제
    randomMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    randomMarkersRef.current = [];

    catCharacters.forEach((cat) => {
      const randomLatLng = getRandomLocation(
        position.getLat(),
        position.getLng(),
        40
      );

      const marker = showMarker(mapRef.current!, randomLatLng, cat.img);

      // 이긴 상대인지 아닌지 알기위한 표시
      marker.setTitle("active");

      kakao.maps.event.addListener(marker, "click", () => {
        if (marker.getTitle() !== "active") {
          return;
        }

        setSelectedCat({ ...cat, marker });

        onClickCatMarker?.();
      });

      // 이전에 생성한 overlay들 해제
      catOverlaysRef.current.forEach((overlays) => {
        overlays.setMap(null);
      });
      catOverlaysRef.current = [];

      const catOverlay = new kakao.maps.CustomOverlay({
        content: `<div class='cat-overlay'>
            <div class='name'>
              <span>이름 : </span>
              <strong>${cat.name}</strong>
            </div>
            <div class='description'>
              <span>소개 : </span>
              <strong>${cat.crying}</strong>
            </div>
          </div>`,
        position: marker.getPosition(),
      });

      catOverlaysRef.current.push(catOverlay);

      kakao.maps.event.addListener(marker, "mouseover", () => {
        catOverlay.setMap(mapRef.current);
      });
      kakao.maps.event.addListener(marker, "mouseout", function () {
        catOverlay.setMap(null);
      });

      randomMarkersRef.current.push(marker);
    });
  }, [onClickCatMarker, setSelectedCat, showMarker, showMyPosition]);

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
    if (mapRef.current) {
      return;
    }

    if (window.kakao?.maps) {
      initMap();

      return;
    }

    const script = document.createElement("script");
    const appKey = import.meta.env.VITE_KKO_MAP_KEY;

    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      // 카카오맵 특유의 'autoload=false' 설정 시 필요
      window.kakao.maps.load(() => {
        initMap();
      });
    };

    document.head.appendChild(script);
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
