import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { checkMeetingAccess, getDiscoveryCallTimer } from "../lib/meeting.functions";
import "./get-agent.css";

export const Route = createFileRoute("/get-agent")({
  validateSearch: (search: Record<string, unknown>) => ({
    callId: typeof search["callId"] === "string" ? search["callId"] : "",
    demo: search["demo"] === true || search["demo"] === "true",
  }),
  component: GetAgentPage,
});

function GetAgentPage() {
  const navigate = useNavigate();
  const { callId, demo } = Route.useSearch();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [verifiedCode, setVerifiedCode] = useState("");
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [linkConfigured, setLinkConfigured] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingCode, setCheckingCode] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!callId) {
      setError("This page needs the discovery call link provided by KINETIK.");
      setLoading(false);
      return;
    }

    if (demo) {
      setVerifiedCode("");
      setMeetingUrl(null);
      setLinkConfigured(false);
      try {
        const storedDemo: unknown = JSON.parse(
          window.sessionStorage.getItem("kinetik-meeting-demo") ?? "null",
        );
        if (
          typeof storedDemo !== "object" ||
          storedDemo === null ||
          !("callId" in storedDemo) ||
          storedDemo.callId !== callId ||
          !("createdAt" in storedDemo) ||
          typeof storedDemo.createdAt !== "string" ||
          !("scheduledAt" in storedDemo) ||
          typeof storedDemo.scheduledAt !== "string"
        ) {
          throw new Error("Demo session details are missing.");
        }
        const createdAt = Date.parse(storedDemo.createdAt);
        const scheduledAtDate = Date.parse(storedDemo.scheduledAt);
        if (!Number.isFinite(createdAt) || !Number.isFinite(scheduledAtDate)) {
          throw new Error("Demo session dates are invalid.");
        }
        setSecondsLeft(
          Math.min(120, Math.max(0, 120 - Math.floor((Date.now() - createdAt) / 1000))),
        );
        setScheduledAt(storedDemo.scheduledAt);
      } catch {
        setError("This demo session has expired. Start the demo again from the marketplace.");
      } finally {
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }

    getDiscoveryCallTimer({ data: { callId } })
      .then((timer) => {
        if (!active) return;
        setSecondsLeft(timer.seconds_until_ready);
        setScheduledAt(timer.scheduled_at);
      })
      .catch((timerError: unknown) => {
        if (active) {
          setError(
            timerError instanceof Error
              ? timerError.message
              : "The call countdown could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [callId, demo]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [secondsLeft]);

  useEffect(() => {
    if (demo || !callId || !verifiedCode || secondsLeft !== 0) return;
    let active = true;

    async function refreshLink() {
      try {
        const access = await checkMeetingAccess({ data: { callId, accessCode: verifiedCode } });
        if (!active) return;
        if (!access.isValid) {
          setVerifiedCode("");
          setMeetingUrl(null);
          setAccessCode("");
          window.sessionStorage.removeItem("kinetik-meeting-access");
          setError("This meeting code is no longer active. Contact KINETIK for help.");
          return;
        }
        setLinkConfigured(access.linkConfigured);
        setMeetingUrl(access.meetingUrl);
      } catch (accessError) {
        if (active) {
          setError(
            accessError instanceof Error
              ? accessError.message
              : "The meeting link could not be checked.",
          );
        }
      }
    }

    void refreshLink();
    const intervalId = window.setInterval(() => void refreshLink(), 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [callId, demo, secondsLeft, verifiedCode]);

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!callId || checkingCode) return;
    if (demo) {
      const demoCode = accessCode.trim();
      if (!demoCode) {
        setError("Enter any text to continue the demo.");
        return;
      }
      setError("");
      await navigate({ to: "/agent-workspace", search: { demo: true } });
      return;
    }

    setCheckingCode(true);
    setError("");

    try {
      const access = await checkMeetingAccess({ data: { callId, accessCode: accessCode.trim() } });
      if (!access.isValid) {
        setError("That code is not valid for this meeting.");
        setVerifiedCode("");
        return;
      }

      setVerifiedCode(accessCode.trim());
      setSecondsLeft(access.secondsUntilReady);
      setLinkConfigured(access.linkConfigured);
      setMeetingUrl(access.meetingUrl);
      setScheduledAt(access.scheduledAt ?? "");
      window.sessionStorage.setItem(
        "kinetik-meeting-access",
        JSON.stringify({ callId, accessCode: accessCode.trim() }),
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "The code could not be verified.",
      );
    } finally {
      setCheckingCode(false);
    }
  }

  const minutes =
    secondsLeft === null ? "--" : String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = secondsLeft === null ? "--" : String(secondsLeft % 60).padStart(2, "0");
  const meetingReady = Boolean(verifiedCode && secondsLeft === 0 && meetingUrl);

  return (
    <main className="get-agent-page">
      <div className="get-agent-card">
        <header className="get-agent-header">
          <a className="get-agent-brand" href="/">
            <span className="get-agent-brand-mark">ϟ</span> KINETIK
          </a>
          <span className="get-agent-private">
            {demo ? <KeyRound size={13} /> : <LockKeyhole size={13} />}
            {demo ? "DEMO MODE" : "PRIVATE CALL"}
          </span>
        </header>

        <div className="get-agent-content">
          <section className="meeting-request">
            <span className="get-agent-eyebrow">
              {demo ? "LOCAL DEMO · NO REAL BOOKING" : "DISCOVERY CALL · SECURE ACCESS"}
            </span>
            <h1>{demo ? "Demo timer and key" : "Your meeting link"}</h1>
            <p>
              {demo
                ? "This local demo creates no call or real access. Enter exdkid to open the mock operations console; any other text opens the demo workspace."
                : "The preparation timer begins when you submit your call request. Enter the private code sent to you to reveal the link when it is ready."}
            </p>

            <div
              className={`meeting-timer${secondsLeft === 0 ? " complete" : ""}`}
              aria-live="polite"
            >
              <strong>
                {minutes}:{seconds}
              </strong>
              <span>{secondsLeft === 0 ? "PREPARED" : "TIME LEFT"}</span>
            </div>
            {demo && error ? (
              <div className="meeting-state error" role="alert">{error}</div>
            ) : demo ? (
              <div className="meeting-state">Demo timer only — no call or meeting room is created.</div>
            ) : loading ? (
              <div className="meeting-state">
                <LoaderCircle size={15} className="get-agent-spin" /> Checking your request…
              </div>
            ) : error && !verifiedCode ? (
              <div className="meeting-state error" role="alert">
                {error}
              </div>
            ) : meetingReady ? (
              <div className="meeting-state ready">
                <Check size={16} />
                <span>
                  Meeting link ready
                  <a
                    className="meeting-link"
                    href={meetingUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {meetingUrl}
                  </a>
                </span>
              </div>
            ) : secondsLeft === 0 && verifiedCode && !linkConfigured ? (
              <div className="meeting-state">
                <LoaderCircle size={15} className="get-agent-spin" /> Your meeting room is being
                added by the KINETIK team.
              </div>
            ) : secondsLeft === 0 && !verifiedCode ? (
              <div className="meeting-state">
                Enter your code to check for the private meeting link.
              </div>
            ) : (
              <div className="meeting-state">
                <LoaderCircle size={15} className="get-agent-spin" /> Preparing your secure meeting
                room.
              </div>
            )}
            {scheduledAt && (
              <p className="get-agent-scheduled">
                Requested call time:{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(scheduledAt))}{" "}
                IST
              </p>
            )}
          </section>

          <section className="workspace-access">
            <span className="get-agent-eyebrow">{demo ? "DEMO INPUT" : "CUSTOMER ACCESS"}</span>
            <h2>
              {demo ? "Enter a demo key" : verifiedCode ? "Access code verified" : "Enter your access code"}
            </h2>
            <p>
              {demo
                ? "Demo routing only: exdkid opens the local mock operations console; any other non-empty text opens the demo workspace."
                : "Your code is specific to this call. It does not grant access to the KINETIK admin area and remains valid until revoked."}
            </p>

            {!verifiedCode ? (
              <form onSubmit={(event) => void submitCode(event)}>
                <label htmlFor="meeting-access-code">
                  {demo ? "Demo key" : "Meeting access code"}
                </label>
                <div className="key-input-wrap">
                  <KeyRound size={16} />
                  <input
                    id="meeting-access-code"
                    type="password"
                    value={accessCode}
                    maxLength={demo ? 120 : 43}
                    onChange={(event) => {
                      setAccessCode(event.target.value);
                      setError("");
                    }}
                    placeholder={demo ? "Enter any text" : "Paste your personal code"}
                    autoComplete="off"
                    required
                  />
                </div>
                {error && (
                  <p className="workspace-access-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="workspace-access-button"
                  type="submit"
                  disabled={
                    checkingCode || (demo ? !accessCode.trim() : accessCode.trim().length !== 43)
                  }
                >
                  {checkingCode ? "Verifying…" : demo ? "Continue with demo key" : "Verify meeting code"}
                  <KeyRound size={15} />
                </button>
              </form>
            ) : (
              <div className="get-agent-verified">
                <p className="get-agent-success">
                  <Check size={15} />
                  Code verified for this discovery call.
                </p>
                {error && (
                  <p className="workspace-access-error" role="alert">
                    {error}
                  </p>
                )}
                {meetingReady && (
                  <button
                    className="workspace-access-button"
                    type="button"
                    onClick={() =>
                      void navigate({ to: "/agent-workspace" })
                    }
                  >
                    Open your AI workspace
                  </button>
                )}
              </div>
            )}
            <p className="get-agent-code-note">
              {demo
                ? "Demo only — exdkid opens mock data; any other non-empty text opens the demo workspace."
                : "If your code was not included in the message, reply to your KINETIK contact."}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
