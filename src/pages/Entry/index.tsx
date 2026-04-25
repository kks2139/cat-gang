import classNames from "classnames/bind";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import TitleCatImg from "@/assets/img/title/main-title-cat.png";
import Button from "@/components/Button";
import Loading from "@/components/Loading";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useViewStore } from "@/store/view";

import AddUserDialog from "./AddUserDialog";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage, setIsStopFocusMe } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const [isShowNewCatDialog, setIsShowNewCatDialog] = useState(false);

  useMyCatsQuery();

  // TODO: 토스 아이디로 유저 정보 가져오기
  const { data: user, isLoading: isUserLoading } = useUsersQuery();

  const startGame = () => {
    setIsStopFocusMe(false);
    navigate("/find-cat");
  };

  return (
    <main className={cn("Entry")}>
      <div className={cn("background")}>
        <img src={TitleCatImg} width={100} height={100} alt="title-cat" />
      </div>

      {isUserLoading ? (
        <div className={cn("init-loading")}>
          <Loading noBackground />
        </div>
      ) : (
        <>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={cn("paw", { [`n${i}`]: true })}>
              <div
                className={cn("paw-stamp")}
                style={{ animationDelay: `${i * 0.2 + 2}s` }}
              >
                <div className={cn("pad")}></div>
              </div>
            </div>
          ))}

          <div className={cn("title")}>
            <h1>냥만시대</h1>
          </div>

          <div className={cn("content")}>
            <div className={cn("menu")}>
              <Button
                className={cn("start")}
                onClick={() => {
                  if (user) {
                    startGame();
                  } else {
                    setIsShowNewCatDialog(true);
                  }
                }}
              >
                시작하기
              </Button>
              <Button
                className={cn("purpose")}
                onClick={() => {
                  addToastMessage({ message: "개발중" });
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
    </main>
  );
}
