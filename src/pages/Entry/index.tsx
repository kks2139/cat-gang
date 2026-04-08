import classNames from "classnames/bind";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const { isLoading, refetch } = useUsersQuery();

  return (
    <main className={cn("Entry")}>
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
            // TODO: 사용자별 모은 냥아치, 레벨 순위화면

            addToastMessage({ message: "개발중" });
          }}
        >
          랭킹
        </Button>
        <Button
          disabled={isLoading}
          onClick={async () => {
            const { data } = await refetch();

            addToastMessage({
              message: `name : ${data?.name} / createdAt : ${data?.createdAt}`,
            });
          }}
        >
          유저정보
        </Button>
      </div>
    </main>
  );
}
