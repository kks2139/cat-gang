import classNames from "classnames/bind";
import { useEffect, useRef, useState } from "react";

import { useAuthMutation } from "@/queries/useAuthMutation";

import Loading from "../Loading";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 세션 내 1회만 인증 초기화한다 — 이후 Entry 재진입 시엔 로딩 없이 바로 렌더한다.
// 토큰 갱신은 supabase 클라이언트의 accessToken 게터가 만료 60초 전 자동 처리하므로
// 재초기화는 불필요하다 (로딩 화면이 매번 깜빡이는 것도 함께 막아준다)
let isAuthInitialized = false;

interface Props {
  children?: React.ReactNode;
}

export default function Auth({ children }: Props) {
  const { mutateAsync: setAuth } = useAuthMutation();

  const [isLoading, setIsLoading] = useState(!isAuthInitialized);

  const isInitialized = useRef(false);

  useEffect(() => {
    (async () => {
      if (isInitialized.current || isAuthInitialized) {
        return;
      }

      isInitialized.current = true;

      const isSuccess = await setAuth();

      // 실패 시엔 플래그를 남기지 않아 다음 진입에서 재시도한다
      if (isSuccess) {
        isAuthInitialized = true;
      }

      setIsLoading(false);
    })();
  }, [setAuth]);

  if (isLoading) {
    return (
      <div className={cn("Auth")}>
        <div className={cn("wrapper")}>
          <Loading noBackground />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
