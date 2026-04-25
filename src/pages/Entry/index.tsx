import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import TitleCatImg from "@/assets/img/title/main-title-cat.png";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Input from "@/components/Input";
import Loading from "@/components/Loading";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useViewStore } from "@/store/view";
import { safeText, wait } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function Entry() {
  const { addToastMessage, setIsStopFocusMe } = useViewStore((s) => s.actions);
  const navigate = useNavigate();

  const [addNewCatDialog, setAddNewCatDialog] = useState(false);
  const [inputValue, setinputValue] = useState("");
  const [inputErrorMessage, setInputErrorMessage] = useState("");

  // TODO: 쿼리 로딩
  const [isLoading, setIsLoading] = useState(false);

  useMyCatsQuery();

  return (
    <main className={cn("Entry")}>
      <div className={cn("background")}>
        <img src={TitleCatImg} width={100} height={100} alt="title-cat" />
      </div>

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
              setAddNewCatDialog(true);
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

      <Dialog
        isShow={addNewCatDialog}
        title="냐오옹~?"
        subTitle="(나의 이름은?)"
        buttonLable="만들기"
        subButtonLable="취소"
        onButtonClick={async () => {
          // TODO: 이름중복 확인
          setIsLoading(true);

          await wait(2000);
          // setInputErrorMessage("중복된 이름입니다.");

          setIsLoading(false);

          await wait(2222000);

          setIsStopFocusMe(false);
          navigate("/find-cat");
        }}
        onSubButtonClick={() => {
          setAddNewCatDialog(false);
          setInputErrorMessage("");
        }}
      >
        <div className={cn("dialog-input")}>
          <Input
            value={inputValue}
            isError={!!inputErrorMessage}
            errorMessage={inputErrorMessage}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value;
              const input = safeText(value);

              setinputValue(input);
              setInputErrorMessage("");
            }}
          />
        </div>
      </Dialog>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className={cn("loading")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Loading text="로딩중.." />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
