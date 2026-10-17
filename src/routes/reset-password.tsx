import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { supabase } from "../services/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && event === "PASSWORD_RECOVERY" && session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;

      setHasSession(Boolean(data.session));
      setCheckingSession(false);

      if (sessionError) {
        setError(sessionError.message);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setUpdating(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setUpdated(true);
  }

  return (
    <main className="password-reset-page">
      <style>{`
        .password-reset-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: radial-gradient(circle at 50% 40%, #161616 0, #050505 42%, #000 75%);
          color: #f5f5f5;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }

        .password-reset-card {
          width: min(430px, 100%);
          padding: 42px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 20px;
          background: rgba(18,18,18,.88);
          box-shadow: 0 30px 100px rgba(0,0,0,.6);
        }

        .password-reset-brand {
          font-size: 24px;
          font-weight: 700;
        }

        .password-reset-card h1 {
          margin: 38px 0 8px;
          font-size: 30px;
        }

        .password-reset-description {
          margin: 0 0 28px;
          color: #999;
          font-size: 14px;
          line-height: 1.5;
        }

        .password-reset-field {
          display: block;
          margin: 0 0 18px;
          color: #aaa;
          font-size: 13px;
        }

        .password-reset-field input {
          display: block;
          width: 100%;
          height: 48px;
          margin-top: 8px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          outline: none;
          background: rgba(255,255,255,.04);
          color: white;
          font: inherit;
        }

        .password-reset-field input:focus {
          border-color: rgba(255,255,255,.35);
        }

        .password-reset-button {
          width: 100%;
          min-height: 48px;
          border: 0;
          border-radius: 10px;
          background: white;
          color: #000;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }

        .password-reset-button:disabled {
          cursor: wait;
          opacity: .65;
        }

        .password-reset-error {
          margin: -2px 0 16px;
          color: #ff9b9b;
          font-size: 13px;
        }

        .password-reset-success {
          color: #b9e6c5;
          font-size: 14px;
          line-height: 1.5;
        }

        .password-reset-link {
          display: inline-block;
          margin-top: 18px;
          color: #fff;
          font-size: 14px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 480px) {
          .password-reset-card {
            padding: 30px 24px;
          }
        }
      `}</style>

      <section className="password-reset-card" aria-live="polite">
        <div className="password-reset-brand">Singularity</div>

        <h1>{updated ? "Password updated" : "Create a new password"}</h1>

        {checkingSession ? (
          <p className="password-reset-description" role="status">
            Verifying your recovery link…
          </p>
        ) : updated ? (
          <>
            <p className="password-reset-success">
              Your password has been changed. Continue to your workspace.
            </p>
            <Link className="password-reset-link" to="/">
              Continue to Singularity
            </Link>
          </>
        ) : hasSession ? (
          <>
            <p className="password-reset-description">Choose a new password for your account.</p>

            <form onSubmit={updatePassword}>
              <label className="password-reset-field">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <label className="password-reset-field">
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>

              {error && (
                <p className="password-reset-error" role="alert">
                  {error}
                </p>
              )}

              <button className="password-reset-button" type="submit" disabled={updating}>
                {updating ? "Updating password…" : "Update password"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="password-reset-description">
              This recovery link is invalid or expired. Request a new password reset email and open
              its link.
            </p>
            {error && (
              <p className="password-reset-error" role="alert">
                {error}
              </p>
            )}
            <Link className="password-reset-link" to="/">
              Return to login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
