import { getCat } from "./cats";

export const wait = (delay: number) =>
  new Promise((res) => setTimeout(res, delay));

export const getPostposition = (
  word = "",
  type: "obj" | "sub" | "topic" | "with"
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
  radiusInMeters: number
): kakao.maps.LatLng => {
  // 1. 0 ~ radiusInMeters 사이의 랜덤한 거리 생성
  // (중심에 몰리지 않게 하기 위해 Math.sqrt 사용)
  const r = radiusInMeters * Math.sqrt(Math.random());

  // 2. 0 ~ 2π 사이의 랜덤한 각도 생성
  const theta = Math.random() * 2 * Math.PI;

  // 3. 미터 단위를 좌표 단위로 변환 (상수값 활용)
  const lat_diff = (r * Math.cos(theta)) / 111000;
  const lng_diff =
    (r * Math.sin(theta)) / (111000 * Math.cos(lat * (Math.PI / 180)));

  return new kakao.maps.LatLng(lat + lat_diff, lng + lng_diff);
};

export const getRandomNumber = (maxNum: number) =>
  Math.floor(Math.random() * maxNum);

export const getFireworkElement = () => {
  // 1. 폭죽 컨테이너 생성
  const explosion = document.createElement("div");
  explosion.className = "papyrus-explosion";

  // 2. 8개의 조각 생성 및 조립
  for (let i = 0; i < 8; i++) {
    const piece = document.createElement("div");
    piece.className = "piece";
    explosion.appendChild(piece);
  }

  // 4. 애니메이션 종료 후 DOM에서 제거 (메모리 관리)
  setTimeout(() => {
    explosion.remove();
  }, 3200); // 애니메이션 시간($duration)보다 살짝 길게

  return explosion;
};

// 기기 위치 반환
export const getCurrentPosition = () => {
  return new Promise<GeolocationCoordinates | undefined>((res) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => res(coords),
      () => res(undefined),
      {
        enableHighAccuracy: false,
        maximumAge: 0,
      }
    );
  });
};

type OverlayType = "me" | "owned" | "enemy" | "loacation-spread-out";

interface CreateOverlayOptions {
  position: kakao.maps.LatLng;
  imgUrl?: string;
  type?: OverlayType;
  map: kakao.maps.Map;
  catName?: string;
}

export const createCustomOverlay = ({
  position,
  imgUrl,
  type,
  map,
  catName,
}: CreateOverlayOptions) => {
  // 최상위 컨테이너
  const container = document.createElement("div");
  container.dataset.cat = "true";
  container.dataset.status = "none";
  container.classList.add("custom-overlay-container");

  if (imgUrl) {
    // 고양이 이미지
    const catImg = document.createElement("img");
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

    wrapper.appendChild(arrow);
    container.appendChild(wrapper);
  }

  // 잡은 고양이일때
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

  if (type === "loacation-spread-out") {
    container.classList.add("no-animation", "no-shadow");

    const wrapper = document.createElement("div");
    wrapper.className = "location-spread-out";

    container.appendChild(wrapper);
  }

  if (type === "enemy") {
    const wrapper = document.createElement("div");
    wrapper.className = "chat";

    const cat = getCat(catName || "");

    if (cat) {
      wrapper.textContent = cat.dialog.chat;
    }

    wrapper.style.animationDelay = `${getRandomNumber(10)}s`;
    container.style.animationDelay = `-${getRandomNumber(10)}s`;
    container.appendChild(wrapper);
  }

  // overlay 생성
  const overlay = new kakao.maps.CustomOverlay({
    position: position,
    content: container,
    clickable: true,
  });

  if (type === "me") {
    overlay.setZIndex(99);
  }

  // 지도에 overlay 표시
  overlay.setMap(map);

  return {
    overlay,
    container,
  };
};
