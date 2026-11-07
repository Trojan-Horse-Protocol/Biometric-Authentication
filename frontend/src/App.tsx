import { useState } from "react";

// Backend API configuration
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  // Component state
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login">("register");

  // Error message state
  const [registrationError, setRegistrationError] = useState("");
  const [loginError, setLoginError] = useState("");

  // Registration status state
  const [registrationStatus, setRegistrationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Login status state
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

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
            onSubmit={async (event) => {
              event.preventDefault();
              setRegistrationError("");
              setRegistrationStatus("loading");

              const formData = new FormData(event.currentTarget);
              const username = String(formData.get("username") ?? "");

              try {
                // temporary, waiting for API format
                throw new Error("Registration API is not connected yet.");
              } catch (error) {
                console.error(error);
                setRegistrationStatus("error");
                setRegistrationError("Registration could not be completed.");
              }
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

            <button
              type="submit"
              disabled={registrationStatus === "loading"}
            >
              {registrationStatus === "loading"
                ? "Registering..."
                : "Register passkey"}
            </button>
          </form>

          <p aria-live="polite">
            {registrationStatus === "loading" && "Preparing passkey registration..."}
            {registrationStatus === "success" &&
              "Registration complete."}
          </p>

          <p aria-live="assertive">
            {registrationStatus === "error" && registrationError}
          </p>

          <button
            type="button"
            onClick={() => setView("login")}
            style={{ marginTop: "1rem" }}
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
            // temporarily simulates the login process until the backend is connected
            onSubmit={(event) => {
              event.preventDefault();
              setLoginError("");
              setLoginStatus("loading");
              window.setTimeout(() => {
                setLoginStatus("success");
              }, 1000);
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

            <button 
              type="submit"
              disabled={loginStatus === "loading"}
            >
              {loginStatus === "loading"
                ? "Signing in..."
                : "Sign in with passkey"}
            </button>
          </form>

          <p aria-live="polite">
            {loginStatus === "loading" && "Signing in..."}
            {loginStatus === "success" &&
              "Login complete."}
          </p>

          <p aria-live="assertive">
            {loginStatus === "error" && loginError}
          </p>

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
