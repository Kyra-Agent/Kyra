import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import {
  clearStoredAuthSession,
  ensureFreshAuthSession,
  getCurrentAuthUser,
  isPasswordRecoveryActive,
  requestPasswordReset,
  signInWithPassword,
  signOutAuthSession,
  signUpWithPassword,
  updateAccountPassword,
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
  const [authMode, setAuthMode] = useState<"signup" | "signin" | "reset">("signup");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [busyAction, setBusyAction] = useState<
    "signin" | "signup" | "reset" | "password" | "validate" | "signout" | null
  >(null);
  // Opens by itself when the session came from a password reset link.
  const [changingPassword, setChangingPassword] = useState(() => isPasswordRecoveryActive());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // The reset link can finish signing in after this panel mounted.
    if (session && isPasswordRecoveryActive()) {
      setChangingPassword(true);
    }
  }, [session]);

  const busy = busyAction !== null;
  const statusTone = getStatusTone(status);
  const isSignUpMode = authMode === "signup";
  const isResetMode = authMode === "reset";
  const emailReady = email.trim().length > 3 && email.includes("@");
  // New accounts need 8 characters; existing accounts may still sign in
  // with the older 6-character minimum.
  const minPasswordLength = isSignUpMode ? 8 : 6;
  const passwordReady = password.length >= minPasswordLength;
  const canSubmit = isResetMode
    ? emailReady && !busy
    : emailReady && passwordReady && !busy;
  const newPasswordReady = newPassword.length >= 8 && newPassword === confirmPassword;

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

  async function handleResetRequest() {
    setBusyAction("reset");
    const result = await requestPasswordReset(email.trim());
    applyResult(result);
    setBusyAction(null);
  }

  async function handlePasswordChange() {
    if (!session || !newPasswordReady || busy) {
      return;
    }

    setBusyAction("password");
    const result = await updateAccountPassword(session, newPassword);
    applyResult(result);

    if (result.ok) {
      setChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    }

    setBusyAction(null);
  }

  async function handlePrimarySubmit() {
    if (!canSubmit) {
      return;
    }

    if (isResetMode) {
      await handleResetRequest();
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
    setChangingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
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
      ) : null}

      {session && changingPassword ? (
        <form
          className="auth-form-grid"
          id="kyra-account-password-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePasswordChange();
          }}
        >
          <label className="field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              disabled={busy}
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              value={newPassword}
            />
          </label>
          <label className="field">
            <span>Repeat new password</span>
            <input
              autoComplete="new-password"
              disabled={busy}
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Type it again"
              type="password"
              value={confirmPassword}
            />
            <small className="auth-field-hint">
              {newPasswordReady
                ? "Passwords match."
                : confirmPassword && newPassword !== confirmPassword
                ? "The two passwords do not match yet."
                : "Use at least 8 characters. Never reuse wallet or seed-phrase passwords."}
            </small>
          </label>
        </form>
      ) : null}

      {session ? null : (
        <>
          <div className="auth-mode-card">
            <strong>
              {isResetMode
                ? "Reset your password"
                : isSignUpMode
                ? "Create your Kyra workspace"
                : "Sign in to your workspace"}
            </strong>
            <p>
              {isResetMode
                ? "Enter your account email. We'll send a link that signs you in so you can choose a new password."
                : isSignUpMode
                ? `New users start here. Create a private workspace to save agents, dashboard records, quota, and public routes. ${currentWalletDisplayName} connection stays separate and always requires an explicit user action.`
                : "Returning users sign in here to reopen saved agents, public routes, approval queues, and private dashboard controls."}
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

          <form
            className="auth-form-grid"
            id="kyra-account-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePrimarySubmit();
            }}
          >
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
            {isResetMode ? null : (
            <label className="field">
              <span>Password</span>
              <input
                autoComplete={isSignUpMode ? "new-password" : "current-password"}
                disabled={busy}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignUpMode ? "Create at least 8 characters" : "Enter your password"}
                type="password"
                value={password}
              />
              <small className="auth-field-hint">
                {passwordReady ? "Password is ready for this account step." : `Use at least ${minPasswordLength} characters. Never reuse wallet or seed-phrase passwords.`}
              </small>
              {isSignUpMode ? null : (
                <button
                  className="auth-forgot-link"
                  disabled={busy}
                  onClick={() => setAuthMode("reset")}
                  type="button"
                >
                  Forgot password?
                </button>
              )}
            </label>
            )}
          </form>
        </>
      )}

      <div className="auth-actions">
        {session && changingPassword ? (
          <>
            <button
              className="button button-primary button-small auth-primary-action"
              disabled={!newPasswordReady || busy}
              form="kyra-account-password-form"
              type="submit"
            >
              <KeyRound size={15} />
              {busyAction === "password" ? "Saving..." : "Save new password"}
            </button>
            <button
              className="button button-ghost button-small"
              disabled={busy}
              onClick={() => {
                setChangingPassword(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : session ? (
          <>
            <button
              className="button button-ghost button-small"
              disabled={busy}
              onClick={() => setChangingPassword(true)}
              type="button"
            >
              <KeyRound size={15} />
              Change password
            </button>
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
              form="kyra-account-auth-form"
              type="submit"
            >
              {isSignUpMode ? <UserRound size={15} /> : <CheckCircle2 size={15} />}
              {busyAction === "signup"
                ? "Creating account..."
                : busyAction === "signin"
                ? "Signing in..."
                : busyAction === "reset"
                ? "Sending..."
                : isResetMode
                ? "Send reset link"
                : isSignUpMode
                ? "Create account"
                : "Sign in"}
            </button>
            <button
              className="button button-ghost button-small"
              disabled={busy}
              onClick={() => setAuthMode(isSignUpMode || isResetMode ? "signin" : "signup")}
              type="button"
            >
              {isResetMode
                ? "Back to sign in"
                : isSignUpMode
                ? "Switch to sign in"
                : "Switch to create account"}
            </button>
          </>
        )}
      </div>

      <div className="auth-safety-line">
        <span>Email account only</span>
        <span>Wallet connection is separate</span>
        <span>Wallet confirmation required</span>
        <span>Account-scoped agent records</span>
      </div>
    </section>
  );
}
