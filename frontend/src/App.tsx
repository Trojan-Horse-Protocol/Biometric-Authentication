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
    </main>
  );
}

export default App;
