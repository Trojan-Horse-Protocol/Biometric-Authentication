import { FormEvent, useState } from "react";
import "./App.css";

// Backend API configuration
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  // Component state
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login" | "recovery">(
    "register",
  );
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  // Check whether the backend is available
  async function checkBackend() {
    setBackendStatus("Checking...");

    try {
      const response = await fetch(`${apiBaseUrl}/health`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: { status: string; service: string } = await response.json();
      setBackendStatus(`${data.service}: ${data.status}`);
    } catch (error) {
      console.error(error);
      setBackendStatus("Backend unavailable");
    }
  }

  function issueRecoveryToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = `recovery-${crypto.randomUUID().slice(0, 8)}`;
    setRecoveryToken(token);
    setRecoveryMessage(
      "Recovery token created for this demo. The backend endpoint will be connected in a later task.",
    );
  }

  function recoverPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryMessage(
      "The recovery request was captured. Passkey recovery will be connected to the backend endpoint in a later task.",
    );
  }

  return (
    <main className="app-shell">
      {/* Main application layout */}
      <div className="brand-banner" aria-label="Trojan Horse Protocol">
        <span className="brand-star">✦</span>
        <div>
          <p className="brand-name">Trojan Horse</p>
          <p className="brand-name">Protocol</p>
        </div>
        <span className="brand-star">✦</span>
      </div>
      <h1 className="page-title">WebAuthn Project</h1>
      <p className="page-subtitle">
        Starter frontend for the club&apos;s passkey authentication project.
      </p>

      {/* Development backend health check */}
      <button className="utility-button" type="button" onClick={checkBackend}>
        Check backend health
      </button>

      <button
        type="button"
        onClick={() => {
          setView("recovery");
          setRecoveryMessage("");
        }}
        className="utility-button"
      >
        Recover access
      </button>

      <p className="backend-status" aria-live="polite">Backend status: {backendStatus}</p>

      {/* Recovery UI */}
      {view === "recovery" && (
        <section
          className="recovery-panel"
          aria-labelledby="recovery-heading"
        >
          <div className="section-heading">
            <span className="heading-star">✦</span>
            <h2 id="recovery-heading">Recover access</h2>
            <span className="heading-star">✦</span>
          </div>
          <p className="recovery-intro">
            Use an admin-issued recovery token to register a new passkey for an
            existing account.
          </p>

          <section className="recovery-card" aria-labelledby="admin-recovery-heading">
            <h3 id="admin-recovery-heading">Admin-issued recovery token</h3>
            <form
              className="recovery-form"
              onSubmit={issueRecoveryToken}
            >
              <div className="field">
                <label htmlFor="recovery-user-email">User email</label>
                <input
                  id="recovery-user-email"
                  name="recovery-user-email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="recovery-reason">Reason</label>
                <textarea
                  id="recovery-reason"
                  name="recovery-reason"
                  placeholder="Why does this user need recovery?"
                  required
                  rows={3}
                />
              </div>
              <button className="primary-button" type="submit">
                Issue recovery token
              </button>
            </form>
            {recoveryToken ? (
              <p className="token-output" aria-live="polite">
                <strong>Recovery token:</strong> {recoveryToken}
              </p>
            ) : null}
          </section>

          <div className="recovery-divider" />

          <section className="recovery-card" aria-labelledby="user-recovery-heading">
            <h3 id="user-recovery-heading">Recover your passkey</h3>
            <form
              className="recovery-form"
              onSubmit={recoverPasskey}
            >
              <div className="field">
                <label htmlFor="user-recovery-email">Account email</label>
                <input
                  id="user-recovery-email"
                  name="user-recovery-email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="user-recovery-token">Recovery token</label>
                <input
                  id="user-recovery-token"
                  name="user-recovery-token"
                  type="text"
                  placeholder="Paste your recovery token"
                  required
                />
              </div>
              <button className="primary-button" type="submit">
                Start passkey recovery
              </button>
            </form>
          </section>

          {recoveryMessage ? (
            <p className="recovery-message" aria-live="polite">{recoveryMessage}</p>
          ) : null}

          <button
            className="text-button"
            type="button"
            onClick={() => setView("login")}
          >
            Back to sign in
          </button>
        </section>
      )}

      {/* Registration view */}
      {view === "register" && (
        <section
          className="auth-panel"
          aria-labelledby="registration-heading"
          style={{
            border: "2px solid #222",
            borderRadius: "12px",
            padding: "3rem",
            maxWidth: "420px",
            margin: "2rem auto",
            textAlign: "center",
          }}
        >
          <h2 id="registration-heading">Create Your Account</h2>

          <p>Register a passkey to securely sign in.</p>

          <form
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
            onSubmit={(event) => {
              event.preventDefault();
              alert("Registration will be connected later.");
            }}
          >
            <div style={{ width: "280px" }}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  textAlign: "left",
                  marginBottom: "0.4rem",
                }}
              >
                Email or Username:
              </label>

              <input
                id="username"
                name="username"
                type="text"
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button type="submit">Register passkey</button>
          </form>

          <button
            type="button"
            onClick={() => setView("login")}
            style = {{marginTop: "1rem"}}
          >
            Already have an account? Sign in
          </button>

        </section>
      )}

      {/* Login view */}
      {view === "login" && (
        <section
          className="auth-panel"
          aria-labelledby="login-heading"
          style={{
            border: "2px solid #222",
            borderRadius: "12px",
            padding: "3rem",
            maxWidth: "420px",
            margin: "2rem auto",
            textAlign: "center",
          }}
        >
          <h2 id="login-heading">Welcome Back</h2>

          <p>Sign in securely with your passkey.</p>

          <form
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}
            onSubmit={(event) => {
              event.preventDefault();
              alert("Login will be connected later.");
            }}
          >
            <div style={{width: "280px"}}>
              <label
                htmlFor="login-username"
                style={{
                  display: "block",
                  textAlign: "left",
                  marginBottom: "0.4rem",
                }}
              >
                Email or Username:
              </label>

              <input
                id="login-username"
                name="login-username"
                type="text"
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button type="submit">Sign in with passkey</button>
          </form>

          <button
            type="button"
            onClick={() => setView("register")}
            style={{ marginTop: "1rem" }}
          >
            Need an account? Create one
          </button>
          <button
            type="button"
            onClick={() => setView("recovery")}
            style={{ marginTop: "0.75rem" }}
          >
            Can&apos;t access your passkey? Recover it
          </button>
        </section>
      )}

    </main>
  );
}

export default App;
