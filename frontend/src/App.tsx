import { FormEvent, useEffect, useState } from "react";
import logo from "./assets/SLP_logo.png";
import registrationTape from "./assets/registration-tape.png";
import star1 from "./assets/star1.png";
import star2 from "./assets/star2.png";
import homeBanner from "./assets/home-banner.png";
import homePlaque from "./assets/home-plaque.png";
import accountPlaque from "./assets/account-plaque.png";
import homeStarOutlinePlum from "./assets/home-star-outline-plum.png";
import homeStarOutlinePink from "./assets/home-star-outline-pink.png";
import homeStarPink from "./assets/home-star-pink.png";
import homeStarPlum from "./assets/home-star-plum.png";

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
type RecoveryStatus = "idle" | "loading" | "success" | "error";

function App() {
  // Component state
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [view, setView] = useState<"register" | "login" | "recovery">("register");
  // Controls whether the logged-in home page is displayed.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Error message state
  const [registrationError, setRegistrationError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");

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

  async function issueRecoveryToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryStatus("loading");
    setRecoveryMessage("");
    setRecoveryToken("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("recovery-user-email") ?? "")
      .trim()
      .toLowerCase();

    try {
      const usersResponse = await fetch(`${apiBaseUrl}/admin/users`, {
        credentials: "include",
      });
      if (!usersResponse.ok) {
        throw new Error("Only an authenticated admin can issue recovery tokens.");
      }

      const users: Array<{ id: number; username: string }> =
        await usersResponse.json();
      const user = users.find((candidate) => candidate.username.toLowerCase() === email);
      if (!user) {
        throw new Error("No account was found for that email.");
      }

      const response = await fetch(`${apiBaseUrl}/admin/users/${user.id}/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ revoke_existing: true }),
      });
      const data: { token?: string; expires_in_minutes?: number } =
        await response.json();
      if (!response.ok || !data.token) {
        throw new Error("The backend could not issue a recovery token.");
      }

      setRecoveryToken(data.token);
      setRecoveryStatus("success");
      setRecoveryMessage(
        `Token issued. It expires in ${data.expires_in_minutes ?? 30} minutes.`,
      );
    } catch (error) {
      console.error(error);
      setRecoveryStatus("error");
      setRecoveryMessage(
        error instanceof Error ? error.message : "Could not issue a recovery token.",
      );
    }
  }

  async function recoverPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryStatus("loading");
    setRecoveryMessage("");

    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("user-recovery-token") ?? "").trim();

    try {
      const beginResponse = await fetch(`${apiBaseUrl}/recovery/begin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!beginResponse.ok) {
        throw new Error("The recovery token is invalid or expired.");
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
      const verifyResponse = await fetch(`${apiBaseUrl}/recovery/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: arrayBufferToBase64Url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
              attestationObject: arrayBufferToBase64Url(attestation.attestationObject),
            },
          },
        }),
      });
      if (!verifyResponse.ok) {
        throw new Error("Passkey recovery verification failed.");
      }

      setRecoveryStatus("success");
      setRecoveryMessage("Passkey recovery complete. You are now signed in.");
      setIsLoggedIn(true);
      setAuthStatus("authenticated");
    } catch (error) {
      console.error(error);
      setRecoveryStatus("error");
      setRecoveryMessage(
        error instanceof Error ? error.message : "Passkey recovery failed.",
      );
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui",
        maxWidth: 1440,
        margin: "0 auto",
        padding: "2rem 1rem",
        minHeight: "100vh",
        boxSizing: "border-box",
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
            backgroundColor: "#FFF8E7",
            border: "6px solid #AAB86F",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(60, 45, 20, 0.18)",
            padding: "8rem 3rem 3rem",
            width: "100%",
            maxWidth: "1100px",
            minHeight: "680px",
            boxSizing: "border-box",
            margin: "2rem auto",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={homeBanner}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-6px",
              left: "-6px",
              width: "calc(100% + 12px)",
              height: "102px",
              objectFit: "cover",
              display: "block",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "240px",
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            <img
              src={logo}
              alt=""
              style={{
                position: "absolute",
                left: "1rem",
                top: "0.25rem",
                width: "140px",
                height: "140px",
                objectFit: "contain",
              }}
            />

            <img
              src={homePlaque}
              alt=""
              style={{
                position: "absolute",
                left: "50%",
                top: "0.75rem",
                width: "360px",
                height: "118px",
                objectFit: "fill",
                transform: "translateX(-50%)",
              }}
            />

            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "0.75rem",
                height: "118px",
                width: "260px",
                transform: "translateX(-50%)",
                color: "#FFFFFF",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "1.5rem",
                fontWeight: 600,
                lineHeight: 1.1,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              Trojan Horse
              <br />
              Protocol
            </span>

            <img
              src={homeStarOutlinePlum}
              alt=""
              style={{
                position: "absolute",
                left: "calc(50% - 205px)",
                top: "7.05rem",
                width: "34px",
                height: "34px",
              }}
            />

            <img
              src={homeStarPink}
              alt=""
              style={{
                position: "absolute",
                left: "calc(50% - 150px)",
                top: "8.65rem",
                width: "18px",
                height: "18px",
              }}
            />

            <img
              src={homeStarPlum}
              alt=""
              style={{
                position: "absolute",
                right: "calc(50% - 150px)",
                top: "8.25rem",
                width: "18px",
                height: "18px",
              }}
            />

            <img
              src={homeStarOutlinePink}
              alt=""
              style={{
                position: "absolute",
                right: "calc(50% - 205px)",
                top: "7.1rem",
                width: "38px",
                height: "38px",
              }}
            />
          </div>

          <h2
            id="home-heading"
            style={{
              color: "#4A1938",
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 600,
              fontSize: "2.5rem",
              margin: "1rem 0 0.75rem",
            }}
          >
            Welcome!
          </h2>

          <p
            style={{
              margin: "0 0 2rem",
              color: "#4A1938",
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            You are signed in with your passkey.
          </p>

          <section
            aria-label="Account and passkey controls"
            style={{
              position: "relative",
              border: "2px solid #AAB86F",
              borderRadius: "22px",
              padding: "3rem 1rem 1rem",
              margin: "2rem auto 0",
              maxWidth: "720px",
              textAlign: "left",
              backgroundColor: "#FFF8E7",
              boxSizing: "border-box",
            }}
          >
            {accountStatus === "loading" && (
              <p
                aria-live="polite"
                style={{
                  color: "#4A1938",
                  fontFamily: '"Fraunces", Georgia, serif',
                  textAlign: "center",
                }}
              >
                Loading account information...
              </p>
            )}

            {accountStatus === "error" && (
              <p
                role="alert"
                style={{
                  color: "#C00000",
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {accountError}
              </p>
            )}

            {accountStatus === "ready" && (
              <>
                <section
                  aria-labelledby="account-heading"
                  style={{
                    position: "relative",
                    border: "1px solid #AAB86F",
                    borderRadius: "18px",
                    padding: "2.75rem 1.25rem 1rem",
                    marginBottom: "2.25rem",
                    backgroundColor: "#FFF8E7",
                  }}
                >
                  <img
                    src={accountPlaque}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: "-1.65rem",
                      left: "1rem",
                      width: "230px",
                      height: "60px",
                      objectFit: "fill",
                    }}
                  />
                  <h3
                    id="account-heading"
                    style={{
                      position: "absolute",
                      top: "-1.65rem",
                      left: "1rem",
                      width: "230px",
                      height: "60px",
                      boxSizing: "border-box",
                      margin: 0,
                      color: "#4A1938",
                      fontFamily: '"Fraunces", Georgia, serif',
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      lineHeight: 1.05,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}
                  >
                    Account
                    <br />
                    Information
                  </h3>
                  <p
                    style={{
                      color: "#4A1938",
                      fontFamily: '"Fraunces", Georgia, serif',
                      margin: "0.25rem 0",
                    }}
                  >
                    Username: {accountUsername}
                  </p>
                  <p
                    style={{
                      color: "#4A1938",
                      fontFamily: '"Fraunces", Georgia, serif',
                      margin: "0.25rem 0",
                    }}
                  >
                    Role: {accountRole.charAt(0).toUpperCase() + accountRole.slice(1)}
                  </p>
                </section>

                <section
                  aria-labelledby="passkeys-heading"
                  style={{
                    position: "relative",
                    border: "1px solid #AAB86F",
                    borderRadius: "18px",
                    padding: "2.75rem 1.25rem 1rem",
                    backgroundColor: "#FFF8E7",
                  }}
                >
                  <img
                    src={accountPlaque}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: "-1.65rem",
                    left: "1rem",
                      width: "210px",
                      height: "58px",
                      objectFit: "fill",
                    }}
                  />
                  <h4
                    id="passkeys-heading"
                    style={{
                      position: "absolute",
                      top: "-1.65rem",
                      left: "1rem",
                      width: "210px",
                      height: "58px",
                      boxSizing: "border-box",
                      margin: 0,
                      color: "#4A1938",
                      fontFamily: '"Fraunces", Georgia, serif',
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      lineHeight: 1.05,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}
                  >
                    Passkeys
                  </h4>

                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 0.75rem",
                    }}
                  >
                    {passkeys.map((passkey) => (
                      <li
                        key={passkey.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "1rem",
                          padding: "0.35rem 0.75rem",
                          border: "1px solid #AAB86F",
                          borderRadius: "999px",
                          backgroundColor: "#F3EED7",
                          color: "#4A1938",
                          fontFamily: '"Fraunces", Georgia, serif',
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span>{passkey.label}</span>

                        <button
                          type="button"
                          onClick={() => removePasskey(passkey.id)}
                          disabled={passkeyActionStatus === "loading"}
                          style={{
                            backgroundColor: "#EE61AA",
                            color: "#4A1938",
                            border: "1px solid #4A1938",
                            borderRadius: "999px",
                            padding: "0.25rem 1.25rem",
                            fontFamily: '"Fraunces", Georgia, serif',
                            fontWeight: 600,
                            cursor:
                              passkeyActionStatus === "loading"
                                ? "not-allowed"
                                : "pointer",
                            opacity: passkeyActionStatus === "loading" ? 0.65 : 1,
                          }}
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
                      backgroundColor: "#EE61AA",
                      color: "#FFFFFF",
                      border: "1px solid #4A1938",
                      borderRadius: "999px",
                      padding: "0.35rem 0.9rem",
                      fontFamily: '"Fraunces", Georgia, serif',
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor:
                        passkeyActionStatus === "loading" ? "not-allowed" : "pointer",
                      opacity: passkeyActionStatus === "loading" ? 0.65 : 1,
                    }}
                  >
                    {passkeyActionStatus === "loading"
                      ? "Registering..."
                      : "Register another passkey"}
                  </button>

                  {passkeyActionStatus === "loading" && (
                    <p
                      aria-live="polite"
                      style={{
                        color: "#4A1938",
                        fontFamily: '"Fraunces", Georgia, serif',
                        fontWeight: 700,
                        textAlign: "center",
                        margin: "0.75rem 0 0",
                      }}
                    >
                      Preparing passkey update...
                    </p>
                  )}

                  {passkeyActionStatus === "success" && (
                    <p
                      aria-live="polite"
                      style={{
                        color: "#4A1938",
                        fontFamily: '"Fraunces", Georgia, serif',
                        fontWeight: 700,
                        textAlign: "center",
                        margin: "0.75rem 0 0",
                      }}
                    >
                      Passkey update completed.
                    </p>
                  )}

                  {passkeyActionStatus === "error" && (
                    <p
                      role="alert"
                      aria-live="assertive"
                      style={{
                        color: "#D00000",
                        fontFamily: '"Fraunces", Georgia, serif',
                        fontWeight: 700,
                        textAlign: "center",
                        margin: "0.75rem 0 0",
                      }}
                    >
                      {passkeyActionError}
                    </p>
                  )}
                </section>
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
            style={{
              display: "block",
              margin: "1.5rem 0 0 auto",
              backgroundColor: "#EE61AA",
              color: "#FFFFFF",
              border: "1px solid #4A1938",
              borderRadius: "999px",
              padding: "0.55rem 1.5rem",
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </section>
      )}

      {/* Recovery view */}
      {authStatus === "unauthenticated" && !isLoggedIn && view === "recovery" && (
        <section
          aria-labelledby="recovery-heading"
          style={{
            backgroundColor: "#FFF8E7",
            borderRadius: "12px",
            boxShadow: "0 8px 20px rgba(60, 45, 20, 0.18)",
            padding: "1rem",
            maxWidth: "560px",
            width: "100%",
            boxSizing: "border-box",
            margin: "4rem auto 2rem",
            textAlign: "center",
          }}
        >
          <img
            src={logo}
            alt="Trojan Horse Protocol logo"
            style={{ width: "120px", height: "120px", objectFit: "contain" }}
          />
          <div
            style={{
              border: "1px solid #4A1938",
              borderRadius: "12px",
              padding: "1.5rem 2rem 2rem",
            }}
          >
            <h2
              id="recovery-heading"
              style={{
                color: "#4A1938",
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: "2.1rem",
                margin: "0 0 0.6rem",
              }}
            >
              Recover access
            </h2>
            <p style={{ color: "#4A1938", margin: "0 0 1.5rem" }}>
              Use an admin-issued token to register a new passkey.
            </p>

            <section aria-labelledby="admin-recovery-heading" style={{ textAlign: "left" }}>
              <h3 id="admin-recovery-heading" style={{ color: "#4A1938" }}>
                Admin-issued recovery token
              </h3>
              <form
                onSubmit={issueRecoveryToken}
                style={{ display: "grid", gap: "0.7rem" }}
              >
                <label htmlFor="recovery-user-email">User email</label>
                <input
                  id="recovery-user-email"
                  name="recovery-user-email"
                  type="email"
                  required
                  placeholder="user@example.com"
                  style={{ height: "40px", padding: "0 0.75rem", borderRadius: "12px", border: "1px solid #4A1938" }}
                />
                <label htmlFor="recovery-reason">Reason</label>
                <textarea
                  id="recovery-reason"
                  name="recovery-reason"
                  required
                  rows={2}
                  placeholder="Why does this user need recovery?"
                  style={{ padding: "0.6rem 0.75rem", borderRadius: "12px", border: "1px solid #4A1938", resize: "vertical" }}
                />
                <button
                  type="submit"
                  disabled={recoveryStatus === "loading"}
                  style={{
                    justifySelf: "center",
                    backgroundColor: recoveryStatus === "loading" ? "#F7B8C8" : "#EE61AA",
                    color: "#FFFFFF",
                    border: "1px solid #4A1938",
                    borderRadius: "999px",
                    padding: "0.55rem 1.2rem",
                    fontWeight: 600,
                  }}
                >
                  {recoveryStatus === "loading" ? "Working..." : "Issue recovery token"}
                </button>
              </form>
              {recoveryToken && (
                <p aria-live="polite" style={{ wordBreak: "break-word" }}>
                  <strong>Recovery token:</strong> {recoveryToken}
                </p>
              )}
            </section>

            <hr style={{ margin: "1.5rem 0", border: 0, borderTop: "1px solid #D8A6A9" }} />

            <section aria-labelledby="user-recovery-heading" style={{ textAlign: "left" }}>
              <h3 id="user-recovery-heading" style={{ color: "#4A1938" }}>
                Recover your passkey
              </h3>
              <form
                onSubmit={recoverPasskey}
                style={{ display: "grid", gap: "0.7rem" }}
              >
                <label htmlFor="user-recovery-token">Recovery token</label>
                <input
                  id="user-recovery-token"
                  name="user-recovery-token"
                  type="text"
                  required
                  placeholder="Paste your recovery token"
                  style={{ height: "40px", padding: "0 0.75rem", borderRadius: "12px", border: "1px solid #4A1938" }}
                />
                <button
                  type="submit"
                  disabled={recoveryStatus === "loading"}
                  style={{
                    justifySelf: "center",
                    backgroundColor: recoveryStatus === "loading" ? "#F7B8C8" : "#EE61AA",
                    color: "#FFFFFF",
                    border: "1px solid #4A1938",
                    borderRadius: "999px",
                    padding: "0.55rem 1.2rem",
                    fontWeight: 600,
                  }}
                >
                  {recoveryStatus === "loading" ? "Recovering..." : "Start passkey recovery"}
                </button>
              </form>
            </section>

            {recoveryMessage && (
              <p role={recoveryStatus === "error" ? "alert" : undefined} aria-live="polite" style={{ color: recoveryStatus === "error" ? "#C00000" : "#4A1938", fontWeight: 700 }}>
                {recoveryMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => setView("login")}
              style={{ border: 0, background: "transparent", color: "#4A1938", textDecoration: "underline" }}
            >
              Back to sign in
            </button>

            <button
              type="button"
              onClick={() => setView("recovery")}
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
              Need to recover a passkey? <span style={{ textDecoration: "underline" }}>Recover access</span>
            </button>
          </div>
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

            <button
              type="button"
              onClick={() => setView("recovery")}
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
              Can&apos;t access your passkey? <span style={{ textDecoration: "underline" }}>Recover it</span>
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
