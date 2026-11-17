import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";

import Auth from "./components/Auth";
import ErrorBoundary, { RouteErrorFallback } from "./components/ErrorBoundary";
import NavigationBlocker from "./components/NavigationBlocker";
import ReactQueryProvider from "./components/ReactQueryProvider";
import ToastMessage from "./components/ToastMessage";
import Entry from "./pages/Entry";
import FindCat from "./pages/FindCat";
import Test from "./pages/Test";
import { useViewStore } from "./store/view";

/**
 * 웹뷰가 백그라운드 전환/장시간 대기 후 디코드된 이미지 비트맵을 메모리에서 버려
 * 화면 복귀 시 이미지가 깨져 보이는 현상(AIT 웹뷰) 대응 — 화면 복귀 시점에
 * 모든 img의 src를 재할당해 HTTP 캐시에서 재디코드하게 유도한다.
 * (네트워크 재요청 없음 — 동일 URL은 캐시로 서빙됨)
 */
function useImageRecovery() {
  useEffect(() => {
    const refreshImages = () => {
      document.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");

        if (!src) {
          return;
        }

        img.src = src;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshImages();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        refreshImages();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}

/**
 * 맵(/find-cat)은 첫 진입 이후 라우트를 벗어나도 언마운트하지 않고 숨긴다(keep-alive).
 * 지도 스타일/타일/마커 로드와 궤적 복원은 한 번이면 충분한데, 라우트 이동으로
 * 언마운트되면 첫 페이지를 갔다가 돌아올 때마다 전체를 다시 로딩하게 된다.
 */
function RootLayout() {
  const location = useLocation();
  const isFindCat = location.pathname.startsWith("/find-cat");
  const isFindCatCached = useViewStore((s) => s.isFindCatCached);
  const { setIsFindCatCached } = useViewStore((s) => s.actions);

  useEffect(() => {
    if (!isFindCat) {
      return;
    }

    // 스토어에 기록 — 이후 라우트를 벗어나도 FindCat를 언마운트하지 않는다
    setIsFindCatCached(true);

    // 숨김(display: none) 해제 직후 지도 캔버스 크기를 재계산한다
    // (MapLibre가 듣는 window resize 이벤트)
    window.dispatchEvent(new Event("resize"));
  }, [isFindCat, setIsFindCatCached]);

  return (
    <>
      <NavigationBlocker />
      {/* 보일 땐 display: contents — 래퍼가 레이아웃(100% 높이 체인)을 깨지 않게 */}
      <div
        style={{ display: isFindCat ? "contents" : "none" }}
        aria-hidden={!isFindCat}
      >
        {isFindCatCached && <FindCat />}
      </div>
      {!isFindCat && <Outlet />}
    </>
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      errorElement: <RouteErrorFallback />,
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: (
            <Auth>
              <Entry />
            </Auth>
          ),
        },
        {
          // 맵 화면은 RootLayout의 keep-alive 영역이 직접 렌더하므로 라우트는 빈 요소로 둔다
          // (이 경로가 * 폴백으로 흐르지 않게 막는 역할)
          path: "find-cat",
          element: null,
        },
        {
          path: "test",
          element: <Test />,
        },
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ],
  {
    basename: "/",
  },
);

function App() {
  useImageRecovery();

  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <RouterProvider router={router} />
        <ToastMessage />
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}

export default App;
