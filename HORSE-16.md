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