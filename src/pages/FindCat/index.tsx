import classNames from "classnames/bind";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map, { type OwnCat } from "@/components/Map";
import Stage from "@/components/Stage";
import { useCatchCatMutation } from "@/queries/useCatchCatMutation";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useCatStore } from "@/store/cat";
import { useViewStore } from "@/store/view";
import { type CatInfo, getCat } from "@/utils/cats";
import {
  getFireworkElement,
  getPostposition,
  removeMarkerWithMotion,
  wait,
} from "@/utils/helper";

import styles from "./index.module.scss";
import MyCats from "./MyCats";

const cn = classNames.bind(styles);

export default function FindCat() {
  const navigate = useNavigate();

  const { setIsStopFocusMe } = useViewStore((s) => s.actions);
  const isShowStage = useCatStore((s) => s.isShowStage);
  const { setSelectedCat, setIsShowStage } = useCatStore((s) => s.actions);

  const [isShowVictoryDialog, setIsShowVictoryDialog] = useState(false);
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [selectedMenu, setSelectedMenu] = useState<"catched" | "all">();
  const [ownCatInfo, setOwnCatInfo] = useState<OwnCat>();

  const { mutate: postCatMutate } = useCatchCatMutation();
  const { data: catList, refetch: fetchMyCats } = useMyCatsQuery();

  const ownCats = catList?.map((c) => ({
    name: c.cat_name,
    position: c.position,
    createdAt: c.created_at,
  })) as OwnCat[];

  const selectedOwnCat = getCat(ownCatInfo?.name || "");

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map")}
        ownCats={ownCats}
        onClickCat={() => {
          setIsShowStage(true);
          setSelectedMenu(undefined);
          setIsStopFocusMe(true);
        }}
        onClickOwnCat={(cat) => {
          setOwnCatInfo(cat);
        }}
      />

      <div className={cn("menu")}>
        <div className={cn("buttons")}>
          <Button
            onClick={() => {
              setIsStopFocusMe(true);
              setSelectedMenu("catched");
            }}
          >
            내 부하
          </Button>
          <Button
            onClick={() => {
              navigate(-1);
            }}
          >
            나가기
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {!!selectedMenu && (
          <motion.div
            className={cn("my-cats-modal")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className={cn("wrapper")}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
            >
              <div className={cn("content")}>
                <div className={cn("close-button")}>
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedMenu(undefined);
                    }}
                  >
                    ×
                  </Button>
                </div>
                <MyCats className={cn("cats")} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

                const { marker } = cat;
                const { lat = 0, lng = 0 } = marker?.getLatLng() || {};

                postCatMutate({
                  catName: cat.name,
                  position: {
                    lat,
                    lng,
                  },
                });

                setSelectedCat(undefined);
                setCatchedCat(cat);
                setIsShowVictoryDialog(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        isShow={isShowVictoryDialog}
        title="승리"
        subTitle={
          <>
            <strong>{getPostposition(catchedCat?.name, "sub")}</strong>{" "}
            굴복했습니다.{"\n"}
            이제 <strong>{getPostposition(catchedCat?.name, "topic")}</strong>
            {"\n"}
            당신의 것입니다.
          </>
        }
        buttonLable="확인"
        onButtonClick={async () => {
          setIsShowVictoryDialog(false);

          if (!catchedCat?.marker) {
            return;
          }

          // 폭죽효과
          catchedCat.marker.getElement()?.appendChild(getFireworkElement());

          await Promise.all([wait(2000), fetchMyCats()]);

          // 잡은 고양이 overlay 지도에서 제거
          removeMarkerWithMotion(catchedCat.marker);
          setCatchedCat(undefined);
        }}
      />

      <Dialog
        isShow={!!ownCatInfo}
        title={selectedOwnCat?.name}
        subTitle={
          <div className={cn("own-cat")}>
            <div className={cn("crying")}>{selectedOwnCat?.crying}</div>

            <img src={selectedOwnCat?.img} alt="" />

            <div className={cn("info")}>
              <div className={cn("label")}>잡은 날</div>
              {ownCatInfo?.createdAt && (
                <div className={cn("created-at")}>
                  {format(ownCatInfo.createdAt, "yyyy년 M월 d일 (eee)", {
                    locale: ko,
                  })}
                  <div>
                    {format(ownCatInfo.createdAt, "HH:mm:dd", {
                      locale: ko,
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        buttonLable="확인"
        onButtonClick={() => {
          setOwnCatInfo(undefined);
        }}
      />
    </main>
  );
}
