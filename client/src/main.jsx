import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import History from "./history.jsx";

// ✅ Use BrowserRouter locally, HashRouter for GitHub Pages
const RouterComponent =
  window.location.hostname === "localhost" ? BrowserRouter : HashRouter;

function Root() {
  const Router = RouterComponent;
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
