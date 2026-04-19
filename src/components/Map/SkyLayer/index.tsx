import classNames from "classnames/bind";
import { useRef, useState } from "react";
import { Pane, useMapEvents } from "react-leaflet";

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "..";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

function CloudLayer() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cloudScale, setCloudScale] = useState(
    (MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL) * 0.5 + 0.5,
  );

  const cloudRef = useRef<HTMLDivElement>(null);

  const calcCloudPosition = () => {
    const center = map.getCenter();
    // 위도/경도를 픽셀 좌표로 변환하여 움직임의 기준점으로 삼습니다.
    const point = map.latLngToLayerPoint(center);

    // 원근감 계수 (0.1 ~ 0.5 사이에서 조절하세요)
    // 값이 작을수록 구름이 더 멀리 있는 것처럼 느껴집니다.
    const speed = 0.2;

    console.log(point);

    setOffset({
      x: point.x * speed,
      y: point.y * speed,
    });
  };

  // 1. 지도의 움직임을 감지하는 이벤트 리스너
  const map = useMapEvents({
    move: () => {
      calcCloudPosition();
    },
    zoomanim: (e) => {
      const zoom = e.zoom;
      const scale = MAX_ZOOM_LEVEL % zoom;
      const maxScale = MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL;

      const res = (maxScale - scale) * 0.5 + 0.5;

      setCloudScale(res);
    },
  });

  // 2. transform을 통해 구름의 위치를 실시간으로 조정
  const cloudStyle = {
    transform: `scale(${cloudScale}) translate3d(${-offset.x}px, ${-offset.y}px, 0)`,
  } as React.CSSProperties;

  return (
    <Pane className={cn("CloudLayer")} name="cloudPane" style={{ zIndex: 701 }}>
      <div ref={cloudRef} className={cn("cloud")} style={cloudStyle}></div>
    </Pane>
  );
}

export default function SkyLayer() {
  return (
    <>
      <CloudLayer />
    </>
  );
}
