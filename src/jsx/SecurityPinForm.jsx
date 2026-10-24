import { useState } from "react";
import { useAuth } from "./useAunth";
import {
  SECURITY_QUESTIONS,
  normalizeAnswer,
  validPin,
} from "../js/securityConfig.mjs";

export default function SecurityPinForm() {
  return <StudentPinForm />;
}

function StudentPinForm() {
  const { user, pinStatus, completePin, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [questionId, setQuestionId] = useState(SECURITY_QUESTIONS[0].id);
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setup = Boolean(pinStatus?.needsSetup);
  const busy = loading || Boolean(pinStatus?.locking);
  const question = SECURITY_QUESTIONS.find(
    (item) => item.id === pinStatus?.questionId,
  );

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (busy) return;
    if (!validPin(pin)) {
      setError("Enter exactly 6 digits for your PIN.");
      return;
    }
    if ((setup || recovering) && pin !== confirmation) {
      setError("The PINs do not match.");
      return;
    }
    if ((setup || recovering) && normalizeAnswer(answer).length < 3) {
      setError("Enter a security answer of at least 3 characters.");
      return;
    }
    setLoading(true);
    try {
      await completePin(
        setup ? "setup-pin" : recovering ? "reset-pin" : "verify-pin",
        { pin, questionId, answer, password },
      );
      if (recovering) {
        setRecovering(false);
        setNotice("PIN reset. Enter your new PIN to unlock the portal.");
      }
      setPin("");
      setConfirmation("");
      setAnswer("");
      setPassword("");
    } catch (error) {
      setError(error.message);
      setPin("");
      setConfirmation("");
      setAnswer("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-view">
      <div className="login-card security-pin-card">
        <img
          className="brand-mark-image"
          src={`${import.meta.env.BASE_URL}riteway-logo.png`}
          alt="Riteway Driving School"
        />
        <p className="eyebrow">RITEWAY DRIVING SCHOOL</p>
        <h1>
          {setup
            ? "Create your security PIN"
            : recovering
              ? "Reset your PIN"
              : "Students module locked"}
        </h1>
        <p className="muted">
          {setup
            ? "Choose a private 6-digit PIN and a security question to protect your account."
            : recovering
              ? "Verify your password and security answer to create a new PIN."
              : "Enter your 6-digit administrator PIN to view student information. This module locks after 5 minutes of inactivity."}
        </p>
        <p className="security-account">{user?.email}</p>
        <form onSubmit={submit}>
          {setup && (
            <label>
              Security question
              <select
                value={questionId}
                disabled={loading}
                onChange={(event) => setQuestionId(event.target.value)}
              >
                {SECURITY_QUESTIONS.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {recovering && (
            <label>
              Your password
              <input
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          {(setup || recovering) && (
            <label>
              {recovering
                ? question?.label || "Your security answer"
                : "Security answer"}
              <input
                type="password"
                autoComplete="off"
                minLength={3}
                maxLength={200}
                required
                disabled={loading}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
              />
            </label>
          )}
          <label>
            {setup || recovering ? "New 6-digit PIN" : "Security PIN"}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="off"
              autoFocus={!recovering && !setup}
              required
              disabled={loading}
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>
          {(setup || recovering) && (
            <label>
              Confirm PIN
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="off"
                required
                disabled={loading}
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="security-notice" role="status">
              {notice}
            </p>
          )}
          <button type="submit" className="button primary full" disabled={busy}>
            {pinStatus?.locking
              ? "Locking portal…"
              : loading
                ? "Verifying…"
                : setup
                  ? "Save PIN and continue"
                  : recovering
                    ? "Reset PIN"
                    : "Unlock portal"}
          </button>
        </form>
        <div className="login-links">
          {!setup && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRecovering((value) => !value);
                setPin("");
                setConfirmation("");
                setAnswer("");
                setPassword("");
                setError("");
                setNotice("");
              }}
            >
              {recovering ? "Back to unlock" : "Forgot PIN?"}
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={loading}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
