import NumberFlow from "@number-flow/react";
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
import { isDev } from "@/utils/constants";
import {
  animateMarker,
  createMarker,
  getCatchedCatElement,
  getRandomLocationInCircle,
  getRandomNumber,
  removeMarkerWithMotion,
  wait,
} from "@/utils/helper";
import {
  getCurrentPosition,
  setMockLocation,
  watchPosition,
} from "@/utils/native";
import { getTodayWalk, storeTodayWalk } from "@/utils/storage";

import Loading from "../Loading";
import styles from "./index.module.scss";
import SkyLayer from "./SkyLayer";

const cn = classNames.bind(styles);

export const MAX_ZOOM_LEVEL = 19;
export const MIN_ZOOM_LEVEL = 19;
export const INIT_ZOOM_LEVEL = 19;
const BOUNDARY_METER_OF_ME = 50;
const OWN_CAT_KEY_TOKEN = "_";
const PAW_INTERVAL_METER = 7; // 한 걸음(발자국) 기본 간격 (m)
const PAW_SPREAD_METER = 1.2; // 중심축에서 좌우로 벌어지는 오프셋 (m)
const PAW_ICON_PX = 18; // 발자국 아이콘 픽셀 크기
const PAW_MAX_COUNT = 200; // 발자국 최대 개수 (DOM 성능 보호)
const WALK_DURATION = 1500; // 캐릭터 이동 애니메이션 시간 (ms)
const MAX_PAWS_PER_MOVE = 50; // 한 번의 위치 업데이트당 찍히는 최대 발자국 수
const MAX_SAVED_PATH = 600; // 스토리지에 저장할 궤적 좌표 최대 개수
const STORE_DEBOUNCE_MS = 5000; // 궤적 저장 디바운스 (ms)
const PAW_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 11.5c-3.2 0-6 2.6-6 5.2 0 1.8 1.4 3 3.2 3 1 0 1.8-.4 2.8-.4s1.8.4 2.8.4c1.8 0 3.2-1.2 3.2-3 0-2.6-2.8-5.2-6-5.2z"/><ellipse cx="6" cy="8.4" rx="1.9" ry="2.4" transform="rotate(-25 6 8.4)"/><ellipse cx="12" cy="6.6" rx="1.9" ry="2.5"/><ellipse cx="18" cy="8.4" rx="1.9" ry="2.4" transform="rotate(25 18 8.4)"/></svg>`;

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
  onDistanceChange?: (distance: number) => void;
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
  onDistanceChange,
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

  // 지도 관련
  const isRendered = useRef(false);
  const isMapReady = useRef(false);
  const isWatchPositionReady = useRef(false);
  const centerPositionOfCats = useRef<L.LatLng>(undefined);

  // 마커
  const catMarkersRef = useRef<L.Marker[]>([]);
  const ownCatMarkersRef = useRef<Record<string, L.Marker>>({});
  const myCatRef = useRef<L.Marker>(null);

  // 타이머
  const walkTimerRef = useRef<number>(undefined);
  const meClickedTimerRef = useRef<number>(undefined);
  const itemSpawnTimerRef = useRef<number>(undefined);
  const catSpawnTimerRef = useRef<number>(undefined);

  // 이동 궤적 (발자국 트레일)
  const pathRef = useRef<L.LatLng[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const sessionDistanceRef = useRef<number>(0); // 이번 세션(캐릭터 첫 위치) 이동 거리 — 발자국 기준
  const startPointRef = useRef<L.CircleMarker | null>(null);
  const nextPawDistanceRef = useRef<number>(PAW_INTERVAL_METER);
  const pawMarkerRef = useRef<L.Marker[]>([]);
  const pawToggleRef = useRef<boolean>(false); // false: 왼쪽 발, true: 오른쪽 발
  const storeWalkTimerRef = useRef<number>(undefined); // 궤적 저장 디바운스 타이머

  // 아이템
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
    click(e) {
      if (isDev) {
        setMockLocation(e.latlng.lat, e.latlng.lng);
        createMeAndCats(true);
      }
    },
  });

  // 발자국 마커 1개를 찍는다 (트레일 기록 및 복원 공용)
  const createPawMarker = useCallback(
    (latLng: L.LatLng, bearingDeg: number, tiltDeg: number) => {
      if (!map) {
        return;
      }

      const icon = L.divIcon({
        className: "paw-print",
        html: `<div class="paw-print-rotate" style="transform: rotate(${bearingDeg + tiltDeg}deg)"><div class="paw-print-inner">${PAW_SVG}</div></div>`,
        iconSize: [PAW_ICON_PX, PAW_ICON_PX],
        iconAnchor: [PAW_ICON_PX / 2, PAW_ICON_PX / 2],
      });

      const pawMarker = L.marker(latLng, {
        icon,
        interactive: false,
        keyboard: false,
      }).addTo(map);

      pawMarkerRef.current.push(pawMarker);

      // 발자국이 너무 많이 쌓이면 오래된 것부터 제거
      if (pawMarkerRef.current.length > PAW_MAX_COUNT) {
        const oldest = pawMarkerRef.current.shift();
        oldest?.remove();
      }
    },
    [map],
  );

  // 시작점 마커를 찍는다
  const createStartDot = useCallback(
    (latLng: L.LatLng) => {
      if (!map || startPointRef.current) {
        return;
      }

      startPointRef.current = L.circleMarker(latLng, {
        radius: 6,
        color: "white",
        weight: 2,
        fillColor: "var(--main-1)",
        fillOpacity: 1,
        className: "trajectory-start-dot",
      }).addTo(map);
    },
    [map],
  );

  // 발자국 간격은 줌이 고정(레벨 19)되어 있으므로 항상 기본 값 사용.
  // 이전에는 줌 레벨별 간격 보정이 있었으나 줌 기능 제거로 단순화함
  const getZoomAwareInterval = useCallback(() => {
    return PAW_INTERVAL_METER;
  }, []);

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

      const newLatLng = new L.LatLng(coords.latitude, coords.longitude);

      if (pathRef.current.length > 0) {
        const lastLatLng = pathRef.current[pathRef.current.length - 1];
        const dist = lastLatLng.distanceTo(newLatLng);

        // 10미터 이상 이동했을때만 거리 추가
        if (dist > 10) {
          totalDistanceRef.current += dist;
          sessionDistanceRef.current += dist;
          onDistanceChange?.(totalDistanceRef.current);
          pathRef.current.push(newLatLng);

          // 줌 레벨에 맞는 발자국 간격(m): 줌 아웃일수록 간격을 넓혀
          // 발자국 아이콘이 겹치지 않도록 한다 (기본 줌에선 7m 그대로)
          const intervalM = getZoomAwareInterval();
          // 좌우 벌어짐 배율: 간격이 늘어난 비율에 맞춰 offset도 같이 키운다
          const spreadDegFactor = intervalM / PAW_INTERVAL_METER;
          // 한 이동당 발자국 개수 상한: 구간이 너무 길면 간격 자체를 늘려 개수를 제한한다
          const maxStepForCap = Math.ceil(dist / MAX_PAWS_PER_MOVE / intervalM) * intervalM;
          const step = Math.max(intervalM, maxStepForCap);

          const bearingDeg =
            (Math.atan2(
              newLatLng.lng - lastLatLng.lng,
              newLatLng.lat - lastLatLng.lat,
            ) *
              180) /
            Math.PI;
          // 이번 구간 이동 전까지의 세션 누적 거리 (캐릭터 첫 위치 기준)
          const sessionDistanceBefore = sessionDistanceRef.current - dist;
          const traveledSinceLastPaw =
            nextPawDistanceRef.current - sessionDistanceBefore;

          // 이동 구간을 따라 step 간격으로 발자국 위치를 미리 계산
          const pawPositions: {
            latLng: L.LatLng;
            bearingDeg: number;
            tiltDeg: number;
          }[] = [];

          for (
            let remain = traveledSinceLastPaw;
            remain <= dist;
            remain += step
          ) {
            const ratio = remain / dist;
            const centerLatLng = L.latLng(
              lastLatLng.lat + (newLatLng.lat - lastLatLng.lat) * ratio,
              lastLatLng.lng + (newLatLng.lng - lastLatLng.lng) * ratio,
            );

            // 중심축에서 좌우로 벌어진 위치 계산 (위도/경도 거리 비율 보정)
            const isLeftPaw = !pawToggleRef.current;
            const metersPerDegLat = 111_320;
            const metersPerDegLng =
              111_320 * Math.cos((centerLatLng.lat * Math.PI) / 180);

            // 보행 방향(미터 공간) 단위 벡터의 오른쪽 수직 벡터
            const dirLatM =
              (newLatLng.lat - lastLatLng.lat) * metersPerDegLat;
            const dirLngM =
              (newLatLng.lng - lastLatLng.lng) * metersPerDegLng;
            const dirNorm = Math.hypot(dirLatM, dirLngM) || 1;
            const perpLatM = dirLngM / dirNorm; // 시계방향 90도 회전: 오른쪽
            const perpLngM = -dirLatM / dirNorm;

            const spreadDegLat =
              (perpLatM * PAW_SPREAD_METER * spreadDegFactor) /
              metersPerDegLat;
            const spreadDegLng =
              (perpLngM * PAW_SPREAD_METER * spreadDegFactor) /
              metersPerDegLng;

            pawPositions.push({
              latLng: L.latLng(
                centerLatLng.lat + spreadDegLat * (isLeftPaw ? -1 : 1),
                centerLatLng.lng + spreadDegLng * (isLeftPaw ? -1 : 1),
              ),
              bearingDeg,
              tiltDeg: isLeftPaw ? 22 : -22, // 왼/오 대각선 번갈아 (방향 반대)
            });
            pawToggleRef.current = !pawToggleRef.current;
          }

          if (pawPositions.length > 0) {
            pawPositions.forEach((paw, index) => {
              // 캐릭터 이동보다 약간 늦게 찍히도록 지연 (WALK_DURATION * 1.3에 걸쳐 순차 출력)
              const delay =
                (index / pawPositions.length) * WALK_DURATION * 1.3;

              window.setTimeout(() => {
                // 캐릭터가 그 지점을 지나가는 시점에 발자국 생성
                createPawMarker(paw.latLng, paw.bearingDeg, paw.tiltDeg);
              }, delay);
            });
          }

          // 다음 발자국 거리 기준 갱신 (간격 배수로 올림)
          nextPawDistanceRef.current =
            Math.floor(sessionDistanceRef.current / step) * step + step;

          // 궤적 저장 (디바운스)
          if (storeWalkTimerRef.current) {
            clearTimeout(storeWalkTimerRef.current);
          }
          storeWalkTimerRef.current = window.setTimeout(() => {
            storeTodayWalk({
              distance: totalDistanceRef.current,
              path: pathRef.current
                .slice(-MAX_SAVED_PATH)
                .map(({ lat, lng }) => ({ lat, lng })),
            });
          }, STORE_DEBOUNCE_MS);
        }
      } else {
        pathRef.current.push(newLatLng);
        createStartDot(newLatLng);
      }

      if (myCatRef.current) {
        startWalkAnimation();
        animateMarker(
          myCatRef.current,
          [coords.latitude, coords.longitude],
          WALK_DURATION,
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
    [
      createPawMarker,
      createStartDot,
      getZoomAwareInterval,
      map,
      onClickMe,
      onDistanceChange,
      startWalkAnimation,
    ],
  );

  const drawCats = useCallback(
    (forceDraw?: boolean) => {
      if (!myCatRef.current || isShowStage) {
        return;
      }

      const myPosition = myCatRef.current.getLatLng();

      // 내 고양이 이전좌표랑 일정m 이상 차이날때만 cats 새로 그린다
      const canSkipDraw = centerPositionOfCats.current
        ? myPosition.distanceTo(centerPositionOfCats.current) <= 40
        : false;

      if (canSkipDraw && !forceDraw) {
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
        const num = getRandomNumber(1000);

        switch (rarity) {
          case "rare":
            return num < 20; // 그릴 확률
          case "unique":
            return num < 10;
          default:
            return num < 50;
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
    },
    [isShowStage, map, onClickCat, setSelectedCat],
  );

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

  const checkSpawnedCats = useCallback(() => {
    if (catSpawnTimerRef.current) {
      clearInterval(catSpawnTimerRef.current);
    }

    // 일정 시간 동안 고양이가 하나도 없다면 다시 그린다
    catSpawnTimerRef.current = setInterval(() => {
      if (catMarkersRef.current.length === 0) {
        drawCats(true);
      }
    }, 5 * 1000);
  }, [drawCats]);

  const createMeAndCats = useCallback(
    async (usePanTo?: boolean) => {
      if (isBattleOnRef.current) {
        return;
      }

      await drawMe(usePanTo);
      drawCats();
      checkSpawnedCats();
    },
    [checkSpawnedCats, drawCats, drawMe],
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

  // 스토리지에 저장된 오늘 산책 데이터(거리 + 궤적)를 읽어 발자국 트레일을 복원한다
  const restoreTodayWalk = useCallback(async () => {
    const todayWalk = await getTodayWalk();

    totalDistanceRef.current = todayWalk.distance;
    onDistanceChange?.(todayWalk.distance);

    if (!map || todayWalk.path.length === 0) {
      return;
    }

    pathRef.current = todayWalk.path.map(
      ({ lat, lng }) => new L.LatLng(lat, lng),
    );

    // 저장된 궤적을 따라 발자국 + 시작점을 다시 그린다 (애니메이션 지연 없이 즉시)
    pathRef.current.forEach((latLng, i) => {
      if (i === 0) {
        createStartDot(latLng);
        return;
      }

      const prev = pathRef.current[i - 1];
      const bearingDeg =
        (Math.atan2(
          latLng.lng - prev.lng,
          latLng.lat - prev.lat,
        ) *
          180) /
        Math.PI;

      createPawMarker(
        latLng,
        bearingDeg,
        pawToggleRef.current ? -22 : 22,
      );
      pawToggleRef.current = !pawToggleRef.current;
    });

    // 다음 발자국 기준을 저장된 궤적 길이 기준으로 맞춘다
    nextPawDistanceRef.current =
      Math.floor(sessionDistanceRef.current / PAW_INTERVAL_METER) *
        PAW_INTERVAL_METER +
      PAW_INTERVAL_METER;
  }, [createPawMarker, createStartDot, map, onDistanceChange]);

  useEffect(() => {
    if (isRendered.current) {
      return;
    }

    isRendered.current = true;

    (async () => {
      setIsInitLoading(true);

      drawOwnCats();

      // 오늘 저장된 궤적 복원 후 캐릭터/고양이 그리기
      await restoreTodayWalk();
      await createMeAndCats();

      setIsInitLoading(false);
      isRendered.current = true;

      onCreateCatsComplete?.();
    })();
  }, [createMeAndCats, drawOwnCats, map, onCreateCatsComplete, restoreTodayWalk]);

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

        if (container) {
          container.classList.add("clicked");

          addToastMessage({
            duration: 3000,
            message: `${itemType === "catnip" ? "캣닢" : itemType === "gukbab" ? "국밥" : "생선"} +1`,
          });

          const [updateResult] = await Promise.allSettled([
            updateItemCount({
              itemType,
              count: (itemCountRef?.current?.[itemType] || 0) + 1,
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
    }, 60_000);

    itemSpawnTimerRef.current = timerId;

    return () => {
      clearInterval(timerId);
      itemSpawnTimerRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, myCatRef.current]);

  useEffect(() => {
    return () => {
      clearInterval(catSpawnTimerRef.current);

      // 대기 중인 궤적 저장 타이머 정리 및 마지막 상태 즉시 저장
      if (storeWalkTimerRef.current) {
        clearTimeout(storeWalkTimerRef.current);
        storeWalkTimerRef.current = undefined;

        if (pathRef.current.length > 0) {
          storeTodayWalk({
            distance: totalDistanceRef.current,
            path: pathRef.current
              .slice(-MAX_SAVED_PATH)
              .map(({ lat, lng }) => ({ lat, lng })),
          });
        }
      }
    };
  }, []);

  return <div className={className}></div>;
}

export default function Map({ className, ...rest }: Props) {
  const map = useViewStore((s) => s.map);
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const { setMap, setIsStopFocusMe } = useViewStore((s) => s.actions);

  const [isLoading, setisLoading] = useState(true);
  const [totalDistance, setTotalDistance] = useState(0);

  const myMarkerRef = useRef<L.Marker>(null);

  const { isNight, hours } = useDayAndNight();

  useEffect(() => {
    return () => setMap(null);
  }, [setMap]);

  // 오늘 산책 거리 초기 표시 (스토리지에서 복원)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const todayWalk = await getTodayWalk();

      if (!cancelled) {
        setTotalDistance(todayWalk.distance);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      map?.dragging.disable();
    } else {
      map?.dragging.enable();
    }
  }, [isLoading, map]);

  return (
    <div className={cn("map-wrapper")}>
      <SkyLayer useDayNight={false} isNight={isNight} hours={hours} />

      {/* <AdBanner adGroupId="123" /> */}

      <div className={cn("distance-display")}>
        <span className={cn("label")}>오늘 산책</span>
        <NumberFlow
          className={cn("distance")}
          value={totalDistance / 1000}
          format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        />
        <span className={cn("unit")}>km</span>
      </div>

      <MapContainer
        className={cn("Map", className)}
        center={[37.5665, 126.978]} // 센터 기본값 서울시청
        zoom={INIT_ZOOM_LEVEL}
        maxZoom={MAX_ZOOM_LEVEL}
        minZoom={MIN_ZOOM_LEVEL}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false} // 하단 저작권 표시줄 전체 삭제
        bounceAtZoomLimits={false}
        maxBoundsViscosity={1}
      >
        <TileLayer
          className={cn("tile-layer", { night: isNight })}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* 맵 내부 마커생성, 이벤트 등록 등 */}
        <MapContent
          {...rest}
          onDistanceChange={(distance) => {
            setTotalDistance(distance);
          }}
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
        aria-label="내 위치로 이동"
        onClick={async () => {
          if (myMarkerRef.current) {
            // panTo 완료 후에 자동 추적 재개 (panTo 도중 panTo/setView와 충돌 방지)
            map?.once("moveend", () => {
              setIsStopFocusMe(false);
            });
            map?.panTo(myMarkerRef.current.getLatLng());
          }
        }}
      >
        <svg
          className={cn("gps-icon")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="7" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      </button>

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
    </div>
  );
}
