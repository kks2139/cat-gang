import { useEffect, useState } from "react";

export const useKakaoMap = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 이미 스크립트가 로드되어 있는지 확인
    if (window.kakao && window.kakao.maps) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    // Vite의 환경변수 접근법: import.meta.env
    const appKey = import.meta.env.VITE_KKO_MAP_KEY;

    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      // 카카오맵 특유의 'autoload=false' 설정 시 필요
      window.kakao.maps.load(() => {
        setIsLoaded(true);
      });
    };

    document.head.appendChild(script);
  }, []);

  return { isLoaded };
};
