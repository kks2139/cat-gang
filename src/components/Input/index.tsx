import classNames from "classnames/bind";
import type { InputHTMLAttributes } from "react";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  isError?: boolean;
  errorMessage?: string;
}

export default function Input({
  className,
  isError,
  errorMessage,
  ...rest
}: Props) {
  return (
    <div className={cn("Input-wrapper", className)}>
      <div className={cn("Input", { error: isError })}>
        <input className={cn("field")} {...rest} />
      </div>
      {isError && errorMessage && (
        <p className={cn("error-message")}>{errorMessage}</p>
      )}
    </div>
  );
}
