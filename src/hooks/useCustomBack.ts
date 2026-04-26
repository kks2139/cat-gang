import { graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect } from "react";

export const useCustomBack = (enabled: boolean, callback: () => void) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscription = graniteEvent.addEventListener("backEvent", {
      onEvent: () => {
        callback();
      },
      onError: (error) => {
        alert(`에러가 발생했어요: ${error}`);
      },
    });

    return unsubscription;
  }, [callback, enabled]);
};
