import { Environment } from "@apps-in-toss/web-framework";

export const isDev = import.meta.env.MODE === "development";

export const operEnv = (() => {
  // 로컬 dev 서버는 devtools mock SDK가 "sandbox"를 반환해 실기기로 오판한다.
  // 로컬에서는 브라우저 폴백(navigator.geolocation, localStorage)을 쓴다.
  if (isDev) {
    return null;
  }

  try {
    return Environment.environment;
  } catch {
    return null;
  }
})();
