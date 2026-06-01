import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import {
  clearStoredAuthSession,
  ensureFreshAuthSession,
  getCurrentAuthUser,
  signInWithPassword,
  signOutAuthSession,
  signUpWithPassword,
  type KyraAuthResult,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "../services/supabaseAuthService";

interface AuthSessionPanelProps {
  session: KyraAuthSession | null;
  status: KyraAuthStatus;
  message: string;
  onSessionChange: (session: KyraAuthSession | null, status: KyraAuthStatus, message: string) => void;
}

function formatSessionExpiry(session: KyraAuthSession) {
  const seconds = session.expiresAt - Math.floor(Date.now() / 1000);

  if (seconds <= 0) {
    return "expired";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}m left`;
}

function shortenUserId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function getStatusTone(status: KyraAuthStatus) {
  if (status === "signed-in") {
    return "ready";
  }

  if (status === "error" || status === "confirmation-required") {
    return "error";
  }

  return "standby";
}

export function AuthSessionPanel({
  session,
  status,
  message,
  onSessionChange,
}: AuthSessionPanelProps) {
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [busyAction, setBusyAction] = useState<"signin" | "signup" | "validate" | "signout" | null>(null);

  const busy = busyAction !== null;
  const statusTone = getStatusTone(status);

  function applyResult(result: KyraAuthResult) {
    onSessionChange(result.session, result.status, result.message);
  }

  async function handleSignIn() {
    setBusyAction("signin");
    const result = await signInWithPassword(email.trim(), password);
    applyResult(result);
    setBusyAction(null);
  }

  async function handleSignUp() {
    setBusyAction("signup");
    const result = await signUpWithPassword(email.trim(), password);
    applyResult(result);
    setBusyAction(null);
  }

  async function handleValidate() {
    if (!session) {
      return;
    }

    setBusyAction("validate");
    const freshResult = await ensureFreshAuthSession(session);

    if (!freshResult.session) {
      applyResult(freshResult);
      setBusyAction(null);
      return;
    }

    const result = await getCurrentAuthUser(freshResult.session);
    applyResult(result);
    setBusyAction(null);
  }

  async function handleSignOut() {
    setBusyAction("signout");
    const result = await signOutAuthSession(session);
    clearStoredAuthSession();
    applyResult(result);
    setBusyAction(null);
  }

  return (
    <section className="dashboard-panel auth-session-panel" id="auth">
      <div className="panel-title">
        <span>account.session</span>
        <span>{session ? "session active" : "session required"}</span>
      </div>

      <div className="auth-session-summary">
        <span className={`readiness-chip readiness-${statusTone}`}>
          {busy ? <Loader2 className="spin-icon" size={14} /> : <KeyRound size={14} />}
          {status.replace(/-/g, " ")}
        </span>
        <p>{message}</p>
      </div>

      {session ? (
        <div className="auth-session-card">
          <span className="auth-avatar">
            <UserRound size={18} />
          </span>
          <div>
            <strong>{session.user.email ?? "Signed-in user"}</strong>
            <small>{shortenUserId(session.user.id)}</small>
          </div>
          <em>{formatSessionExpiry(session)}</em>
        </div>
      ) : (
        <div className="auth-form-grid">
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="founder@kyra.agent"
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              disabled={busy}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              type="password"
              value={password}
            />
          </label>
        </div>
      )}

      <div className="auth-actions">
        {session ? (
          <>
            <button className="button button-ghost button-small" disabled={busy} onClick={handleValidate} type="button">
              <ShieldCheck size={15} />
              {busyAction === "validate" ? "Checking..." : "Validate"}
            </button>
            <button className="button button-ghost button-small" disabled={busy} onClick={handleSignOut} type="button">
              <LogOut size={15} />
              Sign out
            </button>
          </>
        ) : (
          <>
            <button
              className="button button-primary button-small"
              disabled={busy || !email || password.length < 6}
              onClick={handleSignIn}
              type="button"
            >
              <CheckCircle2 size={15} />
              {busyAction === "signin" ? "Signing in..." : "Sign in"}
            </button>
            <button
              className="button button-ghost button-small"
              disabled={busy || !email || password.length < 6}
              onClick={handleSignUp}
              type="button"
            >
              <UserRound size={15} />
              {busyAction === "signup" ? "Creating..." : "Create account"}
            </button>
          </>
        )}
      </div>

      <div className="auth-safety-line">
        <span>No wallet access</span>
        <span>Account-scoped demo records</span>
        <span>Session refresh supported</span>
      </div>
    </section>
  );
}
