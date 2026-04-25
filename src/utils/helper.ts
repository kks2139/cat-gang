import { getHours } from "date-fns";
import L from "leaflet";

import { getCat } from "./cats";

export const wait = (delay: number) =>
  new Promise((res) => setTimeout(res, delay));

export const getPostposition = (
  word = "",
  type: "obj" | "sub" | "topic" | "with",
) => {
  // 마지막 글자의 유니코드 확인
  const lastChar = word.charCodeAt(word.length - 1);

  // 한글 범위가 아닐 경우 처리
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return word;

  // 받침 유무 확인 (0이면 받침 없음)
  const hasBatchim = (lastChar - 0xac00) % 28 !== 0;

  const mapping = {
    obj: hasBatchim ? "을" : "를", // 을/를
    sub: hasBatchim ? "이" : "가", // 이/가
    topic: hasBatchim ? "은" : "는", // 은/는
    with: hasBatchim ? "과" : "와", // 과/와
  };

  return `${word}${mapping[type]}`;
};

export const getRandomLocationInCircle = (
  lat: number,
  lng: number,
  radiusInMeters: number,
): L.LatLngExpression => {
  // 1. 0 ~ radiusInMeters 사이의 랜덤한 거리 생성
  // (중심에 몰리지 않게 하기 위해 Math.sqrt 사용)
  const r = radiusInMeters * Math.sqrt(Math.random());

  // 2. 0 ~ 2π 사이의 랜덤한 각도 생성
  const theta = Math.random() * 2 * Math.PI;

  // 3. 미터 단위를 좌표 단위로 변환 (상수값 활용)
  const lat_diff = (r * Math.cos(theta)) / 111000;
  const lng_diff =
    (r * Math.sin(theta)) / (111000 * Math.cos(lat * (Math.PI / 180)));

  return [lat + lat_diff, lng + lng_diff];
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

// 기기 위치 권한 및 상태 확인
export const checkLocationStatus = async () => {
  if (!navigator.geolocation) {
    alert("이 기기는 위치 서비스를 지원하지 않습니다.");
    return false;
  }

  // Permissions API가 지원되는 경우 권한 상태 확인
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      if (result.state === "denied") {
        alert(
          "위치 권한이 거부되었습니다.\n설정에서 위치 권한을 허용해주세요.",
        );
        return false;
      }
    } catch (e) {
      console.error("Permissions API error:", e);
    }
  }

  return true;
};

// 기기 위치 반환
export const getCurrentPosition = async () => {
  const isOk = await checkLocationStatus();

  if (!isOk) {
    return undefined;
  }

  return new Promise<GeolocationCoordinates | undefined>((res) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => res(coords),
      () => res(undefined),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
      },
    );
  });
};

type OverlayType = "me" | "owned" | "enemy";

interface CreateOverlayOptions {
  map: L.Map;
  position: L.LatLngExpression;
  imgUrl?: string;
  type?: OverlayType;
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
  container.dataset.status = "none";
  container.classList.add("marker-container");

  if (imgUrl) {
    // 고양이 이미지
    const catImg = document.createElement("img");
    catImg.dataset.catImg = "true";
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

    const tip = document.createElement("div");
    tip.className = "tip";

    arrow.appendChild(tip);
    wrapper.appendChild(arrow);
    container.appendChild(wrapper);
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

  // 마커 생성
  const icon = L.divIcon({
    html: container,
    className: "",
    iconSize: [100, 100],
  });

  // 맵에 마커 추가
  const marker = L.marker(position, { icon }).addTo(map);

  return marker;
};

export type Coords = Pick<GeolocationCoordinates, "latitude" | "longitude">;

export const removeMarkerWithMotion = (marker: L.Marker, duration = 300) => {
  const el = marker.getElement();

  if (el) {
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "0";

    setTimeout(() => marker.remove(), duration);
  } else {
    marker.remove();
  }
};

export const watchPosition = async (
  onSuccess: (coords: GeolocationCoordinates) => void,
) => {
  const isOk = await checkLocationStatus();

  if (!isOk) {
    return;
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onSuccess(pos.coords);
    },
    undefined,
    { enableHighAccuracy: true, maximumAge: 0 },
  );

  return watchId;
};

/**
 * 마커를 부드럽게 이동시킨다
 * @param marker Leaflet 마커 객체
 * @param destination 이동할 목적지 좌표
 * @param duration 이동 시간 (ms, 기본값 500ms)
 */
export const animateMarker = (
  marker: L.Marker,
  newPosition: L.LatLngExpression,
  duration: number = 500,
) => {
  const startLatLng = marker.getLatLng();
  const endLatLng = L.latLng(newPosition);
  let startTime: number | null = null;

  const frame = (currentTime: number) => {
    if (!startTime) startTime = currentTime;

    // 진행률 계산 (0 ~ 1)
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 선형 보간법(Lerp)으로 중간 좌표 계산
    const currentLat =
      startLatLng.lat + (endLatLng.lat - startLatLng.lat) * progress;
    const currentLng =
      startLatLng.lng + (endLatLng.lng - startLatLng.lng) * progress;

    marker.setLatLng([currentLat, currentLng]);

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
