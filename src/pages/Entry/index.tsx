import { Screen } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TitleCatImg from "@/assets/img/title/main-title-cat.png";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Loading from "@/components/Loading";
import { useBrowserBackGuard } from "@/hooks/useBrowserBackGuard";
import { useCheckKeypad } from "@/hooks/useCheckKeypad";
import { useCustomBack } from "@/hooks/useCustomBack";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useViewStore } from "@/store/view";

import AddUserDialog from "./AddUserDialog";
import styles from "./index.module.scss";
import RankingSheet from "./RankingSheet";

const cn = classNames.bind(styles);

export default function Entry() {
  const { setIsStopFocusMe } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const [isShowNewCatDialog, setIsShowNewCatDialog] = useState(false);
  const [isShowExitConfirm, setIsShowExitConfirm] = useState(false);
  const [isShowRanking, setIsShowRanking] = useState(false);

  useMyCatsQuery();

  const {
    data: user,
    isError,
    isLoading: isUserLoading,
    refetch,
  } = useUsersQuery();

  const titleRef = useRef<HTMLDivElement>(null);

  const { isKeypadOpen } = useCheckKeypad();

  // 뒤로가기: 열려있는 다이얼로그부터 닫고, 없으면 종료 컨펌을 띄운다
  // (AIT 규정: 최초 진입 화면에서 뒤로가기 시 미니앱이 정상 종료되어야 함)
  useCustomBack(true, () => {
    if (isShowRanking) {
      setIsShowRanking(false);
      return;
    }

    if (isShowNewCatDialog) {
      setIsShowNewCatDialog(false);
      return;
    }

    if (isShowExitConfirm) {
      return;
    }

    setIsShowExitConfirm(true);
  });

  // 로컬(브라우저): 시스템 뒤로가기 가로채서 브라우저 기본 컨펌 노출
  useBrowserBackGuard({
    message: "냥만시대를 종료할까요?",
    onConfirm: () => {
      setIsShowExitConfirm(false);
      Screen.close();
    },
  });

  // 종료 컨펌 확인 시 AIT 환경에선 미니앱을 닫는다 (로컬은 위 컨펌에서 바로 처리)
  const closeApp = () => {
    setIsShowExitConfirm(false);
    Screen.close();
  };

  useEffect(() => {
    if (isKeypadOpen) {
      titleRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isKeypadOpen]);

  const startGame = () => {
    setIsStopFocusMe(false);
    navigate("/find-cat");
  };

  return (
    <main className={cn("Entry")}>
      <div className={cn("background")}>
        {/* 캐릭터 뒤에서 회전하는 광선 */}
        <div className={cn("rays")} aria-hidden />
        {/* 캐릭터를 감싸는 오라 */}
        <div className={cn("aura")} aria-hidden />
        <img src={TitleCatImg} width={100} height={100} alt="title-cat" />
      </div>

      {/* 반짝이는 별 */}
      <div className={cn("stars")} aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      {/* 시선을 중앙으로 모으는 비네트 */}
      <div className={cn("vignette")} aria-hidden />

      {/* 은은하게 떠오르는 빛 입자 */}
      <div className={cn("particles")} aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      {/* TODO: 앱인토스 콘솔에서 배너 광고 그룹 ID 발급 후 주석 해제
          <AdBanner adGroupId="발급받은-ID" /> */}

      {isUserLoading || (!user && isError) ? (
        <div className={cn("init-loading")}>
          <Loading noBackground />
        </div>
      ) : (
        <>
          <div ref={titleRef} className={cn("title")}>
            <h1>냥만시대</h1>
            <p className={cn("tagline")}>냥도시를 평정하라옹</p>
          </div>

          <div className={cn("content")}>
            <div className={cn("menu")}>
              <Button
                className={cn("start")}
                size="large"
                onClick={() => {
                  if (user) {
                    startGame();
                  } else {
                    setIsShowNewCatDialog(true);
                  }
                }}
              >
                <span className={cn("btn-inner")}>
                  <svg
                    className={cn("paw")}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <ellipse cx="12" cy="16" rx="5.2" ry="4.4" />
                    <circle cx="6.5" cy="9" r="2.5" />
                    <circle cx="12" cy="7" r="2.5" />
                    <circle cx="17.5" cy="9" r="2.5" />
                  </svg>
                  시작하기
                </span>
              </Button>

              <Button
                className={cn("ranking")}
                size="large"
                onClick={() => {
                  setIsShowRanking(true);
                }}
              >
                랭킹
              </Button>
            </div>
          </div>
        </>
      )}

      <AddUserDialog
        isShow={isShowNewCatDialog}
        onSuccess={startGame}
        onCancel={() => {
          setIsShowNewCatDialog(false);
        }}
      />

      {/* 랭킹 팝업 (카테고리별 전체 유저 랭킹) */}
      <RankingSheet isShow={isShowRanking} onClose={() => setIsShowRanking(false)} />

      <Dialog
        isShow={isError}
        title="로딩 실패"
        subTitle="문제가 발생했다옹"
        buttonLable="재시도"
        subButtonLable="종료"
        onButtonClick={() => {
          refetch();
        }}
        onSubButtonClick={() => {
          Screen.close();
        }}
      />

      {/* 종료 컨펌 팝업 (뒤로가기 시 노출) */}
      <Dialog
        isShow={isShowExitConfirm}
        title="종료"
        subTitle="냥만시대를 종료할까요?"
        buttonLable="네"
        buttonColor="danger"
        subButtonLable="닫기"
        onButtonClick={closeApp}
        onSubButtonClick={() => {
          setIsShowExitConfirm(false);
        }}
      />
    </main>
  );
}
