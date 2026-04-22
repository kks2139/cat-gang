import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
// Marker 아이콘 깨짐 방지 (특정 환경에서 아이콘 경로가 인식 안 될 때 필요)
import {
  MapContainer,
  ScaleControl,
  TileLayer,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import { useCatStore } from "@/store/cat";
import { useViewStore } from "@/store/view";
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
import SkyLayer from "./SkyLayer";

const cn = classNames.bind(styles);

export const MAX_ZOOM_LEVEL = 19;
export const MIN_ZOOM_LEVEL = 17;
export const INIT_ZOOM_LEVEL = 19;
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
  onMapReady?: (map: L.Map) => void;
  onCreateCatsComplete?: () => void;
  ref?: React.Ref<L.Marker | null>;
}

function MapContent({
  className,
  onClickCat,
  ownCats,
  onClickOwnCat,
  onMapReady,
  onCreateCatsComplete,
  ref: myMarkerRef,
}: Props) {
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const { setIsStopFocusMe } = useViewStore((s) => s.actions);

  // 최신 isStopFocusMe 값을 ref에 동기화 (클로저 스코프 문제 방지)
  const isStopFocusMeRef = useRef(isStopFocusMe);
  isStopFocusMeRef.current = isStopFocusMe;

  const isShowStage = useCatStore((s) => s.isShowStage);
  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isInitLoading, setIsInitLoading] = useState(false);

  const isRendered = useRef(false);
  const isMapReady = useRef(false);
  const isWatchPositionReady = useRef(false);
  const centerPositionOfCats = useRef<L.LatLng>(undefined);

  const catMarkersRef = useRef<L.Marker[]>([]);
  const ownCatMarkersRef = useRef<L.Marker[]>([]);
  const myCatRef = useRef<L.Marker>(null);

  // 부모의 myMarkerRef.current에 그 값을 동기화합니다.
  useImperativeHandle<L.Marker | null, L.Marker | null>(myMarkerRef, () => {
    return myCatRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCatRef.current]);

  const map = useMapEvents({
    dragstart() {
      setIsStopFocusMe(true);
    },
  });

  const calcuateMapBounds = useCallback(
    (coords: GeolocationCoordinates) => {
      const { latitude, longitude } = coords;

      // 1. 원을 생성합니다.
      const tempCircle = L.circle([latitude, longitude], {
        radius: 300,
        interactive: false,
        fillOpacity: 0,
        color: "transparent",
      });

      // 2. 중요: 지도가 있어야 영역 계산이 가능하므로 지도에 추가합니다.
      tempCircle.addTo(map);

      // 3. 영역을 가져옵니다.
      const bounds = tempCircle.getBounds();

      // 4. 영역 설정 후 지도로부터 원을 제거합니다 (화면에 안 보이게).
      tempCircle.remove();

      map.setMaxBounds(bounds);
    },
    [map],
  );

  const drawMe = useCallback(
    async (usePanTo?: boolean) => {
      const coords = await getCurrentPosition();

      if (!coords) {
        return;
      }

      // 드래그 제한범위 설정
      calcuateMapBounds(coords);

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

      // 드래그된 상태 아닐때 (ref로 항상 최신값 참조)
      if (!isStopFocusMeRef.current) {
        // 현재 위치로 지도 중심 이동
        if (usePanTo) {
          map.panTo([coords.latitude, coords.longitude], { duration: 1 });
        } else {
          map.setView([coords.latitude, coords.longitude]);
        }
      }

      return {
        coords,
      };
    },
    [calcuateMapBounds, map],
  );

  const drawCats = useCallback(() => {
    if (!myCatRef.current || isShowStage) {
      return;
    }

    const myPosition = myCatRef.current.getLatLng();

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
          return num < 5; // 그릴 확률
        case "unique":
          return num < 2; //
        default:
          return num < 20;
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
  }, [isShowStage, map, onClickCat, setSelectedCat]);

  const drawOwnCats = useCallback(() => {
    // 이전에 생성한 랜덤 마커들 해제
    ownCatMarkersRef.current.forEach((marker) => {
      removeMarkerWithMotion(marker);
    });
    ownCatMarkersRef.current = [];

    // 잡은 고양이들(깃발) 그리기
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

      drawOwnCats();
      await createMeAndCats();

      setIsInitLoading(false);
      isRendered.current = true;

      onCreateCatsComplete?.();
    })();
  }, [createMeAndCats, drawOwnCats, map, onCreateCatsComplete]);

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

    onMapReady?.(map);
  }, [map, onMapReady]);

  return <div className={className}></div>;
}

export default function Map({ className, ...rest }: Props) {
  const map = useViewStore((s) => s.map);
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const { setMap, setIsStopFocusMe } = useViewStore((s) => s.actions);

  const [isLoading, setisLoading] = useState(true);

  const myMarkerRef = useRef<L.Marker>(null);

  useEffect(() => {
    return () => setMap(null);
  }, [setMap]);

  return (
    <div className={cn("map-wrapper")}>
      <SkyLayer />

      <MapContainer
        className={cn("Map", className)}
        center={[37.5665, 126.978]} // 센터 기본값 서울시청
        zoom={INIT_ZOOM_LEVEL}
        maxZoom={MAX_ZOOM_LEVEL}
        minZoom={MIN_ZOOM_LEVEL}
        zoomControl={false}
        scrollWheelZoom={"center"}
        doubleClickZoom={"center"}
        touchZoom={"center"}
        attributionControl={false} // 하단 저작권 표시줄 전체 삭제
        bounceAtZoomLimits={false}
        maxBoundsViscosity={0.9}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />

        {/* 맵 내부 마커생성, 이벤트 등록 등 */}
        <MapContent
          {...rest}
          ref={myMarkerRef}
          className={cn("map-content")}
          onMapReady={(map) => {
            // 맵 상태에 등록
            setMap(map);
          }}
          onCreateCatsComplete={() => {
            setisLoading(false);
          }}
        />

        <ScaleControl
          position={"bottomleft"} // 위치 설정 (topleft, topright, bottomleft, bottomright)
          imperial={false} // 마일(mi) 단위 표시 여부 (false면 미터법만 표시)
          maxWidth={100} // 축척 바의 최대 길이 (픽셀 단위)
        />
      </MapContainer>

      <button
        data-name="focus-button"
        className={cn("focus-button", { "stop-focus": isStopFocusMe })}
        onClick={async () => {
          if (myMarkerRef.current) {
            map?.flyTo(myMarkerRef.current.getLatLng());
            setIsStopFocusMe(false);
          }
        }}
      ></button>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className={cn("loading")}
            initial={{ opacity: 0, y: -5, translateX: "-50%" }}
            animate={{ opacity: 1, y: 0, translateX: "-50%" }}
            exit={{ opacity: 0, y: -5, translateX: "-50%" }}
            transition={{ duration: 0.2 }}
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
