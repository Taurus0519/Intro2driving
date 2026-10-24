import { useEffect, useState } from "react";
import { SECURITY_QUESTIONS, validPin } from "../js/securityConfig.mjs";
import { securityRequest } from "./securityApi";

export default function StudentPinReset({ studentId }) {
  const [open, setOpen] = useState(false);
  const [questionId, setQuestionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const question = SECURITY_QUESTIONS.find((item) => item.id === questionId);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setQuestionId(null);
    securityRequest("student-recovery-info", { studentId })
      .then((result) => {
        if (active) setQuestionId(result.questionId);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, studentId]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validPin(pin) || pin !== confirm) {
      setError("Enter matching 6-digit PINs.");
      return;
    }
    setLoading(true);
    try {
      const result = await securityRequest("admin-reset-pin", {
        studentId,
        password,
        answer,
        pin,
      });
      setNotice(result.message);
      setOpen(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      setPassword("");
      setAnswer("");
      setPin("");
      setConfirm("");
    }
  }
  return (
    <section className="panel student-pin-reset">
      <h3>Student PIN security</h3>
      <p>
        Reset a forgotten PIN after verifying the student's security answer. A
        reset locks all of their portal sessions.
      </p>
      <button
        type="button"
        className="button small-button"
        disabled={loading}
        onClick={() => {
          setOpen((value) => !value);
          setPassword("");
          setAnswer("");
          setPin("");
          setConfirm("");
          setError("");
          setNotice("");
        }}
      >
        {open ? "Cancel PIN reset" : "Reset student PIN"}
      </button>
      {notice && (
        <p className="security-notice" role="status">
          {notice}
        </p>
      )}
      {open &&
        (loading && !question ? (
          <p role="status">Loading security question…</p>
        ) : question ? (
          <form onSubmit={submit}>
            <label>
              Your administrator password
              <input
                type="password"
                required
                autoComplete="current-password"
                disabled={loading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              {question.label}
              <input
                type="password"
                required
                minLength={3}
                maxLength={200}
                autoComplete="off"
                disabled={loading}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
              />
            </label>
            <label>
              New student PIN
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="off"
                disabled={loading}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <label>
              Confirm new PIN
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="off"
                disabled={loading}
                value={confirm}
                onChange={(event) =>
                  setConfirm(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? "Resetting…" : "Verify answer and reset PIN"}
            </button>
          </form>
        ) : (
          !error && (
            <p>The student has not set up a PIN and security question yet.</p>
          )
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
