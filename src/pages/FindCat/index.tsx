import { generateHapticFeedback } from "@apps-in-toss/web-framework";
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
import { useCustomBack } from "@/hooks/useCustomBack";
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

  const { setIsStopFocusMe, setIsBattleOn, addToastMessage } = useViewStore(
    (s) => s.actions,
  );
  const isShowStage = useCatStore((s) => s.isShowStage);
  const { setSelectedCat, setIsShowStage, setClickedOwnCat } = useCatStore(
    (s) => s.actions,
  );

  const [isShowVictoryDialog, setIsShowVictoryDialog] = useState(false);
  const [isShowMyCatPopup, setIsShowMyCatPopup] = useState(false);
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [ownCatInfo, setOwnCatInfo] = useState<OwnCat>();

  const { mutate: postCatMutate } = useCatchCatMutation();
  const { data: catList, refetch: fetchMyCats } = useMyCatsQuery();

  const ownCats = catList?.map((c) => ({
    name: c.cat_name,
    position: c.position,
    createdAt: c.created_at,
  })) as OwnCat[];

  const selectedOwnCat = getCat(ownCatInfo?.name || "");

  useCustomBack(true, () => {
    if (isShowStage) {
      addToastMessage({ message: "어딜가냐옹" });
      return;
    }

    if (isShowMyCatPopup) {
      setIsShowMyCatPopup(false);
      return;
    }

    if (isShowVictoryDialog) {
      return;
    }

    if (ownCatInfo) {
      setOwnCatInfo(undefined);
      return;
    }

    navigate(-1);
  });

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map")}
        ownCats={ownCats}
        onClickCat={() => {
          setIsShowStage(true);
          setIsStopFocusMe(true);
          setIsBattleOn(true);

          generateHapticFeedback({ type: "wiggle" });
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
              setIsShowMyCatPopup(true);
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
        {isShowMyCatPopup && (
          <motion.div
            className={cn("my-cats-modal")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              const el = target.closest("[data-bottom-sheet]");

              if (!el) {
                setIsShowMyCatPopup(false);
              }
            }}
          >
            <motion.div
              data-bottom-sheet
              className={cn("wrapper")}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3 }}
            >
              <div className={cn("content")}>
                <div className={cn("close-button")}>
                  <Button
                    size="small"
                    onClick={() => {
                      setIsShowMyCatPopup(false);
                    }}
                  >
                    ×
                  </Button>
                </div>

                <MyCats
                  className={cn("cats")}
                  onClickCat={(info) => {
                    setClickedOwnCat(info);

                    setTimeout(() => setClickedOwnCat(undefined), 2000);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isShowStage && (
          <motion.div
            className={cn("img-popup")}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2 }}
          >
            <Stage
              onRun={() => {
                setIsBattleOn(false);
                setIsShowStage(false);
              }}
              onLose={() => {
                setIsBattleOn(false);
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

          // 폭죽 duration 대기
          await wait(1500);
          await fetchMyCats();

          // 잡은 고양이 overlay 지도에서 제거
          removeMarkerWithMotion(catchedCat.marker);
          setCatchedCat(undefined);
          setIsBattleOn(false);
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
                    {format(ownCatInfo.createdAt, "HH:mm", {
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
