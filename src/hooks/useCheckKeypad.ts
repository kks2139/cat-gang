import { useEffect, useState } from "react";

export const useCheckKeypad = () => {
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const height = window.visualViewport?.height || 0;

      if (height < window.innerHeight) {
        setIsKeypadOpen(true);
      } else {
        setIsKeypadOpen(false);
      }
    };

    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  return { isKeypadOpen };
};
