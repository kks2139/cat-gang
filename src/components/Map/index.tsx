import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import {
  config,
  Map as MaplibreMap,
  type MapMouseEvent,
  Marker,
  type SkySpecification,
  type StyleSpecification,
  type TerrainSpecification,
} from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import ImgCatMeWalk1 from "@/assets/img/character/cat-me-walk-1.png";
import ImgCatMeWalk2 from "@/assets/img/character/cat-me-walk-2.png";
import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
import noLabelsStyle from "@/assets/no-labels-style.json";
import PawIcon from "@/components/PawIcon";
import { useDayAndNight } from "@/hooks/useDayAndNight";
import { useItemMutation } from "@/queries/useItemMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useCatStore } from "@/store/cat";
import { useViewStore } from "@/store/view";
import { catCharacters } from "@/utils/cats";
import { isDev } from "@/utils/constants";
import {
  animateMarker,
  type Coords,
  createMarker,
  distanceInMeters,
  getCatchedCatElement,
  getNightTime,
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

const cn = classNames.bind(styles);

// MapLibre는 Leaflet과 같은 줌 레벨에서 축척이 2배(512px 타일 기준)이므로
// Leaflet 줌 19 축척과 동일하게 맞추려면 -1한 값을 사용한다
export const MAX_ZOOM_LEVEL = 18;
export const MIN_ZOOM_LEVEL = 15; // 핀치 줌 아웃 하한 (기본 18 → 15까지 축소 가능)
export const INIT_ZOOM_LEVEL = 18;
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

// 3D 카메라/지형/하늘 설정
const MAP_PITCH = 30; // 카메라 기본 기울기 (도) — 3D 효과의 핵심
const MAX_PITCH = 55; // 두 손가락 드래그 피치 상한 — 과도한 기울기는 렌더 부하(렉) 유발
const TERRAIN_EXAGGERATION = 1.3; // 지형 높이 증폭 배율
const DEM_SOURCE_ID = "terrain-dem";

// 시간대별 하늘 색 (낮/노을/밤)
const SKY_DAY: SkySpecification = {
  "sky-color": "rgb(103, 179, 245)",
  "horizon-color": "rgb(230, 244, 255)",
  "fog-color": "rgb(230, 244, 255)",
  // 지평선 안개/대기 효과 비활성 — 하늘색만 표시
  "fog-ground-blend": 0,
  "horizon-fog-blend": 0,
  "sky-horizon-blend": 0,
  "atmosphere-blend": 0,
};

const SKY_EVENING: SkySpecification = {
  "sky-color": "rgb(255, 145, 84)",
  "horizon-color": "rgb(255, 214, 165)",
  "fog-color": "rgb(255, 214, 165)",
  // 지평선 안개/대기 효과 비활성 — 하늘색만 표시
  "fog-ground-blend": 0,
  "horizon-fog-blend": 0,
  "sky-horizon-blend": 0,
  "atmosphere-blend": 0,
};

const SKY_NIGHT: SkySpecification = {
  "sky-color": "rgb(16, 22, 48)",
  "horizon-color": "rgb(46, 58, 89)",
  "fog-color": "rgb(46, 58, 89)",
  // 지평선 안개/대기 효과 비활성 — 하늘색만 표시
  "fog-ground-blend": 0,
  "horizon-fog-blend": 0,
  "sky-horizon-blend": 0,
  "atmosphere-blend": 0,
};

// 시간(0~23) 기준 하늘 상태: 낮 / 노을(6~8, 17~19) / 밤
const getSkyByHour = (isNight: boolean, hours: number): SkySpecification => {
  if (isNight) {
    return SKY_NIGHT;
  }

  if (hours <= 8 || hours >= 17) {
    return SKY_EVENING;
  }

  return SKY_DAY;
};

// ----- 다크 테마: 밤에는 주요 지물 색을 런타임에서 교체한다 -----
// (스타일 JSON은 낮 테마가 기본 — 여기 정의된 레이어만 밤에 어둡게 치환)
type PaintOverrides = Record<string, Record<string, unknown>>;

const DARK_PAINT_OVERRIDES: PaintOverrides = {
  background: {
    "background-color": "rgb(28, 32, 44)",
  },
  natural_earth: {
    "raster-opacity": 0.15,
  },
  park: {
    "fill-color": "rgb(38, 52, 42)",
    "fill-outline-color": "rgba(70, 110, 75, 0.5)",
  },
  landcover_wood: {
    "fill-color": "hsla(122,20%,22%,0.7)",
  },
  landcover_grass: {
    "fill-color": "rgba(62, 84, 60, 1)",
  },
  landcover_ice: {
    "fill-color": "rgba(70, 82, 100, 1)",
  },
  landcover_sand: {
    "fill-color": "rgba(90, 82, 66, 1)",
  },
  water: {
    "fill-color": "rgb(28, 44, 72)",
  },
  building: {
    "fill-color": "hsl(220,10%,26%)",
  },
  "building-3d": {
    "fill-extrusion-color": "hsl(220,10%,30%)",
  },
};

// 도로 계열: 채도를 죽이고 어둡게 (라벨 없는 지도 특성상 도로 색만으로 계층 구분)
const DARK_ROAD_COLOR = "rgb(64, 70, 86)";
// bridge_*는 map.on("load") 이후에 추가되는 레이어가 아니라 스타일 JSON에 있는 레이어라
// 같은 목록에서 관리 (고가도로/보행자 경로도 밤에는 어둡게 — 누락 시 흰색 잔여)
const DARK_BRIDGE_ROADS = [
  "bridge_motorway_link",
  "bridge_service_track",
  "bridge_link",
  "bridge_street",
  "bridge_secondary_tertiary",
  "bridge_trunk_primary",
  "bridge_motorway",
  "bridge_major_rail",
  "bridge_transit_rail",
  "bridge_path_pedestrian",
];

const DARK_CASING_COLOR = "rgb(40, 45, 58)";
const DARK_BRIDGE_CASINGS = [
  "bridge_motorway_link_casing",
  "bridge_service_track_casing",
  "bridge_link_casing",
  "bridge_street_casing",
  "bridge_secondary_tertiary_casing",
  "bridge_trunk_primary_casing",
  "bridge_motorway_casing",
  "bridge_path_pedestrian_casing",
];
const DARK_ROADS = [
  "road_minor",
  "road_secondary_tertiary",
  "road_trunk_primary",
  "road_service_track",
  "road_link",
  "road_motorway",
  "road_major_rail",
  "road_transit_rail",
  "road_path_pedestrian",
  "road_motorway_link",
  "tunnel_minor",
  "tunnel_secondary_tertiary",
  "tunnel_trunk_primary",
  "tunnel_motorway",
  ...DARK_BRIDGE_ROADS,
];

const DARK_CASINGS = [
  "road_minor_casing",
  "road_secondary_tertiary_casing",
  "road_trunk_primary_casing",
  "road_service_track_casing",
  "road_link_casing",
  "road_motorway_casing",
  "road_motorway_link_casing",
  "tunnel_minor_casing",
  "tunnel_secondary_tertiary_casing",
  "tunnel_trunk_primary_casing",
  "tunnel_motorway_casing",
  ...DARK_BRIDGE_CASINGS,
];

// 스타일의 모든 레이어 색을 낮/밤 테마에 맞게 치환
const applyTheme = (map: MaplibreMap, isNight: boolean, hours: number) => {
  map.setSky(getSkyByHour(isNight, hours));

  // hillshade(지형 음영)는 낮/밤 톤이 다름 — 밤엔 회색 음영이 어두운 배경 위 뿌옇게 부각되므로
  // 밤에는 채도를 낮춘 짙은 남색으로 바꾸고 강도를 줄인다
  if (map.getLayer("terrain-hillshade")) {
    if (isNight) {
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-shadow-color",
        "#12141a"
      );
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-highlight-color",
        "#2a3348"
      );
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-accent-color",
        "#232b3f"
      );
      map.setPaintProperty("terrain-hillshade", "hillshade-exaggeration", 0.35);
    } else {
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-shadow-color",
        "#8a8a8a"
      );
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-highlight-color",
        "#ffffff"
      );
      map.setPaintProperty(
        "terrain-hillshade",
        "hillshade-accent-color",
        "#aaaaaa"
      );
      map.setPaintProperty("terrain-hillshade", "hillshade-exaggeration", 0.5);
    }
  }

  if (!isNight) {
    // 낮: 스타일 원본 색으로 복원
    Object.entries(DARK_PAINT_OVERRIDES).forEach(([layerId, paints]) => {
      if (!map.getLayer(layerId)) {
        return;
      }

      const original = ORIGINAL_PAINTS[layerId];

      // 캡처가 실패한 레이어(빈 객체)는 건드리지 않는다 — 잘못된 값 재주입으로
      // 스펙 검증에 걸려 조용히 무시되며, 실패 상태가 낮에 고착되는 걸 막는다
      if (!original || Object.keys(original).length === 0) {
        return;
      }

      Object.keys(paints).forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setPaintProperty(layerId, key as any, original[key] as any);
      });
    });

    [...DARK_ROADS, ...DARK_CASINGS].forEach((layerId) => {
      if (!map.getLayer(layerId)) {
        return;
      }

      const original = ORIGINAL_PAINTS[layerId];

      if (
        original &&
        "line-color" in original &&
        original["line-color"] !== undefined
      ) {
        map.setPaintProperty(
          layerId,
          "line-color",
          original["line-color"] as never
        );
      }
    });

    return;
  }

  // 밤: 다크 테마 색으로 치환
  Object.entries(DARK_PAINT_OVERRIDES).forEach(([layerId, paints]) => {
    if (!map.getLayer(layerId)) {
      return;
    }

    Object.entries(paints).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setPaintProperty(layerId, key as any, value as any);
    });
  });

  [...DARK_ROADS, ...DARK_CASINGS].forEach((layerId) => {
    if (!map.getLayer(layerId)) {
      return;
    }

    map.setPaintProperty(
      layerId,
      "line-color",
      DARK_CASINGS.includes(layerId) ? DARK_CASING_COLOR : DARK_ROAD_COLOR
    );
  });
};

// 낮 테마 원본 색 (applyTheme 복원용 — 로드 시점에 수집)
const ORIGINAL_PAINTS: Record<string, Record<string, unknown>> = {};

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
  onMapReady?: (map: MaplibreMap) => void;
  onCreateCatsComplete?: () => void;
  ref?: React.Ref<Marker | null>;
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
  const { addToastMessage } = useViewStore((s) => s.actions);

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
  const centerPositionOfCats = useRef<{ lat: number; lng: number } | undefined>(
    undefined
  );

  // 마커
  const catMarkersRef = useRef<Marker[]>([]);
  const ownCatMarkersRef = useRef<Record<string, Marker>>({});
  const myCatRef = useRef<Marker>(null);

  // 타이머
  const walkTimerRef = useRef<number>(undefined);
  const lastWalkStartFrameRef = useRef<number>(0); // 지난 보행의 시작 프레임 (좌우 발 교대용)
  const meClickedTimerRef = useRef<number>(undefined);
  const itemSpawnTimerRef = useRef<number>(undefined);
  const catSpawnTimerRef = useRef<number>(undefined);

  // 이동 궤적 (발자국 트레일)
  const pathRef = useRef<{ lat: number; lng: number }[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const sessionDistanceRef = useRef<number>(0); // 이번 세션(캐릭터 첫 위치) 이동 거리 — 발자국 기준
  const startPointRef = useRef<Marker | null>(null);
  const nextPawDistanceRef = useRef<number>(PAW_INTERVAL_METER);
  const pawMarkerRef = useRef<Marker[]>([]);
  const pawToggleRef = useRef<boolean>(false); // false: 왼쪽 발, true: 오른쪽 발
  const storeWalkTimerRef = useRef<number>(undefined); // 궤적 저장 디바운스 타이머

  // 아이템
  const { data: itemCount } = useItemQuery();
  const { mutateAsync: updateItemCount } = useItemMutation();

  // 최신 itemCount를 참조하기 위한 Ref
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

  const map = useViewStore((s) => s.map);

  // 부모의 myMarkerRef.current에 그 값을 동기화합니다.
  // myCatRef.current는 state가 아니라 ref라 값이 변해도 재렌더가 없어
  // useImperativeHandle(getter, [])로는 마커 생성 이후 값이 반영되지 않는다.
  // → 마커 생성/제거 시점에 직접 대입해 동기화한다 (assignMyMarker)
  const assignMyMarker = useCallback(
    (marker: Marker | null) => {
      myCatRef.current = marker;

      if (typeof myMarkerRef === "object" && myMarkerRef !== null) {
        (myMarkerRef as React.RefObject<Marker | null>).current = marker;
      }
    },
    [myMarkerRef]
  );

  // 위치 구독/dev 목 위치 클릭에서 캐릭터/고양이를 다시 그리기 위한 ref.
  // createMeAndCats는 map 등 의존성이 바뀔 때마다 재생성되므로 클로저에 직접 담으면
  // 구독 시점의 옛날 값(map이 null인 상태)에 갇혀 캐릭터가 안 움직이는 원인이 된다.
  // → 항상 최신값을 가리키는 ref로 우회
  const createMeAndCatsRef = useRef<
    ((usePanTo?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    if (!map || !isDev) {
      return;
    }

    const onClick = (e: MapMouseEvent) => {
      setMockLocation(e.lngLat.lat, e.lngLat.lng);
      createMeAndCatsRef.current?.(true);
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  // 발자국 마커 1개를 찍는다 (트레일 기록 및 복원 공용)
  const createPawMarker = useCallback(
    (
      point: { lat: number; lng: number },
      bearingDeg: number,
      tiltDeg: number
    ) => {
      if (!map) {
        return;
      }

      const el = document.createElement("div");
      el.className = "paw-print";
      el.innerHTML = `<div class="paw-print-rotate" style="transform: rotate(${
        bearingDeg + tiltDeg
      }deg)"><div class="paw-print-inner">${PAW_SVG}</div></div>`;
      el.style.width = `${PAW_ICON_PX}px`;
      el.style.height = `${PAW_ICON_PX}px`;

      // z-index를 낮게 — 캐릭터/고양이 마커가 발자국 위에 표시되도록
      el.style.zIndex = "0";

      const pawMarker = new Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      pawMarkerRef.current.push(pawMarker);

      // 발자국이 너무 많이 쌓이면 오래된 것부터 제거
      if (pawMarkerRef.current.length > PAW_MAX_COUNT) {
        const oldest = pawMarkerRef.current.shift();
        oldest?.remove();
      }
    },
    [map]
  );

  // 시작점 마커를 찍는다
  const createStartDot = useCallback(
    (point: { lat: number; lng: number }) => {
      if (!map || startPointRef.current) {
        return;
      }

      const el = document.createElement("div");
      el.appendChild(
        document.createElementNS("http://www.w3.org/2000/svg", "svg")
      );
      const svg = el.firstChild as SVGSVGElement;
      svg.classList.add("trajectory-start-dot");
      svg.setAttribute("width", "12");
      svg.setAttribute("height", "12");
      svg.setAttribute("viewBox", "0 0 12 12");
      svg.innerHTML =
        '<circle cx="6" cy="6" r="5" fill="var(--main-1)" stroke="white" stroke-width="2"/>';

      // 발자국과 마찬가지로 캐릭터보다 아래 레이어
      el.style.zIndex = "0";

      startPointRef.current = new Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
    },
    [map]
  );

  // 줌 아웃할수록 발자국 간격을 넓혀 아이콘이 겹치지 않게 보정.
  // 기본 줌(18, 화면상 7m 간격이 적당) 기준으로 줌 레벨이 1 내려갈 때마다
  // 실제 지상 길이는 2배가 되므로 간격도 2배로 키운다
  const getZoomAwareInterval = useCallback(() => {
    if (!map) {
      return PAW_INTERVAL_METER;
    }

    const zoomOut = MAX_ZOOM_LEVEL - map.getZoom();

    if (zoomOut <= 0) {
      return PAW_INTERVAL_METER;
    }

    return PAW_INTERVAL_METER * Math.pow(2, zoomOut);
  }, [map]);

  const startWalkAnimation = useCallback(() => {
    const myMarker = myCatRef.current;
    const catImg = myMarker
      ?.getElement()
      ?.querySelector("[data-cat-img]") as HTMLImageElement | null;
    const containerEl = myMarker
      ?.getElement()
      ?.querySelector("[data-marker-container]");

    if (!catImg || !containerEl || meClickedTimerRef.current) {
      return;
    }

    if (walkTimerRef.current) {
      clearInterval(walkTimerRef.current);
    }

    // 걷는 동안 bob/스쿼시/그림자 pulse를 켜고, 끝나면 원복
    containerEl.classList.add("is-walking");

    const walkFrames = [
      ImgCatMeWalk1,
      ImgCatMeWalk2,
      ImgCatMeWalk1,
      ImgCatMeWalk2,
    ];
    // 연속 이동 시 지난번에 안 쓴 발부터 시작해 좌우 걸음이 이어지게 함
    let frameIndex = lastWalkStartFrameRef.current;
    lastWalkStartFrameRef.current = 1 - lastWalkStartFrameRef.current;
    catImg.src = walkFrames[frameIndex];

    walkTimerRef.current = window.setInterval(() => {
      frameIndex++;

      if (frameIndex >= walkFrames.length) {
        clearInterval(walkTimerRef.current);
        walkTimerRef.current = undefined;
        catImg.src = ImgCatMe;
        containerEl.classList.remove("is-walking");
        return;
      }

      catImg.src = walkFrames[frameIndex];
    }, 375);
  }, []);

  const drawMe = useCallback(
    async (usePanTo?: boolean) => {
      const coords: Coords | undefined = await getCurrentPosition();

      if (!coords || !map) {
        return;
      }

      const newPoint = { lat: coords.latitude, lng: coords.longitude };

      if (pathRef.current.length > 0) {
        const lastPoint = pathRef.current[pathRef.current.length - 1];
        const dist = distanceInMeters(lastPoint, newPoint);

        // 10미터 이상 이동했을때만 거리 추가
        if (dist > 10) {
          totalDistanceRef.current += dist;
          sessionDistanceRef.current += dist;
          onDistanceChange?.(totalDistanceRef.current);
          pathRef.current.push(newPoint);

          // 줌 레벨에 맞는 발자국 간격(m): 줌 아웃일수록 간격을 넓혀
          // 발자국 아이콘이 겹치지 않도록 한다 (기본 줌에선 7m 그대로)
          const intervalM = getZoomAwareInterval();
          // 좌우 벌어짐 배율: 간격이 늘어난 비율에 맞춰 offset도 같이 키운다
          const spreadDegFactor = intervalM / PAW_INTERVAL_METER;
          // 한 이동당 발자국 개수 상한: 구간이 너무 길면 간격 자체를 늘려 개수를 제한한다
          const maxStepForCap =
            Math.ceil(dist / MAX_PAWS_PER_MOVE / intervalM) * intervalM;
          const step = Math.max(intervalM, maxStepForCap);

          const bearingDeg =
            (Math.atan2(
              newPoint.lng - lastPoint.lng,
              newPoint.lat - lastPoint.lat
            ) *
              180) /
            Math.PI;
          // 이번 구간 이동 전까지의 세션 누적 거리 (캐릭터 첫 위치 기준)
          const sessionDistanceBefore = sessionDistanceRef.current - dist;
          const traveledSinceLastPaw =
            nextPawDistanceRef.current - sessionDistanceBefore;

          // 이동 구간을 따라 step 간격으로 발자국 위치를 미리 계산
          const pawPositions: {
            latLng: { lat: number; lng: number };
            bearingDeg: number;
            tiltDeg: number;
          }[] = [];

          for (
            let remain = traveledSinceLastPaw;
            remain <= dist;
            remain += step
          ) {
            const ratio = remain / dist;
            const centerPoint = {
              lat: lastPoint.lat + (newPoint.lat - lastPoint.lat) * ratio,
              lng: lastPoint.lng + (newPoint.lng - lastPoint.lng) * ratio,
            };

            // 중심축에서 좌우로 벌어진 위치 계산 (위도/경도 거리 비율 보정)
            const isLeftPaw = !pawToggleRef.current;
            const metersPerDegLat = 111_320;
            const metersPerDegLng =
              111_320 * Math.cos((centerPoint.lat * Math.PI) / 180);

            // 보행 방향(미터 공간) 단위 벡터의 오른쪽 수직 벡터
            const dirLatM = (newPoint.lat - lastPoint.lat) * metersPerDegLat;
            const dirLngM = (newPoint.lng - lastPoint.lng) * metersPerDegLng;
            const dirNorm = Math.hypot(dirLatM, dirLngM) || 1;
            const perpLatM = dirLngM / dirNorm; // 시계방향 90도 회전: 오른쪽
            const perpLngM = -dirLatM / dirNorm;

            const spreadDegLat =
              (perpLatM * PAW_SPREAD_METER * spreadDegFactor) / metersPerDegLat;
            const spreadDegLng =
              (perpLngM * PAW_SPREAD_METER * spreadDegFactor) / metersPerDegLng;

            pawPositions.push({
              latLng: {
                lat: centerPoint.lat + spreadDegLat * (isLeftPaw ? -1 : 1),
                lng: centerPoint.lng + spreadDegLng * (isLeftPaw ? -1 : 1),
              },
              bearingDeg,
              tiltDeg: isLeftPaw ? 22 : -22, // 왼/오 대각선 번갈아 (방향 반대)
            });
            pawToggleRef.current = !pawToggleRef.current;
          }

          if (pawPositions.length > 0) {
            pawPositions.forEach((paw, index) => {
              // 캐릭터 이동보다 약간 늦게 찍히도록 지연 (WALK_DURATION * 1.3에 걸쳐 순차 출력)
              const delay = (index / pawPositions.length) * WALK_DURATION * 1.3;

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
        pathRef.current.push(newPoint);
        createStartDot(newPoint);
      }

      if (myCatRef.current) {
        startWalkAnimation();
        animateMarker(
          myCatRef.current,
          [coords.longitude, coords.latitude],
          WALK_DURATION
        );
      } else {
        const marker = createMarker({
          type: "me",
          imgUrl: ImgCatMe,
          map,
          position: [coords.longitude, coords.latitude],
        });

        marker.on("click", () => {
          onClickMe?.();
        });

        assignMyMarker(marker);
      }

      // 드래그된 상태 아닐때 (ref로 항상 최신값 참조)
      if (!isStopFocusMeRef.current) {
        startWalkAnimation();

        // 현재 위치로 지도 중심 이동
        if (usePanTo) {
          map.easeTo({
            center: [coords.longitude, coords.latitude],
            duration: 1500,
          });
        } else {
          map.jumpTo({
            center: [coords.longitude, coords.latitude],
          });
        }
      }

      return {
        coords,
      };
    },
    [
      assignMyMarker,
      createPawMarker,
      createStartDot,
      getZoomAwareInterval,
      map,
      onClickMe,
      onDistanceChange,
      startWalkAnimation,
    ]
  );

  const drawCats = useCallback(
    (forceDraw?: boolean) => {
      if (!myCatRef.current || !map || isShowStage) {
        return;
      }

      const myPosition = myCatRef.current.getLngLat();

      // 내 고양이 이전좌표랑 일정m 이상 차이날때만 cats 새로 그린다
      const canSkipDraw = centerPositionOfCats.current
        ? distanceInMeters(myPosition, centerPositionOfCats.current) <= 40
        : false;

      if (canSkipDraw && !forceDraw) {
        return;
      }

      // 고양이들 그릴 중심점 업데이트
      centerPositionOfCats.current = {
        lat: myPosition.lat,
        lng: myPosition.lng,
      };

      // 이전에 생성한 랜덤 마커들 해제
      catMarkersRef.current.forEach((marker) => {
        removeMarkerWithMotion(marker);
      });
      catMarkersRef.current = [];

      const filteredCats = catCharacters.filter(({ rarity, activeTime }) => {
        // 시간대 필터: 밤(18시~05시)에만 등장 / 낮(06시~17시)에만 등장
        if (activeTime === "night" && !getNightTime(new Date()).isNightTime) {
          return false;
        }

        if (activeTime === "day" && getNightTime(new Date()).isNightTime) {
          return false;
        }

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
        const [lng, lat] = getRandomLocationInCircle(
          myPosition.lat,
          myPosition.lng,
          BOUNDARY_METER_OF_ME
        );

        const marker = createMarker({
          type: "enemy",
          catName: cat.name,
          position: [lng, lat],
          imgUrl: cat.img,
          map,
        });

        marker.on("click", (e) => {
          // MapLibre 마커 클릭 이벤트의 originalEvent.target은 실제 클릭된 DOM 노드
          // — data-status를 가진 컨테이너를 찾아 올라간다
          const domTarget =
            e.originalEvent.target instanceof HTMLElement
              ? e.originalEvent.target
              : marker.getElement();
          const container = domTarget?.closest("[data-marker-container]");

          if (container?.getAttribute("data-status") !== "none") {
            return;
          }

          setSelectedCat({ ...cat, marker });

          onClickCat?.();
        });

        catMarkersRef.current.push(marker);
      });
    },
    [isShowStage, map, onClickCat, setSelectedCat]
  );

  const drawOwnCats = useCallback(() => {
    if (!map) return;

    // 현재 전달받은 고양이들의 고유 키 셋 생성
    const currentCatKeys = new Set(
      ownCats?.map((cat) => `${cat.name}_${cat.createdAt}`) || []
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
          position: [position.lng, position.lat],
          type: "owned",
          map,
        });

        marker.on("click", () => {
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
    [checkSpawnedCats, drawCats, drawMe]
  );

  // 항상 최신 createMeAndCats를 ref에 동기화 (dev 클릭 핸들러에서 사용)
  createMeAndCatsRef.current = createMeAndCats;

  // 잡은 고양이(깃발) 목록이 로드되거나 변경될 때마다 다시 그린다
  // (마운트 시점엔 쿼리 데이터가 아직 없으므로 데이터 도착 후 재호출 필요)
  useEffect(() => {
    drawOwnCats();
  }, [drawOwnCats]);

  useEffect(() => {
    // 잡은 고양이목록 클릭 리액션
    if (clickedOwnCat) {
      const cat = Object.entries(ownCatMarkersRef.current).find(
        ([key, marker]) => {
          const { lat, lng } = marker.getLngLat();

          return (
            key.includes(clickedOwnCat.createdAt) &&
            lat === clickedOwnCat.lat &&
            lng === clickedOwnCat.lng
          );
        }
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
          // 부하 깃발을 화면 중앙으로 옮긴 뒤 고양이를 등장시킨다
          // (지도 하단 패딩으로 '나'가 유지되는 지점이 화면 중앙 기준점)
          const FOCUS_DURATION = 600;
          const { lat, lng } = marker.getLngLat();

          map?.flyTo({ center: [lng, lat], duration: FOCUS_DURATION });

          const catElement = getCatchedCatElement(
            catData.img,
            catData.dialog.greeting[getRandomNumber(3)]
          );

          wait(FOCUS_DURATION).then(() => {
            markerElement?.appendChild(catElement);

            setTimeout(() => {
              markerElement?.removeChild(catElement);
            }, 2000);
          });
        }
      }
    }
  }, [clickedOwnCat, map]);

  // 스토리지에 저장된 오늘 산책 데이터(거리 + 궤적)를 읽어 발자국 트레일을 복원한다
  const restoreTodayWalk = useCallback(async () => {
    const todayWalk = await getTodayWalk();

    totalDistanceRef.current = todayWalk.distance;
    onDistanceChange?.(todayWalk.distance);

    if (!map || todayWalk.path.length === 0) {
      return;
    }

    pathRef.current = todayWalk.path.map(({ lat, lng }) => ({ lat, lng }));

    // 저장된 궤적을 따라 발자국 + 시작점을 다시 그린다 (애니메이션 지연 없이 즉시)
    pathRef.current.forEach((point, i) => {
      if (i === 0) {
        createStartDot(point);
        return;
      }

      const prev = pathRef.current[i - 1];
      const bearingDeg =
        (Math.atan2(point.lng - prev.lng, point.lat - prev.lat) * 180) /
        Math.PI;

      createPawMarker(point, bearingDeg, pawToggleRef.current ? -22 : 22);
      pawToggleRef.current = !pawToggleRef.current;
    });

    // 다음 발자국 기준을 저장된 궤적 길이 기준으로 맞춘다
    nextPawDistanceRef.current =
      Math.floor(sessionDistanceRef.current / PAW_INTERVAL_METER) *
        PAW_INTERVAL_METER +
      PAW_INTERVAL_METER;
  }, [createPawMarker, createStartDot, map, onDistanceChange]);

  useEffect(() => {
    // 지도 인스턴스(store의 map)가 준비된 뒤 1회만 초기화한다
    if (!map || isRendered.current) {
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

      onCreateCatsComplete?.();
    })();
  }, [
    createMeAndCats,
    drawOwnCats,
    map,
    onCreateCatsComplete,
    restoreTodayWalk,
  ]);

  useEffect(() => {
    if (isInitLoading || isWatchPositionReady.current) {
      return;
    }

    isWatchPositionReady.current = true;

    let stopWatch: (() => void) | undefined;

    // 위치변화 감지 시, 다시 그리기
    // 콜백은 항상 최신 createMeAndCats를 가리키는 ref로 우회 —
    // 구독(effect 1회 실행) 시점의 클로저에 갇히지 않게 한다
    (async () => {
      const stop = await watchPosition(() => {
        if (!myCatRef.current) {
          return;
        }

        createMeAndCatsRef.current?.(true);
      });

      stopWatch = stop;
    })();

    return () => {
      if (stopWatch) {
        stopWatch();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 구독은 마운트 시 1회만, 콜백은 ref로 최신 유지

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
      const myPosition = myCatRef.current?.getLngLat();

      if (!myPosition || !map) return;

      const [lng, lat] = getRandomLocationInCircle(
        myPosition.lat,
        myPosition.lng,
        70
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
        position: [lng, lat],
        imgUrl,
        map,
      });

      marker.on("click", async (e) => {
        // MapLibre 클릭 이벤트의 originalEvent.target은 실제 클릭된 DOM 노드
        // — 아이템 컨테이너를 찾아 올라간다
        const domTarget =
          e.originalEvent.target instanceof HTMLElement
            ? e.originalEvent.target
            : marker.getElement();
        const container = domTarget?.closest("[data-type='item']");

        if (container) {
          container.classList.add("clicked");

          addToastMessage({
            duration: 3000,
            message: `${
              itemType === "catnip"
                ? "캣닢"
                : itemType === "gukbab"
                ? "국밥"
                : "생선"
            } +1`,
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
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const { setMap, setIsStopFocusMe, setIsMapLoading } = useViewStore(
    (s) => s.actions
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  const [isLoading, setisLoading] = useState(true);
  const [totalDistance, setTotalDistance] = useState(0);

  const myMarkerRef = useRef<Marker>(null);

  const { isNight, hours } = useDayAndNight();

  // 지도 초기화 effect에서 클로저가 최신 하늘 상태를 쓰도록 ref 유지
  // (렌더 중이 아닌 effect에서만 갱신)
  const skyStateRef = useRef({ isNight, hours });

  useEffect(() => {
    skyStateRef.current = { isNight, hours };
  }, [isNight, hours]);

  useEffect(() => {
    return () => setMap(null);
  }, [setMap]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    // Vite 번들러 환경에서 maplibre의 import.meta.url 기반 worker URL이
    // 깨지므로 public/에 복사해둔 worker 파일을 명시적으로 지정한다
    // (BASE_URL은 앱인토스 배포 경로에서도 올바르게 리졸브됨)
    config.WORKER_URL = `${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`;

    const map = new MaplibreMap({
      container,
      style: noLabelsStyle as unknown as StyleSpecification,
      center: [126.978, 37.5665], // 센터 기본값 서울시청
      zoom: INIT_ZOOM_LEVEL,
      maxZoom: MAX_ZOOM_LEVEL,
      minZoom: MIN_ZOOM_LEVEL,
      attributionControl: false, // 하단 저작권 표시줄 전체 삭제
      interactive: true,
      dragPan: true,
      touchZoomRotate: true,
      // 핀치 줌 + 두 손가락 회전 모두 활성
      scrollZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      pitchWithRotate: true,
      dragRotate: false,
      // 두 손가락 세로 드래그로 카메라 기울기 조절 활성화 (상한 MAX_PITCH로 렉 방지)
      touchPitch: true,
      maxPitch: MAX_PITCH,
      cooperativeGestures: false,
    });

    // 3D 피치 상태에서는 '지도 중심'이 화면 중앙(지평선 쪽)으로 시각적으로 밀려난다.
    // 하단 패딩을 주면 center 기준점이 화면 하단으로 내려가 캐릭터가 화면 중앙에 보이고,
    // 반경 50m 스폰 고양이들이 화면 안에 들어온다.
    map.setPadding({
      top: 0,
      bottom: Math.round(window.innerHeight * 0.25),
      left: 0,
      right: 0,
    });

    mapRef.current = map;

    map.on("dragstart", () => {
      setIsStopFocusMe(true);
    });

    map.on("load", () => {
      // 낮 테마 원본 색 수집 (밤→낮 복원용)
      // 공개 API인 getPaintProperty를 써야 스타일 스펙 값이 그대로 나온다.
      // (layer.paint._values의 value는 maplibre v6에서 래퍼 객체라 재주입 시
      //  스펙 검증에 걸려 조용히 무시됨 → 밤 테마가 낮에 고착되는 원인이었음)
      [
        ...Object.keys(DARK_PAINT_OVERRIDES),
        ...DARK_ROADS,
        ...DARK_CASINGS,
      ].forEach((layerId) => {
        const layer = map.getLayer(layerId);

        if (!layer) {
          return;
        }

        const paints: Record<string, unknown> = {};
        const paintKeys = Object.keys(DARK_PAINT_OVERRIDES[layerId] ?? {});

        // 도로/casing은 line-color만 치환하므로 그 키만 캡처
        if (DARK_ROADS.includes(layerId) || DARK_CASINGS.includes(layerId)) {
          paintKeys.push("line-color");
        }

        paintKeys.forEach((key) => {
          try {
            // getPaintProperty는 레이어 타입별 키 유니온이라 동적 키 조회에 any 캐스팅 필요
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            paints[key] = map.getPaintProperty(layerId, key as any);
          } catch {
            // layout 속성 등 조회 불가 키는 무시
          }
        });

        ORIGINAL_PAINTS[layerId] = paints;
      });

      // 3D 지형: AWS Terrain Tiles(terrarium DEM, 무료/키 불필요)
      map.addSource(DEM_SOURCE_ID, {
        type: "raster-dem",
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      });

      const terrain: TerrainSpecification = {
        source: DEM_SOURCE_ID,
        exaggeration: TERRAIN_EXAGGERATION,
      };
      map.setTerrain(terrain);

      // 지형 음영(햇빛 그림자 느낌): 위 DEM 소스를 재사용 — 추가 타일 다운로드 없음.
      // 레이어는 background 바로 위(스타일 지물 레이어들보다 아래)에 삽입해 지물에 가리지 않게 한다.
      map.addLayer(
        {
          id: "terrain-hillshade",
          type: "hillshade",
          source: DEM_SOURCE_ID,
          paint: {
            // 은은한 수준으로 조정 — 이전 1.0은 지져분해 보였음
            "hillshade-exaggeration": 0.5,
            "hillshade-shadow-color": "#8a8a8a", // 중립 회색 — 갈색 톤이 지저분해 보여 중화
            "hillshade-highlight-color": "#ffffff",
            "hillshade-accent-color": "#aaaaaa",
            "hillshade-illumination-direction": 315,
            "hillshade-illumination-altitude": 45,
          },
        },
        "natural_earth" // background 다음 = 지물 레이어 전부보다 아래
      );

      // 3D 건물 조명: 광원 방향을 지정해 면에 명암(그림자 느낌)을 강화한다.
      // (MapLibre는 건물의 지면 투영 그림자는 미지원 — 조명 음영이 대체 수단)
      map.setLight({
        anchor: "viewport",
        position: [1.5, 315, 40],
        color: "#ffffff",
        intensity: 0.35,
      });

      // 하늘/안개 효과 + 지물 다크 테마 적용
      applyTheme(map, skyStateRef.current.isNight, skyStateRef.current.hours);

      // 3D 카메라 기울기
      map.setPitch(MAP_PITCH);

      setMap(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [setMap, setIsStopFocusMe]);

  // 로딩중(찾는중 UI 노출중)에는 지도의 모든 조작을 비활성화한다
  // — 드래그 이동/핀치 줌·회전/피치(기울기) 전부 잠금
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (isLoading) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.touchPitch.disable();
    } else {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchPitch.enable();
    }
  }, [isLoading]);

  // 로딩 상태를 전역 스토어에 동기화 — FindCat 페이지에서
  // 내 부하/도감 버튼 등을 함께 비활성화하는 데 사용
  useEffect(() => {
    setIsMapLoading(isLoading);

    return () => {
      setIsMapLoading(false);
    };
  }, [isLoading, setIsMapLoading]);

  // 낮/밤 전환 시 하늘 + 지물 색 갱신
  // (스타일 로드 완료 전에 setSky를 호출하면 "Style is not done loading" 에러가 나므로
  //  map 'load' 이벤트 이후에만 호출한다)
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applyTheme(map, isNight, hours);
  }, [isNight, hours]);

  return (
    <div className={cn("map-wrapper")}>
      {/* 상단 산책 거리 플로팅 캡슐 */}
      <div className={cn("distance-display")}>
        <PawIcon size={15} color="#834e00" className={cn("paw-icon")} />
        <span className={cn("label")}>오늘 산책 거리</span>
        <NumberFlow
          className={cn("distance")}
          value={totalDistance / 1000}
          format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        />
        <span className={cn("unit")}>km</span>
      </div>

      <div
        ref={containerRef}
        className={cn("Map", className, { night: isNight })}
      >
        <div className={cn("map-content")}>
          <MapContent
            {...rest}
            onDistanceChange={(distance) => {
              setTotalDistance(distance);
            }}
            ref={myMarkerRef}
            onMapReady={(map) => {
              // 맵 상태에 등록
              setMap(map);
            }}
            onCreateCatsComplete={() => {
              setisLoading(false);
            }}
          />
        </div>
      </div>

      <button
        data-name="focus-button"
        className={cn("focus-button", { "stop-focus": isStopFocusMe })}
        aria-label="내 위치로 이동"
        disabled={isLoading}
        onClick={async () => {
          const marker = myMarkerRef.current;

          if (marker) {
            const { lat, lng } = marker.getLngLat();

            // panTo 완료 후에 자동 추적 재개 (panTo 도중 panTo/setView와 충돌 방지)
            mapRef.current?.once("moveend", () => {
              setIsStopFocusMe(false);
            });
            mapRef.current?.easeTo({
              center: [lng, lat],
              duration: 1500,
            });
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
