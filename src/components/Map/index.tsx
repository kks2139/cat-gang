import NumberFlow from "@number-flow/react";
import classNames from "classnames/bind";
import { AnimatePresence } from "framer-motion";
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
import { useLocation } from "react-router-dom";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import ImgCatMeWalk1 from "@/assets/img/character/cat-me-walk-1.png";
import ImgCatMeWalk2 from "@/assets/img/character/cat-me-walk-2.png";
import ImgCatnip from "@/assets/img/item/catnip.png";
import ImgFish from "@/assets/img/item/fish.png";
import ImgGukbab from "@/assets/img/item/gukbab.png";
import noLabelsStyle from "@/assets/no-labels-style.json";
import CloudReveal from "@/components/CloudReveal";
import CatTower, { TOWER_HIT_LAYERS } from "@/components/Map/CatTower";
import PawIcon from "@/components/PawIcon";
import { useDayAndNight } from "@/hooks/useDayAndNight";
import { useItemMutation } from "@/queries/useItemMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useUpdateTotalDistanceMutation } from "@/queries/useUpdateTotalDistanceMutation";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useCatStore } from "@/store/cat";
import { useCatTowerStore } from "@/store/catTower";
import { useKkangStore } from "@/store/kkang";
import { useViewStore } from "@/store/view";
import { catCharacters } from "@/utils/cats";
import { isDev, NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";
import {
  animateMarker,
  type Coords,
  createMarker,
  distanceInMeters,
  getCatchedCatElement,
  getMarkerZoomScale,
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
const PAW_ICON_PX = 22; // 발자국 아이콘 픽셀 크기 (symbol/오버레이 공용 — 살짝 크게)
const PAW_MAX_COUNT = 200; // 발자국 최대 개수 (DOM 성능 보호)
const WALK_DURATION = 1500; // 캐릭터 이동 애니메이션 시간 (ms)
const MAX_PAWS_PER_MOVE = 50; // 한 번의 위치 업데이트당 찍히는 최대 발자국 수
const MAX_SAVED_PATH = 600; // 스토리지에 저장할 궤적 좌표 최대 개수
const STORE_DEBOUNCE_MS = 5000; // 궤적 저장 디바운스 (ms)
const SYNC_MIN_INTERVAL_MS = 60_000; // 총 산책거리 서버 동기화 최소 간격 (ms)
const PAW_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 11.5c-3.2 0-6 2.6-6 5.2 0 1.8 1.4 3 3.2 3 1 0 1.8-.4 2.8-.4s1.8.4 2.8.4c1.8 0 3.2-1.2 3.2-3 0-2.6-2.8-5.2-6-5.2z"/><ellipse cx="6" cy="8.4" rx="1.9" ry="2.4" transform="rotate(-25 6 8.4)"/><ellipse cx="12" cy="6.6" rx="1.9" ry="2.5"/><ellipse cx="18" cy="8.4" rx="1.9" ry="2.4" transform="rotate(25 18 8.4)"/></svg>`;

// ----- 발자국 symbol layer (DOM 마커 → GPU symbol 렌더 전환) -----
// 지속 렌더는 symbol layer가 담당한다 — 200개 발자국이 GPU 1배치로 그려져
// 카메라 이동 프레임마다 200개 DOM transform을 갱신하던 비용이 사라진다.
// 찍히는 순간의 스탬프 모션(paw-stamp 애니)만 DOM 오버레이로 잠깐 재생하고,
// 오버레이 제거 시점에 feature를 소스에 플러시해 DOM→GPU가 자연스럽게 이어진다.
const PAW_SOURCE_ID = "paw-source";
const PAW_LAYER_ID = "paw-symbol";
const PAW_IMAGE_ID = "paw-print-icon";
const PAW_STAMP_MS = 600; // DOM 스탬프 오버레이 수명 (paw-stamp 애니 0.5s + 여유)
const PAW_IMAGE_SCALE = 2; // 레티나 대응 — 2배 해상도로 래스터화
const PAW_IMG_CORE = PAW_ICON_PX * PAW_IMAGE_SCALE; // 발바닥 코어 크기 (36px 비트맵)
const PAW_IMG_MARGIN = 12; // 그림자(shadowBlur/Offset) 클리핑 방지 여백 (비트맵 px)
const PAW_IMG_TOTAL = PAW_IMG_CORE + PAW_IMG_MARGIN * 2; // 60px 비트맵
// icon-size 1 = 비트맵의 css 크기(60/2=30px) — 발바닥이 18px로 보이도록 환산
const PAW_ICON_SIZE = PAW_ICON_PX / (PAW_IMG_TOTAL / PAW_IMAGE_SCALE);
// symbol 지물용 최소 GeoJSON 타입 (@types/geojson 미설치 — CatTower와 동일 방식)
type PawFeature = {
  type: "Feature";
  properties: { bearing: number; tilt: number };
  geometry: { type: "Point"; coordinates: [number, number] };
};

// PAW_SVG를 발자국 색(#b0805a)을 주입해 캔버스로 래스터화한다.
// CSS drop-shadow는 symbol layer에서 흉내 낼 수 없으니 캔버스 shadow로
// 같이 구워 넣는다(레티나 2배 기준 blur 4 / offsetY 2 = css 2px / 1px).
const rasterizePawImage = (): Promise<ImageData | null> => {
  return new Promise((resolve) => {
    const svg = PAW_SVG.replace("<svg ", '<svg fill="#b0805a" ');
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");

      canvas.width = PAW_IMG_TOTAL;
      canvas.height = PAW_IMG_TOTAL;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(
        img,
        PAW_IMG_MARGIN,
        PAW_IMG_MARGIN,
        PAW_IMG_CORE,
        PAW_IMG_CORE
      );

      resolve(ctx.getImageData(0, 0, PAW_IMG_TOTAL, PAW_IMG_TOTAL));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};

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
  /** 깡 캡슐(충전) 클릭 콜백 */
  onClickKkang?: () => void;
  /** 캣 타워 팝업의 작업고양이 추가 클릭 — 고양이 목록 시트를 연다 */
  onTowerAddCats?: () => void;
  /** 캣 타워 팝업의 꾸미기 클릭 — 해당 타워의 색상 선택 시트를 연다 */
  onTowerDecor?: (towerId: string) => void;
  /** 캣 타워를 새로 세웠을 때 */
  onTowerPlaced?: () => void;
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
  onTowerAddCats,
  onTowerDecor,
  onTowerPlaced,
}: Omit<Props, "onClickKkang">) {
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
  // 발자국 symbol 지물 — 최대 200개(Point feature), 소스에 플러시되면 GPU 렌더
  const pawFeaturesRef = useRef<PawFeature[]>([]);
  // 스탬프 모션 재생 중인 DOM 오버레이 (0.6s 뒤 제거)
  const pawOverlaysRef = useRef<{ marker: Marker; timer: number }[]>([]);
  // 아이콘 이미지 준비 전에 플러시 요청이 들어오면 대기 표시 (래스터화 완료 시 반영)
  const pawFlushPendingRef = useRef(false);
  const isPawLayersAddedRef = useRef(false);
  // 플러시 스로틀 타이머 — 복원 시 최대 200개 발자국이 동시에 찍혀
  // setData 버스트가 되지 않게 한 프레임으로 합친다
  const pawFlushTimerRef = useRef<number>(0);
  const pawToggleRef = useRef<boolean>(false); // false: 왼쪽 발, true: 오른쪽 발
  const storeWalkTimerRef = useRef<number>(undefined); // 궤적 저장 디바운스 타이머

  // 부하 인사 연출 상태 — 재클릭 시 진행 중인 연출을 정리하고 새로 재생하기 위한 ref
  const greetingRef = useRef<{
    element: HTMLDivElement;
    timers: number[];
  } | null>(null);

  // 아이템
  const { data: itemCount } = useItemQuery();
  const { mutateAsync: updateItemCount } = useItemMutation();

  // 최신 itemCount를 참조하기 위한 Ref
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

  // 총 산책거리 서버 동기화 (랭킹용) — 서버값 + 오늘 누적거리를 절대값으로 전송
  const { data: user } = useUsersQuery();
  const { mutateAsync: syncTotalDistanceRpc } =
    useUpdateTotalDistanceMutation();

  const serverTotalDistanceRef = useRef(0);
  const lastSyncedCandidateRef = useRef<number | null>(null);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    serverTotalDistanceRef.current = user?.total_distance ?? 0;
  }, [user]);

  const syncTotalDistance = useCallback(
    async (isFinal = false) => {
      const candidate =
        serverTotalDistanceRef.current + totalDistanceRef.current;

      if (candidate === lastSyncedCandidateRef.current) {
        return;
      }

      if (
        !isFinal &&
        Date.now() - lastSyncAtRef.current < SYNC_MIN_INTERVAL_MS
      ) {
        return;
      }

      lastSyncAtRef.current = Date.now();

      try {
        // greatest(total_distance, p_distance)로 갱신되므로 중복/재전송에도 멱등
        await syncTotalDistanceRpc({ distance: candidate });
        lastSyncedCandidateRef.current = candidate;
      } catch (e) {
        // 실패 시 lastSyncedCandidate를 진행하지 않아 다음 주기에 재전송된다
        console.error("총 산책거리 동기화 실패:", e);
      }
    },
    [syncTotalDistanceRpc]
  );

  // watchPosition 핸들러/언마운트 클린업이 항상 최신 함수를 쓰도록 ref 유지
  const syncTotalDistanceRef = useRef(syncTotalDistance);
  syncTotalDistanceRef.current = syncTotalDistance;

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
      // 캣 타워 위치 지정 중에는 캐릭터를 움직이지 않는다
      const towerState = useCatTowerStore.getState();

      if (towerState.isPlacingTower) {
        return;
      }

      // 타워가 세워져 있을 땐 지면 클릭만 캐릭터 이동으로 처리한다 —
      // 타워 지물(기둥/기초 지반/발판) 클릭은 팝업 토글이 가야 한다
      if (
        towerState.towers.length > 0 &&
        map.queryRenderedFeatures(e.point, { layers: TOWER_HIT_LAYERS })
          .length > 0
      ) {
        return;
      }

      setMockLocation(e.lngLat.lat, e.lngLat.lng);
      createMeAndCatsRef.current?.(true);
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  // 대기 중인 발자국 feature를 symbol 소스에 반영 — 아이콘 이미지가 아직
  // 준비 전이면 플래그만 두고, load 쪽 래스터화 완료 시점에 다시 반영한다
  const flushPawFeatures = useCallback(() => {
    if (!map) {
      return;
    }

    if (!map.hasImage(PAW_IMAGE_ID)) {
      pawFlushPendingRef.current = true;
      return;
    }

    const source = map.getSource(PAW_SOURCE_ID) as
      | { setData: (data: unknown) => void }
      | undefined;

    source?.setData({
      type: "FeatureCollection",
      features: pawFeaturesRef.current,
    });
  }, [map]);

  // 발자국 1개를 찍는다 (트레일 기록 및 복원 공용) —
  // 지속 렌더는 symbol layer, 스탬프 모션은 DOM 오버레이가 담당
  const createPawMarker = useCallback(
    (
      point: { lat: number; lng: number },
      bearingDeg: number,
      tiltDeg: number
    ) => {
      if (!map) {
        return;
      }

      // symbol 지물 추가 — 오버레이가 끝나는 시점에 플러시돼 그린다
      pawFeaturesRef.current.push({
        type: "Feature",
        properties: { bearing: bearingDeg, tilt: tiltDeg },
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      });

      // 발자국이 너무 많이 쌓이면 오래된 것부터 제거
      if (pawFeaturesRef.current.length > PAW_MAX_COUNT) {
        pawFeaturesRef.current.shift();
      }

      // 스탬프 모션 오버레이 — 기존 DOM 마커와 동일한 마크업/애니메이션
      const el = document.createElement("div");
      el.className = "paw-print";
      // 진행 방향(bearing)은 Marker rotation에 맡기고(rotationAlignment: "map"),
      // 좌우 기울기(tilt)만 CSS로 먹인다 — CSS rotate만 쓰면 마커가 화면 공간에
      // 고정돼 지도를 회전했을 때 발자국 방향이 실제 이동 방향과 어긋난다
      el.innerHTML = `<div class="paw-print-rotate" style="transform: rotate(${tiltDeg}deg)"><div class="paw-print-inner">${PAW_SVG}</div></div>`;
      el.style.width = `${PAW_ICON_PX}px`;
      el.style.height = `${PAW_ICON_PX}px`;

      // z-index를 낮게 — 캐릭터/고양이 마커가 발자국 위에 표시되도록
      el.style.zIndex = "0";

      const overlay = new Marker({
        element: el,
        rotation: bearingDeg,
        rotationAlignment: "map",
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      // 모션 종료 후 오버레이 제거 + 그 시점에 symbol feature를 그린다 —
      // 오버레이 최종 프레임과 symbol 아이콘이 같은 모양이라 전환이 안 보인다
      const timer = window.setTimeout(() => {
        overlay.remove();

        pawOverlaysRef.current = pawOverlaysRef.current.filter(
          (item) => item.marker !== overlay
        );

        // 플러시는 한 프레임으로 합친다 — 복원 시 수백 개가 같은 타이밍에
        // 끝나도 setData는 1회만 발생한다
        if (!pawFlushTimerRef.current) {
          pawFlushTimerRef.current = window.setTimeout(() => {
            pawFlushTimerRef.current = 0;
            flushPawFeatures();
          }, 16);
        }
      }, PAW_STAMP_MS);

      pawOverlaysRef.current.push({ marker: overlay, timer });
    },
    [map, flushPawFeatures]
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

  // 세그먼트(from → to) 위 offset(m) 지점마다 발자국 위치를 계산한다.
  // 좌우 번갈아 찍히는 토글은 pawToggleRef를 공유해 라이브 기록과 복원이 이어지게 한다
  const buildPawPositions = useCallback(
    (
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
      offsetsInMeters: number[],
      spreadFactor: number
    ) => {
      const segLen = distanceInMeters(from, to);

      if (segLen === 0 || offsetsInMeters.length === 0) {
        return [];
      }

      const bearingDeg =
        (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;
      const metersPerDegLat = 111_320;

      return offsetsInMeters.map((offset) => {
        const ratio = offset / segLen;
        const centerPoint = {
          lat: from.lat + (to.lat - from.lat) * ratio,
          lng: from.lng + (to.lng - from.lng) * ratio,
        };

        // 중심축에서 좌우로 벌어진 위치 계산 (위도/경도 거리 비율 보정)
        const isLeftPaw = !pawToggleRef.current;
        const metersPerDegLng =
          111_320 * Math.cos((centerPoint.lat * Math.PI) / 180);

        // 보행 방향(미터 공간) 단위 벡터의 오른쪽 수직 벡터
        const dirLatM = (to.lat - from.lat) * metersPerDegLat;
        const dirLngM = (to.lng - from.lng) * metersPerDegLng;
        const dirNorm = Math.hypot(dirLatM, dirLngM) || 1;
        const perpLatM = dirLngM / dirNorm; // 시계방향 90도 회전: 오른쪽
        const perpLngM = -dirLatM / dirNorm;

        const spreadDegLat =
          (perpLatM * PAW_SPREAD_METER * spreadFactor) / metersPerDegLat;
        const spreadDegLng =
          (perpLngM * PAW_SPREAD_METER * spreadFactor) / metersPerDegLng;

        pawToggleRef.current = !pawToggleRef.current;

        return {
          latLng: {
            lat: centerPoint.lat + spreadDegLat * (isLeftPaw ? -1 : 1),
            lng: centerPoint.lng + spreadDegLng * (isLeftPaw ? -1 : 1),
          },
          bearingDeg,
          tiltDeg: isLeftPaw ? 22 : -22, // 왼/오 대각선 번갈아 (방향 반대)
        };
      });
    },
    []
  );

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
      // 캣 타워 위치 지정(새로 세우기/이동) 중에는 캐릭터 이동,
      // 발자국, 거리 기록을 모두 멈춘다 (GPS가 와도 자리를 지킨다)
      if (useCatTowerStore.getState().isPlacingTower) {
        return undefined;
      }

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

          // 이번 구간 이동 전까지의 세션 누적 거리 (캐릭터 첫 위치 기준)
          const sessionDistanceBefore = sessionDistanceRef.current - dist;
          const traveledSinceLastPaw =
            nextPawDistanceRef.current - sessionDistanceBefore;

          // 이동 구간을 따라 step 간격으로 발자국 위치를 미리 계산
          const offsets: number[] = [];

          for (
            let remain = traveledSinceLastPaw;
            remain <= dist;
            remain += step
          ) {
            offsets.push(remain);
          }

          const pawPositions = buildPawPositions(
            lastPoint,
            newPoint,
            offsets,
            spreadDegFactor
          );

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

            // 총 산책거리 서버 동기화 (내부에서 60초 스로틀)
            void syncTotalDistanceRef.current();
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
          // 캣 타워 위치 지정 중에는 다른 마커 동작을 막는다
          if (useCatTowerStore.getState().isPlacingTower) {
            return;
          }

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
      buildPawPositions,
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
          // 캣 타워 위치 지정 중에는 다른 마커 동작(전투 시작 등)을 막는다
          if (useCatTowerStore.getState().isPlacingTower) {
            return;
          }

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
          catName: cat.name,
          map,
        });

        marker.on("click", () => {
          // 캣 타워 위치 지정 중에는 다른 마커 동작을 막는다
          if (useCatTowerStore.getState().isPlacingTower) {
            return;
          }

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

  // 진행 중인 부하 인사 연출을 정리한다 (대기 중 타이머 취소 + 노출 중 요소 제거)
  const clearGreeting = useCallback(() => {
    const greeting = greetingRef.current;

    if (!greeting) {
      return;
    }

    greeting.timers.forEach((timer) => clearTimeout(timer));
    greeting.element.remove();
    greetingRef.current = null;
  }, []);

  useEffect(() => {
    // 잡은 고양이목록 클릭 리액션
    if (!clickedOwnCat) {
      return;
    }

    // 깃발 마커 매칭은 created_at으로만 한다 — 좌표 float 일치 비교는
    // 미세한 값 차이만으로도 실패해 인사 모션이 간헐적으로 안 나오는 원인이 된다
    const entry = Object.entries(ownCatMarkersRef.current).find(([key]) =>
      key.includes(clickedOwnCat.createdAt)
    );

    if (!entry) {
      return;
    }

    const [key, marker] = entry;
    const catName = key.split(OWN_CAT_KEY_TOKEN)[0];
    const catData = catCharacters.find(({ name }) => name === catName);
    const markerElement = marker.getElement();

    if (!catData || !markerElement) {
      return;
    }

    // 이전 인사 연출이 아직 진행 중이면 정리 후 새로 재생한다
    // (기존엔 요소가 남아있으면 조용히 return해서 재클릭 시 지도 이동만 되고 모션이 안 나왔다)
    clearGreeting();

    // 부하 깃발을 화면 중앙으로 옮긴 뒤 고양이를 등장시킨다
    // (지도 하단 패딩으로 '나'가 유지되는 지점이 화면 중앙 기준점)
    const FOCUS_DURATION = 600;
    const GREETING_DURATION = 3000;
    const { lat, lng } = marker.getLngLat();

    map?.flyTo({ center: [lng, lat], duration: FOCUS_DURATION });

    const catElement = getCatchedCatElement(
      catData.img,
      catData.dialog.greeting[getRandomNumber(3)],
      GREETING_DURATION
    );

    const timers: number[] = [];
    greetingRef.current = { element: catElement, timers };

    // flyTo 완료 후 등장
    timers.push(
      window.setTimeout(() => {
        markerElement.appendChild(catElement);
      }, FOCUS_DURATION)
    );

    // 노출 종료 후 제거 — removeChild 대신 remove()로 안전하게 (마커가 먼저 제거돼도 에러 없음)
    timers.push(
      window.setTimeout(() => {
        catElement.remove();
        greetingRef.current = null;
      }, FOCUS_DURATION + GREETING_DURATION)
    );
  }, [clearGreeting, clickedOwnCat, map]);

  // 스토리지에 저장된 오늘 산책 데이터(거리 + 궤적)를 읽어 발자국 트레일을 복원한다
  const restoreTodayWalk = useCallback(async () => {
    const todayWalk = await getTodayWalk();

    totalDistanceRef.current = todayWalk.distance;
    onDistanceChange?.(todayWalk.distance);

    if (!map || todayWalk.path.length === 0) {
      return;
    }

    pathRef.current = todayWalk.path.map(({ lat, lng }) => ({ lat, lng }));

    // 저장된 궤적은 10m 이상 이동 시점의 좌표만 담고 있어(라이브 기록 조건)
    // 점 하나당 발자국 하나를 찍으면 듬성듬성 보인다 → 라이브와 동일하게
    // 세그먼트 사이를 보간해 발자국 간격마다 찍는다
    const intervalM = getZoomAwareInterval();

    // 세그먼트별 길이와 궤적 전체 길이(m)를 먼저 계산
    const segmentLengths: number[] = [];
    let totalLength = 0;

    for (let i = 1; i < pathRef.current.length; i++) {
      const segLen = distanceInMeters(
        pathRef.current[i - 1],
        pathRef.current[i]
      );

      segmentLengths.push(segLen);
      totalLength += segLen;
    }

    // 간격 기준점(k * intervalM)이 걸치는 세그먼트마다 발자국 위치를 계산
    const allPaws: {
      latLng: { lat: number; lng: number };
      bearingDeg: number;
      tiltDeg: number;
    }[] = [];
    let accDistance = 0;

    pathRef.current.forEach((point, i) => {
      if (i === 0) {
        return;
      }

      const prev = pathRef.current[i - 1];
      const segLen = segmentLengths[i - 1];
      const offsets: number[] = [];

      for (
        let target = (Math.floor(accDistance / intervalM) + 1) * intervalM;
        target <= accDistance + segLen;
        target += intervalM
      ) {
        offsets.push(target - accDistance);
      }

      allPaws.push(...buildPawPositions(prev, point, offsets, 1));

      accDistance += segLen;
    });

    // 최대 개수 초과분은 가장 오래된(앞쪽) 발자국부터 잘라낸다
    const drawnPaws = allPaws.slice(-PAW_MAX_COUNT);

    drawnPaws.forEach((paw) => {
      createPawMarker(paw.latLng, paw.bearingDeg, paw.tiltDeg);
    });

    // 트레일이 잘리지 않았을 때만 시작점을 찍는다 (잘렸으면 시작점이 트레일 밖에 있다)
    if (drawnPaws.length === allPaws.length) {
      createStartDot(pathRef.current[0]);
    }

    // 복원된 궤적 길이를 세션 거리로 반영해 이후 라이브 발자국 간격 cadence를 이어받는다
    sessionDistanceRef.current = totalLength;
    nextPawDistanceRef.current =
      Math.floor(totalLength / intervalM) * intervalM + intervalM;
  }, [
    buildPawPositions,
    createPawMarker,
    createStartDot,
    getZoomAwareInterval,
    map,
    onDistanceChange,
  ]);

  // --- 발자국 symbol layer 준비 (store의 map = 스타일 로드 완료 보장, 1회) ---
  // 200개 발자국을 GPU 1배치로 그린다 — DOM 마커면 카메라가 움직이는 프레임마다
  // 전부 transform을 갱신해야 해서 발자국이 가장 무거운 DOM 부하였음. symbol은
  // 지도 좌표계에 고정이라 카메라 이동에 재배치 비용이 없다.
  // 스타일 최상단에 추가 — 기존 DOM 발자국도 지도 지물 위에 그려졌으므로 동일 순서
  useEffect(() => {
    if (!map || isPawLayersAddedRef.current) {
      return;
    }

    isPawLayersAddedRef.current = true;

    map.addSource(PAW_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: PAW_LAYER_ID,
      type: "symbol",
      source: PAW_SOURCE_ID,
      layout: {
        "icon-image": PAW_IMAGE_ID,
        "icon-size": PAW_ICON_SIZE,
        // bearing(북쪽 기준 진행 방향) + tilt(좌우 발 기울기)를 합산해 회전
        "icon-rotate": ["+", ["get", "bearing"], ["get", "tilt"]] as never,
        // 지도 북쪽 기준 회전 + 지면에 눕히기 — 기존 Marker와 동일한 정렬
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        // 배치 충돌 검사 없이 전부 표시 — DOM 마커 때와 동일
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": 0.7, // 기존 .paw-print-inner opacity 유지
      },
    });

    // SVG → 캔버스 래스터화 후 아이콘 등록. 완료 전에 플러시 요청이
    // 대기 중이면 여기서 반영한다 (발자국이 이미지보다 먼저 찍히는 레이스 대비)
    void rasterizePawImage().then((data) => {
      if (!data) {
        return;
      }

      map.addImage(PAW_IMAGE_ID, data, { pixelRatio: PAW_IMAGE_SCALE });

      if (pawFlushPendingRef.current) {
        pawFlushPendingRef.current = false;

        const source = map.getSource(PAW_SOURCE_ID) as
          | { setData: (data: unknown) => void }
          | undefined;

        source?.setData({
          type: "FeatureCollection",
          features: pawFeaturesRef.current,
        });
      }
    });
  }, [map]);

  // --- 마커 줌 연동 스케일 — 줌에 따라 캐릭터/깃발/아이템도 세계처럼 작아진다 ---
  // DOM 마커는 화면 픽셀 고정이라 줌을 줄여도 크기 그대로 — 실제 미터 스케일 지물인
  // 캣 타워와의 이질감 원인. zoom 이벤트마다 마커의 전용 스케일 래퍼만 갱신한다.
  // 스폰된 DOM 마커는 보통 몇 개 안 되고(발자국은 symbol layer로 GPU 렌더 중),
  // 스케일이 바뀐 프레임에만 갱신해 줌 제스처 중에도 비용이 거의 없다.
  // transform은 래퍼(maplibre 배치용)가 아닌 내부 스케일 래퍼에 걸어야 한다 —
  // 래퍼 transform을 덮어쓰면 마커가 좌측상단에 고정되는 함정.
  useEffect(() => {
    if (!map) {
      return;
    }

    let lastScale = -1;

    const applyMarkerScale = () => {
      const scale = getMarkerZoomScale(map.getZoom());

      if (scale === lastScale) {
        return;
      }

      lastScale = scale;

      map
        .getContainer()
        .querySelectorAll<HTMLElement>(".marker-zoom-scale")
        .forEach((el) => {
          el.style.transform = `scale(${scale})`;
        });
    };

    applyMarkerScale();
    map.on("zoom", applyMarkerScale);

    return () => {
      map.off("zoom", applyMarkerScale);
    };
  }, [map]);

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
      // 광고 보상(+2)과의 균형을 위해 스폰 확률을 10%(아이템당 약 3.3%)로 낮춘다
      // — 30번 시도 중 3번만 스폰되며, 각 아이템은 시도당 1/30 확률로 나온다
      const randomNum = getRandomNumber(30);
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
        // 캣 타워 위치 지정 중에는 아이템 줍기도 막는다
        if (useCatTowerStore.getState().isPlacingTower) {
          return;
        }

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

      // 발자국 스탬프 오버레이 타이머/마커 정리 (지속 symbol 지물은 지도와 함께 정리됨)
      pawOverlaysRef.current.forEach(({ marker, timer }) => {
        clearTimeout(timer);
        marker.remove();
      });
      pawOverlaysRef.current = [];
      clearTimeout(pawFlushTimerRef.current);
      pawFlushTimerRef.current = 0;

      // 진행 중인 부하 인사 연출 타이머 정리
      clearGreeting();

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

          // 앱 종료 전 마지막 동기화 (스로틀 무시)
          void syncTotalDistanceRef.current(true);
        }
      }
    };
  }, [clearGreeting]);

  // 캣 타워 위치 지정 구역의 중심이 될 내 캐릭터 위치 (마커가 생기기 전엔 undefined)
  const getMyPosition = useCallback(() => {
    const position = myCatRef.current?.getLngLat();

    return position ? { lat: position.lat, lng: position.lng } : undefined;
  }, []);

  return (
    <div className={className}>
      <CatTower
        getMyPosition={getMyPosition}
        onAddCats={onTowerAddCats}
        onDecorTower={(towerId) => onTowerDecor?.(towerId)}
        onTowerPlaced={onTowerPlaced}
      />
    </div>
  );
}

export default function Map({ className, onClickKkang, ...rest }: Props) {
  const isStopFocusMe = useViewStore((s) => s.isStopFocusMe);
  const kkangCount = useKkangStore((s) => s.count);
  const { setMap, setIsStopFocusMe, setIsMapLoading, addToastMessage } =
    useViewStore((s) => s.actions);
  // 캣 타워 위치 지정(새로 세우기/이동) 중엔 상단 버튼/내 위치 버튼을 잠근다
  const isPlacingTower = useCatTowerStore((s) => s.isPlacingTower);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  const [isLoading, setisLoading] = useState(true);
  // 재진입 리빌 — keep-alive로 지도가 살아있는 상태에서 /find-cat에 다시 들어오면
  // CloudReveal을 즉시 마운트했다 exit시켜 구름 갈라짐(REVEAL_HOLD 유지 포함)을 재생한다
  const [isReentering, setIsReentering] = useState(false);
  // 리빌 exit 연출이 끝나기까지(핀치/드래그) 지도 조작을 잠그는 플래그 —
  // AnimatePresence onExitComplete에서 해제한다
  const [isRevealLock, setIsRevealLock] = useState(false);
  const location = useLocation();
  const [totalDistance, setTotalDistance] = useState(0);

  // 총 산책거리 (서버 누적값 + 오늘 거리) — 오늘 산책 거리 캡슐 클릭 시 토스트로 노출
  const { data: user } = useUsersQuery();
  const totalWalkDistance = (user?.total_distance ?? 0) + totalDistance;

  const onClickDistance = () => {
    addToastMessage({
      message: `지금까지 총 ${(totalWalkDistance / 1000).toFixed(
        2
      )} km 산책했어요`,
      // 산책 거리 캡슐 바로 아래(화면 상단)에 노출
      position: "top",
    });
  };

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

    let cancelled = false;

    (async () => {
      // 첫 렌더 center를 현위치로 잡기 위해 지도 생성 전에 위치를 먼저 조회한다.
      // (시청 기본값으로 만든 뒤 현위치로 jumpTo하면 장거리 이동이 되어
      //  웹뷰에서 타일/지형 재로딩 잔렉이 남는 원인이 됨.
      //  위치 조회는 CloudReveal 로딩 화면이 지도를 가리는 동안 이뤄지므로 지연이 노출되지 않음)
      const coords = await getCurrentPosition();

      if (cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      // 위치 조회 실패 시 기존 기본값(서울시청)으로 폴백
      const map = new MaplibreMap({
        container,
        style: noLabelsStyle as unknown as StyleSpecification,
        center: coords ? [coords.longitude, coords.latitude] : [126.978, 37.5665],
        zoom: INIT_ZOOM_LEVEL,
        maxZoom: MAX_ZOOM_LEVEL,
        minZoom: MIN_ZOOM_LEVEL,
        attributionControl: false, // 하단 저작권 표시줄 전체 삭제
        interactive: true,
        dragPan: true,
        touchZoomRotate: true,
        // 핀치 줌 + 두 손가락 회전 모두 활성
        // 마우스 휠 줌은 데스크톱 테스트(pnpm dev)에서만 — 기기엔 휠이 없고,
        // 타워 포커스의 scrollZoom 토글(CatTower)과도 이 상태를 기준으로 맞춘다
        scrollZoom: isDev,
        // 더블탭/더블클릭 줌 활성 (마커 위 더블탭은 dblclick 핸들러에서 제외)
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
        pitchWithRotate: true,
        // 마우스 회전/기울기(우클릭·ctrl+좌클릭 드래그)도 데스크톱 테스트에서만 —
        // 기기의 한 손가락 드래그(팬)와 무관하고 타워 포커스의 dragRotate
        // 토글(CatTower)과도 이 상태를 기준으로 맞춘다
        dragRotate: isDev,
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

      // 더블탭(더블클릭) 줌 — 마커 위에서는 제외한다.
      // 마커 더블탭은 전투 시작/인사 등 게임 동작의 연타와 겹치므로
      // preventDefault로 내장 줌을 막고 클릭 이벤트만 전달되게 한다
      map.on("dblclick", (e) => {
        const target = e.originalEvent.target;

        if (target instanceof Element && target.closest(".maplibregl-marker")) {
          e.preventDefault();
        }
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
    })();

    // 위치 조회 대기 중 언마운트되면 cancelled 플래그로 지도 생성을 막는다.
    // 이미 생성된 경우(위치 조회가 빠르게 끝난 뒤 언마운트)에는 인스턴스를 정리한다.
    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
      }

      mapRef.current = null;
    };
  }, [setMap, setIsStopFocusMe]);

  // 로딩중(찾는중 UI 노출중) 또는 재진입 리빌 재생중에는 지도의 모든 조작을
  // 비활성화한다 — 드래그 이동/핀치 줌·회전/피치(기울기) 전부 잠금
  // (안개에 가려진 상태에서 조작되면 리빌 종료 시점에 상태가 튀는 걸 방지)
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (isLoading || isReentering || isRevealLock) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.touchPitch.disable();
    } else {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchPitch.enable();
    }
  }, [isLoading, isReentering, isRevealLock]);

  // 로딩 상태를 전역 스토어에 동기화 — FindCat 페이지에서
  // 내 부하/도감 버튼 등을 함께 비활성화하는 데 사용
  useEffect(() => {
    setIsMapLoading(isLoading);

    return () => {
      setIsMapLoading(false);
    };
  }, [isLoading, setIsMapLoading]);

  // 리빌 진행 중 신호 — 구름/안개 연출이 다시 시작되면 리빌 완료 플래그를 되돌린다.
  // 완료(onExitComplete) 시점은 아래 AnimatePresence에서 스토어에 반영한다
  useEffect(() => {
    if (isLoading || isReentering) {
      useViewStore.getState().actions.setIsMapRevealDone(false);
    }
  }, [isLoading, isReentering]);

  // 재진입 리빌 — 첫 로딩이 끝난 뒤(/find-cat에서 나갔다) 다시 맵 화면에
  // 들어오면 구름 갈라짐을 다시 보여준다. 지도는 이미 준비돼 있으므로 로딩
  // 표시 없이, CloudReveal의 REVEAL_HOLD(1초) 유지 뒤 갈라짐만 재생한다.
  const isFindCatCached = useViewStore((s) => s.isFindCatCached);
  const isMapScreen = location.pathname.startsWith("/find-cat");
  // 라우트 전환 감지는 렌더 중 이전 값과 비교해 처리한다 (effect에서
  // setState하면 cascading render라 react-hooks 규칙에 걸림)
  const [prevIsMapScreen, setPrevIsMapScreen] = useState(isMapScreen);

  if (prevIsMapScreen !== isMapScreen) {
    setPrevIsMapScreen(isMapScreen);

    if (!isMapScreen) {
      // 맵을 벗어나면 리빌 상태를 해제 — 다음 재진입에 다시 재생되게 한다
      setIsReentering(false);
    } else if (!isLoading && isFindCatCached) {
      // keep-alive로 살아있는 지도에 다시 들어온 순간 — 구름을 마운트하고
      // 다음 프레임에 exit시켜 REVEAL_HOLD(1초) 유지 후 갈라짐이 재생되게 한다
      setIsReentering(true);
      setIsRevealLock(true);
    }
  }

  // 리빌 마운트 다음 프레임에 exit — AnimatePresence exit 모션이 재생된다
  useEffect(() => {
    if (!isReentering) {
      return;
    }

    const raf = requestAnimationFrame(() => setIsReentering(false));

    return () => cancelAnimationFrame(raf);
  }, [isReentering]);

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

  // 웹뷰 백그라운드 복귀 시 GPU 텍스처가 버려져 지도 캔버스가 깨지는 현상 대응 —
  // 화면 복귄 시 강제로 한 프레임 다시 그린다 (마커 이미지 재디코드는 App의
  // 이미지 리커버리 훅이 담당)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        mapRef.current?.triggerRepaint();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className={cn("map-wrapper")}>
      {/* 상단 플로팅 캡슐 행 — 왼쪽 산책 거리 / 오른쪽 깡 */}
      <div className={cn("top-bar")}>
        <button
          type="button"
          className={cn("distance-display")}
          disabled={isLoading || isPlacingTower}
          onClick={onClickDistance}
          aria-label="총 산책 거리 보기"
        >
          <PawIcon size={15} color="#834e00" className={cn("paw-icon")} />
          <span className={cn("label")}>오늘 산책 거리</span>
          <NumberFlow
            className={cn("distance")}
            value={totalDistance / 1000}
            format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          />
          <span className={cn("unit")}>km</span>
        </button>

        <button
          type="button"
          className={cn("kkang-display")}
          disabled={isLoading || isPlacingTower}
          onClick={onClickKkang}
          aria-label="깡 충전"
        >
          <span className={cn("kkang-icon")}>⚡</span>
          <NumberFlow
            className={cn("count")}
            value={kkangCount}
            spinTiming={NUMBER_FLOW_SPIN_TIMING}
          />
        </button>
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
        disabled={isLoading || isPlacingTower}
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

      {/* 첫 진입 리빌 — 구름/안개가 화면을 덮고 로딩 완료 후 양쪽으로 흩어진다
          (연출 상세는 CloudReveal 컴포넌트 담당)
          재진입에도 다시 재생하고, exit 연출이 끝나면 조작 잠금을 푼다 */}
      <AnimatePresence
        onExitComplete={() => {
          setIsRevealLock(false);
          // 리빌(구름 갈라짐) 연출이 완전히 끝났음을 스토어에 알린다 —
          // 리빌 위에 띄우면 안 되는 연출(캣 타워 완공 축하 등)이 이 시점을 기다린다
          useViewStore.getState().actions.setIsMapRevealDone(true);
        }}
      >
        {(isLoading || isReentering) && (
          <CloudReveal
            isNight={isNight}
            hideLoading={!isLoading}
            isReenter={!isLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
