import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map from "@/components/Map";
import Stage from "@/components/Stage";
import { useCatchCatMutation } from "@/queries/useCatchCatMutation";
import { useCatStore } from "@/store/cat";
import { type CatInfo } from "@/utils/cats";
import { getPostposition } from "@/utils/helper";

import styles from "./index.module.scss";
import MyCats from "./MyCats";

const cn = classNames.bind(styles);

export default function FindCat() {
  const navigate = useNavigate();

  const { setSelectedCat } = useCatStore((s) => s.actions);

  const [isShowStage, setIsShowStage] = useState(false);
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [selectedMenu, setSelectedMenu] = useState<"catched" | "all">();

  const { mutate: postCatMutate } = useCatchCatMutation();

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map")}
        onClickCatMarker={() => {
          setIsShowStage(true);
          setSelectedMenu(undefined);
        }}
      />

      <div className={cn("menu")}>
        <div className={cn("buttons")}>
          <Button
            onClick={() => {
              setSelectedMenu("catched");
            }}
          >
            내 조직원
          </Button>
          <Button
            onClick={() => {
              navigate(-1);
            }}
          >
            나가기
          </Button>
        </div>

        <AnimatePresence>
          {!!selectedMenu && (
            <motion.div
              className={cn("content")}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MyCats
                onClose={() => {
                  setSelectedMenu(undefined);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!!isShowStage && (
          <motion.div
            className={cn("img-popup")}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2 }}
          >
            <Stage
              onClose={() => {
                setIsShowStage(false);
              }}
              onWin={(cat) => {
                setIsShowStage(false);

                const { overlay } = cat;

                postCatMutate({
                  catName: cat.name,
                  position: {
                    lat: overlay?.getPosition().getLat() || 0,
                    lng: overlay?.getPosition().getLng() || 0,
                  },
                });

                setTimeout(() => {
                  setSelectedCat(undefined);
                  setCatchedCat(cat);
                }, 500);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        isShow={!!catchedCat}
        title="승리"
        subTitle={
          <>
            <strong>{getPostposition(catchedCat?.name, "obj")}</strong> 손에
            넣었습니다.{"\n"}
            이제 <strong>
              {getPostposition(catchedCat?.name, "with")}
            </strong>{" "}
            그의 영역은{"\n"}
            당신이 가지게 됩니다.
          </>
        }
        buttonLable="확인"
        onButtonClick={() => {
          setCatchedCat(undefined);
        }}
      />
    </main>
  );
}
