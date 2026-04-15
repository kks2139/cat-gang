import { useEffect } from "react";

import { isDev } from "@/utils/constants";

/**
 * 브라우저 새로고침 및 탭 닫기 시 확인 얼럿을 띄워주는 컴포넌트입니다.
 * (내부 페이지 이동 및 뒤로가기는 허용합니다.)
 */
export default function NavigationBlocker() {
  // 1. 브라우저 새로고침 및 탭 닫기 방지 (beforeunload)
  useEffect(() => {
    if (isDev) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // 현대 브라우저에서 얼럿을 띄우기 위해 필요합니다.
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
