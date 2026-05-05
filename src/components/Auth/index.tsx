import classNames from "classnames/bind";
import { useEffect, useRef, useState } from "react";

import { useAuthMutation } from "@/queries/useAuthMutation";

import Loading from "../Loading";
import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props {
  children?: React.ReactNode;
}

export default function Auth({ children }: Props) {
  const { mutateAsync: setAuth } = useAuthMutation();

  const [isLoading, setIsLoading] = useState(true);

  const isInitialized = useRef(false);

  useEffect(() => {
    (async () => {
      if (isInitialized.current) {
        return;
      }

      isInitialized.current = true;

      // const isOk = await setAuth();

      setIsLoading(false);
      // if (true) {
      // }
    })();
  }, [setAuth]);

  if (isLoading) {
    return (
      <div className={cn("Auth")}>
        <div className={cn("wrapper")}>
          <Loading noBackground />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
