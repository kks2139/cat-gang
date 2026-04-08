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
