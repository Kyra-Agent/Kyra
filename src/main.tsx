import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { consumeAuthCallbackSession } from "./services/supabaseAuthService";
import "./styles.css";

void consumeAuthCallbackSession();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
