import classNames from "classnames/bind";
import { type ButtonHTMLAttributes } from "react";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  size?: "small" | "regular" | "large";
}

export default function Button({
  className,
  size = "regular",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      className={cn("Button", className, { [size]: true })}
      type={type}
      {...rest}
    ></button>
  );
}
