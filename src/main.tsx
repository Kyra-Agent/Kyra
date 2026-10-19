import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WalletProviderBoundary } from "./providers/WalletProviderBoundary";
import { consumeAuthCallbackSession } from "./services/supabaseAuthService";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import "./motion.css";
import "./route-loading.css";
import "./luxe.css";
import "./luxe-motion.css";
import "./luxe-v3.css";
import "./luxe-v4.css";

void consumeAuthCallbackSession();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProviderBoundary>
      <App />
    </WalletProviderBoundary>
  </React.StrictMode>,
);
