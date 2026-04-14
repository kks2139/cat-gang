import classNames from "classnames/bind";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const { refetch, isFetching } = useUsersQuery();
  useMyCatsQuery();

  return (
    <main className={cn("Entry")}>
      <div className={cn("background-sunset")}>
        <div className={cn("sky")}>
          {/* 태양 뒤쪽 구름 */}
          <div className={cn("cloud", "large")} />
          <div className={cn("cloud", "small")} />

          <div className={cn("sun-wrapper")}>
            <div className={cn("heat-haze")} />
            <div className={cn("sun")}>
              <div className={cn("sun-core")} />
              <div className={cn("sun-flame")} />
            </div>
          </div>

          {/* 태양 앞쪽 구름 (더 많이 가림) */}
          <div className={cn("cloud", "large", "front")} />
          <div className={cn("cloud", "medium", "front", "pos-1")} />
          <div className={cn("cloud", "medium", "front", "pos-2")} />
          <div className={cn("cloud", "small", "front")} />
        </div>
      </div>

      <div className={cn("content")}>
        <h1 className={cn("title")}>CAT GANG</h1>
        <div className={cn("menu")}>
          <Button
            className={cn("start")}
            onClick={() => {
              navigate("/find-cat");
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
          <Button
            disabled={isFetching}
            onClick={async () => {
              const { data } = await refetch();

              addToastMessage({
                message: `name : ${data?.name}`,
              });
            }}
          >
            유저정보
          </Button>
        </div>
      </div>
    </main>
  );
}
