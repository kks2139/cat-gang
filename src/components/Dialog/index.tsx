import { graniteEvent } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { operEnv } from "@/utils/constants";

import Button, { type Color } from "../Button";
import {
  getTopDialogDismiss,
  pushDialogDismiss,
  removeDialogDismiss,
} from "./backStack";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  isShow?: boolean;
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  buttonLable?: string;
  onButtonClick?: () => void;
  subButtonLable?: string;
  onSubButtonClick?: () => void;
  buttonColor?: Color;
  /** 뒤로가기로 닫을 때 실행할 콜백 (없으면 onSubButtonClick 사용) */
  onBackClose?: () => void;
  /** 뒤로가기로 닫기 비활성화 (기본: 활성) */
  isBackClose?: boolean;
  /** 제목을 최상단 좌측에 정렬 (정보창용) */
  isTitleLeft?: boolean;
  children?: React.ReactNode;
  buttonDisabled?: boolean;
  className?: string;
}

export default function Dialog({
  isShow,
  title,
  subTitle,
  buttonLable = "확인",
  onButtonClick,
  subButtonLable,
  onSubButtonClick,
  buttonColor = "primary",
  onBackClose,
  isBackClose = true,
  isTitleLeft,
  children,
  buttonDisabled,
  className,
}: Props) {
  // 다이얼로그 노출 중 뒤로가기를 한 번 더 누르면 닫히는 공통 로직.
  // 실행되는 건 취소성 액션(onBackClose ?? onSubButtonClick)이고, 취소 액션이
  // 없는 다이얼로그(승리 팝업 등)는 반응하지 않는다.
  // - AIT: 네이티브 backEvent를 직접 구독한다
  // - 브라우저: useBrowserBackGuard의 popstate 핸들러가 이 스택을 소비하므로
  //   여기선 스택 유지만 한다 (브라우저 컨펌이 뜨지 않는다)
  useEffect(() => {
    if (!isShow || !isBackClose) {
      return;
    }

    const dismiss = () => {
      (onBackClose ?? onSubButtonClick)?.();
    };

    pushDialogDismiss(dismiss);

    const unsubscription = operEnv
      ? graniteEvent.addEventListener("backEvent", {
          onEvent: () => {
            // 여러 dismiss가 쌓여 리스너가 여러 개여도 최상단 하나만 닫는다
            if (getTopDialogDismiss() === dismiss) {
              dismiss();
            }
          },
        })
      : undefined;

    return () => {
      unsubscription?.();

      removeDialogDismiss(dismiss);
    };
  }, [isBackClose, isShow, onBackClose, onSubButtonClick]);

  return (
    <AnimatePresence>
      {isShow && (
        <motion.div
          className={cn("Dialog", className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <div className={cn("content")}>
            <div className={cn("wrapper", { "title-left": isTitleLeft })}>
              {title && <h3 className={cn("title")}>{title}</h3>}
              {subTitle && <h5 className={cn("sub-title")}>{subTitle}</h5>}
              {children && <div className={cn("body")}>{children}</div>}
            </div>

            <div className={cn("buttons")}>
              <Button color={buttonColor} disabled={buttonDisabled} onClick={onButtonClick}>
                {buttonLable}
              </Button>
              {onSubButtonClick && (
                <Button color="secondary" onClick={onSubButtonClick}>
                  {subButtonLable}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
