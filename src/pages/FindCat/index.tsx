import { Device } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map, { type OwnCat } from "@/components/Map";
import Stage from "@/components/Stage";
import { useBrowserBackGuard } from "@/hooks/useBrowserBackGuard";
import { useCustomBack } from "@/hooks/useCustomBack";
import { useCatchCatMutation } from "@/queries/useCatchCatMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useCatStore } from "@/store/cat";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getGangInfo, MyCat } from "@/utils/cats";
import {
  getFireworkElement,
  getPostposition,
  removeMarkerWithMotion,
  wait,
} from "@/utils/helper";

import CatBook from "./CatBook";
import styles from "./index.module.scss";
import MyCats from "./MyCats";
import MyInfoDialog from "./MyInfoDialog";
import OwnCatInfoDialog from "./OwnCatInfoDialog";

const cn = classNames.bind(styles);

export default function FindCat() {
  const navigate = useNavigate();

  const { setIsStopFocusMe, setIsBattleOn } = useViewStore((s) => s.actions);
  const isMapLoading = useViewStore((s) => s.isMapLoading);
  const isShowStage = useCatStore((s) => s.isShowStage);
  const { setSelectedCat, setIsShowStage, setClickedOwnCat } = useCatStore(
    (s) => s.actions
  );

  const [isShowVictoryDialog, setIsShowVictoryDialog] = useState(false);
  const [isShowCatchedCatPopup, setIsShowCatchedCatPopup] = useState(false);
  const [isShowMyInfoPopup, setIsShowMyInfoPopup] = useState(false);
  const [isShowCatBook, setIsShowCatBook] = useState(false);
  const [isShowExitConfirm, setIsShowExitConfirm] = useState(false);
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [ownCatInfo, setOwnCatInfo] = useState<OwnCat>();

  const { mutate: postCatMutate } = useCatchCatMutation();
  const { data: catList, refetch: fetchMyCats } = useMyCatsQuery();
  // 아이템 조회
  useItemQuery();

  const ownCats = (catList?.map((c) => ({
    name: c.cat_name,
    position: c.position,
    createdAt: c.created_at,
  })) || []) as OwnCat[];

  // 바텀시트(내 부하/도감)가 열려있으면 지도 배경에 블러를 건다.
  // 웹뷰(AIT)에서는 WebGL 캔버스 위의 backdrop-filter가 무시되므로
  // 지도 컨테이너 자체에 filter: blur를 적용한다
  const isAnySheetOpen = isShowCatchedCatPopup || isShowCatBook;

  // 도감: 잡은 고양이 이름 집합
  const catchedNames = new Set(ownCats.map(({ name }) => name));

  // 세력 성장: 부하 수에 따라 내 고양이 스탯 보너스 적용
  // (Stage가 싱글턴 스탯을 읽으므로 부하 목록이 바뀔 때마다 갱신)
  const uniqueMinionCount = new Set(
    ownCats
      .filter(
        ({ name }) =>
          catCharacters.find((c) => c.name === name)?.rarity === "unique"
      )
      .map(({ name }) => name)
  ).size;
  const gangInfo = getGangInfo(ownCats.length, uniqueMinionCount);

  useEffect(() => {
    MyCat.getInstance().applyGangBonus(gangInfo);
  }, [gangInfo]);

  // 뒤로가기: 열려있는 레이어부터 닫고, 없으면 나가기 컨펌을 띄운다
  const closeTopLayer = useCallback(() => {
    if (isShowStage) {
      return;
    }

    if (isShowVictoryDialog) {
      return;
    }

    if (isShowCatchedCatPopup) {
      setIsShowCatchedCatPopup(false);
      return;
    }

    if (isShowCatBook) {
      setIsShowCatBook(false);
      return;
    }

    if (isShowMyInfoPopup) {
      setIsShowMyInfoPopup(false);
      return;
    }

    if (ownCatInfo) {
      setOwnCatInfo(undefined);
      return;
    }

    if (isShowExitConfirm) {
      return;
    }

    setIsShowExitConfirm(true);
  }, [
    isShowCatBook,
    isShowCatchedCatPopup,
    isShowExitConfirm,
    isShowMyInfoPopup,
    isShowStage,
    isShowVictoryDialog,
    ownCatInfo,
  ]);

  // AIT 환경: 시스템 뒤로가기 이벤트 처리
  useCustomBack(true, closeTopLayer);

  // 로컬(브라우저): 시스템 뒤로가기 가로채서 브라우저 기본 컨펌 노출
  useBrowserBackGuard({
    message: "나갈까요?",
    onConfirm: () => {
      setIsShowExitConfirm(false);
      navigate("/");
    },
  });

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map", { "is-blurred": isAnySheetOpen })}
        ownCats={ownCats}
        onClickCat={() => {
          setIsShowStage(true);
          setIsStopFocusMe(true);
          setIsBattleOn(true);

          Device.triggerHaptic({ type: "wiggle" });
        }}
        onClickOwnCat={(cat) => {
          setOwnCatInfo(cat);
        }}
        onClickMe={() => {
          setIsShowMyInfoPopup(true);
        }}
      />

      {/* 하단 플로팅 액션 독 */}
      <div className={cn("floating-dock")}>
        <Button
          className={cn("dock-btn", "my-cats-btn")}
          color="primary"
          disabled={isMapLoading}
          onClick={() => {
            setIsStopFocusMe(true);
            setIsShowCatchedCatPopup(true);
          }}
        >
          <span className={cn("btn-label")}>내 부하</span>
          {ownCats && ownCats.length > 0 && (
            <span className={cn("badge")}>{ownCats.length}</span>
          )}
        </Button>
        <Button
          className={cn("dock-btn", "book-btn")}
          color="primary"
          disabled={isMapLoading}
          onClick={() => {
            setIsStopFocusMe(true);
            setIsShowCatBook(true);
          }}
        >
          <span className={cn("btn-label")}>도감</span>
        </Button>
      </div>

      {/* 부하 목록 모던 바텀시트 */}
      <AnimatePresence>
        {isShowCatchedCatPopup && (
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
                setIsShowCatchedCatPopup(false);
              }
            }}
          >
            <motion.div
              data-bottom-sheet
              className={cn("sheet-container")}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <div className={cn("sheet-header")}>
                <div className={cn("title-row")}>
                  <h3 className={cn("sheet-title")}>내 부하 고양이</h3>
                  <span className={cn("sheet-count")}>
                    {ownCats?.length || 0}마리
                  </span>
                </div>
                <button
                  type="button"
                  className={cn("close-btn")}
                  onClick={() => setIsShowCatchedCatPopup(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              <div className={cn("sheet-body")}>
                <MyCats
                  className={cn("cats-scroll")}
                  onClickCat={(info) => {
                    setClickedOwnCat(info);
                    setTimeout(() => setClickedOwnCat(undefined), 2000);
                    setIsShowCatchedCatPopup(false);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 도감 바텀시트 */}
      <AnimatePresence>
        {isShowCatBook && (
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
                setIsShowCatBook(false);
              }
            }}
          >
            <motion.div
              data-bottom-sheet
              className={cn("sheet-container")}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <div className={cn("sheet-header")}>
                <div className={cn("title-row")}>
                  <h3 className={cn("sheet-title")}>고양이 도감</h3>
                  <span className={cn("sheet-count")}>
                    {catCharacters.length}종 중 {catchedNames.size}종
                  </span>
                </div>
                <button
                  type="button"
                  className={cn("close-btn")}
                  onClick={() => setIsShowCatBook(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              <div className={cn("sheet-body")}>
                <CatBook catchedNames={catchedNames} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 전투 팝업 */}
      <AnimatePresence>
        {isShowStage && (
          <motion.div
            className={cn("img-popup")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
                const { lat = 0, lng = 0 } = marker?.getLngLat() || {};

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

      {/* 승리 팝업 */}
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

      {/* 잡은 고양이 팝업 */}
      <OwnCatInfoDialog
        isShow={!!ownCatInfo}
        onClose={() => {
          setOwnCatInfo(undefined);
        }}
        ownCat={ownCatInfo}
      />

      {/* 내 고양이 정보 팝업 */}
      <MyInfoDialog
        isShow={isShowMyInfoPopup}
        onClose={() => {
          setIsShowMyInfoPopup(false);
        }}
      />

      {/* 나가기 컨펌 팝업 (뒤로가기 시 노출) */}
      <Dialog
        isShow={isShowExitConfirm}
        title="나가기"
        subTitle="지도 화면을 나가서 처음 화면으로 돌아갈까요?"
        buttonLable="나가기"
        buttonColor="danger"
        subButtonLable="닫기"
        onButtonClick={() => {
          setIsShowExitConfirm(false);
          navigate("/");
        }}
        onSubButtonClick={() => {
          setIsShowExitConfirm(false);
        }}
      />
    </main>
  );
}
