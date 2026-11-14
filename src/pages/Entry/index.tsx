import { Screen } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TitleCatImg from "@/assets/img/title/main-title-cat.png";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Loading from "@/components/Loading";
import { useCheckKeypad } from "@/hooks/useCheckKeypad";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useViewStore } from "@/store/view";

import AddUserDialog from "./AddUserDialog";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { setIsStopFocusMe } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const [isShowNewCatDialog, setIsShowNewCatDialog] = useState(false);

  useMyCatsQuery();

  const {
    data: user,
    isError,
    isLoading: isUserLoading,
    refetch,
  } = useUsersQuery();

  const titleRef = useRef<HTMLDivElement>(null);

  const { isKeypadOpen } = useCheckKeypad();

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

      {/* TODO: id발급 */}
      {/* <AdBanner adGroupId="" /> */}

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
                    <circle cx="5" cy="10.5" r="2.3" />
                    <circle cx="9.4" cy="6.8" r="2.5" />
                    <circle cx="14.6" cy="6.8" r="2.5" />
                    <circle cx="19" cy="10.5" r="2.3" />
                  </svg>
                  시작하기
                </span>
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
    </main>
  );
}
