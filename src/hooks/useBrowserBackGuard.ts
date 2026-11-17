import { useEffect, useRef } from "react";

import { getTopDialogDismiss } from "@/components/Dialog/backStack";
import { operEnv } from "@/utils/constants";

// 히스토리 가드 엔트리 표식 — 시스템 뒤로가기를 가로채기 위한 센티널 식별자
const GUARD_KEY = "catGangBackGuard";

interface Options {
  /** 가드 활성화 여부 (기본 true) — 화면이 숨김 상태(keep-alive)면 꺼서 다른 화면의 뒤로가기를 방해하지 않게 한다 */
  enabled?: boolean;
  /** 뒤로가기 시 브라우저 기본 컨펌(window.confirm)에 노출할 문구 */
  message: string;
  /** 컨펌 확인 시 실행 — 페이지 이동/종료는 호출부가 처리한다 */
  onConfirm: () => void;
}

/**
 * 로컬(브라우저) 환경에서 시스템 뒤로가기를 가로채 브라우저 기본 컨펌을 띄운다.
 * AIT 환경에선 네이티브 backEvent(useCustomBack)를 쓰므로 아무 동작도 하지 않는다.
 *
 * - 컨펌 취소: 다시 가드 엔트리를 쌓아 화면에 머문다
 * - 컨펌 확인: onConfirm 실행 후에도 가드를 다시 쌓는다
 *   (페이지 이동이나 탭 종료 시엔 무시되고, window.close()가 막힌 로컬에선
 *    계속 뒤로가기를 가로챈 상태를 유지한다)
 */
export const useBrowserBackGuard = ({
  enabled = true,
  message,
  onConfirm,
}: Options) => {
  // 최신 onConfirm을 ref에 동기화 (렌더 중이 아닌 effect에서만 갱신)
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (!enabled || operEnv) {
      return;
    }

    // 가드 엔트리가 아직 없을 때만 쌓는다 (StrictMode 이중 마운트 대비).
    // 라우터가 관리하는 state(idx 등)는 그대로 복사해 라우터 내부 동작을 보호한다
    const pushGuardEntry = () => {
      history.pushState(
        { ...(history.state as Record<string, unknown>), [GUARD_KEY]: true },
        ""
      );
    };

    const isGuardEntry = () => {
      const state = history.state as Record<string, unknown> | null;

      return Boolean(state?.[GUARD_KEY]);
    };

    if (!isGuardEntry()) {
      pushGuardEntry();
    }

    const handlePopState = () => {
      // 다이얼로그가 열려있으면 컨펌 대신 최상단 다이얼로그를 닫는다
      // (Dialog의 공통 뒤로가기 로직 — AIT backEvent와 동일한 동작)
      const topDismiss = getTopDialogDismiss();

      if (topDismiss) {
        topDismiss();
        pushGuardEntry();
        return;
      }

      // 브라우저 기본 컨펌 (로컬 전용)
      const exit = window.confirm(message);

      if (exit) {
        onConfirmRef.current();
      }

      pushGuardEntry();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, message]);
};
