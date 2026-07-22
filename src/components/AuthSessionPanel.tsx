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
import { currentWalletDisplayName } from "../config/productChains";

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
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [busyAction, setBusyAction] = useState<"signin" | "signup" | "validate" | "signout" | null>(null);

  const busy = busyAction !== null;
  const statusTone = getStatusTone(status);
  const isSignUpMode = authMode === "signup";
  const emailReady = email.trim().length > 3 && email.includes("@");
  const passwordReady = password.length >= 6;
  const canSubmit = emailReady && passwordReady && !busy;

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

  async function handlePrimarySubmit() {
    if (!canSubmit) {
      return;
    }

    if (isSignUpMode) {
      await handleSignUp();
      return;
    }

    await handleSignIn();
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
    setEmail("");
    setPassword("");
    setAuthMode("signup");
    applyResult(result);
    setBusyAction(null);
  }

  return (
    <section className="dashboard-panel auth-session-panel" id="auth">
      <div className="panel-title">
        <span>Account session</span>
        <span>{session ? "session active" : isSignUpMode ? "create workspace" : "returning user"}</span>
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
            <strong>Signed-in account</strong>
            <small>Account session active</small>
          </div>
          <em>{formatSessionExpiry(session)}</em>
        </div>
      ) : (
        <>
          <div className="auth-mode-card">
            <strong>{isSignUpMode ? "Create your Kyra workspace" : "Sign in to your workspace"}</strong>
            <p>
              {isSignUpMode
                ? `New users start here. Create a private workspace to save agents, dashboard records, quota, and public routes. ${currentWalletDisplayName} connection stays separate and always requires owner action.`
                : "Returning users sign in here to reopen saved agents, public routes, approval queues, and owner dashboard controls."}
            </p>
            <div className="auth-mode-switch" role="tablist" aria-label="Account access mode">
              <button
                aria-selected={isSignUpMode}
                className={isSignUpMode ? "is-active" : undefined}
                disabled={busy}
                onClick={() => setAuthMode("signup")}
                role="tab"
                type="button"
              >
                Create account
              </button>
              <button
                aria-selected={!isSignUpMode}
                className={!isSignUpMode ? "is-active" : undefined}
                disabled={busy}
                onClick={() => setAuthMode("signin")}
                role="tab"
                type="button"
              >
                Sign in
              </button>
            </div>
          </div>

          <div className="auth-choice-summary" aria-label="Account path summary">
            <div className={isSignUpMode ? "is-active" : undefined}>
              <strong>Create account</strong>
              <span>For new Kyra users who need a private workspace.</span>
            </div>
            <div className={!isSignUpMode ? "is-active" : undefined}>
              <strong>Sign in</strong>
              <span>For returning users with an existing email and password.</span>
            </div>
          </div>

          <div className="auth-form-grid">
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isSignUpMode ? "new-user@example.com" : "your-account@example.com"}
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete={isSignUpMode ? "new-password" : "current-password"}
                disabled={busy}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handlePrimarySubmit();
                  }
                }}
                placeholder={isSignUpMode ? "Create at least 6 characters" : "Enter your password"}
                type="password"
                value={password}
              />
              <small className="auth-field-hint">
                {passwordReady ? "Password is ready for this account step." : "Use at least 6 characters. Never reuse wallet or seed-phrase passwords."}
              </small>
            </label>
          </div>
        </>
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
              className="button button-primary button-small auth-primary-action"
              disabled={!canSubmit}
              onClick={handlePrimarySubmit}
              type="button"
            >
              {isSignUpMode ? <UserRound size={15} /> : <CheckCircle2 size={15} />}
              {busyAction === "signup"
                ? "Creating account..."
                : busyAction === "signin"
                ? "Signing in..."
                : isSignUpMode
                ? "Create account"
                : "Sign in"}
            </button>
            <button
              className="button button-ghost button-small"
              disabled={busy}
              onClick={() => setAuthMode(isSignUpMode ? "signin" : "signup")}
              type="button"
            >
              {isSignUpMode ? "Switch to sign in" : "Switch to create account"}
            </button>
          </>
        )}
      </div>

      <div className="auth-safety-line">
        <span>Email account only</span>
        <span>No wallet access</span>
        <span>No transaction signing</span>
        <span>Account-scoped agent records</span>
      </div>
    </section>
  );
}
