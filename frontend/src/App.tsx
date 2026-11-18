import { FormEvent, useEffect, useState } from "react";

// Backend API configuration
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type SessionInfo = {
  user_id: string;
  username: string;
  expires_at: string;
};

function App() {
  // Component state
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login">("register");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  function validateEmail(value: string) {
    const email = value.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const message = isValid ? "" : "Please enter a valid email address.";
    setEmailError(message);
    return isValid;
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function refreshSession() {
    try {
      const response = await fetch(`${apiBaseUrl}/session`, {
        credentials: "include"
      });

      if (!response.ok) {
        setSession(null);
        return;
      }

      const data: SessionInfo = await response.json();
      setSession(data);
    } catch (error) {
      console.error(error);
      setSession(null);
    }
  }

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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSessionMessage("");

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("login-username") ?? "").trim();

    if (!validateEmail(username)) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });

      const data: SessionInfo | { message?: string } = await response.json();

      if (!response.ok) {
        setSessionMessage(
          "message" in data && data.message
            ? data.message
            : "Could not create a session."
        );
        return;
      }

      setSession(data as SessionInfo);
    } catch (error) {
      console.error(error);
      setSessionMessage("Could not create a session.");
    }
  }

  async function handleLogout() {
    setSessionMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/logout`, {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        setSessionMessage("Could not log out.");
        return;
      }

      setSession(null);
      setView("login");
    } catch (error) {
      console.error(error);
      setSessionMessage("Could not log out.");
    }
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

      <p aria-live="polite">Backend status: {backendStatus}</p>

      {session ? (
        <section
          aria-labelledby="session-heading"
          style={{
            border: "2px solid #222",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "420px",
            margin: "2rem auto",
            textAlign: "center",
          }}
        >
          <h2 id="session-heading">Signed in</h2>
          <p>Signed in as {session.username}.</p>
          <button type="button" onClick={() => void handleLogout()}>
            Log out
          </button>
          {sessionMessage ? <p aria-live="polite">{sessionMessage}</p> : null}
        </section>
      ) : null}

      {/* Registration view */}
      {!session && view === "register" && (
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
              const formData = new FormData(event.currentTarget);
              const email = String(formData.get("username") ?? "");

              if (!validateEmail(email)) {
                return;
              }

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
                Email:
              </label>

              <input
                id="username"
                name="username"
                type="email"
                required
                aria-invalid={emailError ? "true" : "false"}
                aria-describedby="registration-email-error"
                onBlur={(event) => validateEmail(event.currentTarget.value)}
                onChange={(event) => {
                  if (emailError) {
                    validateEmail(event.currentTarget.value);
                  }
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              {emailError ? (
                <p
                  id="registration-email-error"
                  role="alert"
                  style={{ color: "#b42318", textAlign: "left", margin: "0.4rem 0 0" }}
                >
                  {emailError}
                </p>
              ) : null}
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
      {!session && view === "login" && (
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
            onSubmit={handleLogin}
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
                Email:
              </label>

              <input
                id="login-username"
                name="login-username"
                type="email"
                required
                aria-invalid={emailError ? "true" : "false"}
                aria-describedby="login-email-error"
                onBlur={(event) => validateEmail(event.currentTarget.value)}
                onChange={(event) => {
                  if (emailError) {
                    validateEmail(event.currentTarget.value);
                  }
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              {emailError ? (
                <p
                  id="login-email-error"
                  role="alert"
                  style={{ color: "#b42318", textAlign: "left", margin: "0.4rem 0 0" }}
                >
                  {emailError}
                </p>
              ) : null}
            </div>

            <button type="submit">Sign in with passkey</button>
          </form>
          {sessionMessage ? <p aria-live="polite">{sessionMessage}</p> : null}

          <button
            type="button"
            onClick={() => setView("register")}
            style={{ marginTop: "1rem" }}
          >
            Need an account? Create one
          </button>
        </section>
      )}

    </main>
  );
}

export default App;
