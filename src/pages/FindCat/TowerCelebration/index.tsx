import classNames from "classnames/bind";
import { motion } from "framer-motion";
import { type CSSProperties, useMemo } from "react";

import { TOWER_MAX_HEIGHT } from "@/store/catTower";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 컨페티 조각 수/색 — 화면을 가득 채우는 분량
const CONFETTI_COUNT = 64;
const CONFETTI_COLORS = [
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#4ade80",
  "#60a5fa",
  "#f87171",
  "#ffffff",
];

// 렌더 순수성(react-hooks/purity)을 지키기 위한 시드 기반 결정적 난수 —
// Math.random은 렌더 중 호출이 불가하므로 곱셈 난수 생성기로 대체한다
const createSeededRandom = (seed: number) => {
  let s = seed % 2147483647;

  if (s <= 0) {
    s += 2147483646;
  }

  return () => {
    s = (s * 16807) % 2147483647;

    return (s - 1) / 2147483646;
  };
};

/** 캣 타워 완공 축하 연출 — 컨페티가 화면을 가득 채우고 축하 메시지가 팝으로 등장한다.
 * 노출 시간(3.5초)과 종료는 호출부(FindCat)가 관리한다 */
export default function TowerCelebration() {
  // 조각별 위치/색/크기/지연/회전을 넓게 흩어지게 배치 (시드 기반 난수)
  const pieces = useMemo(() => {
    const rand = createSeededRandom(20261124);

    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.6,
      duration: 2.4 + rand() * 1.1,
      width: 7 + rand() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: -50 + rand() * 100,
      spin: 360 + rand() * 360,
    }));
  }, []);

  return (
    <div className={cn("celebration")}>
      <div className={cn("confetti")} aria-hidden="true">
        {pieces.map((piece, i) => (
          <i
            key={i}
            style={
              {
                left: `${piece.left}%`,
                width: piece.width,
                height: piece.width * 0.6,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                "--drift": `${piece.drift}px`,
                "--spin": `${piece.spin}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <motion.div
        className={cn("message")}
        initial={{ scale: 0.3, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          damping: 11,
          stiffness: 220,
          delay: 0.15,
        }}
      >
        <div className={cn("title-row")}>
          <span className={cn("emoji")}>🎉</span>
          <strong className={cn("title")}>캣 타워 완공!</strong>
          <span className={cn("emoji")}>🎉</span>
        </div>
        <span className={cn("sub")}>
          {TOWER_MAX_HEIGHT}m에 도달했다옹! 고생한 부하들도 쉬게 해줬다옹!
        </span>
      </motion.div>
    </div>
  );
}
