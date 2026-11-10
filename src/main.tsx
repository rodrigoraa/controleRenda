import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import Application from "./Application";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { UIProvider } from "./ui/theme";
import "./styles.css";
import "./mobile.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UIProvider>
      <Application />
    </UIProvider>
  </React.StrictMode>,
);
