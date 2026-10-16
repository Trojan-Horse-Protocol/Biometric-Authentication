import { useState } from "react";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login">("register");

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

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>WebAuthn Project</h1>
      <p>Starter frontend for the club&apos;s passkey authentication project.</p>

      <button type="button" onClick={checkBackend}>
        Check backend health
      </button>

      <p aria-live="polite">Backend status: {backendStatus}</p>

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
        </section>
      )}

    </main>
  );
}

export default App;
