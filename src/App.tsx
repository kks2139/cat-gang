import "maplibre-gl/dist/maplibre-gl.css";

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import Auth from "./components/Auth";
import ErrorBoundary, { RouteErrorFallback } from "./components/ErrorBoundary";
import NavigationBlocker from "./components/NavigationBlocker";
import ReactQueryProvider from "./components/ReactQueryProvider";
import ToastMessage from "./components/ToastMessage";
import Entry from "./pages/Entry";
import FindCat from "./pages/FindCat";
import Test from "./pages/Test";

const router = createBrowserRouter(
  [
    {
      path: "/",
      errorElement: <RouteErrorFallback />,
      element: (
        <>
          <NavigationBlocker />
          <Outlet />
        </>
      ),
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
          path: "find-cat",
          element: <FindCat />,
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
