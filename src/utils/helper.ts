import { getHours } from "date-fns";
import {
  type LngLatLike,
  type Map as MaplibreMap,
  Marker,
} from "maplibre-gl";

import { pawShapeMarkup } from "@/components/PawIcon";
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

  // 1-2. 팽창하는 충격파 링 3겹 (시간차 따라잡기)
  ["", "second", "third"].forEach((modifier) => {
    const wave = document.createElement("div");
    wave.className = modifier ? `shockwave ${modifier}` : "shockwave";
    explosion.appendChild(wave);
  });

  // 1-3. 중심에서 사방으로 뻗는 황금 스파크 광선
  const rays = document.createElement("div");
  rays.className = "rays";

  for (let i = 0; i < 10; i++) {
    const ray = document.createElement("div");
    ray.className = "ray";
    ray.style.setProperty("--angle", `${i * 36 + getRandomNumber(14)}deg`);
    rays.appendChild(ray);
  }

  explosion.appendChild(rays);

  // 2. 조각 컨테이너 생성 및 조립
  // 1차 폭발 60개 + 약간 시간을 두고 터지는 2차 폭발 웨이브 20개
  const pieces = document.createElement("div");
  pieces.className = "pieces";

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    piece.className = i < 60 ? "piece" : "piece late";
    pieces.appendChild(piece);
  }

  explosion.appendChild(pieces);

  // 3. 애니메이션 종료 후 DOM에서 제거 (메모리 관리)
  setTimeout(() => {
    explosion.remove();
  }, 2200);

  return explosion;
};

// 등급 이펙트 별(스파클) 설정 — 별마다 위치/높이/크기/지연/속도/좌우 흔들림(drift)을
// 달리해 화려하고 다이나믹하게 보이게 한다. 값은 CSS 변수로 span에 주입되고
// 움직임 자체는 globals.scss의 sparkle-rise 키프레임이 담당한다
const RARE_STAR_STYLES = [
  { left: 2, bottom: 5, size: 12, delay: 0, duration: 2.6, drift: 6 },
  { left: 13, bottom: 8, size: 15, delay: 0.9, duration: 2.9, drift: -7 },
  { left: 25, bottom: 4, size: 11, delay: 1.7, duration: 2.4, drift: 8 },
  { left: 37, bottom: 9, size: 14, delay: 0.5, duration: 3.0, drift: -6 },
  { left: 47, bottom: 6, size: 12, delay: 1.3, duration: 2.7, drift: 5 },
];

const UNIQUE_STAR_STYLES = [
  { left: 0, bottom: 5, size: 13, delay: 0, duration: 2.0, drift: 8 },
  { left: 8, bottom: 9, size: 17, delay: 0.7, duration: 2.3, drift: -9 },
  { left: 16, bottom: 4, size: 12, delay: 1.4, duration: 1.9, drift: 7 },
  { left: 24, bottom: 10, size: 18, delay: 0.3, duration: 2.4, drift: -8 },
  { left: 33, bottom: 5, size: 12, delay: 1.1, duration: 2.1, drift: 9 },
  { left: 41, bottom: 9, size: 16, delay: 1.8, duration: 2.5, drift: -7 },
  { left: 49, bottom: 4, size: 13, delay: 0.5, duration: 2.0, drift: 6 },
  { left: 54, bottom: 8, size: 15, delay: 1.5, duration: 2.2, drift: -6 },
];

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

  // 내 고양이일때 — 발바닥이 새겨진 그린 위치 핀으로 표시
  if (type === "me") {
    container.classList.add("no-animation");
    // 내 위치 핀은 다른 마커(발자국 0 / 캐릭터·아이템 10)에 가려지지 않도록 최상위로
    container.style.zIndex = "50";

    const wrapper = document.createElement("div");
    wrapper.className = "arrow-3d-wrapper";

    const pin = document.createElement("div");
    pin.className = "arrow-3d";
    // 발바닥 무늬는 공통 도형(PawIcon.pawShapeMarkup)을 중첩 svg로 새겨 넣는다
    pin.innerHTML = `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="me-pin-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><path d="M18 33C18 33 7.5 21.4 7.5 13.5 7.5 7.7 12.2 3 18 3s10.5 4.7 10.5 10.5C28.5 21.4 18 33 18 33Z" fill="url(#me-pin-gradient)" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/><svg x="10.5" y="6" width="15" height="15" viewBox="0 0 24 24" fill="#ffffff">${pawShapeMarkup}</svg></svg>`;

    wrapper.appendChild(pin);
    container.appendChild(wrapper);
  }

  // 잡은 고양이일때(깃발) — 그림자 + 떠오르는 반짝임 이펙트
  if (type === "owned") {
    // 일반 바닥 그림자 대신 어두운 톤 그림자(flag-shadow-floor)만 사용
    container.classList.add("no-animation", "no-shadow");

    const wrapper = document.createElement("div");
    wrapper.className = "flag-wrapper";

    // 등급별 깃발 색/반짝임 — 잡은 고양이의 희귀도를 클래스로 노출 (globals.scss 참고)
    if (isRare) {
      wrapper.classList.add("rare");
    }

    if (isUnique) {
      wrapper.classList.add("unique");
    }

    const pole = document.createElement("div");
    pole.className = "pole";

    const flag = document.createElement("div");
    flag.className = "flag";

    // 깃대 발밑 어두운 그림자
    const shadowFloor = document.createElement("div");
    shadowFloor.className = "flag-shadow-floor";

    // 깃발 주변을 떠오르는 반짝임 별 — 등급이 높을수록 많이 (일반 4 / 레어 6 / 유니크 8)
    const sparkles = document.createElement("div");
    sparkles.className = "flag-sparkles";

    const sparkleCount = isUnique ? 8 : isRare ? 6 : 4;

    for (let i = 0; i < sparkleCount; i++) {
      sparkles.appendChild(document.createElement("span"));
    }

    wrapper.appendChild(pole);
    wrapper.appendChild(flag);
    wrapper.appendChild(shadowFloor);
    wrapper.appendChild(sparkles);
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

      // 발밑 어두운 그림자
      const shadowFloor = document.createElement("div");
      shadowFloor.className = "shadow-floor";

      // 떠오르는 별 — unique는 더 많고 크고 빠르게 (레어 5개 / 유니크 8개)
      const sparkles = document.createElement("div");
      sparkles.className = "sparkles";

      (isUnique ? UNIQUE_STAR_STYLES : RARE_STAR_STYLES).forEach(
        ({ left, bottom, size, delay, duration, drift }) => {
          const star = document.createElement("span");
          star.style.setProperty("--star-left", `${left}px`);
          star.style.setProperty("--star-bottom", `${bottom}px`);
          star.style.setProperty("--star-size", `${size}px`);
          star.style.setProperty("--star-delay", `${delay}s`);
          star.style.setProperty("--star-duration", `${duration}s`);
          star.style.setProperty("--star-drift", `${drift}px`);
          sparkles.appendChild(star);
        }
      );

      effect.appendChild(shadowFloor);
      effect.appendChild(sparkles);

      container.appendChild(effect);
    }

    const randomDelay = -getRandomNumber(20); // 음수 딜레이로 즉시 시작하되 지점 랜덤
    const randomDuration = 15 + getRandomNumber(10); // 15~25초 사이의 다양한 속도
    const randomScale = 0.8 + Math.random() * 0.4; // 0.8~1.2 사이의 크기 다양함

    // 등장 연출: 순차 등장하는 느낌을 위해 스태거 딜레이 부여
    container.style.setProperty("--spawn-delay", `${getRandomNumber(600)}ms`);
    wrapper.style.animationDelay = `${getRandomNumber(10)}s`;
    // 이동(cat-move)과 방향 lean(cat-face)이 같은 주기/페이즈를 공유해야 동기화되므로
    // 랜덤 값을 CSS 변수로 노출한다 (인라인 animation-* 는 img 쪽 애니메이션과 공유 불가)
    container.style.setProperty("--swim-duration", `${randomDuration}s`);
    container.style.setProperty("--swim-delay", `${randomDelay}s`);
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
  // 발자국(z-index 0)보다 위에 표시되도록 — 발자국은 이후에 DOM에 추가되므로
  // z-index가 없으면(DOM 순서) 발자국이 캐릭터를 덮어버린다
  // 내 위치 핀(me)은 캐릭터/아이템(10)보다도 위에 있어야 하므로 최상위로 둔다
  wrapperEl.style.zIndex = type === "me" ? "50" : "10";
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

export const getCatchedCatElement = (
  imgUrl: string,
  greet: string,
  durationMs = 3000,
) => {
  const container = document.createElement("div");
  container.className = "click-catched-cat";
  // 인사 연출 총 시간을 CSS 변수로 전달 — 애니메이션 길이와
  // 호출부의 요소 제거 시점이 한 값(GREETING_DURATION)에서 결정된다
  container.style.setProperty("--greeting-duration", `${durationMs}ms`);
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
