import classNames from "classnames/bind";
import { useEffect, useState } from "react";

import { useViewStore } from "@/store/view";

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "..";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

export default function ZoomButton() {
  const map = useViewStore((s) => s.map);
  const [zoomState, setZoomState] = useState({ isMax: false, isMin: false });

  useEffect(() => {
    if (!map) return;

    const updateZoomStatus = () => {
      const current = map.getZoom();

      setZoomState({
        isMax: current >= MAX_ZOOM_LEVEL,
        isMin: current <= MIN_ZOOM_LEVEL,
      });
    };

    // 지도의 줌이 끝날 때마다 상태 체크
    map.on("zoomend", updateZoomStatus);

    // 초기 상태 설정
    updateZoomStatus();

    return () => {
      map.off("zoomend", updateZoomStatus);
    };
  }, [map]);

  return (
    <div className={cn("ZoomButton")}>
      <button
        type="button"
        disabled={zoomState.isMax}
        onClick={() => {
          map?.zoomIn();
        }}
      >
        +
      </button>
      <button
        type="button"
        disabled={zoomState.isMin}
        onClick={() => {
          map?.zoomOut();
        }}
      >
        -
      </button>
    </div>
  );
}
