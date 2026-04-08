import { BrowserRouter, Route, Routes } from "react-router-dom";

import ReactQueryProvider from "./components/ReactQueryProvider";
import ToastMessage from "./components/ToastMessage";
import Entry from "./pages/Entry";
import FindCat from "./pages/FindCat";

function App() {
  return (
    <BrowserRouter basename="/">
      <ReactQueryProvider>
        <Routes>
          <Route index element={<Entry />} />
          <Route path="/find-cat" element={<FindCat />} />
        </Routes>

        <ToastMessage />
      </ReactQueryProvider>
    </BrowserRouter>
  );
}

export default App;
