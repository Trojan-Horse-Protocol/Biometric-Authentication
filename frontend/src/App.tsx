import { useState } from "react";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [backendStatus, setBackendStatus] = useState("Not checked");

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

      <section
        aria-labelledby="registration-heading"
        style={{
          border: "2px solid #222",
          borderRadius: "12px",
          padding: "2rem",
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
            gap: "0.75rem",
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
      </section>

    </main>
  );
}

export default App;
