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

export const getRandomLocation = (
  lat: number,
  lng: number,
  radiusInMeters: number
): kakao.maps.LatLng => {
  const lat_diff = (Math.random() - 0.5) * 2 * (radiusInMeters / 111000);
  const lng_diff = (Math.random() - 0.5) * 2 * (radiusInMeters / 88000);
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
