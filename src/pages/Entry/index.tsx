import classNames from "classnames/bind";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import { useViewStore } from "@/store/view";
import { supabase } from "@/utils/supabase";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);

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
            setIsLoading(true);

            const { data, error } = await supabase
              .from("users")
              .select("*")
              .eq("id", 1)
              .single();

            if (error) {
              alert(error);
            }

            setIsLoading(false);

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
