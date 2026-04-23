import { useCallback, useEffect, useRef, useState } from "react";

import { getNightTime } from "@/utils/helper";

export const useDayAndNight = (useInterval = true) => {
  const [isNight, setIsNight] = useState(false);
  const [hours, setHours] = useState(0);
  const timer = useRef(0);

  const calcNight = useCallback(() => {
    const { isNightTime, hours } = getNightTime(new Date());
    setIsNight(isNightTime);
    setHours(hours);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    calcNight();

    if (useInterval) {
      timer.current = setInterval(() => {
        calcNight();
      }, 3000);
    }

    return () => clearInterval(timer.current);
  }, [calcNight, useInterval]);

  return { isNight, hours };
};
