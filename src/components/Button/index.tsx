import classNames from "classnames/bind";
import { type ButtonHTMLAttributes } from "react";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  size?: "small" | "regular" | "large";
  color?: "primary" | "secondary";
  radius?: number;
}

export default function Button({
  className,
  size = "regular",
  color = "primary",
  type = "button",
  radius,
  ...rest
}: Props) {
  return (
    <button
      style={radius ? { borderRadius: radius } : undefined}
      className={cn("Button", className, { [size]: true, [color]: true })}
      type={type}
      {...rest}
    ></button>
  );
}
