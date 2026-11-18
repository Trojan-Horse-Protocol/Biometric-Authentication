| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Confirm backend is running |
| `POST` | `/session` | Create an authenticated session and set an HttpOnly cookie |
| `GET` | `/session` | Return the current session, or `401` if none is valid |
| `POST` | `/logout` | Invalidate the current session and clear the cookie |
| `POST` | `/webauthn/register/options` | Generate registration challenge |
| `POST` | `/webauthn/register/verify` | Verify new credential |
| `POST` | `/webauthn/authenticate/options` | Generate login challenge |
| `POST` | `/webauthn/authenticate/verify` | Verify authentication |

Session cookies are `HttpOnly` and `SameSite=Lax`. Set `SESSION_COOKIE_SECURE=true` in HTTPS deployments.

Error responses use `{ "error": "<code>", "message": "<safe message>" }` and do not include stack traces or session identifiers.
