import classNames from "classnames/bind";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ImgWinningFlag from "@/assets/img/winning_flag.png";
import Button from "@/components/Button";
import Dialog from "@/components/Dialog";
import Map from "@/components/Map";
import Stage from "@/components/Stage";
import { useCatStore } from "@/store/cat";
import { catCharacters, type CatInfo } from "@/utils/cats";
import { getPostposition } from "@/utils/helper";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function FindCat() {
  const navigate = useNavigate();

  const { setSelectedCat, addCatchedCat } = useCatStore((s) => s.actions);
  const catchedCats = useCatStore((s) => s.catchedCats);

  const [isShowPopup, setIsShowPopup] = useState(false);
  const [catchedCat, setCatchedCat] = useState<CatInfo>();
  const [selectedMenu, setSelectedMenu] = useState<"catched" | "all">();

  return (
    <main className={cn("FindCat")}>
      <Map
        className={cn("map")}
        onClickCatMarker={() => {
          setIsShowPopup(true);
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
              setSelectedMenu("all");
            }}
          >
            냥아치 목록
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
              <button
                className={cn("close-button")}
                type="button"
                onClick={() => {
                  setSelectedMenu(undefined);
                }}
              >
                닫기
              </button>

              <div className={cn("wrapper")}>
                {selectedMenu === "catched" &&
                  (catchedCats.length > 0 ? (
                    <ul>
                      {catchedCats.map(({ name, img, crying }) => (
                        <li key={name}>
                          <img src={img} alt={name} width={50} height={50} />
                          <span>{name} :</span>
                          <span>{crying}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={cn("empty")}>
                      크흡.. 부하가 하나도 없다니
                    </div>
                  ))}
                {selectedMenu === "all" && (
                  <ul>
                    {catCharacters.map(({ name, img, crying }) => (
                      <li key={name}>
                        <img src={img} alt={name} width={50} height={50} />
                        <span>{name} :</span>
                        <span>{crying}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!!isShowPopup && (
          <motion.div
            className={cn("img-popup")}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2 }}
          >
            <Stage
              onClose={() => {
                setIsShowPopup(false);
              }}
              onWin={(cat) => {
                setIsShowPopup(false);

                setTimeout(() => {
                  cat.marker?.setImage(
                    new kakao.maps.MarkerImage(
                      ImgWinningFlag,
                      new kakao.maps.Size(30, 30),
                      { offset: new kakao.maps.Point(0, 0) }
                    )
                  );

                  cat.marker?.setTitle("catched");

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
          if (catchedCat) {
            addCatchedCat(catchedCat);

            // TODO: 잡은 고양이목록 디비저장
          }

          setCatchedCat(undefined);
        }}
      />
    </main>
  );
}
