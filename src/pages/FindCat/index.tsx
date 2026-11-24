import { Device } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AdBanner, useFullScreenAd } from "@/components/Ads";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map, { type OwnCat } from "@/components/Map";
import { TOWER_ZONE_RADIUS } from "@/components/Map/CatTower";
import Stage from "@/components/Stage";
import type { ItemType } from "@/components/Stage/Inventory";
import { useBrowserBackGuard } from "@/hooks/useBrowserBackGuard";
import { useCustomBack } from "@/hooks/useCustomBack";
import { useCatchCatMutation } from "@/queries/useCatchCatMutation";
import { useItemMutation } from "@/queries/useItemMutation";
import { useItemQuery } from "@/queries/useItemQuery";
import { useMyCatsQuery } from "@/queries/useMyCatsQuery";
import { useCatStore } from "@/store/cat";
import { catNameOfKey, useCatTowerStore } from "@/store/catTower";
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
import { getCelebratedTowerIds, markTowerCelebrated } from "@/utils/storage";

import CatBook from "./CatBook";
import CatTowerSheet from "./CatTowerSheet";
import styles from "./index.module.scss";
import MyCats from "./MyCats";
import MyInfoDialog from "./MyInfoDialog";
import OwnCatInfoDialog from "./OwnCatInfoDialog";
import TowerCelebration from "./TowerCelebration";

const cn = classNames.bind(styles);

// 캣 타워 완공 축하 연출 노출 시간 (ms)
const CELEBRATION_DURATION_MS = 3500;
// 전투 시작 인트로 연출 시간 (ms) — 깡 소모 등 전투 진입 처리와 무관하게
// 병렬로 재생하고, 종료 후에 Stage를 띄운다
const BATTLE_INTRO_MS = 1900;
// 맵 진입 리빌(CloudReveal)이 끝난 뒤 축하 연출을 띄우기까지의 대기 시간 (ms)
const CELEBRATION_REVEAL_DELAY_MS = 1500;
// 축하 대상 타워로 카메라를 옮기는 시간 (ms) — 이동이 끝난 뒤 메시지가 나온다
// (focusTower의 flyTo duration과 맞춘 값)
const CELEBRATION_FLY_MS = 800;

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
  const [isShowTowerSheet, setIsShowTowerSheet] = useState(false);
  // 캣 타워 시트 모드 — list: 내 캣타워 목록 / cats: 작업고양이 추가 / decor: 꾸미기
  const [towerSheetMode, setTowerSheetMode] = useState<
    "list" | "cats" | "decor"
  >("list");
  // cats/decor 모드의 대상 타워 id (decor는 완공 타워에도 쓴다)
  const [towerSheetTargetId, setTowerSheetTargetId] = useState<string>();
  const [isShowExitConfirm, setIsShowExitConfirm] = useState(false);
  const [isShowKkangEmpty, setIsShowKkangEmpty] = useState(false);
  const [isShowKkangAd, setIsShowKkangAd] = useState(false);
  // 전투 시작 인트로 연출 노출 여부 — 끝나면 Stage를 띄운다
  const [isBattleIntro, setIsBattleIntro] = useState(false);
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

  // 캣 타워 — 보유 타워 목록(버튼 badge 갯수) + 위치 지정 모드 여부
  const towers = useCatTowerStore((s) => s.towers);
  const isPlacingTower = useCatTowerStore((s) => s.isPlacingTower);
  const isMoveTower = useCatTowerStore((s) => s.isMoveTower);
  // 부하별 오늘 남은 근무 ms — 퇴근 토스트 감지에 쓴다
  const workLeft = useCatTowerStore((s) => s.workLeft);

  // 부하 퇴근 토스트 — 남은 근무가 0으로 떨어지는 순간(틱 감지) 알린다.
  // 앱을 켰을 때 이미 퇴근해 있는 부하는 직전 값이 없어 알리지 않는다
  const prevWorkLeftRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const prev = prevWorkLeftRef.current;

    Object.entries(workLeft).forEach(([key, left]) => {
      if (left <= 0 && prev[key] !== undefined && prev[key] > 0) {
        addToastMessage({
          message: `${catNameOfKey(key)}가 하루 근무를 마치고 퇴근했다옹!`,
        });
      }
    });

    prevWorkLeftRef.current = workLeft;
  }, [workLeft, addToastMessage]);

  // 캣 타워 완공 축하 연출 — 노출 중인 타워 id (3.5초 뒤 자동 종료)
  const [celebrationTowerId, setCelebrationTowerId] = useState<string>();
  // 감지했지만 아직 노출 대기 중인 타워 — 맵 화면이 숨겨져 있거나 진입
  // 리빌(CloudReveal)이 진행 중이면 가려지므로, 화면이 보이고 리빌이 끝난 뒤
  // 노출한다 (keep-alive로 맵 밖에 있는 동안 완공돼도 재진입 시 다시 볼 수 있게)
  const [pendingCelebration, setPendingCelebration] = useState<{
    towerId: string;
  }>();
  // 이번 세션에서 연출을 시작한 타워 — 스토리지 저장 지연과 무관하게 이중 노출을 막는다
  const celebrationShownRef = useRef<Set<string>>(new Set());
  // 대기 중 리빌을 기다린 적이 있는지 — 리빌이 끝난 직후 노출이 시작되면
  // 1.5초 뒤에 띄우기 위한 플래그 (리빌과 무관하게 즉시 노출 케이스와 구분)
  const celebrationWaitedRevealRef = useRef(false);

  // 맵 진입 리빌 완료 여부 — 연출을 가릴 수 있는 상태 판단용
  const isMapRevealDone = useViewStore((s) => s.isMapRevealDone);

  // 맵 화면(/find-cat) 표시 여부 — keep-alive로 숨겨진 동안엔 연출을 보여줄 수
  // 없으므로 축하 연출 시작을 여기에 묶는다 (축하 effect에서 사용)
  const isMapScreen = useLocation().pathname.startsWith("/find-cat");

  // 깡 충전 보상형 광고 — 진입 시 미리 로드해 딜레이 없이 재생한다
  const {
    isSupported: isKkangAdSupported,
    isLoaded: isKkangAdLoaded,
    isFailed: isKkangAdFailed,
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
    isSupported: isItemAdSupported,
    isLoaded: isItemAdLoaded,
    isFailed: isItemAdFailed,
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

  // 도감: 잡은 고양이 이름 집합
  const catchedNames = new Set(ownCats.map(({ name }) => name));

  // 캣 타워 위치로 지도를 옮긴다 (자동 추적은 끈 상태로) — 목록에서 타워 선택 시
  const focusTower = useCallback(
    (towerId: string) => {
      const tower = useCatTowerStore
        .getState()
        .towers.find((tower) => tower.id === towerId);

      if (!tower) {
        return;
      }

      setIsStopFocusMe(true);
      useViewStore.getState().map?.flyTo({
        center: [tower.lng, tower.lat],
        duration: 800,
      });
    },
    [setIsStopFocusMe]
  );

  // 캣 타워 버튼 클릭 — 내 캣타워 목록 바텀시트를 연다
  // (이동/포커싱은 목록에서 타워를 고르는 방식으로 바뀌었다)
  const onClickTowerButton = useCallback(() => {
    // 부하가 없으면 아무 동작도 하지 않는다
    if (ownCats.length === 0) {
      return;
    }

    setTowerSheetMode("list");
    setIsShowTowerSheet(true);
  }, [ownCats.length]);

  // 도감 수집률 (%) — 도감 버튼 badge에 표기
  const collectionRate = Math.round(
    (catchedNames.size / catCharacters.length) * 100
  );

  // 깡: 오늘 남은 개수를 storage에서 로드 (마운트 시 1회)
  useEffect(() => {
    void useKkangStore.getState().actions.init();
    // 캣 타워: 기기 저장값 복원 + 앱을 끈 사이 성장분 반영
    void useCatTowerStore.getState().actions.init();
  }, []);

  // 캣 타워 완공 축하 연출 1단계(감지) — 완공됐는데 아직 축하를 못 본 타워를 찾는다.
  // 노출 여부는 스토리지에 기록해 앱을 다시 열어도 타워당 1회만 보여준다.
  // 맵 화면이 숨겨진 동안(Entry 화면 등)에도 감지는 진행해 대기열에 올려두고,
  // 실제 노출은 맵 화면에 다시 들어온 뒤에 이뤄진다
  useEffect(() => {
    if (pendingCelebration) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const celebrated = await getCelebratedTowerIds();

      if (cancelled) {
        return;
      }

      const doneTower = towers.find(
        (tower) => tower.completedAt && !celebrated.includes(tower.id)
      );

      if (!doneTower || celebrationShownRef.current.has(doneTower.id)) {
        return;
      }

      celebrationShownRef.current.add(doneTower.id);
      void markTowerCelebrated(doneTower.id);
      setPendingCelebration({ towerId: doneTower.id });
    })();

    return () => {
      cancelled = true;
    };
  }, [towers, pendingCelebration]);

  // 캣 타워 완공 축하 연출 2단계(노출) — 맵 화면이 보이고 리빌이 끝난 상태에서만
  // 시작한다. 대기 중 리빌을 기다렸으면(진입/재진입 직후) 리빌 종료 1.5초 뒤,
  // 아니면 즉시 **축하 대상 타워로 카메라를 먼저 옮긴 뒤** 메시지를 띄운다
  useEffect(() => {
    if (!pendingCelebration || !isMapScreen) {
      return;
    }

    // 리빌이 진행 중이면 기다렸음을 표시하고 대기 — 리빌이 끝나면 재실행된다
    if (!isMapRevealDone) {
      celebrationWaitedRevealRef.current = true;
      return;
    }

    // 리빌을 기다렸던 경험(진입/재진입 직후)이면 리빌 종료 1.5초 뒤에 띄운다
    const delay = celebrationWaitedRevealRef.current
      ? CELEBRATION_REVEAL_DELAY_MS
      : 0;
    celebrationWaitedRevealRef.current = false;

    const timer = window.setTimeout(() => {
      // 1) 축하 대상 타워로 카메라 이동 (자동 위치 추적은 끈 상태로)
      focusTower(pendingCelebration.towerId);

      // 2) 이동이 끝난 뒤 메시지 노출 → 3.5초 뒤 종료
      window.setTimeout(() => {
        setCelebrationTowerId(pendingCelebration.towerId);
        setPendingCelebration(undefined);

        window.setTimeout(() => {
          setCelebrationTowerId(undefined);
        }, CELEBRATION_DURATION_MS);
      }, CELEBRATION_FLY_MS);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [pendingCelebration, isMapScreen, isMapRevealDone, focusTower]);

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

  // 전투 인트로 종료 → Stage 진입 (연출 시간 동안 깡 소모 등 처리는 이미 완료)
  useEffect(() => {
    if (!isBattleIntro) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsShowStage(true);
      setIsBattleIntro(false);
    }, BATTLE_INTRO_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isBattleIntro, setIsShowStage]);

  // 뒤로가기: 열려있는 레이어부터 닫고, 없으면 나가기 컨펌을 띄운다
  const closeTopLayer = useCallback(() => {
    if (isShowStage || isBattleIntro) {
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

    if (isPlacingTower) {
      useCatTowerStore.getState().actions.cancelPlacing();
      return;
    }

    if (isShowTowerSheet) {
      setIsShowTowerSheet(false);
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
    isBattleIntro,
    isPlacingTower,
    isShowCatBook,
    isShowCatchedCatPopup,
    isShowExitConfirm,
    isShowKkangAd,
    isShowKkangEmpty,
    isShowMyInfoPopup,
    isShowStage,
    isShowTowerSheet,
    isShowVictoryDialog,
    itemAdType,
    ownCatInfo,
  ]);

  // keep-alive(App 라우트 유지)로 숨겨진 상태에서는 뒤로가기 가드를 끈다 —
  // 숨겨진 FindCat의 가드가 현재 화면(Entry 등)의 뒤로가기를 가로채는 걸 방지
  // (isMapScreen은 위 축하 연출 effect에서 선언해 함께 사용한다)

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
        className={cn("map")}
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

          // 인트로 연출 중 재클릭으로 깡이 이중 소모되지 않게 막는다
          if (useViewStore.getState().isBattleOn) {
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

          // 전투 시작 — 등급별 소모량만큼 깡 소모 (도망/패배해도 환불 없음).
          // 소모/DB 저장은 즉시 처리하고, 인트로 연출은 이후 Stage 진입만 지연시킨다
          actions.consume(cost);

          setIsBattleIntro(true);
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
        onTowerAddCats={() => {
          // 타워 팝업의 작업고양이 추가 — 고양이 목록만 노출되는 모드로 시트 오픈
          setTowerSheetMode("cats");
          setIsShowTowerSheet(true);
        }}
        onTowerDecor={(towerId) => {
          // 타워 팝업의 꾸미기 — 해당 타워의 색상 선택만 노출되는 모드로 시트 오픈
          setTowerSheetTargetId(towerId);
          setTowerSheetMode("decor");
          setIsShowTowerSheet(true);
        }}
        onTowerPlaced={() => {
          setIsStopFocusMe(true);
          setTowerSheetMode("list");
          setIsShowTowerSheet(true);
          addToastMessage({
            message: "캣 타워 기초를 세웠다옹! 부하를 붙여 키워보자옹!",
            position: "center",
          });
        }}
      />

      {/* 하단 플로팅 액션 독 — 문구(위)+값(아래) 컴팩트 버튼 */}
      <div className={cn("floating-dock")}>
        <Button
          className={cn("dock-btn", "my-cats-btn")}
          color="primary"
          disabled={isMapLoading || isPlacingTower}
          onClick={() => {
            setIsStopFocusMe(true);
            setIsShowCatchedCatPopup(true);
          }}
        >
          <span className={cn("btn-label")}>부하</span>
          {ownCats && ownCats.length > 0 && (
            <span className={cn("badge")}>{ownCats.length}</span>
          )}
        </Button>
        <Button
          className={cn("dock-btn", "book-btn")}
          color="primary"
          disabled={isMapLoading || isPlacingTower}
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
        <Button
          className={cn("dock-btn", "tower-btn")}
          color="primary"
          disabled={isMapLoading || isPlacingTower}
          onClick={onClickTowerButton}
        >
          <span className={cn("btn-label")}>캣 타워</span>
          {towers.length > 0 && (
            <span className={cn("badge")}>
              {towers.length}
              <span className={cn("unit")}>채</span>
            </span>
          )}
        </Button>
      </div>

      {/* 캣 타워 위치 지정 모드 배너 (지정 중일 때만 노출) */}
      <AnimatePresence>
        {isPlacingTower && (
          <motion.div
            className={cn("tower-place-bar")}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
          >
            <span className={cn("place-text")}>
              {isMoveTower
                ? `캣 타워 주변 ${TOWER_ZONE_RADIUS}m 안에서\n옮길 자리를 골라라옹!`
                : `주변 ${TOWER_ZONE_RADIUS}m 안에서\n캣 타워를 세울 자리를 골라라옹!`}
            </span>
            <button
              type="button"
              className={cn("place-cancel")}
              onClick={() => {
                useCatTowerStore.getState().actions.cancelPlacing();
              }}
            >
              취소
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 캣 타워 바텀시트 (목록 / 작업고양이 추가 / 꾸미기 모드) */}
      <CatTowerSheet
        isShow={isShowTowerSheet}
        mode={towerSheetMode}
        targetTowerId={towerSheetTargetId}
        onSelectTower={(towerId) => {
          setIsShowTowerSheet(false);
          focusTower(towerId);
        }}
        onBuildTower={() => {
          // 시트를 닫고 위치 지정 모드로 — 지도에서 세울 자리를 고른다
          setIsShowTowerSheet(false);
          useCatTowerStore.getState().actions.startPlacing();
        }}
        onClose={() => {
          setIsShowTowerSheet(false);
        }}
      />

      {/* 캣 타워 완공 축하 연출 (3.5초 자동 종료, 타워당 1회) */}
      {celebrationTowerId && <TowerCelebration />}

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

      {/* 전투 시작 인트로 — 클릭 즉시 깡 소모 후 BATTLE_INTRO_MS 동안 재생 */}
      <AnimatePresence>
        {isBattleIntro && (
          <motion.div
            className={cn("battle-intro")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
          >
            {/* 흔들림은 딤 배경이 아닌 내용물만 — 배경이 움직이면 맵 테두리가 샌다 */}
            <motion.div
              className={cn("battle-intro-shake")}
              animate={{
                x: [0, 0, -10, 9, -6, 5, -2, 0],
                y: [0, 0, 5, -5, 3, -2, 1, 0],
              }}
              transition={{
                duration: 1.15,
                times: [0, 0.28, 0.34, 0.4, 0.46, 0.52, 0.6, 1],
              }}
            >
            <div className={cn("battle-intro-sparks")} aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  style={{ "--angle": `${i * 36}deg` } as React.CSSProperties}
                />
              ))}
            </div>

            <motion.div
              className={cn("battle-intro-vs")}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 1, 1, 1, 1, 1],
                // 타격감: 후세기로 화면 안까지 박치기 → 크게 과부하 착지 → 강한 스쿼시 → 좌우 흔들림
                scale: [0, 0.3, 3.2, 0.85, 1.08, 1, 1],
                rotate: [-28, -28, 12, -5, 2, 0, 0],
                x: [0, 0, -16, 12, -8, 5, 0],
              }}
              transition={{
                delay: 0.1,
                duration: 1.15,
                times: [0, 0.1, 0.28, 0.36, 0.44, 0.55, 1],
                ease: "easeOut",
              }}
            >
              VS
            </motion.div>
            <motion.div
              className={cn("battle-intro-label")}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.25 }}
            >
              {useCatStore.getState().selectedCat?.name ?? "상대"}
              </motion.div>
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
        subTitle={
          isItemAdSupported
            ? `광고를 보고\n${
                itemAdType ? ITEM_INFO[itemAdType].name : ""
              } ${ITEM_AD_REWARD_COUNT}개를 받을 수 있다옹!`
            : `이 기기에서는 광고를 볼 수 없다옹…\n토스앱 최신 버전에서 시도해 주세요!`
        }
        buttonLable={
          !isItemAdSupported
            ? "광고를 사용할 수 없어요"
            : isItemAdFailed
            ? "다시 시도"
            : "광고 보고 받기"
        }
        buttonColor="blue"
        buttonDisabled={
          isItemAdSupported ? !isItemAdLoaded && !isItemAdFailed : true
        }
        onButtonClick={() => {
          if (!isItemAdSupported) return;
          if (isItemAdFailed) {
            loadItemAd();
            return;
          }
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
        subTitle={
          isKkangAdSupported
            ? `깡 ${kkangNeed}개가 필요한데\n지금 ${kkangCount}개밖에 없다옹…`
            : `이 기기에서는 광고를 볼 수 없다옹…\n토스앱 최신 버전에서 시도해 주세요!`
        }
        buttonLable={
          !isKkangAdSupported
            ? "광고를 사용할 수 없어요"
            : isKkangAdFailed
            ? "다시 시도"
            : "광고 보고 받기"
        }
        buttonColor="blue"
        buttonDisabled={
          isKkangAdSupported ? !isKkangAdLoaded && !isKkangAdFailed : true
        }
        onButtonClick={() => {
          if (!isKkangAdSupported) return;
          if (isKkangAdFailed) {
            loadKkangAd();
            return;
          }
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
        subTitle={
          isKkangAdSupported
            ? `광고를 보고\n깡 ${KKANG_AD_REWARD_COUNT}개를 받을 수 있다옹!`
            : `이 기기에서는 광고를 볼 수 없다옹…\n토스앱 최신 버전에서 시도해 주세요!`
        }
        buttonLable={
          !isKkangAdSupported
            ? "광고를 사용할 수 없어요"
            : isKkangAdFailed
            ? "다시 시도"
            : "광고 보고 받기"
        }
        buttonColor="blue"
        buttonDisabled={
          isKkangAdSupported ? !isKkangAdLoaded && !isKkangAdFailed : true
        }
        onButtonClick={() => {
          if (!isKkangAdSupported) return;
          if (isKkangAdFailed) {
            loadKkangAd();
            return;
          }
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
