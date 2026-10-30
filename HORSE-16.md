HORSE 16 WebAuthn security checklist and testcases 

WebAuth security checklist 

The checklist and test cases should focus on verifying passkey registration, login security, phishing resistance (protects users from fake websites that want to use their login credientials), replay protection (prevents someone from getting a valid login and reusing it to later login in as someone else), authorization, account recovery, and audit logging (keeps a record of events that happened in the app, used to review what happened, when it happened, and which user or system performed the action)

1. Registration and credintial storage 
Generate a unique, secure registration challenge 
Validate the registration challenge and esure it cannot be resused 
Validate the expected origin and relying party ID 
Verify the registration repsonse using the WebAuthn library 
Ensure the credential public key and credential ID are stored correctly 
Ensure private keys and raw fingerprint or facial data are never stored 
Prevent duplicate or impromperly associated credential registrations
Require an authenticated, authorized session before adding credentials to an existing account 

2. Authentication and passkey verification 
Generate a fresh challenge for each authentication attempt 
Validate the challenge, origin, relying party ID, signature, and user verification requirements 
Reject expired, unknown, or previously consumed challenges 
Verify that the crendential belongs to the claimed account 
Check the credential counter where supported andinterpret it according to authenticator behavior 
Create an authenticated session only after all required checks succeed 
Invalidate the session on logout 

3. Authorization and account isolation 
Have role based access control on the backend, not just the frontend 
Prevent users from accessing another user's account data or credentials 
Require the appropriate role for administrative actions 
Prevent ordinary users from assigning themselves administrator privileges 
Validate authroization on every protected API endpoint 

4. Abuse prevention and recovery
Rate limit repeated failed authentication attemps 
Apply limits to registration, recovery, and other endpoints 
Ensure account recovery doesn't silently bypass authentication protections 
Require appropriate verification before removing or replacing a passkey 
Prevent recovery tokens from being reused or used after expiration 
Return generic errors where detailed responses could reveal senstive account information 

5. Logging, configuration, and deployment 
Log successful and failed authentication events without recording secrets 
Record relevant security events, including credential changes and administrative actions 
Exclude private keys, session tokens, recovery tokens, and sensitive challenge material from logs 
Keep secrets outside source control and use secure session cookie settings 
Use HTTPS in deployed environments and secure local development 
Pin and review dependencies, run automated dependency and security checks 
Verify that a clean Docker deployment works using the documented instructions 

Security Test Cases 

1. 
Test: Register a new user with a valid passkey 
Result: registration succedds and the credential is saved 

Test: Register a passkey, then inspect the database
Result: credential ID and public key are stored

Test: Submit a registration response with an incorrect challenge
Result: registration rejected 

Test: Submit an authentication assertion with an incorrect challenge
Result: login is rejected 

Test: Submit an assertion with an invalid signatur
Result: login is rejected 

Test: Submit an assertion with an incorrect origin
Result: login is rejected 

Test: Submit an assertion with an incorrect relying party ID 
Result: login is rejected 

Test: Attempt authentication with an unknown credential ID
Result: authentication fails and no session is created 

Test: Authenticate with a valid passkey and required user verfication 
Result: login succeeds and a valid session is established 

Test: Attempt to authenticate without require user verfication 
Result: authentication is rejected when verfication is required by the server's policy 

2. Authorization and passkey verfication 

Test: Attempt to access another user's account information while logged in as a different user
Result: Access is denied, and the user cannot view another user's private information

Test: Attempt to access an administrator-only endpoint while logged in as a regular user
Result: The request is rejected because the user does not have administrator permissions

Test: Attempt to assign administrator privileges to a regular user without authorization
Result: The role change is rejected, and the user's permissions remain unchanged

Test: Attempt to access a protected API endpoint without being logged in
Result: Access is denied, and no protected information is returned

Test: Have an administrator perform an authorized role assignment
Result: The role assignment succeeds, and the action is recorded in the audit log

3. Authorization and account isolation 

Test: Log in successfully using a valid passkey
Result: An authenticated session is created, and the user can access protected resources

Test: Log out and attempt to reuse the previous session
Result: The previous session is invalidated, and access to protected resources is denied

Test: Attempt to access a protected page after the session expires
Result: Access is denied until the user authenticates again

Test: Attempt to modify a session identifier to access another user's session
Result: The modified session is rejected, and the user cannot access another user's account

Test: Authenticate successfully and inspect the session cookie
Result: The session cookie uses appropriate security setting, including HttpOnly, Secure in HTTPS deployments, and an appropriate SameSite policy

4. Abuse prevention and revcovery

Test: Repeatedly submit invalid authentication responses until the configured rate limit is reached
Result: Additional attempts are restricted according to the configured rate-limiting policy

Test: Submit repeated failed login requests from the same client
Result: The server limits excessive requests and continues to handle legitimate requests appropriately

Test: Repeatedly request new authentication challenges
Result: Challenge requests are rate-limited according to the configured policy

Test: Repeatedly attempt account recovery beyond the configured limit
Result: Further recovery attempts are restricted, and the account recovery mechanism remains protected

Test: Wait until the rate-limit window expires and attempt authentication with a valid passkey
Result: The rate limit is lifted according to policy, and valid authentication can proceed

5. Logging, configuration, and deployment

Test: Log in successfully using a valid passkey
Result: A successful authentication event is recorded with a timestamp and relevant account identifier

Test: Attempt to log in using an invalid authentication response
Result: A failed authentication event is recorded without exposing sensitive authentication information

Test: Attempt to access an administrator-only endpoint without the required role
Result: The denied authorization attempt is recorded in the audit log

Test: Register or remove a passkey
Result: The credential change is recorded with the relevant account identifier, timestamp, and event outcome

Test: Have an administrator change a user's role
Result: The administrative action is recorded so it can be reviewed later

Test: Inspect application logs for private keys, session tokens, and recovery tokens
Result: Sensitive authentication information is not exposed in the logs

