import classNames from "classnames/bind";
import { useNavigate } from "react-router-dom";

import TitleCatImg from "@/assets/img/title/main-title-cat.png";
import Button from "@/components/Button";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useViewStore } from "@/store/view";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  useMyCatsQuery();

  return (
    <main className={cn("Entry")}>
      <div className={cn("background")}>
        <img src={TitleCatImg} width={100} height={100} alt="title-cat" />
      </div>

      <div className={cn("title")}>
        <h1>냥만시대</h1>
      </div>

      <div className={cn("content")}>
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
        </div>
      </div>
    </main>
  );
}
