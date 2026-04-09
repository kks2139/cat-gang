import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ReactQueryProvider from "./components/ReactQueryProvider";
import ToastMessage from "./components/ToastMessage";
import Entry from "./pages/Entry";
import FindCat from "./pages/FindCat";
import Test from "./pages/Test";

function App() {
  return (
    <BrowserRouter basename="/">
      <ReactQueryProvider>
        <Routes>
          <Route index element={<Entry />} />
          <Route path="/find-cat" element={<FindCat />} />
          <Route path="/test" element={<Test />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <ToastMessage />
      </ReactQueryProvider>
    </BrowserRouter>
  );
}

export default App;
