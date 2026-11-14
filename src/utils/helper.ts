import { getHours } from "date-fns";
import {
  type LngLatLike,
  type Map as MaplibreMap,
  Marker,
} from "maplibre-gl";

import type { ItemType } from "@/components/Stage/Inventory";

import { getCat } from "./cats";

export const wait = (delay: number) =>
  new Promise((res) => setTimeout(res, delay));

export const getPostposition = (
  word = "",
  type: "obj" | "sub" | "topic" | "with",
) => {
  // 마지막 글자의 유니코드 확인
  const lastChar = word.charCodeAt(word.length - 1);

  // 받침 유무 확인 (0이면 받침 없음)
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return word;
  const hasBatchim = (lastChar - 0xac00) % 28 !== 0;

  const mapping = {
    obj: hasBatchim ? "을" : "를", // 을/를
    sub: hasBatchim ? "이" : "가", // 이/가
    topic: hasBatchim ? "은" : "는", // 은/는
    with: hasBatchim ? "과" : "와", // 과/와
  };

  return `${word}${mapping[type]}`;
};

export type Coords = Pick<GeolocationCoordinates, "latitude" | "longitude">;

export const getRandomLocationInCircle = (
  lat: number,
  lng: number,
  radiusInMeters: number,
): [number, number] => {
  // 1. 0 ~ radiusInMeters 사이의 랜덤한 거리 생성
  // (중심에 몰리지 않게 하기 위해 Math.sqrt 사용)
  const r = radiusInMeters * Math.sqrt(Math.random());

  // 2. 0 ~ 2π 사이의 랜덤한 각도 생성
  const theta = Math.random() * 2 * Math.PI;

  // 3. 미터 단위를 좌표 단위로 변환 (상수값 활용)
  const lat_diff = (r * Math.cos(theta)) / 111000;
  const lng_diff =
    (r * Math.sin(theta)) / (111000 * Math.cos(lat * (Math.PI / 180)));

  return [lng + lng_diff, lat + lat_diff];
};

export const getRandomNumber = (maxNum: number) =>
  Math.floor(Math.random() * maxNum);

export const getFireworkElement = () => {
  // 1. 폭죽 컨테이너 생성
  const explosion = document.createElement("div");
  explosion.className = "papyrus-explosion";

  // 1-1. 중앙 섬광 효과 추가
  const flash = document.createElement("div");
  flash.className = "central-flash";
  explosion.appendChild(flash);

  // 2. 50개의 조각 생성 및 조립 (화려하게 증량)
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("div");
    piece.className = "piece";
    explosion.appendChild(piece);
  }

  // 4. 애니메이션 종료 후 DOM에서 제거 (메모리 관리: 3초 애니메이션 기준)
  setTimeout(() => {
    explosion.remove();
  }, 3500); // 애니메이션 시간($duration)보다 살짝 길게

  return explosion;
};

type MarkerType = "me" | "owned" | "enemy" | "item";

interface CreateOverlayOptions {
  map: MaplibreMap;
  position: [number, number]; // [lng, lat]
  imgUrl?: string;
  type?: MarkerType;
  itemType?: ItemType;
  catName?: string;
}

export const createMarker = ({
  map,
  position,
  imgUrl,
  type,
  catName = "",
}: CreateOverlayOptions) => {
  const cat = getCat(catName);
  const isRare = cat?.rarity === "rare";
  const isUnique = cat?.rarity === "unique";

  // 최상위 컨테이너
  const container = document.createElement("div");
  container.dataset.type = type;
  container.dataset.status = "none";
  container.dataset.markerContainer = "true";
  container.className = "marker-container";
  // Leaflet divIcon의 iconSize(100/60) 역할 — 고정 크기 없으면 PNG 원본 크기로 렌더됨
  container.style.width = type === "item" ? "60px" : "100px";
  container.style.height = type === "item" ? "60px" : "100px";
  // 발자국(z-index 0)보다 위에 표시되도록
  container.style.zIndex = "10";

  if (imgUrl) {
    // 고양이 이미지
    const catImg = document.createElement("img");
    catImg.dataset.catImg = "true";
    catImg.src = imgUrl;

    if (type === "item") {
      // 클릭 시 골골대는 모션 적용을 위함
      const itemWrapper = document.createElement("div");
      itemWrapper.className = "item";

      container.appendChild(itemWrapper);
      itemWrapper.appendChild(catImg);
    } else {
      container.appendChild(catImg);
    }
  }

  // 내 고양이일때
  if (type === "me") {
    container.classList.add("no-animation");

    const wrapper = document.createElement("div");
    wrapper.className = "arrow-3d-wrapper";

    const arrow = document.createElement("div");
    arrow.className = "arrow-3d";

    const speak = document.createElement("div");
    speak.dataset.speak = "true";
    speak.className = "speak";

    wrapper.appendChild(arrow);
    container.appendChild(wrapper);
    container.appendChild(speak);
  }

  // 잡은 고양이일때(깃발)
  if (type === "owned") {
    container.classList.add("no-animation", "small-shadow");

    const wrapper = document.createElement("div");
    wrapper.className = "flag-wrapper";

    const pole = document.createElement("div");
    pole.className = "pole";

    const flag = document.createElement("div");
    flag.className = "flag";

    wrapper.appendChild(pole);
    wrapper.appendChild(flag);
    container.appendChild(wrapper);
  }

  if (type === "enemy") {
    const wrapper = document.createElement("div");
    wrapper.className = "chat";

    if (cat?.dialog.chat) {
      wrapper.textContent = cat.dialog.chat;
    }

    // 희귀함 효과 적용
    if (isRare || isUnique) {
      container.classList.add("no-shadow");

      const effect = document.createElement("div");
      effect.classList.add("rarity-effect", isRare ? "rare" : "unique");

      const glowFloor = document.createElement("div");
      glowFloor.className = "glow-floor";

      effect.appendChild(glowFloor);
      container.appendChild(effect);
    }

    const randomDelay = -getRandomNumber(20); // 음수 딜레이로 즉시 시작하되 지점 랜덤
    const randomDuration = 15 + getRandomNumber(10); // 15~25초 사이의 다양한 속도
    const randomScale = 0.8 + Math.random() * 0.4; // 0.8~1.2 사이의 크기 다양함

    wrapper.style.animationDelay = `${getRandomNumber(10)}s`;
    container.style.animationDuration = `${randomDuration}s`;
    container.style.animationDelay = `${randomDelay}s`;
    container.style.transform = `scale(${randomScale})`;
    container.style.setProperty("--jump-delay", `-${getRandomNumber(20)}s`);

    container.appendChild(wrapper);
  }

  if (type === "item") {
    container.classList.add("item", "no-animation", "no-shadow");
  }

  // MapLibre는 element에 지도 위치용 transform을 직접 걸므로,
  // 컨테이너의 CSS 애니메이션(cat-move translate/scale)이 그 transform을 덮어쓰면
  // 마커가 화면 원점(좌측상단)에 박힌다. Leaflet divIcon처럼 래퍼를 한 겹 더 씌워
  // 위치 transform(래퍼)과 애니메이션 transform(컨테이너)을 분리한다.
  const wrapperEl = document.createElement("div");
  wrapperEl.className = "map-marker-wrapper";
  wrapperEl.style.width = type === "item" ? "60px" : "100px";
  wrapperEl.style.height = type === "item" ? "60px" : "100px";
  wrapperEl.appendChild(container);

  // 마커 생성 (MapLibre: setLngLat([lng, lat]) -> 엘리먼트 지정)
  // 앵커는 기본값(center) — Leaflet divIcon도 iconSize 중앙이 앵커였으므로 동일 유지
  const marker = new Marker({ element: wrapperEl })
    .setLngLat(position as LngLatLike)
    .addTo(map);

  return marker;
};

export const removeMarkerWithMotion = (marker: Marker, duration = 300) => {
  const el = marker.getElement();

  if (el) {
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "0";

    setTimeout(() => marker.remove(), duration);
  } else {
    marker.remove();
  }
};

/**
 * 마커를 부드럽게 이동시킨다
 * @param marker MapLibre 마커 객체
 * @param destination 이동할 목적지 좌표 [lng, lat]
 * @param duration 이동 시간 (ms, 기본값 500ms)
 */
export const animateMarker = (
  marker: Marker,
  newPosition: [number, number],
  duration: number = 500,
) => {
  const startLatLng = marker.getLngLat();
  const startLat = startLatLng.lat;
  const startLng = startLatLng.lng;
  const [endLng, endLat] = newPosition;
  let startTime: number | null = null;

  const frame = (currentTime: number) => {
    if (!startTime) startTime = currentTime;

    // 진행률 계산 (0 ~ 1)
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 선형 보간법(Lerp)으로 중간 좌표 계산
    const currentLat = startLat + (endLat - startLat) * progress;
    const currentLng = startLng + (endLng - startLng) * progress;

    marker.setLngLat([currentLng, currentLat]);

    if (progress < 1) {
      requestAnimationFrame(frame); // 다음 프레임 요청
    }
  };

  requestAnimationFrame(frame);
};

export const getNightTime = (date: Date) => {
  const h = getHours(date);

  const isNightTime = h >= 18 || 6 >= h;

  return { isNightTime, hours: h };
};

/**
 * 1. 모든 공백 제거
 * 2. 특수문자 및 기호 제거 (영문, 한글, 숫자만 남김)
 * 3. 최대 10자리까지 제한
 */
export const safeText = (input: string): string => {
  const cleaned = input.replace(/[\s/!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, "");

  return cleaned.slice(0, 10);
};

export const getCatchedCatElement = (imgUrl: string, greet: string) => {
  const container = document.createElement("div");
  container.className = "click-catched-cat";
  container.dataset.catchedCat = "ture";

  const comment = document.createElement("div");
  comment.className = "comment";
  comment.textContent = greet;

  const img = document.createElement("img");
  img.src = imgUrl;

  container.appendChild(comment);
  container.appendChild(img);

  return container;
};

// 두 좌표 [lat, lng] 간 거리 (미터) — Leaflet distanceTo 대체 (haversine)
export const distanceInMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};
