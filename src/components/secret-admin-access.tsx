import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, X } from "lucide-react";
import {
  getOpsPassphrase,
  isValidOpsPassphrase,
  OPS_ROUTE,
  unlockOpsConsole,
} from "../lib/opsAccess";

export function PassphrasePrompt({
  onSuccess,
  onCancel,
  embedded = false,
}: {
  onSuccess: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidOpsPassphrase(passphrase)) {
      setError(
        getOpsPassphrase()
          ? "That passphrase is not correct."
          : "Set VITE_ADMIN_SECRET_KEY to enable console access.",
      );
      return;
    }

    setError("");
    unlockOpsConsole();
    onSuccess();
  }

  return (
    <section
      className={`ops-gate-card${embedded ? " is-embedded" : ""}`}
      role="dialog"
      aria-modal={embedded}
      aria-labelledby="ops-access-title"
    >
      {onCancel && (
        <button
          className="ops-icon-button ops-gate-close"
          type="button"
          onClick={onCancel}
          aria-label="Close access prompt"
        >
          <X size={18} />
        </button>
      )}
      <div className="ops-gate-mark">
        <KeyRound size={20} />
      </div>
      <p className="ops-eyebrow">PRIVATE CONSOLE</p>
      <h1 id="ops-access-title">Secret access</h1>
      <p className="ops-muted">
        Enter the local passphrase to open the KINETIK operations preview.
      </p>
      <form className="ops-gate-form" onSubmit={submit}>
        <label htmlFor="ops-passphrase">Passphrase</label>
        <input
          id="ops-passphrase"
          autoComplete="current-password"
          autoFocus
          type="password"
          value={passphrase}
          onChange={(event) => {
            setPassphrase(event.target.value);
            setError("");
          }}
          placeholder="Enter passphrase"
          required
        />
        {error && (
          <p className="ops-error" role="alert">
            {error}
          </p>
        )}
        <button className="ops-primary-button" type="submit">
          Unlock console
        </button>
      </form>
      <p className="ops-gate-footnote">Mock data only · no Supabase connection</p>
    </section>
  );
}

export function SecretAdminShortcut() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="ops-access-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <PassphrasePrompt
        embedded
        onCancel={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          void navigate({ to: OPS_ROUTE });
        }}
      />
    </div>
  );
}
