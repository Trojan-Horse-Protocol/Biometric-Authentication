import { useEffect, useState } from "react";

// Backend API configuration
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,50}$/;
const EMAIL_PATTERN =
  /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const IDENTIFIER_FORMAT_MESSAGE =
  "Use a 3-50 character username (letters, numbers, underscores, or hyphens) or a valid email address.";

function normalizeIdentifier(identifier: string): string {
  const trimmedIdentifier = identifier.trim();
  return trimmedIdentifier.includes("@")
    ? trimmedIdentifier.toLowerCase()
    : trimmedIdentifier;
}

function isValidIdentifier(identifier: string): boolean {
  return USERNAME_PATTERN.test(identifier) || EMAIL_PATTERN.test(identifier);
}

  // Converts WebAuthn credential data for the backend.
  function base64UrlToUint8Array(value: string): Uint8Array {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const binary = window.atob(base64);
  
    return Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
  }
  
  function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
  
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
  
    return window
      .btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

function App() {
  // Component state
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login">("register");
  // Controls whether the logged-in home page is displayed.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Error message state
  const [registrationError, setRegistrationError] = useState("");
  const [loginError, setLoginError] = useState("");

  // Authentication status state
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated" | "error"
  >("checking");
  const [authError, setAuthError] = useState("");

  // Registration status state
  const [registrationStatus, setRegistrationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Login status state
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/authentication/user`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setIsLoggedIn(false);
          setAuthStatus("unauthenticated");
          return;
        }

        if (!response.ok) {
          throw new Error(`Session check failed: HTTP ${response.status}`);
        }

        setIsLoggedIn(true);
        setAuthStatus("authenticated");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAuthError(
          error instanceof Error ? error.message : "Could not check session.",
        );
        setAuthStatus("error");
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

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
      <p>Placeholder description.</p>

      {/* Development backend health check */}
      <button type="button" onClick={checkBackend}>
        Check backend health
      </button>

      <p aria-live="polite">Backend status: {backendStatus}</p>
      {authStatus === "checking" && (
        <p aria-live="polite">Checking your sign-in session...</p>
      )}
      {authStatus === "error" && (
        <p role="alert">
          Unable to check your sign-in session: {authError}
        </p>
      )}
      {authStatus === "authenticated" && isLoggedIn && (
        <section
          aria-labelledby="home-heading"
          style={{
            border: "2px solid #222",
            borderRadius: "12px",
            padding: "3rem",
            maxWidth: "420px",
            margin: "2rem auto",
            textAlign: "center",
          }}
        >
          <h2 id="home-heading">Welcome</h2>

          <p>You are signed in with your passkey.</p>

          <p>This is a placeholder.</p>

          <button
            type="button"
            onClick={async () => {
              await fetch(`${apiBaseUrl}/authentication/logout`, {
                method: "POST",
                credentials: "include",
              });

              setIsLoggedIn(false);
              setAuthStatus("unauthenticated");
              setLoginStatus("idle");
              setLoginError("");
              setView("login");
            }}
          >
            Log out
          </button>
        </section>
      )}

      {/* Registration view */}
      {authStatus === "unauthenticated" && !isLoggedIn && view === "register" && (
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

              const formData = new FormData(event.currentTarget);
              const username = normalizeIdentifier(
                String(formData.get("username") ?? ""),
              );
              if (!isValidIdentifier(username)) {
                setRegistrationStatus("error");
                setRegistrationError(IDENTIFIER_FORMAT_MESSAGE);
                return;
              }
              setRegistrationStatus("loading");

              try {
                const beginResponse = await fetch(
                  `${apiBaseUrl}/authentication/register/begin`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                  },
                );
              
                if (!beginResponse.ok) {
                  throw new Error("Could not begin registration.");
                }
              
                const registrationOptions = await beginResponse.json();
              
                const publicKeyOptions = {
                  ...registrationOptions,
                  challenge: base64UrlToUint8Array(registrationOptions.challenge),
                  user: {
                    ...registrationOptions.user,
                    id: base64UrlToUint8Array(registrationOptions.user.id),
                  },
                  excludeCredentials: registrationOptions.excludeCredentials?.map(
                    (credential: { id: string; type: string }) => ({
                      ...credential,
                      id: base64UrlToUint8Array(credential.id),
                    }),
                  ),
                } as PublicKeyCredentialCreationOptions;
              
                const credential = await navigator.credentials.create({
                  publicKey: publicKeyOptions,
                });
              
                if (!(credential instanceof PublicKeyCredential)) {
                  throw new Error("No passkey credential was created.");
                }
              
                const attestation = credential.response as AuthenticatorAttestationResponse;
              
                const credentialPayload = {
                  id: credential.id,
                  rawId: arrayBufferToBase64Url(credential.rawId),
                  type: credential.type,
                  response: {
                    clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
                    attestationObject: arrayBufferToBase64Url(
                      attestation.attestationObject,
                    ),
                  },
                };
              
                const verifyResponse = await fetch(
                  `${apiBaseUrl}/authentication/register/verify`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                      credential: credentialPayload,
                    }),
                  },
                );
              
                if (!verifyResponse.ok) {
                  throw new Error("Registration verification failed.");
                }
                
                setRegistrationStatus("success");
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
      {authStatus === "unauthenticated" && !isLoggedIn && view === "login" && (
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
            onSubmit={async (event) => {
              event.preventDefault();
              setLoginError("");

              const formData = new FormData(event.currentTarget);
              const username = normalizeIdentifier(
                String(formData.get("login-username") ?? ""),
              );
              if (!isValidIdentifier(username)) {
                setLoginStatus("error");
                setLoginError(IDENTIFIER_FORMAT_MESSAGE);
                return;
              }
              setLoginStatus("loading");

              try {
                const beginResponse = await fetch(
                  `${apiBaseUrl}/authentication/login/begin`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                  },
                );

                if (!beginResponse.ok) {
                  throw new Error("Could not begin login.");
                }

                const loginOptions = await beginResponse.json();

                const publicKeyOptions = {
                  ...loginOptions,
                  challenge: base64UrlToUint8Array(loginOptions.challenge),
                  allowCredentials: loginOptions.allowCredentials?.map(
                    (credential: { id: string; type: string }) => ({
                      ...credential,
                      id: base64UrlToUint8Array(credential.id),
                    }),
                  ),
                } as PublicKeyCredentialRequestOptions;

                const credential = await navigator.credentials.get({
                  publicKey: publicKeyOptions,
                });

                if (!(credential instanceof PublicKeyCredential)) {
                  throw new Error("No passkey credential was provided.");
                }

                const assertion = credential.response as AuthenticatorAssertionResponse;

                const credentialPayload = {
                  id: credential.id,
                  rawId: arrayBufferToBase64Url(credential.rawId),
                  type: credential.type,
                  response: {
                    clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
                    authenticatorData: arrayBufferToBase64Url(
                      assertion.authenticatorData,
                    ),
                    signature: arrayBufferToBase64Url(assertion.signature),
                    userHandle: assertion.userHandle
                      ? arrayBufferToBase64Url(assertion.userHandle)
                      : null,
                  },
                };

                const verifyResponse = await fetch(
                  `${apiBaseUrl}/authentication/login/verify`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                      credential: credentialPayload,
                    }),
                  },
                );

                if (!verifyResponse.ok) {
                  throw new Error("Login verification failed.");
                }

                setLoginStatus("success");
                setIsLoggedIn(true);
                setAuthStatus("authenticated");
              } catch (error) {
                console.error(error);
                setLoginStatus("error");
                setLoginError("Login could not be completed.");
              }
            }}
          >
            <div style={{ width: "280px" }}>
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
