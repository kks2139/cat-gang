import NumberFlow from "@number-flow/react";
import {
  type LngLatLike,
  type Map as MaplibreMap,
  type MapMouseEvent,
  Marker,
} from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDayAndNight } from "@/hooks/useDayAndNight";
import { useCatTowerStore } from "@/store/catTower";
import { useViewStore } from "@/store/view";
import { isDev, NUMBER_FLOW_SPIN_TIMING } from "@/utils/constants";
import { distanceInMeters } from "@/utils/helper";

// ----- 캣 타워 상수 -----
export const TOWER_ZONE_RADIUS = 100; // 위치 지정 가능 반경 (m, 내 위치 기준)
// 원목 가지 캣트리 치수 — 몸통/기초는 축소, 가지/둥지는 실제 미터 기준
const TOWER_FOOTPRINT_M = 3; // 몸통(원목) 지름 (m)
const TRUNK_SIDES = 16; // 몸통 원기둥 근사 다각형 변 수
const TOWER_PERCH_T = 1.4; // 꼭대기 발판 두께 (m)
const PERCH_RADIUS_M = 4.75; // 꼭대기 발판 반경 (m)
const TOWER_FOUNDATION_M = 8.6; // 기초 지반(흙) 오각 반경 (m) — 옆면 폭 ≈ 반경×cos36°
const TOWER_FOUNDATION_HEIGHT = 1.5; // 기초 지반 높이 (m) — 0m 상태에서 보이는 지물
// 가지 배치 — 실제 높이 기준. 첫 가지 이후 일정 간격으로 한 개씩 발생한다
const BRANCH_START_M = 10; // 첫 가지 높이 (실제 m)
const BRANCH_INTERVAL_M = 20; // 가지 간격 (실제 m)
const BRANCH_MAX_COUNT = 6; // 가지 상한
const BRANCH_HEADROOM_M = 5; // 꼭대기 발판과 최소 이 간격(m)만큼 띄운다
// 가지 형태 — fill-extrusion은 기울기 밀기를 못 하므로 세로 기둥 조각을
// 바깥으로 계단식 오프셋해 뻗은 가지로 근사한다
const BRANCH_SEG_COUNT = 3; // 가지 조각 수 (계단 단계)
const BRANCH_SEG_DIAMETER_M = 1.2; // 가지 조각 지름 (m)
const BRANCH_SEG_RISE_M = 0.35; // 조각마다 올라가는 높이 (축소 스케일 m)
const BRANCH_SEG_H_M = 0.9; // 가지 조각 하나의 높이 (축소 스케일 m)
const BRANCH_BASE_REACH_M = 8; // 첫(가장 아래) 가지의 뻗은 거리 (실제 m)
const BRANCH_REACH_STEP_M = 0.8; // 위로 갈수록 줄어드는 뻗은 거리 (실제 m)
const BRANCH_GOLDEN_ANGLE = 137.5; // 가지 방향 — 황금각으로 사방 골고루
const BRANCH_ANGLE_OFFSET = 15; // 첫 가지 방향 (도)
const NEST_RADIUS_M = 2.6; // 둥지 발판 반경 (실제 m)
const NEST_T = 0.7; // 둥지 발판 두께 (실제 m)
const NEST_RADIUS_STEP_M = 0.15; // 위 가지일수록 줄어드는 둥지 반경 (실제 m)
const NEST_PAW_SCALE = 0.55; // 둥지 발바닥 문양 크기 — 꼭대기 마크 대비 배율
// 실제 높이의 1/5로만 렌더링 — 실제 높이(점수)가 아무리 자라도 몸통이 화면을
// 벗어나지 않게 한다. 가지·둥지·발바닥 마크는 예외로 실제 크기를 쓴다
export const TOWER_VISUAL_HEIGHT_RATIO = 1 / 5;
// 타워 전체 확대 배율 — 모든 지물 치수(수평/수직, 축소 렌더 포함)에 곱해진다.
// 1 = 치수 그대로. 타워를 키우거나 줄일 땐 이 값 하나만 조정한다
export const TOWER_SCALE = 1.25;
// 확대 배율이 반영된 기초 지반 크기 — 라벨/건물 판정/공사 모션 등
// 기초 지반 크기를 따라가는 로직은 전부 이 값을 쓴다
const FOUNDATION_SIZE_M = TOWER_FOUNDATION_M * TOWER_SCALE;
// 오각 옆면(flat)까지의 거리 — 라벨/공사 모션/팝업이 지반 가장자리에 맞춰야 하므로
const FOUNDATION_INRADIUS_M = FOUNDATION_SIZE_M * Math.cos(Math.PI / 5);
// 타워 이동/성장 모션 시간 (ms)
const MOVE_ANIM_DURATION = 800;
// 타워 클릭 시 카메라 연출 — 카메라를 지면 가까이(피치 최대치) 내려
// 수평 시점으로 올려보게 하고 타워가 꽉 차게 보이도록 줌인한다.
// TOWER_VIEW_ZOOM은 기본 줌 상한(Map의 MAX_ZOOM_LEVEL 18)보다 한 단계 높은 값이라
// 포커스 동안에만 setMaxZoom으로 상한을 올리고, 해제 시 원래 상한으로 되돌린다
const TOWER_VIEW_PITCH = 55;
const TOWER_VIEW_ZOOM = 19;
const DEFAULT_MAX_ZOOM = 18;
const TOWER_VIEW_DURATION_MS = 1200;
const METERS_PER_DEG_LAT = 111_320;

// 위치 지정 파동 효과 — WebGL 지물 대신 DOM/CSS 펄스(GPU 합성)로 표현해 렉을 없앤다.
// 구역의 실제 범위는 정적 zone fill/line 지물이 담당하고, 링은 중앙에서
// 구역 반경의 절반까지 퍼지는 CSS 애니메이션으로만 재생된다.
const ZONE_PULSE_PERIOD_S = 2; // 링이 중앙→가장자리까지 퍼지는 주기 (초)
const ZONE_PULSE_RINGS = 1; // 링 개수 (위상 절반 오프셋)
const ZONE_PULSE_REACH_M = TOWER_ZONE_RADIUS / 3; // 파동이 퍼지는 반경 (m)

// 공사중 모션 — 망치가 한 자리에서 망치질하는 시간(ms) / 먼지 구름 개수
const HAMMER_STAY_MS = 3600;
const WORK_DUST_COUNT = 8;

// 건물 위 배치 금지 — 타워가 건물에 묻히는 걸 막는 방식으로,
// 위치 지정 시 클릭 자리가 건물이면 세우지 않는다 (게임 규칙).
const SOURCE_ID = "cat-tower-source";
const ZONE_SOURCE_ID = "cat-tower-zone-source";
const LAYER_TOWER = "cat-tower-3d";
const LAYER_FOUNDATION = "cat-tower-foundation";
const LAYER_BRANCH = "cat-tower-branch";
const LAYER_NEST = "cat-tower-nest";
const LAYER_PERCH = "cat-tower-perch";
const LAYER_PAW = "cat-tower-paw";
const LAYER_ZONE_FILL = "cat-tower-zone-fill";
const LAYER_ZONE_LINE = "cat-tower-zone-line";

// 타워 클릭 판정 대상 레이어 — CatTower 내부 핸들러와 Map의 dev 클릭 가드가 공용 사용
export const TOWER_HIT_LAYERS = [
  LAYER_TOWER,
  LAYER_FOUNDATION,
  LAYER_BRANCH,
  LAYER_NEST,
  LAYER_PERCH,
  LAYER_PAW,
];

// 스타일의 3D 건물 레이어 — 위치 지정 시 건물 위 배치 판정에 사용
const BUILDING_LAYER_ID = "building-3d";
const BUILDING_SOURCE_ID = "openmaptiles";
const BUILDING_SOURCE_LAYER = "building";

type Position = { lat: number; lng: number };

// @types/geojson 미설치 프로젝트라 최소 GeoJSON 타입을 로컬로 정의한다
type GeoJSONFeature = {
  type: "Feature";
  properties: Record<string, string | number>;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

type GeoJSONData = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

// querySourceFeatures 결과 지물의 geometry (타일 경계 클리핑으로 MultiPolygon일 수 있음)
type BuildingGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

// ----- 낮/밤 색 팔레트 (원목: 갈색 + 밝은 갈색) -----
// 몸통: 실제 10m마다 어두운/밝은 갈색이 교대로 들어가는 밴드(나무 나이테 느낌).
// step 표현식으로 하드 밴드를 만들어 지물은 몸통 1개 그대로 (추가 비용 없음).
// 축소 렌더 기준 밴드 높이 = 10m × TOWER_VISUAL_HEIGHT_RATIO(1/5) = 2m
const TRUNK_BAND_M = 2;
const TRUNK_A_DAY = "#a06b42"; // 어두운 갈색
const TRUNK_B_DAY = "#c99a68"; // 밝은 갈색
const TRUNK_A_NIGHT = "#c08c5c";
const TRUNK_B_NIGHT = "#e6c394";
// 가지는 몸통보다 한 톤 어둡게 — 뻗은 방향이 읽히게
const BRANCH_COLOR_DAY = "#8a5a34";
const BRANCH_COLOR_NIGHT = "#b07a48";
// 둥지 발판은 가장 밝은 갈색 — 고양이가 앉는 자리임을 강조
const NEST_COLOR_DAY = "#d9b98a";
const NEST_COLOR_NIGHT = "#eecfa0";
const PERCH_COLOR_DAY = "#dfb887";
const PERCH_COLOR_NIGHT = "#f0d0a2";
// 흰색 발바닥 마크 — 패드 1개 + 발가락 3개 원형 지물.
// 꼭대기 발판(정북)과 둥지 발판(가지 바깥 방향)에서 함께 사용한다
const PAW_PAD_RADIUS_M = 1.3; // 패드 반경
const PAW_PAD_OFFSET_M = 0.6; // 패드 중심을 뒤쪽(마크가 바라보는 방향 반대)으로
const PAW_TOE_RADIUS_M = 0.55; // 발가락 반경
const PAW_TOE_DISTANCE_M = 1.9; // 마크 중심 → 발가락 중심 거리
const PAW_TOE_ANGLES = [50, 90, 130]; // 발가락 3개 방향(도) — 앞쪽 부채꼴
const PAW_THICKNESS_M = 0.2; // 발바닥 돌출 두께
const FOUNDATION_COLOR_DAY = "#7a4f2c"; // 흙 기초
const FOUNDATION_COLOR_NIGHT = "#a06b3f";

// 몸통 밴드 색 — band 프로퍼티(0=어두운 갈색, 1=밝은 갈색)로 밴드 지물별 색 선택
const trunkBandColor = (isNight: boolean): never =>
  [
    "match",
    ["get", "band"],
    0,
    isNight ? TRUNK_A_NIGHT : TRUNK_A_DAY,
    isNight ? TRUNK_B_NIGHT : TRUNK_B_DAY,
  ] as never;

// 평면 근사 좌표 변환 (근접 거리라 충분) — 헬퍼의 getRandomLocationInCircle과 동일 방식
const metersToDegLng = (meters: number, lat: number) =>
  meters / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

const metersToDegLat = (meters: number) => meters / METERS_PER_DEG_LAT;

// 중심점 기준 원형 링 좌표 — steps를 낮추면 다각형(근사 원)이 된다
const getCircleRing = (
  lat: number,
  lng: number,
  radiusM: number,
  steps = 72
) => {
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dx = metersToDegLng(radiusM * Math.sin(theta), lat);
    const dy = metersToDegLat(radiusM * Math.cos(theta));

    coords.push([lng + dx, lat + dy]);
  }

  return coords;
};

// 원형 폴리곤 (위치 지정 가능 구역 표시)
const getCirclePolygon = (lat: number, lng: number, radiusM: number) => [
  getCircleRing(lat, lng, radiusM),
];

// N각 폴리곤 — 몸통/가지의 원기둥 근사에 사용
const getNGonPolygon = (
  lat: number,
  lng: number,
  radiusM: number,
  sides: number
) => [getCircleRing(lat, lng, radiusM, sides)];

// 중심을 동/북쪽으로 오프셋(m)한 원형 폴리곤 — 가지 조각/발바닥 패드·발가락용
const getOffsetCirclePolygon = (
  lat: number,
  lng: number,
  offsetX: number,
  offsetY: number,
  radiusM: number,
  sides = 24
) => [
  getCircleRing(
    lat + metersToDegLat(offsetY),
    lng + metersToDegLng(offsetX, lat),
    radiusM,
    sides
  ),
];

const setSourceData = (
  map: MaplibreMap,
  sourceId: string,
  data: GeoJSONData
) => {
  const source = map.getSource(sourceId) as
    | { setData: (data: GeoJSONData) => void }
    | undefined;

  source?.setData(data);
};

// ----- 건물 위 타워: 위치 지점의 건물 높이 조회 -----
// MapLibre는 모든 fill-extrusion을 하나의 3D 패스에서 실제 깊이 테스트로 그리므로
// (레이어 순서 무관) 건물에 겹치면 타워가 묻힌다. 타워 자리 건물의 render_height를
// 읽어 타워 기저를 옥상 위로 올리면 건물 위에 얹힌 모양이 된다.

// 반 링 점포함 여부 (ray casting)
const pointInRing = (x: number, y: number, ring: number[][]) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
};

// 외곽 링은 포함, 구멍(내부 링)은 제외
const pointInPolygonRings = (rings: number[][][], x: number, y: number) => {
  if (!pointInRing(x, y, rings[0])) {
    return false;
  }

  return !rings.slice(1).some((hole) => pointInRing(x, y, hole));
};

const geomContains = (geom: BuildingGeometry, x: number, y: number) => {
  if (geom.type === "Polygon") {
    return pointInPolygonRings(geom.coordinates, x, y);
  }

  return geom.coordinates.some((poly) => pointInPolygonRings(poly, x, y));
};

// 건물 위 배치 금지 판정 — 기초 지반(중심 + 오각 꼭짓점/옆면 중점)이 건물에
// 걸치면 못 세운다. 카메라와 무관하게 판정해야 하므로 querySourceFeatures +
// 점-폴리곤 판정을 쓴다 (queryRenderedFeatures는 기울어진 카메라에서
// 앞 건물이 화면을 가리면 오판정한다)
const isOnBuilding = (map: MaplibreMap, lat: number, lng: number): boolean => {
  if (!map.getLayer(BUILDING_LAYER_ID)) {
    return false;
  }

  // 오각 기초 지반의 꼭짓점 5개(72° 간격) + 옆면 중점 5개(36° 오프셋) + 중심
  const samples: [number, number][] = [[lng, lat]];

  for (let k = 0; k < 5; k += 1) {
    const vertexRad = ((k * 72) * Math.PI) / 180;
    const midRad = ((k * 72 + 36) * Math.PI) / 180;

    samples.push([
      lng + metersToDegLng(FOUNDATION_SIZE_M * Math.sin(vertexRad), lat),
      lat + metersToDegLat(FOUNDATION_SIZE_M * Math.cos(vertexRad)),
    ]);
    samples.push([
      lng + metersToDegLng(FOUNDATION_INRADIUS_M * Math.sin(midRad), lat),
      lat + metersToDegLat(FOUNDATION_INRADIUS_M * Math.cos(midRad)),
    ]);
  }
  const feats = map.querySourceFeatures(BUILDING_SOURCE_ID, {
    sourceLayer: BUILDING_SOURCE_LAYER,
  });

  for (const [x, y] of samples) {
    for (const f of feats) {
      const geom = f.geometry as unknown as BuildingGeometry | null;

      if (geom && geomContains(geom, x, y)) {
        return true;
      }
    }
  }

  return false;
};

// 타워 지물 데이터: 원목 가지 캣트리
// - 기초 지반(항상 노출) + 몸통(밴드) + 가지·둥지 발판 + 꼭대기 발판
// - 몸통/기초는 실제 값 × TOWER_VISUAL_HEIGHT_RATIO(1/5)로 축소해 그린다
// - 가지·둥지·발바닥 마크는 축소하면 몇 픽셀밖에 안 돼 실제 크기(미터)로 그린다 —
//   가지의 부착 높이(attachH)만 축소 스케일로 몸통 위에 붙인다
// - 가지는 fill-extrusion이 기울기 밀기를 못 하므로 세로 기둥 조각을
//   바깥으로 계단식 오프셋해 뻗은 가지로 근사한다
const getTowerData = (
  lat: number,
  lng: number,
  realHeight: number
): GeoJSONData => {
  // 축소 비율 × 전체 확대 배율
  const visualHeight = realHeight * TOWER_VISUAL_HEIGHT_RATIO * TOWER_SCALE;
  const features: GeoJSONFeature[] = [
    {
      type: "Feature",
      properties: { kind: "foundation", h: TOWER_FOUNDATION_HEIGHT },
      geometry: {
        type: "Polygon",
        coordinates: getNGonPolygon(lat, lng, FOUNDATION_SIZE_M, 5),
      },
    },
  ];

  // 0m 상태에선 기초 지반만 보인다
  if (visualHeight > 0) {
    // 몸통 — 16각 원기둥. 실제 10m(축소 2m)마다 어두운/밝은 갈색 밴드.
    // fill-extrusion 색은 지물당 한 번 평가되므로(지물 안에서 높이별 변화 불가)
    // 밴드마다 지물을 쪼개고 band 프로퍼티(0=어두운 갈색, 1=밝은 갈색)로 선택한다
    const bandM = TRUNK_BAND_M * TOWER_SCALE;
    const bandCount = Math.ceil(visualHeight / bandM);

    for (let i = 0; i < bandCount; i += 1) {
      features.push({
        type: "Feature",
        properties: {
          kind: "tower",
          // 밴드 지물은 자기 구간만 그린다 — base를 0으로 두면 위 밴드가
          // 아래를 전부 덮어 꼭대기 밴드 색 하나만 보이게 된다
          base: i * bandM,
          h: Math.min((i + 1) * bandM, visualHeight),
          band: i % 2,
        },
        geometry: {
          type: "Polygon",
          coordinates: getNGonPolygon(
            lat,
            lng,
            (TOWER_FOOTPRINT_M / 2) * TOWER_SCALE,
            TRUNK_SIDES
          ),
        },
      });
    }

    // 흰색 발바닥 마크 공용 — 패드 1 + 발가락 3.
    // faceAngleDeg(동=0° 반시계, 북=90°) 방향을 바라보게 마크 전체를 회전하고
    // scale로 크기를 맞춘다. 마크 중심은 (centerX, centerY) 오프셋 — 꼭대기
    // 발판은 타워 중심, 둥지 발판은 가지 끝(둥지 중심)에 놓인다
    const pushPawMark = (
      base: number,
      faceAngleDeg: number,
      scale: number,
      centerX = 0,
      centerY = 0
    ) => {
      const faceRad = ((faceAngleDeg - 90) * Math.PI) / 180;
      const rot = (x: number, y: number): [number, number] => [
        x * Math.cos(faceRad) - y * Math.sin(faceRad),
        x * Math.sin(faceRad) + y * Math.cos(faceRad),
      ];

      const pushBean = (x: number, y: number, radiusM: number) => {
        const [rx, ry] = rot(x, y);

        features.push({
          type: "Feature",
          properties: {
            kind: "paw",
            base,
            h: base + PAW_THICKNESS_M * TOWER_SCALE,
          },
          geometry: {
            type: "Polygon",
            coordinates: getOffsetCirclePolygon(
              lat,
              lng,
              centerX + rx * scale,
              centerY + ry * scale,
              radiusM * scale
            ),
          },
        });
      };

      // 패드는 마크가 바라보는 방향의 뒤쪽에, 발가락은 앞쪽 부채꼴로
      const [padX, padY] = rot(0, -PAW_PAD_OFFSET_M);

      pushBean(padX, padY, PAW_PAD_RADIUS_M);

      PAW_TOE_ANGLES.forEach((angleDeg) => {
        const rad = (angleDeg * Math.PI) / 180;

        pushBean(
          PAW_TOE_DISTANCE_M * Math.cos(rad),
          PAW_TOE_DISTANCE_M * Math.sin(rad),
          PAW_TOE_RADIUS_M
        );
      });
    };

    // 가지 + 둥지 — 실제 높이 10m부터 20m 간격으로 한 개씩 발생(상한 6개).
    // 방향은 황금각 배치로 사방 골고루, 위로 갈수록 짧게 뻗는다(실제 나무 형태)
    for (let k = 0; k < BRANCH_MAX_COUNT; k += 1) {
      const realAt = BRANCH_START_M + k * BRANCH_INTERVAL_M;

      // 몸통이 가지 자리까지 자라야(꼭대기 여유 포함) 가지가 나온다
      if (realAt >= realHeight - BRANCH_HEADROOM_M) {
        break;
      }

      // 부착 높이는 축소 스케일 — 몸통 위에 붙어 있어야 하므로
      const attachH = realAt * TOWER_VISUAL_HEIGHT_RATIO * TOWER_SCALE;
      const angleRad =
        ((BRANCH_ANGLE_OFFSET + k * BRANCH_GOLDEN_ANGLE) * Math.PI) / 180;
      const reach = (BRANCH_BASE_REACH_M - k * BRANCH_REACH_STEP_M) * TOWER_SCALE;
      const trunkRadius = (TOWER_FOOTPRINT_M / 2) * TOWER_SCALE;
      const stepReach = (reach - trunkRadius) / BRANCH_SEG_COUNT;
      const nestRadius = (NEST_RADIUS_M - k * NEST_RADIUS_STEP_M) * TOWER_SCALE;

      // 계단식 가지 조각 — 바깥으로 + 살짝 위로 번갈아 쌓는다
      for (let s = 0; s < BRANCH_SEG_COUNT; s += 1) {
        const off = trunkRadius + stepReach * (s + 0.5);
        const base = attachH + s * BRANCH_SEG_RISE_M * TOWER_SCALE;

        features.push({
          type: "Feature",
          properties: {
            kind: "branch",
            base,
            h: base + BRANCH_SEG_H_M * TOWER_SCALE,
          },
          geometry: {
            type: "Polygon",
            coordinates: getOffsetCirclePolygon(
              lat,
              lng,
              off * Math.cos(angleRad),
              off * Math.sin(angleRad),
              (BRANCH_SEG_DIAMETER_M / 2) * TOWER_SCALE,
              TRUNK_SIDES
            ),
          },
        });
      }

      // 둥지 발판 — 가지 끝(마지막 조각 위)에 얹는다. base를 둥지 높이로 두지
      // 않으면 0부터 채운 판이 바닥까지 내려와 몸통을 덮어버린다
      const nestBase =
        attachH +
        (BRANCH_SEG_COUNT - 1) * BRANCH_SEG_RISE_M * TOWER_SCALE +
        BRANCH_SEG_H_M * TOWER_SCALE;

      features.push({
        type: "Feature",
        properties: {
          kind: "nest",
          base: nestBase,
          h: nestBase + NEST_T,
        },
        geometry: {
          type: "Polygon",
          coordinates: getOffsetCirclePolygon(
            lat,
            lng,
            reach * Math.cos(angleRad),
            reach * Math.sin(angleRad),
            nestRadius,
            24
          ),
        },
      });

      // 둥지 발판 위 발바닥 문양 — 둥지 중심에 놓고 발가락이 가지가
      // 뻗은 바깥 방향을 향한다
      pushPawMark(
        nestBase + NEST_T,
        BRANCH_ANGLE_OFFSET + k * BRANCH_GOLDEN_ANGLE,
        NEST_PAW_SCALE * TOWER_SCALE,
        reach * Math.cos(angleRad),
        reach * Math.sin(angleRad)
      );
    }

    // 꼭대기 발판 — 원형 슬래브
    features.push({
      type: "Feature",
      properties: {
        kind: "perch",
        // 꼭대기 발판도 몸통 꼭대기에 얹은 슬래브 — 0부터 채우면
        // 타워 전체를 perch 색 기둥이 덮어 밴드가 안 보인다
        base: visualHeight,
        h: visualHeight + TOWER_PERCH_T * TOWER_SCALE,
        hRel: visualHeight,
      },
      geometry: {
        type: "Polygon",
        coordinates: getCirclePolygon(lat, lng, PERCH_RADIUS_M * TOWER_SCALE),
      },
    });

    // 꼭대기 발판 중앙 흰색 발바닥 — 정북 방향, 둥지 문양보다 크게
    pushPawMark(
      visualHeight + TOWER_PERCH_T * TOWER_SCALE,
      90,
      TOWER_SCALE
    );
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const getZoneData = (myPosition: Position): GeoJSONData => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: getCirclePolygon(
          myPosition.lat,
          myPosition.lng,
          TOWER_ZONE_RADIUS
        ),
      },
    },
  ],
});

// easeOutCubic — 이동 후 타워가 0에서 목표 높이까지 자라나는 모션 곡선
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ----- 타워 옆 팝업 정보창 (포탈로 마커 엘리먼트에 렌더) -----
function TowerPopupContent({
  height,
  attachedCount,
  onAddCats,
  onMove,
}: {
  height: number;
  attachedCount: number;
  onAddCats: () => void;
  onMove: () => void;
}) {
  return (
    <div className="cat-tower-popup-body">
      <div className="cat-tower-popup-title-row">
        <span className="cat-tower-popup-icon">🗼</span>
        <span className="cat-tower-popup-title">캣 타워</span>
        <span className="cat-tower-popup-height">
          {height.toFixed(1)}
          <em>m</em>
        </span>
      </div>
      <div className="cat-tower-popup-info">
        <b>{attachedCount}</b>마리 일하는 중
      </div>
      <div className="cat-tower-popup-actions">
        <button
          type="button"
          className="cat-tower-popup-btn add"
          onClick={onAddCats}
        >
          작업 고양이 추가
        </button>
        <button
          type="button"
          className="cat-tower-popup-btn sub"
          onClick={onMove}
        >
          위치 옮기기
        </button>
      </div>
    </div>
  );
}

interface Props {
  /** 내 캐릭터 현재 위치 (위치 지정 모드 구역의 중심) */
  getMyPosition: () => Position | undefined;
  /** 팝업의 작업고양이 추가 클릭 — 고양이 목록 바텀시트를 연다 */
  onAddCats?: () => void;
  /** 타워를 새로 세웠을 때 */
  onTowerPlaced?: () => void;
}

/**
 * 지도 위 캣 타워 — fill-extrusion 3D 레이어로 그려서
 * 지도 기울기/회전/줌에 함께 변형되는 진짜 3D 지물로 표현한다.
 * 형태는 원목 가지 캣트리 구조(몸통 + 사방 가지 + 가지 끝 둥지 발판 + 꼭대기 발판).
 * 몸통/기초는 실제 높이의 1/5로 축소, 가지·둥지는 실제 크기로 그린다.
 * 건물과 겹치면 옥상 위에 얹힌다(기저를 건물 높이로).
 * (높이 라벨은 DOM 마커 — 타워 발밑에 안내판처럼 붙인다)
 * 타워 클릭 시 바텀시트 대신 타워 옆 팝업 정보창이 뜬다.
 */
export default function CatTower({
  getMyPosition,
  onAddCats,
  onTowerPlaced,
}: Props) {
  const map = useViewStore((s) => s.map);
  const { addToastMessage } = useViewStore((s) => s.actions);
  // 실시간 높이 — 성장 중 1초마다 재렌더되며 아래 effect들이 지도를 갱신한다
  const height = useCatTowerStore((s) => s.height);
  const tower = useCatTowerStore((s) => s.tower);
  const isPlacingTower = useCatTowerStore((s) => s.isPlacingTower);
  // 밤엔 타워를 밝게 채색해 어두운 지도 위에서 발광하는 느낌을 낸다
  const { isNight } = useDayAndNight();

  const isLayersAddedRef = useRef(false);
  const heightLabelMarkerRef = useRef<Marker | null>(null);
  // 높이 라벨 마커 엘리먼트 — portal로 React(NumberFlow)를 렌더해
  // 숫자 변화 시 spin 모션이 나오게 한다 (textContent 교체는 모션 불가)
  const [labelEl, setLabelEl] = useState<HTMLDivElement | null>(null);
  // 위치 지정 구역 중앙 펄스 (DOM 마커 — CSS 애니메이션, WebGL 비용 없음)
  const zonePulseMarkerRef = useRef<Marker | null>(null);
  // 공사중 모션 마커들(먼지 구름 여럿 + 망치 1개) — 작업중 부하가 있을 때만
  const workMarkersRef = useRef<Marker[]>([]);
  // 망치가 자리를 옮기는 주기 타이머
  const hammerTimerRef = useRef<number>(0);

  // --- 타워 팝업 정보창 (마커 엘리먼트를 상태로 들고 portal로 렌더) ---
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  const popupMarkerRef = useRef<Marker | null>(null);
  // 타워 포커스 직전의 카메라 상태 — 팝오버가 사라질 때 이 값으로 되돌린다
  const cameraSnapshotRef = useRef<{
    lat: number;
    lng: number;
    zoom: number;
    pitch: number;
    bearing: number;
    /** 포커스 전 자동 위치 추적 여부 */
    wasFollow: boolean;
  } | null>(null);

  // 이동 모션 진행 중 플래그 — 모션 중엔 틱 effect가 지물 높이를 덮어쓰지 않게 한다
  const isMoveAnimRef = useRef(false);
  const moveAnimRafRef = useRef<number>(0);
  // 직전 타워 위치 — 위치가 바뀌었을 때만 이동 모션을 재생한다
  const prevTowerPosRef = useRef<Position | null>(null);
  // 팝업 내 버튼 클릭 1회를 무시하기 위한 플래그 — 같은 클릭이 지도 클릭으로도
  // 전달돼 "위치 옮기기"를 누른 순간 팝업 자리(구역 내)로 곧바로 이동되는 버그 방지
  const suppressNextClickRef = useRef(false);

  // 높이 라벨 마커 생성 (1회 보장) — 지도가 준비된 뒤에만
  // 라벨은 타워 중심이 아니라 기초 지반 앞쪽(남쪽) 하단에 안내판처럼 붙인다
  // 내용(아이콘/NumberFlow 숫자/m)은 render의 portal이 채운다
  const ensureHeightLabel = useCallback(
    (towerState: { lat: number; lng: number }) => {
      const labelLat = towerState.lat - metersToDegLat(FOUNDATION_INRADIUS_M);

      if (!map || heightLabelMarkerRef.current) {
        // 이미 있으면 위치만 동기화 (타워 이동 대응)
        heightLabelMarkerRef.current?.setLngLat([
          towerState.lng,
          labelLat,
        ] as LngLatLike);
        return;
      }

      const el = document.createElement("div");
      el.className = "cat-tower-label";
      setLabelEl(el);

      heightLabelMarkerRef.current = new Marker({
        element: el,
        anchor: "bottom",
        offset: [0, 46],
      })
        .setLngLat([towerState.lng, labelLat] as LngLatLike)
        .addTo(map);
    },
    [map]
  );

  // 라벨 마커 제거 (타워 제거 시) — 다음 세움 때 다시 생성된다
  const removeHeightLabel = useCallback(() => {
    heightLabelMarkerRef.current?.remove();
    heightLabelMarkerRef.current = null;
    setLabelEl(null);
  }, []);

  // 지물 높이를 목표치까지 0에서 자라나는 모션 (타워 이동 직후)
  // 실제 높이(realHeight) 기준으로 전달 — 축소/확대 배율은 getTowerData가 처리
  const playGrowMotion = useCallback(
    (lat: number, lng: number, targetRealHeight: number) => {
      if (!map) {
        return;
      }

      cancelAnimationFrame(moveAnimRafRef.current);
      isMoveAnimRef.current = true;

      const startAt = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - startAt) / MOVE_ANIM_DURATION);
        const realHeight = targetRealHeight * easeOutCubic(t);

        setSourceData(map, SOURCE_ID, getTowerData(lat, lng, realHeight));

        if (t < 1) {
          moveAnimRafRef.current = requestAnimationFrame(step);
          return;
        }

        isMoveAnimRef.current = false;
      };

      moveAnimRafRef.current = requestAnimationFrame(step);
    },
    [map]
  );

  // --- 소스/레이어 준비 (스타일 로드 완료 보장된 store의 map 기준 1회) ---
  useEffect(() => {
    if (!map || isLayersAddedRef.current) {
      return;
    }

    isLayersAddedRef.current = true;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: LAYER_FOUNDATION,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "foundation"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": 0,
        "fill-extrusion-color": FOUNDATION_COLOR_DAY,
        "fill-extrusion-opacity": 0.95,
      },
    });

    // 몸통 — 실제 10m마다 어두운/밝은 갈색 교대 밴드 (지물별 band 프로퍼티)
    map.addLayer({
      id: LAYER_TOWER,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "tower"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-color": trunkBandColor(false),
        "fill-extrusion-opacity": 0.95,
      },
    });

    // 가지 — 몸통에서 뻗어 나가는 원목 가지 (계단식 근사, 몸통보다 한 톤 어둡게)
    map.addLayer({
      id: LAYER_BRANCH,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "branch"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-color": BRANCH_COLOR_DAY,
      },
    });

    // 둥지 발판 — 가지 끝에 얹는 가장 밝은 갈색 원판
    map.addLayer({
      id: LAYER_NEST,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "nest"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-color": NEST_COLOR_DAY,
      },
    });

    // 꼭대기 발판 — 타워의 상징이 되는 가장 밝은 단
    map.addLayer({
      id: LAYER_PERCH,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "perch"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-color": PERCH_COLOR_DAY,
      },
    });

    // 꼭대기 발판 위 흰색 발바닥 마크 (낮/밤 공통 흰색)
    map.addLayer({
      id: LAYER_PAW,
      type: "fill-extrusion",
      source: SOURCE_ID,
      filter: ["==", ["get", "kind"], "paw"],
      paint: {
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-color": "#ffffff",
        "fill-extrusion-opacity": 0.95,
      },
    });

    // 위치 지정 모드에서만 보이는 가능 구역 (내 위치 주변 원)
    map.addSource(ZONE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: LAYER_ZONE_FILL,
      type: "fill",
      source: ZONE_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "fill-color": "#f472b6",
        "fill-opacity": 0.12,
      },
    });

    map.addLayer({
      id: LAYER_ZONE_LINE,
      type: "line",
      source: ZONE_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#f472b6",
        "line-width": 2,
        "line-dasharray": [2, 2],
        "line-opacity": 0.8,
      },
    });

    // 레이어가 준비되기 전 반영 못 한 상태를 즉시 동기화한다 (최신값은 getState로)
    const state = useCatTowerStore.getState();

    if (state.tower) {
      setSourceData(
        map,
        SOURCE_ID,
        getTowerData(state.tower.lat, state.tower.lng, state.height)
      );
      // 라벨 마커는 1회만 생성되는(ref 가드) 외부 시스템(DOM/MapLibre) 동기화라
      // setLabelEl은 사실상 마운트 1회 — cascading render 우려 대상 아님
      // eslint-disable-next-line react-hooks/set-state-in-effect
      ensureHeightLabel(state.tower);
      prevTowerPosRef.current = {
        lat: state.tower.lat,
        lng: state.tower.lng,
      };
    }
  }, [map, ensureHeightLabel]);

  // --- 낮/밤 타워 색 전환 (밤엔 발광 느낌의 밝은 팔레트) ---
  useEffect(() => {
    if (!map) {
      return;
    }

    if (map.getLayer(LAYER_TOWER)) {
      map.setPaintProperty(
        LAYER_TOWER,
        "fill-extrusion-color",
        trunkBandColor(isNight)
      );
    }

    if (map.getLayer(LAYER_BRANCH)) {
      map.setPaintProperty(
        LAYER_BRANCH,
        "fill-extrusion-color",
        isNight ? BRANCH_COLOR_NIGHT : BRANCH_COLOR_DAY
      );
    }

    if (map.getLayer(LAYER_NEST)) {
      map.setPaintProperty(
        LAYER_NEST,
        "fill-extrusion-color",
        isNight ? NEST_COLOR_NIGHT : NEST_COLOR_DAY
      );
    }

    if (map.getLayer(LAYER_PERCH)) {
      map.setPaintProperty(
        LAYER_PERCH,
        "fill-extrusion-color",
        isNight ? PERCH_COLOR_NIGHT : PERCH_COLOR_DAY
      );
    }

    if (map.getLayer(LAYER_FOUNDATION)) {
      map.setPaintProperty(
        LAYER_FOUNDATION,
        "fill-extrusion-color",
        isNight ? FOUNDATION_COLOR_NIGHT : FOUNDATION_COLOR_DAY
      );
    }
  }, [map, isNight]);

  // --- 타워 지물/라벨 갱신 (높이 틱마다) + 위치 변경(이동) 감지 ---
  useEffect(() => {
    if (!map) {
      return;
    }

    if (tower) {
      // 타워 위치가 바뀌었으면 이동 모션 재생 (0에서 다시 자라남) + 새 자리 페이드 즉시 적용
      const prevPos = prevTowerPosRef.current;
      const isPosChanged =
        !!prevPos && (prevPos.lat !== tower.lat || prevPos.lng !== tower.lng);

      if (isPosChanged && !isMoveAnimRef.current) {
        playGrowMotion(tower.lat, tower.lng, height);
      }

      prevTowerPosRef.current = { lat: tower.lat, lng: tower.lng };

      // 모션 중엔 모션이 지물을 그리게 한다 (틱이 덮어쓰지 않게)
      if (!isMoveAnimRef.current) {
        setSourceData(
          map,
          SOURCE_ID,
          getTowerData(tower.lat, tower.lng, height)
        );
      }

      // 위 레이어 준비 effect와 동일 — 마커 1회 생성만으로 setLabelEl 발생
      // eslint-disable-next-line react-hooks/set-state-in-effect
      ensureHeightLabel(tower);
    } else {
      setSourceData(map, SOURCE_ID, {
        type: "FeatureCollection",
        features: [],
      });
      removeHeightLabel();
      prevTowerPosRef.current = null;
    }
  }, [
    map,
    tower,
    height,
    ensureHeightLabel,
    removeHeightLabel,
    playGrowMotion,
  ]);

  // --- 공사중 모션 (작업중 부하가 있을 때만) ---
  // 기초 지반 주변에서 먼지 구름이 계속 피어오르고, 망치 1개가 주변을
  // 돌아다니며 망치질한다. WebGL 갱신 없는 DOM/CSS 애니메이션 (맵 렌더 비용 0).
  // 부하가 없으면 아무 효과 없다.
  useEffect(() => {
    if (!map) {
      return;
    }

    const cleanup = () => {
      window.clearInterval(hammerTimerRef.current);
      hammerTimerRef.current = 0;
      workMarkersRef.current.forEach((marker) => marker.remove());
      workMarkersRef.current = [];
    };

    if (!tower || tower.attachedKeys.length === 0) {
      cleanup();
      return;
    }

    const { lat, lng } = tower;

    // 지면상 위치 계산 — 기초 지반 주변 한 바퀴에서 무작위 자리
    const spotAroundTower = (
      radiusMinM: number,
      radiusMaxM: number
    ): LngLatLike => {
      const angle = Math.random() * 2 * Math.PI;
      const radiusM = radiusMinM + Math.random() * (radiusMaxM - radiusMinM);

      return [
        lng + metersToDegLng(radiusM * Math.sin(angle), lat),
        lat + metersToDegLat(radiusM * Math.cos(angle)),
      ] as LngLatLike;
    };

    // 먼지 구름 — 기초 지반 바깥 테두리에 균등 배치(+지터), 시간차로 피어오른다
    const dustMarkers: Marker[] = [];

    for (let i = 0; i < WORK_DUST_COUNT; i += 1) {
      const angle = (i / WORK_DUST_COUNT) * 2 * Math.PI + Math.random() * 0.5;
      const radius = FOUNDATION_INRADIUS_M + 1.5 + Math.random() * 2.5;
      const el = document.createElement("div");
      el.className = "cat-tower-work-dust";
      el.innerHTML = "<i></i>";
      // 애니메이션은 내부 <i>에 — 래퍼 transform 덮어쓰기 함정 회피
      const puff = el.firstElementChild as HTMLElement | null;

      if (puff) {
        puff.style.animationDelay = `${((i * 2.6) / WORK_DUST_COUNT).toFixed(
          2
        )}s`;
      }

      dustMarkers.push(
        new Marker({ element: el, anchor: "center" })
          .setLngLat([
            lng + metersToDegLng(radius * Math.sin(angle), lat),
            lat + metersToDegLat(radius * Math.cos(angle)),
          ] as LngLatLike)
          .addTo(map)
      );
    }

    // 망치 1개 — 주변을 돌아다니며 망치질 (자리 이동 시 애니메이션 재시작)
    const hammerEl = document.createElement("div");
    hammerEl.className = "cat-tower-work-hammer";
    hammerEl.innerHTML = "<i>🔨</i>";

    const hammerMarker = new Marker({ element: hammerEl, anchor: "center" })
      .setLngLat(spotAroundTower(FOUNDATION_INRADIUS_M - 3, FOUNDATION_INRADIUS_M + 1))
      .addTo(map);

    const moveHammer = () => {
      hammerMarker.setLngLat(spotAroundTower(FOUNDATION_INRADIUS_M - 3, FOUNDATION_INRADIUS_M + 1));

      // 새 자리에서 망치질이 처음부터 시작되게 애니메이션을 리셋
      const strike = hammerEl.firstElementChild as HTMLElement | null;

      if (strike) {
        strike.style.animation = "none";
        void strike.offsetWidth;
        strike.style.animation = "";
      }
    };

    hammerTimerRef.current = window.setInterval(moveHammer, HAMMER_STAY_MS);
    workMarkersRef.current = [...dustMarkers, hammerMarker];

    return cleanup;
  }, [map, tower]);

  // --- 위치 지정 모드 구역 토글 + 중앙 펄스 링 (DOM/CSS 애니메이션) ---
  // 파동을 WebGL 지물로 그리면 프레임마다 GeoJSON 재생성 + GPU 지물 렌더로 렉이 걸려
  // DOM 마커의 CSS 애니메이션(합성 스레드)으로 대체한다 — 맵 렌더 비용은 0.
  // 링 크기는 map.project로 파동 도달 반경(구역의 절반)의 화면 반경(px)을 계산해 CSS 변수로 넣고,
  // 줌/이동(move 이벤트)마다 갱신해 어느 줌에서도 구역 가장자리까지 퍼지게 맞춘다.
  useEffect(() => {
    if (!map) {
      return;
    }

    const show = isPlacingTower;
    const myPosition = show ? getMyPosition() : undefined;

    // 내 위치를 아직 못 받았으면 구역을 숨긴 채 대기한다
    [LAYER_ZONE_FILL, LAYER_ZONE_LINE].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          "visibility",
          show && myPosition ? "visible" : "none"
        );
      }
    });

    if (show && myPosition) {
      setSourceData(map, ZONE_SOURCE_ID, getZoneData(myPosition));
    }

    // (위치 지정 중엔 캐릭터가 얼어 중심이 고정 — 시작 시 위치를 고정해 사용)
    let updatePulseSize: (() => void) | null = null;

    if (show && myPosition) {
      const { lat, lng } = myPosition;

      const el = document.createElement("div");
      el.className = "cat-tower-zone-pulse";
      el.innerHTML = Array.from(
        { length: ZONE_PULSE_RINGS },
        (_, i) =>
          `<i class="cat-tower-zone-pulse-ring" style="animation-delay:${(
            (ZONE_PULSE_PERIOD_S * i) /
            ZONE_PULSE_RINGS
          ).toFixed(2)}s"></i>`
      ).join("");

      // 파동 도달 반경(구역의 절반)의 화면 반경(px) — 링이 정확히 그 지점까지 퍼지게
      updatePulseSize = () => {
        const center = map.project([lng, lat]);
        const edge = map.project([
          lng + metersToDegLng(ZONE_PULSE_REACH_M, lat),
          lat,
        ]);

        el.style.setProperty("--pulse-r", `${Math.abs(edge.x - center.x)}px`);
      };

      updatePulseSize();
      map.on("move", updatePulseSize);

      zonePulseMarkerRef.current = new Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([lng, lat] as LngLatLike)
        .addTo(map);
    } else {
      zonePulseMarkerRef.current?.remove();
      zonePulseMarkerRef.current = null;
    }

    return () => {
      if (updatePulseSize) {
        map.off("move", updatePulseSize);
      }

      zonePulseMarkerRef.current?.remove();
      zonePulseMarkerRef.current = null;
    };
  }, [map, isPlacingTower, getMyPosition]);

  // --- 타워 포커스 동안 제스처 재배치 (타워 화면 중심 고정) ---
  // 타워가 화면 중심에 고정된 상태로 줌/회전/피치는 모두 중심(타워) 기준으로
  // 움직이게 한다. 카메라를 옮기는 팬(한 손가락 드래그)만 막고, 데스크톱 마우스
  // 테스트를 위해 포커스 동안에만 마우스 전용 동작을 연다:
  // - dragRotate(우클릭/ctrl+드래그): 중심 궤도 회전
  // - scrollZoom(휠): around "center"라 타워 중심 줌
  // 더블클릭 줌은 커서 기준이라 중심이 흘러가므로 잠근다.
  // (지도 쪽 리빌 잠금 effect도 핸들러를 다루므로, 리빌 재생 중 포커스가
  //  유지되는 드문 경우엔 리빌 쪽이 이기게 둔다 — 팝업을 다시 열면 복구됨)
  useEffect(() => {
    if (!map) {
      return;
    }

    if (popupEl) {
      map.dragPan.disable();
      map.dragRotate.enable();
      map.scrollZoom.enable({ around: "center" });
      map.doubleClickZoom.disable();
    } else {
      map.dragPan.enable();
      map.dragRotate.disable();
      // 포커스 해제 후 휠은 원래 상태로 — 기기(off)는 비활성, 데스크톱
      // 테스트(isDev)는 다시 활성해 휠 줌 확인이 이어지게 한다
      if (isDev) {
        map.scrollZoom.enable();
      } else {
        map.scrollZoom.disable();
      }
      map.doubleClickZoom.enable();
    }
  }, [map, popupEl]);

  // --- 타워 팝업 열기/닫기 (이벤트 핸들러에서만 상태를 바꾼다) ---
  const closePopup = useCallback(() => {
    popupMarkerRef.current?.remove();
    popupMarkerRef.current = null;
    setPopupEl(null);

    // 포커스 해제 — 클릭 직전의 카메라(연출/줌/기울기/회전)로 되돌린다
    const snapshot = cameraSnapshotRef.current;

    if (!map || !snapshot) {
      return;
    }

    cameraSnapshotRef.current = null;

    // 줌 상한 원복 — 되돌아갈 줌(≤ 기본 상한) 애니메이션이 상한에 걸리지 않게 먼저
    map.setMaxZoom(DEFAULT_MAX_ZOOM);
    map.easeTo({
      center: [snapshot.lng, snapshot.lat],
      zoom: snapshot.zoom,
      pitch: snapshot.pitch,
      bearing: snapshot.bearing,
      duration: TOWER_VIEW_DURATION_MS,
    });
    // 복귀 애니메이션이 끝난 뒤 자동 위치 추적을 원래 상태로 되돌린다
    // (애니메이션 중 추적이 재개되면 카메라 복귀가 위치 갱신에 끊긴다)
    map.once("moveend", () => {
      useViewStore.getState().actions.setIsStopFocusMe(!snapshot.wasFollow);
    });
  }, [map]);

  const togglePopup = useCallback(() => {
    if (!map) {
      return;
    }

    // 이미 열려 있으면 닫는다
    if (popupMarkerRef.current) {
      closePopup();
      return;
    }

    const { tower: towerState } = useCatTowerStore.getState();

    if (!towerState) {
      return;
    }

    // 클릭 직전 카메라를 저장 — 팝오버가 사라질 때 되돌린다
    const center = map.getCenter();
    cameraSnapshotRef.current = {
      lat: center.lat,
      lng: center.lng,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      wasFollow: !useViewStore.getState().isStopFocusMe,
    };

    // 카메라를 타워로 — 지면 가까이(피치 최대) 내려오며 타워를 꽉 차게 줌인한다.
    // 자동 위치 추적을 먼저 멈추지 않으면 다음 위치 갱신에 카메라가 도로 끌려온다
    useViewStore.getState().actions.setIsStopFocusMe(true);
    // 포커스 동안에만 줌 상한을 올린다 (기본 상한보다 한 단계 더 들어가기 위해)
    map.setMaxZoom(TOWER_VIEW_ZOOM);
    map.easeTo({
      center: [towerState.lng, towerState.lat],
      zoom: TOWER_VIEW_ZOOM,
      pitch: TOWER_VIEW_PITCH,
      duration: TOWER_VIEW_DURATION_MS,
    });

    const el = document.createElement("div");
    el.className = "cat-tower-popup";

    // 타워 '옆'에 붙이기 — 기초 지반 오른쪽 모서리 좌표에 좌측 앵커로 놓아
    // 어떤 줌에서도 지물/높이 라벨과 겹치지 않게 한다 (모서리 = 중심 + 지반 절반)
    const foundationEdgeLng =
      towerState.lng + metersToDegLng(FOUNDATION_INRADIUS_M, towerState.lat);

    popupMarkerRef.current = new Marker({
      element: el,
      anchor: "left",
      offset: [10, 8],
    })
      .setLngLat([foundationEdgeLng, towerState.lat] as LngLatLike)
      .addTo(map);
    setPopupEl(el);
  }, [map, closePopup]);

  // --- 지도 클릭: 팝업 무시 → 위치 지정 처리 → 타워 클릭(팝업 토글)/지면 클릭(팝업 닫기) ---
  useEffect(() => {
    if (!map) {
      return;
    }

    const onMapClick = (e: MapMouseEvent) => {
      const state = useCatTowerStore.getState();

      // 팝업 내 버튼에서 시작된 클릭 1회는 무시한다 (위치 지정 오발 방지)
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      // 팝업 위 클릭은 지도 동작(지면 클릭 닫기/타워 토글/위치 지정)에서 제외
      const target = e.originalEvent.target;

      if (target instanceof Element && target.closest(".cat-tower-popup")) {
        return;
      }

      if (state.isPlacingTower) {
        const my = getMyPosition();
        const dist = my
          ? distanceInMeters(my, { lat: e.lngLat.lat, lng: e.lngLat.lng })
          : Infinity;

        if (dist > TOWER_ZONE_RADIUS) {
          addToastMessage({
            message: `주변 ${TOWER_ZONE_RADIUS}m 안에서 골라야 한다옹!`,
            position: "center",
          });
          return;
        }

        // 건물 위 배치 금지 — 기초 지반이 건물에 걸치면 세우지 못한다
        // (건물에 묻히는 3D 렌더링 문제를 게임 규칙으로 푼다)
        if (isOnBuilding(map, e.lngLat.lat, e.lngLat.lng)) {
          addToastMessage({
            message: "건물 위엔 못 세운다옹! 빈 땅을 골라라옹!",
            position: "center",
          });
          return;
        }

        if (state.isMoveTower) {
          // 기존 타워 이동 — 높이/부하 유지한 채 위치만 변경 + 자라나는 모션
          state.actions.moveTo(e.lngLat.lat, e.lngLat.lng);
          addToastMessage({
            message: "캣 타워를 옮겼다옹!",
            position: "center",
          });
        } else {
          state.actions.place(e.lngLat.lat, e.lngLat.lng);
          onTowerPlaced?.();
        }
        return;
      }

      if (!state.tower) {
        return;
      }

      // 타워(기초 지반/발판 포함)를 클릭했는지 레이어 히트로 판정
      const hit = map.queryRenderedFeatures(e.point, {
        layers: TOWER_HIT_LAYERS,
      });

      if (hit.length > 0) {
        // 타워 클릭 — 팝업 정보창 토글 (바텀시트 대신)
        togglePopup();
      } else if (popupMarkerRef.current) {
        // 지면 클릭 — 팝업 닫기
        closePopup();
      }
    };

    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
    };
  }, [
    map,
    getMyPosition,
    onTowerPlaced,
    addToastMessage,
    togglePopup,
    closePopup,
  ]);

  // --- 실시간 높이 틱 (성장 계산과 저장(디바운스)은 스토어가 담당) ---
  useEffect(() => {
    const timer = window.setInterval(() => {
      useCatTowerStore.getState().actions.tick();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // --- 언마운트 정리 ---
  useEffect(() => {
    return () => {
      cancelAnimationFrame(moveAnimRafRef.current);
      removeHeightLabel();

      zonePulseMarkerRef.current?.remove();
      zonePulseMarkerRef.current = null;

      window.clearInterval(hammerTimerRef.current);
      workMarkersRef.current.forEach((marker) => marker.remove());
      workMarkersRef.current = [];

      popupMarkerRef.current?.remove();
      popupMarkerRef.current = null;

      if (!isLayersAddedRef.current) {
        return;
      }

      isLayersAddedRef.current = false;

      const currentMap = useViewStore.getState().map;

      // 지도 인스턴스가 이미 정리된 뒤라면 레이어도 함께 사라졌으므로 건드리지 않는다
      if (!currentMap) {
        return;
      }

      try {
        [
          LAYER_TOWER,
          LAYER_FOUNDATION,
          LAYER_BRANCH,
          LAYER_NEST,
          LAYER_PERCH,
          LAYER_PAW,
          LAYER_ZONE_FILL,
          LAYER_ZONE_LINE,
        ].forEach((layerId) => {
          if (currentMap.getLayer(layerId)) {
            currentMap.removeLayer(layerId);
          }
        });

        [SOURCE_ID, ZONE_SOURCE_ID].forEach((sourceId) => {
          if (currentMap.getSource(sourceId)) {
            currentMap.removeSource(sourceId);
          }
        });
      } catch {
        // remove된 map에 접근한 경우 — 지도가 정리 중이라 레이어도 함께 사라진다
      }
    };
  }, [removeHeightLabel]);

  return (
    <>
      {labelEl &&
        createPortal(
          <>
            <span className="cat-tower-label-icon">🗼</span>
            <NumberFlow
              className="cat-tower-label-num"
              value={height}
              format={{
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }}
              spinTiming={NUMBER_FLOW_SPIN_TIMING}
            />
            <span className="cat-tower-label-unit">m</span>
          </>,
          labelEl
        )}

      {popupEl &&
        tower &&
        createPortal(
          <TowerPopupContent
            height={height}
            attachedCount={tower.attachedKeys.length}
            onAddCats={() => {
              closePopup();
              onAddCats?.();
            }}
            onMove={() => {
              // 1) 이 클릭이 지도 클릭으로도 전달되면 무시하도록 표시
              suppressNextClickRef.current = true;
              // 2) 팝오버를 먼저 없애고
              closePopup();
              // 3) 위치 지정 모드는 클릭 이벤트가 완전히 끝난 뒤에 활성화 —
              //    활성화와 같은 클릭으로 팝오버 자리(구역 내)에 이동되는 것을 막는다
              window.setTimeout(() => {
                suppressNextClickRef.current = false;
                useCatTowerStore.getState().actions.startMoving();
              }, 0);
            }}
          />,
          popupEl
        )}
    </>
  );
}
