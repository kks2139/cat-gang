import classNames from "classnames/bind";
import { motion } from "framer-motion";

import Loading from "@/components/Loading";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

// 갈라짐 시작 전 유지 시간(s) — 로딩 직후 다크 테마 전환 순간(지도 색 깜빡임)을
// 구름 뒤로 가리기 위해 구름/안개가 바로 걷히지 않게 1초 여유를 둔다
const REVEAL_HOLD = 1;

// 재진입 리빌 유지 시간(s) — 지도가 이미 그려져 있어 지물 색 전환 깜빡임이
// 없으므로 짧게 유지한다
export const REVEAL_HOLD_REENTER = 0.2;

// ─── 리빌 구름 구성 ────────────────────────────────────────
// 크고작은 구름들이 안개 위에 떠 있고, 로딩 완료 시 화면 중앙에 가까운
// 구름부터 양쪽으로 흩어지며 지도를 드러낸다. 구름마다 크기/위치/드리프트/
// 이탈 속도·거리·회전을 달리해 기계적인 커튼이 아닌 바람에 흩어지는
// 구름처럼 보이게 한다. (offset: left면 왼쪽 가장자리에서, right면 오른쪽에서)
interface RevealCloudConfig {
  side: "left" | "right";
  /** 화면 세로 위치 (%) */
  top: number;
  /** side 기준 가로 위치 (%) */
  offset: number;
  width: number;
  height: number;
  opacity: number;
  blur: number;
  /** 대기 중 좌우 드리프트 진폭 (px) */
  driftX: number;
  driftDuration: number;
  /** 드리프트 시작 딜레이 (음수 = 중간 위상부터) */
  driftDelay: number;
  /** 이탈(갈라짐) 모션 — x는 화면 바깥 방향 px, y는 상승(음수) */
  exitX: number;
  exitY: number;
  exitRotate: number;
  exitDuration: number;
  exitDelay: number;
}

const REVEAL_CLOUDS: RevealCloudConfig[] = [
  // ── 왼쪽 — 중앙 경계 근처 구름(exitDelay 0)부터 갈라지고 바깥쪽이 뒤따른다
  {
    side: "left",
    top: 42,
    offset: 38,
    width: 64,
    height: 40,
    opacity: 0.88,
    blur: 4.5,
    driftX: -12,
    driftDuration: 7,
    driftDelay: -3,
    exitX: -560,
    exitY: -8,
    exitRotate: 3,
    exitDuration: 1.2,
    exitDelay: 0,
  },
  {
    side: "left",
    top: 28,
    offset: 20,
    width: 120,
    height: 70,
    opacity: 0.92,
    blur: 3,
    driftX: -10,
    driftDuration: 11,
    driftDelay: -6,
    exitX: -640,
    exitY: -10,
    exitRotate: 2,
    exitDuration: 1.35,
    exitDelay: 0.1,
  },
  {
    side: "left",
    top: 72,
    offset: 26,
    width: 78,
    height: 46,
    opacity: 0.85,
    blur: 4,
    driftX: -16,
    driftDuration: 8,
    driftDelay: -1,
    exitX: -600,
    exitY: -12,
    exitRotate: 4,
    exitDuration: 1.25,
    exitDelay: 0.08,
  },
  {
    side: "left",
    top: 6,
    offset: -10,
    width: 170,
    height: 96,
    opacity: 0.96,
    blur: 2.5,
    driftX: 14,
    driftDuration: 9,
    driftDelay: -2,
    exitX: -720,
    exitY: -18,
    exitRotate: -3,
    exitDuration: 1.5,
    exitDelay: 0.22,
  },
  {
    side: "left",
    top: 86,
    offset: 4,
    width: 130,
    height: 74,
    opacity: 0.94,
    blur: 2.5,
    driftX: 10,
    driftDuration: 12,
    driftDelay: -8,
    exitX: -700,
    exitY: -16,
    exitRotate: -2,
    exitDuration: 1.45,
    exitDelay: 0.18,
  },
  {
    side: "left",
    top: 52,
    offset: -6,
    width: 190,
    height: 104,
    opacity: 0.97,
    blur: 2,
    driftX: 12,
    driftDuration: 10,
    driftDelay: -4,
    exitX: -780,
    exitY: -24,
    exitRotate: -4,
    exitDuration: 1.6,
    exitDelay: 0.28,
  },
  {
    side: "left",
    top: 14,
    offset: 24,
    width: 96,
    height: 54,
    opacity: 0.9,
    blur: 3,
    driftX: 9,
    driftDuration: 10,
    driftDelay: -5,
    exitX: -660,
    exitY: -14,
    exitRotate: 2,
    exitDuration: 1.4,
    exitDelay: 0.12,
  },
  {
    side: "left",
    top: 62,
    offset: 34,
    width: 70,
    height: 42,
    opacity: 0.85,
    blur: 4,
    driftX: -13,
    driftDuration: 8,
    driftDelay: -2,
    exitX: -580,
    exitY: -10,
    exitRotate: 3,
    exitDuration: 1.25,
    exitDelay: 0.05,
  },
  {
    side: "left",
    top: 94,
    offset: 30,
    width: 88,
    height: 50,
    opacity: 0.88,
    blur: 3.5,
    driftX: -9,
    driftDuration: 11,
    driftDelay: -7,
    exitX: -620,
    exitY: -12,
    exitRotate: -2,
    exitDuration: 1.3,
    exitDelay: 0.15,
  },
  // ── 오른쪽 (왼쪽과 대칭 — 이탈 방향만 반대)
  {
    side: "right",
    top: 44,
    offset: 36,
    width: 70,
    height: 42,
    opacity: 0.86,
    blur: 4,
    driftX: 12,
    driftDuration: 7.5,
    driftDelay: -4,
    exitX: 580,
    exitY: -8,
    exitRotate: -3,
    exitDuration: 1.2,
    exitDelay: 0.04,
  },
  {
    side: "right",
    top: 24,
    offset: 16,
    width: 110,
    height: 64,
    opacity: 0.92,
    blur: 3,
    driftX: 10,
    driftDuration: 10.5,
    driftDelay: -7,
    exitX: 660,
    exitY: -12,
    exitRotate: -2,
    exitDuration: 1.3,
    exitDelay: 0.12,
  },
  {
    side: "right",
    top: 68,
    offset: 24,
    width: 84,
    height: 48,
    opacity: 0.84,
    blur: 4,
    driftX: 15,
    driftDuration: 8.5,
    driftDelay: -2,
    exitX: 620,
    exitY: -10,
    exitRotate: -4,
    exitDuration: 1.25,
    exitDelay: 0.06,
  },
  {
    side: "right",
    top: 10,
    offset: -8,
    width: 160,
    height: 92,
    opacity: 0.95,
    blur: 2.5,
    driftX: 13,
    driftDuration: 9.5,
    driftDelay: -3,
    exitX: 740,
    exitY: -16,
    exitRotate: 3,
    exitDuration: 1.5,
    exitDelay: 0.2,
  },
  {
    side: "right",
    top: 84,
    offset: 6,
    width: 126,
    height: 72,
    opacity: 0.92,
    blur: 2.5,
    driftX: 11,
    driftDuration: 12,
    driftDelay: -9,
    exitX: 700,
    exitY: -14,
    exitRotate: 2,
    exitDuration: 1.4,
    exitDelay: 0.16,
  },
  {
    side: "right",
    top: 54,
    offset: -4,
    width: 180,
    height: 100,
    opacity: 0.96,
    blur: 2,
    driftX: -12,
    driftDuration: 10,
    driftDelay: -5,
    exitX: 780,
    exitY: -22,
    exitRotate: 4,
    exitDuration: 1.55,
    exitDelay: 0.26,
  },
  {
    side: "right",
    top: 18,
    offset: 28,
    width: 92,
    height: 52,
    opacity: 0.9,
    blur: 3,
    driftX: -9,
    driftDuration: 10,
    driftDelay: -6,
    exitX: 640,
    exitY: -12,
    exitRotate: -2,
    exitDuration: 1.35,
    exitDelay: 0.1,
  },
  {
    side: "right",
    top: 60,
    offset: 34,
    width: 66,
    height: 40,
    opacity: 0.84,
    blur: 4,
    driftX: 14,
    driftDuration: 8,
    driftDelay: -3,
    exitX: 560,
    exitY: -8,
    exitRotate: 3,
    exitDuration: 1.2,
    exitDelay: 0.02,
  },
  {
    side: "right",
    top: 92,
    offset: 28,
    width: 86,
    height: 48,
    opacity: 0.88,
    blur: 3.5,
    driftX: 10,
    driftDuration: 11,
    driftDelay: -8,
    exitX: 640,
    exitY: -12,
    exitRotate: 2,
    exitDuration: 1.3,
    exitDelay: 0.14,
  },
  // ── 큰 구름 추가 (양쪽 각 3개) — 화면을 더 빽빽하게 채우고, 느리게 나가며 리빌 뒤쪽을 담당
  {
    side: "left",
    top: 34,
    offset: 42,
    width: 150,
    height: 84,
    opacity: 0.93,
    blur: 2.5,
    driftX: 11,
    driftDuration: 10.5,
    driftDelay: -4,
    exitX: -700,
    exitY: -16,
    exitRotate: -3,
    exitDuration: 1.5,
    exitDelay: 0.16,
  },
  {
    side: "left",
    top: 74,
    offset: 12,
    width: 160,
    height: 88,
    opacity: 0.95,
    blur: 2.5,
    driftX: -12,
    driftDuration: 9.5,
    driftDelay: -6,
    exitX: -720,
    exitY: -18,
    exitRotate: -2,
    exitDuration: 1.55,
    exitDelay: 0.2,
  },
  {
    side: "left",
    top: 90,
    offset: 44,
    width: 140,
    height: 78,
    opacity: 0.92,
    blur: 3,
    driftX: 10,
    driftDuration: 11.5,
    driftDelay: -8,
    exitX: -680,
    exitY: -14,
    exitRotate: 2,
    exitDuration: 1.45,
    exitDelay: 0.18,
  },
  {
    side: "right",
    top: 32,
    offset: 40,
    width: 148,
    height: 84,
    opacity: 0.93,
    blur: 2.5,
    driftX: -11,
    driftDuration: 10,
    driftDelay: -5,
    exitX: 700,
    exitY: -14,
    exitRotate: 3,
    exitDuration: 1.5,
    exitDelay: 0.14,
  },
  {
    side: "right",
    top: 76,
    offset: 12,
    width: 158,
    height: 88,
    opacity: 0.94,
    blur: 2.5,
    driftX: 12,
    driftDuration: 9,
    driftDelay: -7,
    exitX: 720,
    exitY: -16,
    exitRotate: 2,
    exitDuration: 1.55,
    exitDelay: 0.22,
  },
  {
    side: "right",
    top: 88,
    offset: 46,
    width: 142,
    height: 78,
    opacity: 0.92,
    blur: 3,
    driftX: -10,
    driftDuration: 11,
    driftDelay: -9,
    exitX: 680,
    exitY: -14,
    exitRotate: -2,
    exitDuration: 1.45,
    exitDelay: 0.17,
  },
];

interface Props {
  /** 낮/밤 톤 — 밤이면 남색 안개/구름 */
  isNight: boolean;
  /** "찾는중" 로딩 표시 숨김 — 지도가 이미 로딩돼 있는 재진입 리빌에서 사용 */
  hideLoading?: boolean;
  /**
   * 재진입 리빌 톤 — 지도가 이미 그려져 있어 깜빡임 가림이 필요 없다:
   * ① 유지 시간을 1초 → 0.5초로 줄이고 ② 첫 렌더부터 불투명하게 그려
   *  마운트 페이드인 사이 지도가 비치는 것을 막는다
   */
  isReenter?: boolean;
}

/**
 * 맵 첫 진입 리빌 — 크고작은 구름과 안개가 화면을 덮고 있다가(로딩 표시 포함)
 * 로딩이 끝나면(parent가 언마운트) 구름이 중앙에 가까운 것부터 양쪽으로
 * 흩어지며 지도를 드러낸다. AnimatePresence 안에서 isShow 토글로 사용한다.
 */
function CloudReveal({ isNight, hideLoading, isReenter }: Props) {
  // 재진입 시엔 유지 시간을 0.5초로 — 첫 로딩(REVEAL_HOLD)보다 짧게
  const revealHold = isReenter ? REVEAL_HOLD_REENTER : REVEAL_HOLD;

  return (
    <motion.div
      className={cn("cloud-reveal", { night: isNight })}
      // 재진입 리빌은 페이드인 없이 첫 프레임부터 불투명 — 마운트 사이에
      // 지도가 비치는 걸 막는다. (첫 로딩은 페이드인으로 부드럽게 덮는다)
      initial={{ opacity: isReenter ? 1 : 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3 } }}
    >
      {/* 안개 베이스 — 불투명, 로딩중 지도를 완전히 가림. 갈라질 땐 서서히 걷힘.
          다크 테마 전환 깜빡임을 가리기 위해 revealHold만큼 늦게 시작 */}
      <motion.div
        className={cn("fog-base")}
        exit={{
          opacity: 0,
          transition: {
            duration: 1.2,
            delay: revealHold + 0.15,
            ease: "easeOut",
          },
        }}
      />

      {REVEAL_CLOUDS.map((cloud, index) => (
        <motion.div
          key={index}
          className={cn("cloud-move")}
          style={{
            top: `${cloud.top}%`,
            ...(cloud.side === "left"
              ? { left: `${cloud.offset}%` }
              : { right: `${cloud.offset}%` }),
            width: cloud.width,
            height: cloud.height,
          }}
          exit={{
            x: cloud.exitX,
            y: cloud.exitY,
            rotate: cloud.exitRotate,
            scale: 1.05,
            transition: {
              x: {
                duration: cloud.exitDuration,
                delay: revealHold + cloud.exitDelay,
                ease: [0.62, 0, 0.36, 1],
              },
              y: {
                duration: cloud.exitDuration,
                delay: revealHold + cloud.exitDelay,
                ease: "easeOut",
              },
              rotate: {
                duration: cloud.exitDuration,
                delay: revealHold + cloud.exitDelay,
                ease: "easeOut",
              },
              scale: {
                duration: cloud.exitDuration,
                delay: revealHold + cloud.exitDelay,
                ease: "easeOut",
              },
              // 이동이 거의 끝나는 마지막 구간에만 서서히 사라진다 —
              // 화면 밖으로 못 나간 구름이 하드컷되지 않게
              opacity: {
                duration: 0.4,
                delay: revealHold + cloud.exitDelay + cloud.exitDuration - 0.4,
              },
            },
          }}
        >
          {/* 드리프트(구름 몸체)와 이탈 모션(래퍼)을 분리 — CSS 애니메이션과
              framer transform이 같은 요소에서 충돌하지 않게 */}
          <div
            className={cn("cloud")}
            style={
              {
                opacity: cloud.opacity,
                filter: `blur(${cloud.blur}px)`,
                "--drift-x": `${cloud.driftX}px`,
                "--drift-duration": `${cloud.driftDuration}s`,
                "--drift-delay": `${cloud.driftDelay}s`,
              } as React.CSSProperties
            }
          />
        </motion.div>
      ))}

      {/* 재진입 리빌(지도가 이미 로딩돼 있을 때)은 로딩 표시 없이 바로 갈라진다 */}
      {!hideLoading && (
        <motion.div
          className={cn("loading")}
          initial={{ opacity: 0, y: -5, translateX: "-50%" }}
          animate={{ opacity: 1, y: 0, translateX: "-50%" }}
          exit={{ opacity: 0, y: -5, translateX: "-50%" }}
          transition={{ duration: 0.2 }}
        >
          <Loading text="찾는중..." />
        </motion.div>
      )}
    </motion.div>
  );
}

export default CloudReveal;
