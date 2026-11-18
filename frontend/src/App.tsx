import { FormEvent, useState } from "react";

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
    <main
      style={{
        fontFamily: "system-ui",
        maxWidth: 720,
        margin: "4rem auto",
        padding: "0 1rem"
      }}
    >
      {/* Main application layout */}
      <h1>WebAuthn Project</h1>
      <p>Starter frontend for the club&apos;s passkey authentication project.</p>

      {/* Development backend health check */}
      <button type="button" onClick={checkBackend}>
        Check backend health
      </button>

      <button
        type="button"
        onClick={() => {
          setView("recovery");
          setRecoveryMessage("");
        }}
        style={{ marginLeft: "0.75rem" }}
      >
        Recover access
      </button>

      <p aria-live="polite">Backend status: {backendStatus}</p>

      {/* Recovery UI */}
      {view === "recovery" && (
        <section
          aria-labelledby="recovery-heading"
          style={{
            border: "2px solid #222",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "520px",
            margin: "2rem auto",
          }}
        >
          <h2 id="recovery-heading">Recover access</h2>
          <p>
            Use an admin-issued recovery token to register a new passkey for an
            existing account.
          </p>

          <section aria-labelledby="admin-recovery-heading">
            <h3 id="admin-recovery-heading">Admin-issued recovery token</h3>
            <form
              onSubmit={issueRecoveryToken}
              style={{ display: "grid", gap: "0.75rem" }}
            >
              <label htmlFor="recovery-user-email">User email</label>
              <input
                id="recovery-user-email"
                name="recovery-user-email"
                type="email"
                placeholder="user@example.com"
                required
              />
              <label htmlFor="recovery-reason">Reason</label>
              <textarea
                id="recovery-reason"
                name="recovery-reason"
                placeholder="Why does this user need recovery?"
                required
                rows={3}
              />
              <button type="submit">Issue recovery token</button>
            </form>
            {recoveryToken ? (
              <p aria-live="polite">
                <strong>Recovery token:</strong> {recoveryToken}
              </p>
            ) : null}
          </section>

          <hr />

          <section aria-labelledby="user-recovery-heading">
            <h3 id="user-recovery-heading">Recover your passkey</h3>
            <form
              onSubmit={recoverPasskey}
              style={{ display: "grid", gap: "0.75rem" }}
            >
              <label htmlFor="user-recovery-email">Account email</label>
              <input
                id="user-recovery-email"
                name="user-recovery-email"
                type="email"
                placeholder="user@example.com"
                required
              />
              <label htmlFor="user-recovery-token">Recovery token</label>
              <input
                id="user-recovery-token"
                name="user-recovery-token"
                type="text"
                placeholder="Paste your recovery token"
                required
              />
              <button type="submit">Start passkey recovery</button>
            </form>
          </section>

          {recoveryMessage ? (
            <p aria-live="polite">{recoveryMessage}</p>
          ) : null}

          <button
            type="button"
            onClick={() => setView("login")}
            style={{ marginTop: "1rem" }}
          >
            Back to sign in
          </button>
        </section>
      )}

      {/* Registration view */}
      {view === "register" && (
        <section
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
