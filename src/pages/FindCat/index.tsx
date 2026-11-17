import { Device } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AdBanner, useFullScreenAd } from "@/components/Ads";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map, { type OwnCat } from "@/components/Map";
import Stage from "@/components/Stage";
import type { ItemType } from "@/components/Stage/Inventory";
import { useBrowserBackGuard } from "@/hooks/useBrowserBackGuard";
import { useCustomBack } from "@/hooks/useCustomBack";
import { useCatchCatMutation } from "@/queries/useCatchCatMutation";
import { useItemMutation } from "@/queries/useItemMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useCatStore } from "@/store/cat";
import { useKkangStore } from "@/store/kkang";
import { useViewStore } from "@/store/view";
import { catCharacters, type CatInfo, getGangInfo, MyCat } from "@/utils/cats";
import {
  ITEM_AD_REWARD_COUNT,
  ITEM_RECHARGE_AD_GROUP_ID,
  KKANG_AD_REWARD_COUNT,
  KKANG_COST_BY_RARITY,
  KKANG_RECHARGE_AD_GROUP_ID,
} from "@/utils/constants";
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

/** 광고 보상으로 지급할 아이템 표시 정보 */
const ITEM_INFO: Record<ItemType, { name: string }> = {
  catnip: { name: "캣잎" },
  fish: { name: "생선" },
  gukbab: { name: "국밥" },
};

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
  const [isShowKkangEmpty, setIsShowKkangEmpty] = useState(false);
  const [isShowKkangAd, setIsShowKkangAd] = useState(false);
  // 깡 부족 팝업에 표시할 필요 깡 개수 (상대 등급별 소모량)
  const [kkangNeed, setKkangNeed] = useState(KKANG_COST_BY_RARITY.common);
  // 광고로 충전할 아이템 (값이 있으면 아이템 충전 다이얼로그 노출 중)
  const [itemAdType, setItemAdType] = useState<ItemType>();
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [ownCatInfo, setOwnCatInfo] = useState<OwnCat>();

  const { mutate: postCatMutate } = useCatchCatMutation();
  const { data: catList, refetch: fetchMyCats } = useMyCatsQuery();
  // 아이템 조회 (내 정보 팝업의 보유 아이템 개수 + 광고 보상 계산에 사용)
  const { data: itemCount } = useItemQuery();
  const { mutateAsync: updateItemCount } = useItemMutation();

  const { addToastMessage } = useViewStore((s) => s.actions);
  const kkangCount = useKkangStore((s) => s.count);

  // 깡 충전 보상형 광고 — 진입 시 미리 로드해 딜레이 없이 재생한다
  const {
    isLoaded: isKkangAdLoaded,
    load: loadKkangAd,
    show: showKkangAd,
  } = useFullScreenAd(KKANG_RECHARGE_AD_GROUP_ID, {
    onDismissed: ({ earnedReward }) => {
      setIsShowKkangAd(false);
      // 깡 부족 팝업에서 광고를 보는 경우도 있으므로 함께 닫는다
      setIsShowKkangEmpty(false);
      // 소진된 광고를 다시 로드 — 깡 부족 팝업에서 반복해서 광고를 볼 수 있게
      loadKkangAd();

      if (!earnedReward) {
        return;
      }

      // 광고 시청 완료 → 깡 지급 + 화면 중앙 토스트
      useKkangStore.getState().actions.add(KKANG_AD_REWARD_COUNT);
      addToastMessage({
        message: `깡 ${KKANG_AD_REWARD_COUNT}개를 받았다옹!`,
        position: "center",
      });
    },
    onError: () => {
      setIsShowKkangAd(false);
      setIsShowKkangEmpty(false);
      addToastMessage({ message: "광고를 재생하지 못했어요" });
    },
  });

  // 아이템 충전 보상형 광고 (내 정보 팝업 > 보유 아이템 클릭)
  const {
    isLoaded: isItemAdLoaded,
    load: loadItemAd,
    show: showItemAd,
  } = useFullScreenAd(ITEM_RECHARGE_AD_GROUP_ID, {
    onDismissed: ({ earnedReward }) => {
      const itemType = itemAdType;
      setItemAdType(undefined);
      loadItemAd();

      if (!earnedReward || !itemType) {
        return;
      }

      // 광고 시청 완료 → 아이템 지급 + 화면 중앙 토스트
      const itemName = ITEM_INFO[itemType].name;

      void updateItemCount({
        itemType,
        count: (itemCount?.[itemType] || 0) + ITEM_AD_REWARD_COUNT,
      });

      addToastMessage({
        message: `${itemName} ${ITEM_AD_REWARD_COUNT}개를 받았다옹!`,
        position: "center",
      });
    },
    onError: () => {
      setItemAdType(undefined);
      addToastMessage({ message: "광고를 재생하지 못했어요" });
    },
  });

  useEffect(() => {
    loadKkangAd();
    loadItemAd();
  }, [loadItemAd, loadKkangAd]);

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

  // 도감 수집률 (%) — 도감 버튼 badge에 표기
  const collectionRate = Math.round(
    (catchedNames.size / catCharacters.length) * 100
  );

  // 깡: 오늘 남은 개수를 storage에서 로드 (마운트 시 1회)
  useEffect(() => {
    void useKkangStore.getState().actions.init();
  }, []);

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

    // 깡 다이얼로그는 Dialog 자체 dismiss 리스너가 닫는다 (이중 발화 방지)
    if (isShowKkangEmpty || isShowKkangAd) {
      return;
    }

    if (itemAdType) {
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
    isShowKkangAd,
    isShowKkangEmpty,
    isShowMyInfoPopup,
    isShowStage,
    isShowVictoryDialog,
    itemAdType,
    ownCatInfo,
  ]);

  // keep-alive(App 라우트 유지)로 숨겨진 상태에서는 뒤로가기 가드를 끈다 —
  // 숨겨진 FindCat의 가드가 현재 화면(Entry 등)의 뒤로가기를 가로채는 걸 방지
  const isMapScreen = useLocation().pathname.startsWith("/find-cat");

  // AIT 환경: 시스템 뒤로가기 이벤트 처리
  useCustomBack(isMapScreen, closeTopLayer);

  // 로컬(브라우저): 시스템 뒤로가기 가로채서 브라우저 기본 컨펌 노출
  useBrowserBackGuard({
    enabled: isMapScreen,
    message: "나갈까요?",
    onConfirm: () => {
      setIsShowExitConfirm(false);
      // push 대신 replace로 나간다 — /find-cat이 히스토리에 남으면
      // Auth 로딩 중 뒤로가기(가로채기 갭)로 맵 화면에 되돌아올 수 있다
      navigate("/", { replace: true });
    },
  });

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map", { "is-blurred": isAnySheetOpen })}
        ownCats={ownCats}
        onClickCat={() => {
          // 마커 클릭 핸들러는 마커 생성 시점의 onClickCat 클로저를 계속 사용한다.
          // 구독값(kkangCount)을 쓰면 깡이 소모된 뒤에도 예전 값으로 체크해
          // 깡 0인데 전투가 시작되는 버그가 생기므로 반드시 스토어에서 직접 읽는다
          const { isInitialized, count, actions } = useKkangStore.getState();

          // storage 로드 전(수백 ms)에는 클릭을 무시한다
          if (!isInitialized) {
            return;
          }

          // 상대 등급에 따라 깡 소모량이 다르다 (common 1 / rare 2 / unique 3)
          const selectedRarity =
            useCatStore.getState().selectedCat?.rarity ?? "common";
          const cost = KKANG_COST_BY_RARITY[selectedRarity];

          // 깡이 부족하면 전투를 시작하지 않는다 (마커 선택 상태도 되돌린다)
          if (count < cost) {
            setKkangNeed(cost);
            setSelectedCat(undefined);
            setIsShowKkangEmpty(true);
            return;
          }

          // 전투 시작 — 등급별 소모량만큼 깡 소모 (도망/패배해도 환불 없음)
          actions.consume(cost);

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
        onClickKkang={() => {
          setIsShowKkangAd(true);
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
          {catchedNames.size > 0 && (
            <span className={cn("badge")}>
              {collectionRate}
              <span className={cn("unit")}>%</span>
            </span>
          )}
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

              {/* 시트 하단 배너 광고 (시트 닫힘 시 언마운트 → 자동 destroy) */}
              <AdBanner
                className={cn("sheet-ad")}
                adGroupId="ait-ad-test-banner-id"
              />
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

              {/* 시트 하단 배너 광고 (시트 닫힘 시 언마운트 → 자동 destroy) */}
              <AdBanner
                className={cn("sheet-ad")}
                adGroupId="ait-ad-test-banner-id"
              />
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
        onItemAdClick={setItemAdType}
      />

      {/* 아이템 충전 팝업 (보유 아이템 클릭 — 보상형 광고 시청 후 지급) */}
      <Dialog
        isShow={!!itemAdType}
        title="아이템 충전"
        subTitle={`광고를 보고\n${
          itemAdType ? ITEM_INFO[itemAdType].name : ""
        } ${ITEM_AD_REWARD_COUNT}개를 받을 수 있다옹!`}
        buttonLable="광고 보고 받기"
        buttonColor="blue"
        buttonDisabled={!isItemAdLoaded}
        onButtonClick={() => {
          showItemAd();
        }}
        subButtonLable="닫기"
        onBackClose={() => setItemAdType(undefined)}
        onSubButtonClick={() => setItemAdType(undefined)}
      />

      {/* 깡 부족 안내 팝업 (고양이 클릭 시 깡이 부족하면 노출) — 광고로 바로 충전 가능 */}
      <Dialog
        isShow={isShowKkangEmpty}
        title="깡 부족"
        subTitle={`깡 ${kkangNeed}개가 필요한데\n지금 ${kkangCount}개밖에 없다옹…`}
        buttonLable="광고 보고 받기"
        buttonColor="blue"
        buttonDisabled={!isKkangAdLoaded}
        onButtonClick={() => {
          showKkangAd();
        }}
        subButtonLable="닫기"
        onBackClose={() => setIsShowKkangEmpty(false)}
        onSubButtonClick={() => setIsShowKkangEmpty(false)}
      />

      {/* 깡 충전 팝업 (깡 캡슐 클릭 — 보상형 광고 시청 후 깡 지급) */}
      <Dialog
        isShow={isShowKkangAd}
        title="깡 충전"
        subTitle={`광고를 보고\n깡 ${KKANG_AD_REWARD_COUNT}개를 받을 수 있다옹!`}
        buttonLable="광고 보고 받기"
        buttonColor="blue"
        buttonDisabled={!isKkangAdLoaded}
        onButtonClick={() => {
          showKkangAd();
        }}
        subButtonLable="닫기"
        onBackClose={() => setIsShowKkangAd(false)}
        onSubButtonClick={() => setIsShowKkangAd(false)}
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
          // push 대신 replace로 나간다 — /find-cat이 히스토리에 남으면
          // Auth 로딩 중 뒤로가기(가로채기 갭)로 맵 화면에 되돌아올 수 있다
          navigate("/", { replace: true });
        }}
        onSubButtonClick={() => {
          setIsShowExitConfirm(false);
        }}
      />
    </main>
  );
}
