import { useEffect, useState } from "react";
import logo from "./assets/SLP_logo.png";
import registrationTape from "./assets/registration-tape.png";
import star1 from "./assets/star1.png";
import star2 from "./assets/star2.png";

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

type Passkey = {
  id: number;
  label: string;
};

type AccountStatus = "idle" | "loading" | "ready" | "error";
type PasskeyActionStatus = "idle" | "loading" | "success" | "error";

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

  // Account information state
  const [accountUsername, setAccountUsername] = useState("");
  const [accountRole, setAccountRole] = useState("");
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("idle");
  const [accountError, setAccountError] = useState("");

  // Passkey action state
  const [passkeyActionStatus, setPasskeyActionStatus] = useState<PasskeyActionStatus>("idle");
  const [passkeyActionError, setPasskeyActionError] = useState("");

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

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    const controller = new AbortController();

    async function loadAccount() {
      setAccountStatus("loading");
      setAccountError("");

      try {
        const response = await fetch(`${apiBaseUrl}/account`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Account request failed: HTTP ${response.status}`);
        }

        const data: {
          username: string;
          role: string;
          passkeys: Passkey[];
        } = await response.json();

        setAccountUsername(data.username);
        setAccountRole(data.role);
        setPasskeys(data.passkeys);
        setAccountStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAccountError(
          error instanceof Error
            ? error.message
            : "Could not load account information.",
        );
        setAccountStatus("error");
      }
    }

    void loadAccount();

    return () => controller.abort();
  }, [authStatus]);

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

  async function registerAdditionalPasskey() {
    setPasskeyActionStatus("loading");
    setPasskeyActionError("");

    try {
      const beginResponse = await fetch(
        `${apiBaseUrl}/account/passkeys/begin`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!beginResponse.ok) {
        throw new Error("Could not begin passkey registration.");
      }

      const registrationOptions = await beginResponse.json();

      const publicKeyOptions = {
        ...registrationOptions,
        challenge: base64UrlToUint8Array(registrationOptions.challenge),
        user: {
          ...registrationOptions.user,
          id: base64UrlToUint8Array(registrationOptions.user.id),
        },
        excludeCredentials:
          registrationOptions.excludeCredentials?.map(
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

      const attestation =
        credential.response as AuthenticatorAttestationResponse;

      const credentialPayload = {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64Url(
            attestation.clientDataJSON,
          ),
          attestationObject: arrayBufferToBase64Url(
            attestation.attestationObject,
          ),
        },
      };

      const finishResponse = await fetch(
        `${apiBaseUrl}/account/passkeys/finish`,
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

      if (!finishResponse.ok) {
        throw new Error("Could not finish passkey registration.");
      }

      const accountResponse = await fetch(`${apiBaseUrl}/account`, {
        credentials: "include",
      });

      if (!accountResponse.ok) {
        throw new Error("Passkey was added, but account data could not refresh.");
      }

      const accountData: {
        username: string;
        role: string;
        passkeys: Passkey[];
      } = await accountResponse.json();

      setPasskeys(accountData.passkeys);
      setPasskeyActionStatus("success");
    } catch (error) {
      console.error(error);
      setPasskeyActionStatus("error");
      setPasskeyActionError(
        error instanceof Error
          ? error.message
          : "Passkey registration could not be completed.",
      );
    }
  }

  async function removePasskey(passkeyId: number) {
    setPasskeyActionStatus("loading");
    setPasskeyActionError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/account/passkeys/${passkeyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Could not remove this passkey.");
      }

      setPasskeys((currentPasskeys) =>
        currentPasskeys.filter((passkey) => passkey.id !== passkeyId),
      );

      setPasskeyActionStatus("success");
    } catch (error) {
      console.error(error);
      setPasskeyActionStatus("error");
      setPasskeyActionError(
        error instanceof Error
          ? error.message
          : "Passkey could not be removed.",
      );
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui",
        maxWidth: 720,
        margin: "4rem auto",
        padding: "0 1rem",
        minHeight: "100vh",
      }}
    >
      {/* Main application layout */}
      {/*
        <h1>WebAuthn Project</h1>
        <p>Placeholder description.</p>

        <button type="button" onClick={checkBackend}>
          Check backend health
        </button>

        <p aria-live="polite">Backend status: {backendStatus}</p>
      */}
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

          <section
            aria-labelledby="account-heading"
            style={{
              marginTop: "2rem",
            }}
          >
            <h3 id="account-heading">Account information</h3>

            {accountStatus === "loading" && (
              <p aria-live="polite">Loading account information...</p>
            )}

            {accountStatus === "error" && (
              <p role="alert">{accountError}</p>
            )}

            {accountStatus === "ready" && (
              <>
                <p>Username: {accountUsername}</p>
                <p>
                  Role: {accountRole.charAt(0).toUpperCase() + accountRole.slice(1)}
                </p>

                <h4>Passkeys</h4>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "1rem 0",
                  }}
                >
                  {passkeys.map((passkey) => (
                    <li
                      key={passkey.id}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <span>{passkey.label}</span>

                      <button
                        type="button"
                        onClick={() => removePasskey(passkey.id)}
                        disabled={passkeyActionStatus === "loading"}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={registerAdditionalPasskey}
                  disabled={passkeyActionStatus === "loading"}
                  style={{
                    marginTop: "1rem",
                  }}
                >
                  {passkeyActionStatus === "loading"
                    ? "Working..."
                    : "Register another passkey"}
                </button>

                {passkeyActionStatus === "success" && (
                  <p aria-live="polite">Passkey update completed.</p>
                )}

                {passkeyActionStatus === "error" && (
                  <p role="alert">{passkeyActionError}</p>
                )}
              </>
            )}
          </section>

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
            backgroundColor: "#FFF8E7",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(60, 45, 20, 0.18)",
            padding: "1rem",
            maxWidth: "560px",
            width: "100%",
            boxSizing: "border-box",
            margin: "8rem auto 2rem",
            textAlign: "center",
            position: "relative",
          }}
        >
          <img
            src={registrationTape}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-48px",
              left: "-45px",
              width: "220px",
              height: "auto",
              transform: "rotate(0deg)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <img
            src={logo}
            alt="Trojan Horse Protocol logo"
            style={{
              position: "absolute",
              top: "-90px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "180px",
              height: "180px",
              objectFit: "contain",
            }}
          />

          <img
            src={star1}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-28px",
              bottom: "-46px",
              width: "100px",
              height: "auto",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <img
            src={star2}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "16px",
              bottom: "-86px",
              width: "60px",
              height: "auto",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              border: "1px solid #4A1938",
              borderRadius: "12px",
              padding: "6rem 3rem 3rem",
              boxSizing: "border-box",
            }}
          >
          <h2
            id="registration-heading"
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "2.5rem",
              fontWeight: 600,
              color: "#4A1938",
              margin: "0 0 0.75rem",
            }}
          >
            Create Your Account
          </h2>

          <div
            aria-hidden="true"
            style={{
              width: "70%",
              maxWidth: "620px",
              height: "1px",
              backgroundColor: "#4A1938",
              margin: "0 auto 0.75rem",
            }}
          />

          <p
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "1.1rem",
              color: "#4A1938",
              margin: "0 0 2rem",
            }}
          >
            Register a passkey to securely sign in.
          </p>

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
            <div style={{ width: "100%", maxWidth: "560px" }}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  textAlign: "left",
                  marginBottom: "0.4rem",
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#4A1938",
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
                  height: "42px",
                  boxSizing: "border-box",
                  border: "1px solid #4A1938",
                  borderRadius: "14px",
                  padding: "0 1rem",
                  backgroundColor: "#FFFFFF",
                  color: "#4A1938",
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: "1.1rem",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={registrationStatus === "loading"}
              style={{
                height: "42px",
                padding: "0 2rem",
                border: "1px solid #4A1938",
                borderRadius: "21px",
                backgroundColor:
                  registrationStatus === "loading" ? "#F7B8C8" : "#EE61AA",
                color: "#FFFFFF",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "1.1rem",
                fontWeight: 600,
                cursor: registrationStatus === "loading" ? "not-allowed" : "pointer",
              }}
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

          <p
            aria-live="assertive"
            style={{
              color: "#D00000",
              fontWeight: 700,
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "1rem",
              margin: "0.75rem 0 0",
            }}
          >
            {registrationStatus === "error" && registrationError}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#4A1938",
              }}
            />

            <button
              type="button"
              onClick={() => setView("login")}
              style={{
                padding: 0,
                border: "none",
                backgroundColor: "transparent",
                color: "#4A1938",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Already have an account?{" "}
              <span style={{ textDecoration: "underline" }}>Sign in</span>
            </button>

            <span
              aria-hidden="true"
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#4A1938",
              }}
            />
          </div>
          </div>
        </section>
      )}

      {/* Login view */}
      {authStatus === "unauthenticated" && !isLoggedIn && view === "login" && (
        <section
          aria-labelledby="login-heading"
          style={{
            backgroundColor: "#FFF8E7",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(60, 45, 20, 0.18)",
            padding: "1rem",
            maxWidth: "560px",
            width: "100%",
            boxSizing: "border-box",
            margin: "8rem auto 2rem",
            textAlign: "center",
            position: "relative",
          }}
        >
          <img
            src={registrationTape}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-48px",
              left: "-45px",
              width: "220px",
              height: "auto",
              transform: "rotate(0deg)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <img
            src={logo}
            alt="Trojan Horse Protocol logo"
            style={{
              position: "absolute",
              top: "-90px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "180px",
              height: "180px",
              objectFit: "contain",
            }}
          />

          <img
            src={star1}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-28px",
              bottom: "-46px",
              width: "100px",
              height: "auto",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <img
            src={star2}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "16px",
              bottom: "-86px",
              width: "60px",
              height: "auto",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              border: "1px solid #4A1938",
              borderRadius: "12px",
              padding: "6rem 3rem 3rem",
              boxSizing: "border-box",
            }}
          >
          <h2
            id="login-heading"
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "2.5rem",
              fontWeight: 600,
              color: "#4A1938",
              margin: "0 0 0.75rem",
            }}
          >
            Welcome Back
          </h2>

          <div
            aria-hidden="true"
            style={{
              width: "70%",
              height: "1px",
              backgroundColor: "#4A1938",
              margin: "0 auto 0.75rem",
            }}
          />

          <p
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "1.1rem",
              color: "#4A1938",
              margin: "0 0 2rem",
            }}
          >
            Sign in securely with your passkey.
          </p>

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
            <div style={{ width: "100%", maxWidth: "560px" }}>
              <label
                htmlFor="login-username"
                style={{
                  display: "block",
                  textAlign: "left",
                  marginBottom: "0.4rem",
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#4A1938",
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
                  height: "42px",
                  boxSizing: "border-box",
                  border: "1px solid #4A1938",
                  borderRadius: "14px",
                  padding: "0 1rem",
                  backgroundColor: "#FFFFFF",
                  color: "#4A1938",
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: "1.1rem",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loginStatus === "loading"}
              style={{
                height: "42px",
                padding: "0 2rem",
                border: "1px solid #4A1938",
                borderRadius: "21px",
                backgroundColor:
                  loginStatus === "loading" ? "#F7B8C8" : "#EE61AA",
                color: "#FFFFFF",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "1.1rem",
                fontWeight: 600,
                cursor: loginStatus === "loading" ? "not-allowed" : "pointer",
              }}
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

          <p
            aria-live="assertive"
            style={{
              color: "#D00000",
              fontWeight: 700,
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: "1rem",
              margin: "0.75rem 0 0",
            }}
          >
            {loginStatus === "error" && loginError}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#4A1938",
              }}
            />

            <button
              type="button"
              onClick={() => setView("register")}
              style={{
                padding: 0,
                border: "none",
                backgroundColor: "transparent",
                color: "#4A1938",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Need an account?{" "}
              <span style={{ textDecoration: "underline" }}>Create one</span>
            </button>

            <span
              aria-hidden="true"
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#4A1938",
              }}
            />
          </div>
          </div>
        </section>
      )}

    </main>
  );
}

export default App;
