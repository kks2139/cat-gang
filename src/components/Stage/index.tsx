import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import classNames from "classnames/bind";
import { AnimatePresence } from "framer-motion";
import { produce } from "immer";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCustomBack } from "@/hooks/useCustomBack";
import { useItemMutation } from "@/queries/useItemMutation";
import { useCatStore } from "@/store/cat";
import { type CatInfo, MyCat } from "@/utils/cats";
import { getPostposition, getRandomNumber, wait } from "@/utils/helper";

import Dialog from "../Dialog";
import Control, { type DialogInfo, type Side } from "./Control";
import Effects, { type EffectType } from "./Effects";
import styles from "./index.module.scss";
import Inventory, { type ItemType } from "./Inventory";
import Player from "./Player";
import type { BuffAndDebuff, StatusEffectInfo } from "./Player/StatusEffect";

interface StatusEffect {
  my: StatusEffectInfo[];
  enemy: StatusEffectInfo[];
}

const cn = classNames.bind(styles);

// 모션 duration(초) 정의
const MY_MOTION_DELAY = 1;
const MY_MOTION_DURATION = 0.2;
const PUNCH_DURATION = 0.2;
const SEDUCE_DURATION = 2;
// 행동 후 딜레이
const DELAY_OF_ACTIONS = 0.5;

interface Props {
  onWin: (cat: CatInfo) => void;
  onLose?: () => void;
  onRun?: () => void;
}

export default function Stage({ onWin, onLose, onRun }: Props) {
  const selectedCat = useCatStore((s) => s.selectedCat);
  const myCat = MyCat.getInstance().getMyCat();

  const [dialogInfo, setDialogInfo] = useState<DialogInfo | undefined>({
    side: "enemy",
    type: "meet",
    speaker: selectedCat?.name || "",
    text: selectedCat?.dialog.meet || "",
  });

  const [dialogConfirmCount, setDialogConfirmCount] = useState(0);
  const [isShowControl, setIsShowControl] = useState(false);
  const [isShowFinishPopup, setIsShowFinishPopup] = useState(false);
  const [winner, setWinner] = useState<Side>();

  // 전투진행관련 상태들
  const [hpInfo, setHpInfo] = useState({
    myHp: myCat.hp,
    enemyHp: selectedCat?.hp || 0,
  });
  const [defenseInfo, setDefenseInfo] = useState({
    myDefense: myCat.defense,
    enemyDefense: selectedCat?.defense || 0,
  });
  const [punchedBy, setPunchedBy] = useState<Side>();
  const [seducedBy, setSeducedBy] = useState<Side>();
  const [isRun, setIsRun] = useState(false);
  const [isShowItems, setIsShowItems] = useState(false);
  const [usedItem, setUsedItem] = useState<ItemType>();
  const [statusEffects, setStatusEffects] = useState<StatusEffect>({
    my: [],
    enemy: [],
  });
  const turnCountRef = useRef<{ my: number; enemy: number }>({
    my: 0,
    enemy: 0,
  });

  const { mutateAsync: updateItemCount } = useItemMutation();

  const isVictory = !!winner && winner === "me";

  const enemyEffect: EffectType | undefined =
    winner === "me"
      ? "lose"
      : seducedBy === "enemy"
        ? "seduce"
        : punchedBy === "me"
          ? "punch"
          : usedItem === "fish"
            ? "item"
            : undefined;

  const myEffect: EffectType | undefined = isRun
    ? "run"
    : winner === "enemy"
      ? "lose"
      : seducedBy === "me"
        ? "seduce"
        : punchedBy === "enemy"
          ? "punch"
          : usedItem === "catnip" || usedItem === "gukbab"
            ? "item"
            : undefined;

  const checkHasStatusEffect = useCallback(
    (effect: BuffAndDebuff) => {
      const me = !!statusEffects.my.find((e) => e.effect === effect);
      const enemy = !!statusEffects.enemy.find((e) => e.effect === effect);

      return {
        me,
        enemy,
      };
    },
    [statusEffects.enemy, statusEffects.my],
  );

  // return: 승리한 사이드
  const punch = async (by: Side): Promise<Side | void> => {
    let winnerSide: Side | undefined;
    const actionDelay = (PUNCH_DURATION + DELAY_OF_ACTIONS) * 1000;
    const isByMe = by === "me";
    const hasCatnip = checkHasStatusEffect("catnip");
    const plusDamage = hasCatnip.me ? 2 : 0;

    const damage = isByMe
      ? myCat.punchPower + plusDamage - (defenseInfo.enemyDefense || 0)
      : selectedCat!.punchPower - (defenseInfo.myDefense || 0);

    if (isByMe) {
      const enemyHp = Math.max(hpInfo.enemyHp - damage, 0);

      if (enemyHp === 0) {
        winnerSide = "me";
      }

      setPunchedBy("me");
      setTimeout(() => setPunchedBy(undefined), 1000);
      generateHapticFeedback({ type: "tickMedium" });

      await wait(actionDelay);

      setHpInfo(
        produce((draft) => {
          draft.enemyHp = enemyHp;
        }),
      );
    } else {
      const myHp = Math.max(hpInfo.myHp - damage, 0);

      if (myHp === 0) {
        winnerSide = "enemy";
      }

      setPunchedBy("enemy");
      setTimeout(() => setPunchedBy(undefined), 1000);
      generateHapticFeedback({ type: "tickMedium" });

      await wait(actionDelay);

      setHpInfo(
        produce((draft) => {
          draft.myHp = myHp;
        }),
      );
    }

    // hp감소 효과 대기
    await wait(2000);

    return winnerSide;
  };

  const seduce = async (by: Side) => {
    const isByMe = by === "me";
    const hasSeduce = checkHasStatusEffect("seduce");

    // 유혹: 방어력 -2
    const defense = isByMe
      ? Math.max(defenseInfo.enemyDefense - 2, 0)
      : Math.max(defenseInfo.myDefense - 2, 0);

    if (isByMe) {
      setSeducedBy("enemy");
      await wait(SEDUCE_DURATION * 1000);
      setSeducedBy(undefined);

      // 중첩효과 x
      if (!hasSeduce.enemy) {
        setDefenseInfo(
          produce((draft) => {
            draft.enemyDefense = defense;
          }),
        );
      }

      // 상대 유혹 상태 3턴 지속
      setStatusEffects(
        produce((draft) => {
          draft.enemy = draft.enemy.filter((e) => e.effect !== "seduce");
          draft.enemy.push({
            effect: "seduce",
            endTurn: turnCountRef.current.enemy + 3,
          });
        }),
      );
    } else {
      setSeducedBy("me");
      await wait(SEDUCE_DURATION * 1000);
      setSeducedBy(undefined);

      // 중첩효과 x
      if (!hasSeduce.me) {
        setDefenseInfo(
          produce((draft) => {
            draft.myDefense = defense;
          }),
        );
      }

      // 나 유혹 상태 3턴 지속
      setStatusEffects(
        produce((draft) => {
          draft.my = draft.my.filter((e) => e.effect !== "seduce");
          draft.my.push({
            effect: "seduce",
            endTurn: turnCountRef.current.my + 3,
          });
        }),
      );
    }

    await wait(DELAY_OF_ACTIONS * 1000);
  };

  const enemyAction = () => {
    // 상대는 랜덤으로 액션을 취한다
    const action = getRandomNumber(8);
    const side = "enemy";
    const hasFish = checkHasStatusEffect("fish");

    // 생선효과: 상대액션 건너뜀
    if (hasFish.enemy) {
      setDialogInfo({
        side: "enemy",
        type: "system",
        speaker: "",
        text: `${getPostposition(selectedCat!.name, "topic")} 생선에 정신이 팔려있다..!`,
      });

      return;
    }

    switch (action) {
      // 냥냥펀치
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        setDialogInfo({
          side,
          type: "punch",
          speaker: selectedCat!.name,
          text: selectedCat!.dialog.punch,
        });
        break;
      case 6:
      case 7: // 유혹
        setDialogInfo({
          side,
          type: "seduce",
          speaker: selectedCat!.name,
          text: selectedCat!.dialog.seduce,
        });
        break;
    }

    setIsShowControl(true);
  };

  useEffect(() => {
    setTimeout(
      () => setIsShowControl(true),
      (MY_MOTION_DURATION + MY_MOTION_DELAY + 0.3) * 1000,
    );
  }, []);

  useEffect(() => {
    const myTurnCount = turnCountRef.current.my;
    const enemyTurnCount = turnCountRef.current.enemy;

    // 현재턴수랑 비교해서 상태이상 제거
    setStatusEffects(
      produce((draft) => {
        draft.my = draft.my.filter((effect) => effect.endTurn > myTurnCount);
        draft.enemy = draft.enemy.filter(
          (effect) => effect.endTurn > enemyTurnCount,
        );
      }),
    );

    // eslint-disable-next-line react-hooks/refs
  }, [turnCountRef.current.my, turnCountRef.current.enemy]);

  useCustomBack(isShowItems, () => {
    setIsShowItems(false);
  });

  return (
    <div className={cn("Stage")}>
      {/* <div
        style={{
          color: "white",
          fontSize: "20px",
          position: "absolute",
          zIndex: 9999,
          top: 0,
          left: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        나 : {statusEffects.my.map((effect) => effect.endTurn)}
        <div>------</div>
        상대 : {statusEffects.enemy.map((effect) => effect.endTurn)}
      </div> */}

      <AnimatePresence>
        {isShowItems && (
          <Inventory
            onClose={() => setIsShowItems(false)}
            onSelect={async (item, currCount) => {
              setIsShowItems(false);
              setIsShowControl(false);
              setUsedItem(item);

              // 아이템 카운트 반영 + 사용 모션 대기
              await Promise.allSettled([
                updateItemCount({
                  itemType: item,
                  count: Math.max(currCount - 1, 0),
                }),
                wait(3000),
              ]);

              setIsShowControl(true);

              switch (item) {
                case "gukbab":
                  setHpInfo(
                    produce((draft) => {
                      draft.myHp = Math.min(hpInfo.myHp + 5, myCat.hp);
                    }),
                  );
                  setDialogInfo({
                    type: "system",
                    speaker: "",
                    text: `국밥으로 체력충전!`,
                  });
                  break;
                case "catnip":
                  // 캣닢 효과 나에게 3턴 지속
                  setStatusEffects(
                    produce((draft) => {
                      draft.my = draft.my.filter((e) => e.effect !== "catnip");
                      draft.my.push({
                        effect: "catnip",
                        endTurn: turnCountRef.current.my + 3,
                      });
                    }),
                  );

                  setDialogInfo({
                    type: "system",
                    speaker: "",
                    text: `캣닢 효과로 데미지 증폭!`,
                  });
                  break;
                case "fish":
                  // 물고기 효과 상대에게 2턴 지속
                  setStatusEffects(
                    produce((draft) => {
                      draft.enemy = draft.enemy.filter(
                        (e) => e.effect !== "fish",
                      );
                      draft.enemy.push({
                        effect: "fish",
                        endTurn: turnCountRef.current.enemy + 2,
                      });
                    }),
                  );

                  setDialogInfo({
                    type: "system",
                    speaker: "",
                    text: `${getPostposition(selectedCat?.name, "sub")} 생선에 정신이 팔렸다!`,
                    nextTurn: "me",
                  });
              }

              setUsedItem(undefined);

              turnCountRef.current.my += 1;
            }}
          />
        )}
      </AnimatePresence>

      <div className={cn("view")}>
        {/* 적 고양이 */}
        <Player
          side="enemy"
          cat={selectedCat}
          hp={hpInfo.enemyHp}
          defense={defenseInfo.enemyDefense}
          effectType={enemyEffect}
          punchDuraion={PUNCH_DURATION}
          seduceDuraion={SEDUCE_DURATION}
          introMotion={{
            initial: { opacity: 0, y: -50 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.2, delay: 0.5 },
          }}
          catImgIntroMotion={{
            initial: { opacity: 0, x: 100 },
            animate: { opacity: 1, x: 0 },
            transition: { duration: 0.3, delay: 0.2 },
          }}
          isSpeaking={dialogInfo?.side === "enemy" && enemyEffect !== "lose"}
          usedItem={usedItem}
          statusEffectInfos={statusEffects.enemy}
        >
          <Effects
            target="enemy"
            enabled={!!enemyEffect}
            effectType={enemyEffect}
            punchDuration={PUNCH_DURATION}
            usedItem={usedItem}
          />
        </Player>

        {/* 나 */}
        <Player
          side="me"
          cat={myCat}
          hp={hpInfo.myHp}
          defense={defenseInfo.myDefense}
          effectType={myEffect}
          punchDuraion={PUNCH_DURATION}
          seduceDuraion={SEDUCE_DURATION}
          catImgIntroMotion={{
            initial: { opacity: 0, x: -100 },
            animate: { opacity: 1, x: 0 },
            transition: {
              duration: MY_MOTION_DURATION,
              delay: MY_MOTION_DELAY,
            },
          }}
          introMotion={{
            initial: { opacity: 0, y: -50 },
            animate: { opacity: 1, y: 0 },
            transition: {
              duration: 0.3,
              delay: MY_MOTION_DURATION + MY_MOTION_DELAY,
            },
          }}
          isSpeaking={
            dialogInfo &&
            dialogInfo.type !== "system" &&
            dialogInfo.side === undefined
          }
          usedItem={usedItem}
          statusEffectInfos={statusEffects.my}
        >
          <Effects
            enabled={!!myEffect}
            effectType={myEffect}
            punchDuration={PUNCH_DURATION}
            usedItem={usedItem}
          />
        </Player>
      </div>

      <Control
        isShow={isShowControl}
        dialogInfo={dialogInfo}
        onPunch={() => {
          setDialogInfo({
            type: "punch",
            speaker: myCat.name,
            text: myCat.dialog.punch,
          });
        }}
        onSeduce={() => {
          setDialogInfo({
            type: "seduce",
            speaker: myCat.name,
            text: myCat.dialog.seduce,
          });
        }}
        onRun={() => {
          setDialogInfo({
            type: "run",
            speaker: myCat.name,
            text: myCat.dialog.run,
          });
        }}
        onShowItems={() => {
          setIsShowItems(true);
        }}
        // 대화상자 클릭 후 액션 정의
        onDialogConfirmClick={async ({ type, causedBy, nextTurn }) => {
          const turnCountActions = ["punch", "seduce"];

          if (dialogConfirmCount === 0) {
            setDialogInfo({
              type: "meet",
              speaker: myCat.name,
              text: myCat.dialog.meet,
            });
          } else if (dialogConfirmCount === 1) {
            setDialogInfo(undefined);
          } else {
            setDialogInfo(undefined);
            setIsShowControl(false);

            if (causedBy === "me") {
              if (turnCountActions.includes(type || "")) {
                // 턴 카운트 증가
                turnCountRef.current.my += 1;
              }

              switch (type) {
                case "system":
                  if (nextTurn !== "me") {
                    enemyAction();
                  }

                  break;
                case "punch": {
                  const winner = await punch("me");

                  if (winner === "me") {
                    setDialogInfo({
                      type: "win",
                      speaker: myCat.name,
                      text: myCat.dialog.win,
                    });
                  } else {
                    enemyAction();
                  }

                  break;
                }
                case "seduce":
                  await seduce("me");

                  setDialogInfo({
                    type: "system",
                    speaker: "",
                    text: `${getPostposition(selectedCat?.name, "sub")} 유혹에 넘어갔다!`,
                  });

                  break;
                case "win":
                  setWinner("me");

                  setDialogInfo({
                    side: "enemy",
                    type: "lose",
                    speaker: selectedCat!.name,
                    text: selectedCat!.dialog.lose,
                  });

                  break;
                case "lose":
                  setIsShowFinishPopup(true);
                  break;
                case "run":
                  setIsRun(true);

                  setDialogInfo({
                    side: "enemy",
                    type: "run",
                    speaker: selectedCat!.name,
                    text: selectedCat!.dialog.run,
                  });

                  break;
              }

              if (type !== "lose") {
                setIsShowControl(true);
              }
            }

            if (causedBy === "enemy") {
              if (turnCountActions.includes(type || "")) {
                // 턴 카운트 증가
                turnCountRef.current.enemy += 1;
              }

              switch (type) {
                case "punch": {
                  const winner = await punch("enemy");

                  if (winner === "enemy") {
                    setDialogInfo({
                      side: "enemy",
                      type: "win",
                      speaker: selectedCat!.name,
                      text: selectedCat!.dialog.win,
                    });
                  }

                  break;
                }
                case "seduce":
                  await seduce("enemy");

                  setDialogInfo({
                    type: "system",
                    speaker: "",
                    text: `으.. ${selectedCat?.name}의 유혹에 넘어갔다..!`,
                  });

                  break;
                case "win":
                  setWinner("enemy");

                  setDialogInfo({
                    side: "me",
                    type: "lose",
                    speaker: myCat.name,
                    text: myCat.dialog.lose,
                  });
                  break;
                case "lose":
                  setIsShowFinishPopup(true);
                  break;
                case "run":
                  onRun?.();
                  break;
              }

              if (type !== "lose") {
                setIsShowControl(true);
              }
            }
          }

          setDialogConfirmCount((pre) => pre + 1);
        }}
      />

      <Dialog
        isShow={isShowFinishPopup}
        title={isVictory ? "승리" : "패배"}
        subTitle={isVictory ? "적을 쓰러뜨렸습니다." : "패배하였습니다."}
        buttonLable={isVictory ? "좋은 싸움이었다" : "도망가자"}
        onButtonClick={() => {
          if (isVictory && selectedCat) {
            onWin(selectedCat);
          } else {
            onLose?.();
          }
        }}
      />
    </div>
  );
}
