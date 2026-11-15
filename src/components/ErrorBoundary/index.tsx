import classNames from "classnames/bind";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import ImgCatMe from "@/assets/img/character/cat-me.png";
import Button from "@/components/Button";

import styles from "./index.module.scss";

const cn = classNames.bind(styles);

interface ErrorScreenProps {
  onRetry: () => void;
}

function ErrorScreen({ onRetry }: ErrorScreenProps) {
  return (
    <div className={cn("ErrorBoundary")}>
      <img className={cn("cat")} src={ImgCatMe} alt="" />

      <h1 className={cn("title")}>앗, 고양이가 실수했나 봐요</h1>
      <p className={cn("description")}>
        예상치 못한 문제가 생겼어요.
        <br />
        잠시 후 다시 시도해 주세요.
      </p>

      <div className={cn("actions")}>
        <Button color="primary" size="small" onClick={onRetry}>
          다시 시도
        </Button>
        <Button
          color="secondary"
          size="small"
          onClick={() => window.location.reload()}
        >
          새로고침
        </Button>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 라우터 바깥 트리(Provider, ToastMessage 등)의 렌더 에러를 잡는다.
 * 라우트 내부 에러는 react-router가 가로채므로 RouteErrorFallback을 errorElement로 사용.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <ErrorScreen onRetry={() => this.setState({ error: null })} />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/** 라우트 렌더 에러용 폴백 (createBrowserRouter의 errorElement에 사용) */
export function RouteErrorFallback() {
  const navigate = useNavigate();

  return <ErrorScreen onRetry={() => navigate("/")} />;
}
