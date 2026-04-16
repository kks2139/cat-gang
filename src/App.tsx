import "leaflet/dist/leaflet.css";

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

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
      element: (
        <>
          <NavigationBlocker />
          <Outlet />
        </>
      ),
      children: [
        {
          index: true,
          element: <Entry />,
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
    <ReactQueryProvider>
      <RouterProvider router={router} />
      <ToastMessage />
    </ReactQueryProvider>
  );
}

export default App;
