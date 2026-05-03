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
} from "react-leaflet";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import ImgCatMeWalk1 from "@/assets/img/character/cat-me-walk-1.png";
import ImgCatMeWalk2 from "@/assets/img/character/cat-me-walk-2.png";
import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
import { useDayAndNight } from "@/hooks/useDayAndNight";
import { useItemMutation } from "@/queries/useItemMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useCatStore } from "@/store/cat";
import { useViewStore } from "@/store/view";
import { catCharacters } from "@/utils/cats";
import {
  animateMarker,
  createMarker,
  getCatchedCatElement,
  getRandomLocationInCircle,
  getRandomNumber,
  removeMarkerWithMotion,
  wait,
} from "@/utils/helper";
import { getCurrentPosition, watchPosition } from "@/utils/native";

import Loading from "../Loading";
import styles from "./index.module.scss";
import SkyLayer from "./SkyLayer";
import ZoomButton from "./ZoomButton";

const cn = classNames.bind(styles);

export const MAX_ZOOM_LEVEL = 19;
export const MIN_ZOOM_LEVEL = 17;
export const INIT_ZOOM_LEVEL = 19;
const BOUNDARY_METER_OF_ME = 50;
const OWN_CAT_KEY_TOKEN = "_";

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
  onClickMe?: () => void;
}

function MapContent({
  className,
  onClickCat,
  ownCats,
  onClickOwnCat,
  onMapReady,
  onCreateCatsComplete,
  ref: myMarkerRef,
  onClickMe,
}: Props) {
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const isBattleOn = useViewStore((s) => s.isBattleOn);
  const { setIsStopFocusMe, addToastMessage } = useViewStore((s) => s.actions);

  // 최신 isStopFocusMe 값을 ref에 동기화 (클로저 스코프 문제 방지)
  const isStopFocusMeRef = useRef(isStopFocusMe);
  isStopFocusMeRef.current = isStopFocusMe;

  // 전투중 여부 ref 동기화
  const isBattleOnRef = useRef(isBattleOn);
  isBattleOnRef.current = isBattleOn;

  const isShowStage = useCatStore((s) => s.isShowStage);
  const clickedOwnCat = useCatStore((s) => s.clickedOwnCat);
  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isInitLoading, setIsInitLoading] = useState(false);

  const isRendered = useRef(false);
  const isMapReady = useRef(false);
  const isWatchPositionReady = useRef(false);
  const centerPositionOfCats = useRef<L.LatLng>(undefined);

  const catMarkersRef = useRef<L.Marker[]>([]);
  const ownCatMarkersRef = useRef<Record<string, L.Marker>>({});
  const myCatRef = useRef<L.Marker>(null);
  const walkTimerRef = useRef<number>(undefined);
  const meClickedTimerRef = useRef<number>(undefined);
  const itemSpawnTimerRef = useRef<number>(undefined);

  const { data: itemCount } = useItemQuery();
  const { mutateAsync: updateItemCount } = useItemMutation();

  // 최신 itemCount를 참조하기 위한 Ref
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

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

  const startWalkAnimation = useCallback(() => {
    const catImg = myCatRef.current
      ?.getElement()
      ?.querySelector("[data-cat-img]") as HTMLImageElement | null;

    if (!catImg || meClickedTimerRef.current) {
      return;
    }

    if (walkTimerRef.current) {
      clearInterval(walkTimerRef.current);
    }

    const walkFrames = [
      ImgCatMeWalk1,
      ImgCatMeWalk2,
      ImgCatMeWalk1,
      ImgCatMeWalk2,
    ];
    let frameIndex = 0;
    catImg.src = walkFrames[frameIndex];

    walkTimerRef.current = window.setInterval(() => {
      frameIndex++;

      if (frameIndex >= walkFrames.length) {
        clearInterval(walkTimerRef.current);
        walkTimerRef.current = undefined;
        catImg.src = ImgCatMe;
        return;
      }

      catImg.src = walkFrames[frameIndex];
    }, 375);
  }, []);

  const drawMe = useCallback(
    async (usePanTo?: boolean) => {
      const coords = await getCurrentPosition();

      if (!coords) {
        return;
      }

      if (myCatRef.current) {
        startWalkAnimation();
        animateMarker(
          myCatRef.current,
          [coords.latitude, coords.longitude],
          1500,
        );
      } else {
        const marker = createMarker({
          type: "me",
          imgUrl: ImgCatMe,
          map,
          position: [coords.latitude, coords.longitude],
        }).on("click", () => {
          onClickMe?.();
        });

        marker.setZIndexOffset(99);

        myCatRef.current = marker;
      }

      // 드래그된 상태 아닐때 (ref로 항상 최신값 참조)
      if (!isStopFocusMeRef.current) {
        startWalkAnimation();

        // 현재 위치로 지도 중심 이동
        if (usePanTo) {
          map.panTo([coords.latitude, coords.longitude], { duration: 1.5 });
        } else {
          map.setView([coords.latitude, coords.longitude], undefined, {
            duration: 1.5,
          });
        }
      }

      return {
        coords,
      };
    },
    [map, onClickMe, startWalkAnimation],
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
    if (!map) return;

    // 현재 전달받은 고양이들의 고유 키 셋 생성
    const currentCatKeys = new Set(
      ownCats?.map((cat) => `${cat.name}_${cat.createdAt}`) || [],
    );

    // 1. 제거 대상: 현재 데이터에 없는 마커들을 지도에서 삭제
    Object.entries(ownCatMarkersRef.current).forEach(([key, marker]) => {
      if (!currentCatKeys.has(key)) {
        removeMarkerWithMotion(marker);
        delete ownCatMarkersRef.current[key];
      }
    });

    // 2. 추가 대상: 현재 마커 객체에 없는 고양이들만 새로 생성
    ownCats?.forEach((cat) => {
      const key = `${cat.name}${OWN_CAT_KEY_TOKEN}${cat.createdAt}`;

      if (!ownCatMarkersRef.current[key]) {
        const { position } = cat;

        const marker = createMarker({
          position: [position.lat, position.lng],
          type: "owned",
          map,
        }).on("click", () => {
          onClickOwnCat?.(cat);
        });

        ownCatMarkersRef.current[key] = marker;
      }
    });
  }, [map, onClickOwnCat, ownCats]);

  const createMeAndCats = useCallback(
    async (usePanTo?: boolean) => {
      if (isBattleOnRef.current) {
        return;
      }

      await drawMe(usePanTo);
      drawCats();
    },
    [drawCats, drawMe],
  );

  useEffect(() => {
    // 잡은 고양이목록 클릭 리액션
    if (clickedOwnCat) {
      const cat = Object.entries(ownCatMarkersRef.current).find(
        ([key, marker]) => {
          const { lat, lng } = marker.getLatLng();

          return (
            key.includes(clickedOwnCat.createdAt) &&
            lat === clickedOwnCat.lat &&
            lng === clickedOwnCat.lng
          );
        },
      );

      if (cat) {
        const [key, marker] = cat;
        const catName = key.split(OWN_CAT_KEY_TOKEN)[0];
        const markerElement = marker.getElement();
        const catchedCat = markerElement?.querySelector("[data-catched-cat]");

        if (!catName || catchedCat) {
          return;
        }

        const catData = catCharacters.find(({ name }) => name === catName);

        if (catData) {
          const catElement = getCatchedCatElement(
            catData.img,
            catData.dialog.greeting[getRandomNumber(3)],
          );

          markerElement?.appendChild(catElement);

          setTimeout(() => {
            markerElement?.removeChild(catElement);
          }, 2000);
        }
      }
    }
  }, [clickedOwnCat]);

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

    let stopWatch: (() => void) | undefined;

    (async () => {
      // 위치변화 감지 시, 다시 그리기

      const stop = await watchPosition(() => {
        if (!myCatRef.current) {
          return;
        }

        createMeAndCats(true);
      });

      stopWatch = stop;
    })();

    return () => {
      if (stopWatch) {
        stopWatch();
      }
    };
  }, [createMeAndCats, isInitLoading]);

  useEffect(() => {
    // map 세팅 및 이벤트 등록
    if (!map || isMapReady.current) {
      return;
    }

    isMapReady.current = true;

    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (itemSpawnTimerRef.current) {
      return;
    }

    const spwanItem = () => {
      const myPosition = myCatRef.current?.getLatLng();

      if (!myPosition) return;

      const randomLatLng = getRandomLocationInCircle(
        myPosition.lat,
        myPosition.lng,
        70,
      );
      const randomNum = getRandomNumber(10);
      const itemType =
        randomNum === 0
          ? "catnip"
          : randomNum === 1
            ? "gukbab"
            : randomNum === 2
              ? "fish"
              : null;
      const imgUrl =
        itemType === "catnip"
          ? ImgCatnip
          : itemType === "gukbab"
            ? ImgGukbab
            : ImgFish;

      if (!itemType) {
        return;
      }

      const marker = createMarker({
        type: "item",
        position: randomLatLng,
        imgUrl,
        map: map,
      }).on("click", async (e) => {
        const target = e.target as L.Marker;
        const container = target
          .getElement()
          ?.querySelector("[data-type='item']");

        if (container && itemCountRef.current) {
          container.classList.add("clicked");

          addToastMessage({
            duration: 3000,
            message: `${itemType === "catnip" ? "캣닢" : itemType === "gukbab" ? "국밥" : "생선"} +1`,
          });

          const [updateResult] = await Promise.allSettled([
            updateItemCount({
              itemType,
              count: (itemCountRef.current[itemType] || 0) + 1,
            }),
            wait(2000),
          ]);

          if (updateResult.status === "fulfilled" && updateResult.value) {
            marker.remove();
          }
        }
      });
    };

    const timerId = setInterval(() => {
      spwanItem();
    }, 10000);

    itemSpawnTimerRef.current = timerId;

    return () => {
      clearInterval(timerId);
      itemSpawnTimerRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, myCatRef.current]);

  return <div className={className}></div>;
}

export default function Map({ className, ...rest }: Props) {
  const map = useViewStore((s) => s.map);
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const { setMap, setIsStopFocusMe } = useViewStore((s) => s.actions);

  const [isLoading, setisLoading] = useState(true);

  const myMarkerRef = useRef<L.Marker>(null);

  const { isNight, hours } = useDayAndNight();

  useEffect(() => {
    return () => setMap(null);
  }, [setMap]);

  useEffect(() => {
    if (isLoading) {
      map?.dragging.disable();
    } else {
      map?.dragging.enable();
    }
  }, [isLoading, map]);

  return (
    <div className={cn("map-wrapper", { night: isNight })}>
      <SkyLayer isNight={isNight} hours={hours} />
      {/* <AdBanner adGroupId="123" /> */}

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
        maxBoundsViscosity={1}
      >
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

      <ZoomButton />

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className={cn("loading")}
            initial={{ opacity: 0, y: -5, translateX: "-50%" }}
            animate={{ opacity: 1, y: 0, translateX: "-50%" }}
            exit={{ opacity: 0, y: -5, translateX: "-50%" }}
            transition={{ duration: 0.2 }}
          >
            <Loading text="찾는중..." />
          </motion.div>
        )}
      </AnimatePresence>
      <Loading />
    </div>
  );
}
