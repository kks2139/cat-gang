import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import Dialog from "@/components/Dialog";
import Input from "@/components/Input";
import Loading from "@/components/Loading";
import { useAddUserMutation } from "@/queries/useAddUserMutation";
import { safeText, wait } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  isShow: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddUserDialog({ isShow, onSuccess, onCancel }: Props) {
  const [inputName, setInputName] = useState("");
  const [inputCrying, setInputCrying] = useState("");
  const [inputErrorMessage, setInputErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: addUser } = useAddUserMutation();

  const reset = () => {
    setInputName("");
    setInputCrying("");
    setInputErrorMessage("");
  };

  return (
    <>
      <Dialog
        isShow={isShow}
        title="이름을 알려달라옹"
        buttonLable="만들기"
        buttonDisabled={!inputName || !inputCrying}
        subButtonLable="취소"
        onButtonClick={async () => {
          setIsLoading(true);

          const [err] = await Promise.all([
            addUser({
              catName: inputName,
              crying: inputCrying,
            }),
            wait(1000),
          ]);

          if (err?.code === "23505") {
            setInputErrorMessage("이미 있다옹.");
          } else {
            onSuccess();
          }

          setIsLoading(false);
        }}
        onSubButtonClick={() => {
          reset();
          onCancel();
        }}
      >
        <div className={cn("dialog-input")}>
          <Input
            autoFocus
            placeholder="고양이 이름"
            value={inputName}
            isError={!!inputErrorMessage}
            errorMessage={inputErrorMessage}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value;
              const input = safeText(value);

              setInputName(input);
              setInputErrorMessage("");
            }}
          />
          <Input
            placeholder="울음 소리"
            value={inputCrying}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value;
              const input = safeText(value);

              setInputCrying(input);
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
            transition={{ duration: 0.2 }}
          >
            <div className={cn("wrapper")}>
              <Loading text="기둘려봐옹" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
