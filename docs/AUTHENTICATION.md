# Authentication and Password Recovery

## Registration and login

Registration accepts name, email, username, password, and password confirmation.
Email and username are normalized and validated. The controller explicitly
hashes passwords with bcrypt using cost 10 before persistence. Registration
sends a verification email whose token is stored as a SHA-256 hash and expires
after 24 hours.

Login normalizes email, requires a verified account, compares the submitted
password with bcrypt, and returns a JWT plus the supported user profile. JWTs
are signed with `JWT_SECRET` and expire after seven days.

Protected middleware:

1. reads the Bearer token;
2. verifies it with `JWT_SECRET`;
3. loads the referenced user without the password;
4. returns 401 if the token is absent, invalid, or references a deleted user.

Ownership and active Space membership checks remain separate authorization
boundaries and normally return 403 when an authenticated user lacks access.

## Client sessions

The web `AuthProvider` stores the authenticated user/token representation in
browser storage and configures Axios authentication.

Mobile:

- stores native session data through Expo SecureStore;
- uses versioned browser storage on Expo web;
- restores the session before protected routes render;
- injects the token through the shared Axios client;
- coordinates concurrent 401 responses so logout/session expiry runs once;
- replaces navigation with `/sign-in` after logout or invalid session;
- does not treat 403 as session expiry.

## Forgot-password request

`POST /api/auth/forgot-password`:

- normalizes the submitted email;
- returns the same neutral response whether the account exists:
  `If an account exists, a password reset email has been sent.`;
- generates a cryptographically random raw token;
- stores only its SHA-256 hash and a one-hour expiry;
- sends the raw token only inside the reset URL;
- is limited to five requests per 15 minutes.

Email-delivery failure does not disclose account existence through the response.
The raw token is not returned by the API or logged.

## Password reset

The email links to:

```text
${CLIENT_URL}/reset-password/:token
```

The web page validates matching passwords with the same minimum six-character
rule used by registration and submits:

```text
POST /api/auth/reset-password/:token
```

The controller hashes the new password with bcrypt cost 10 before the atomic
database update. The `findOneAndUpdate` predicate contains both the SHA-256
token hash and `resetPasswordExpires > now`. The same update writes the already
hashed password and clears both reset fields. Concurrent reuse therefore yields
one success; later attempts receive the normal invalid/expired-token response.
Reset attempts are limited to ten per 15 minutes.

## Mobile recovery boundary

Mobile provides the signed-out request screen only. It validates the email,
prevents repeated submission, calls the existing forgot-password endpoint, and
shows the neutral confirmation. Reset completion intentionally remains on the
web page; mobile has no native token route or duplicate reset implementation.

## URL and email configuration

Required email/app settings:

```text
CLIENT_URL
SERVER_URL
ALLOW_LOCALHOST_EMAIL_LINKS
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
```

Localhost, loopback, `.local`, and private LAN email links are accepted only
when `ALLOW_LOCALHOST_EMAIL_LINKS=true`. With that control disabled, local or
private URLs and non-HTTPS public `CLIENT_URL` values fail email configuration
validation.

Production and tester APK environments must set:

```env
CLIENT_URL=https://deployed-web-client.example
ALLOW_LOCALHOST_EMAIL_LINKS=false
```

Do not introduce a mobile reset URL unless the token-handling architecture is
redesigned and reviewed separately.

## Security regression coverage

Backend tests cover neutral responses, hashed token storage, bounded expiry,
bcrypt persistence, invalid/expired tokens, atomic single use, concurrent reset,
rate limiting, URL controls, and absence of plaintext password/token responses.
The real persistence case uses `MONGO_TRANSACTION_TEST_URI` and skips when it is
not configured.
