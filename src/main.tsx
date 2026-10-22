import React, { lazy, Suspense } from "react";
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

const TelegramMiniApp = lazy(() =>
  import("./pages/TelegramMiniApp").then((module) => ({
    default: module.TelegramMiniApp,
  }))
);

// /tg is the Telegram Mini App: it opens inside Telegram from an agent's bot
// button and has none of the site's chrome or account session.
const isTelegramMiniApp = /^\/tg\/?$/u.test(window.location.pathname);

if (!isTelegramMiniApp) void consumeAuthCallbackSession();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProviderBoundary>
      {isTelegramMiniApp
        ? (
          <Suspense fallback={null}>
            <TelegramMiniApp />
          </Suspense>
        )
        : <App />}
    </WalletProviderBoundary>
  </React.StrictMode>,
);
