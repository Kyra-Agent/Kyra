import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WalletProviderBoundary } from "./providers/WalletProviderBoundary";
import { consumeAuthCallbackSession } from "./services/supabaseAuthService";
import "./styles.css";

void consumeAuthCallbackSession();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProviderBoundary>
      <App />
    </WalletProviderBoundary>
  </React.StrictMode>,
);
