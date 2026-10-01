# Sign-in, 2FA, email verification, notifications and admin roles

This is the operator guide for the security features: what to configure, how to
bootstrap the super admin, and how to test each flow. API details live in
Swagger (`/docs` in development) and in `packages/shared/src/api-types.ts`.

## 1. Environment variables

### API (`apps/api/.env`, never committed)

| Variable | Required | Purpose |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | to bootstrap | Email of the super admin created on first start |
| `SUPER_ADMIN_INITIAL_PASSWORD` | to bootstrap | Initial password (≥ 12 chars). Only read while that account doesn't exist; remove it after the first sign-in |
| `GOOGLE_CLIENT_IDS` | for Google sign-in | Comma-separated OAuth client ids allowed as the ID token audience (the **Web** client id the app passes as `webClientId`, plus iOS/Android ids if you use them) |
| `APPLE_CLIENT_IDS` | for Apple sign-in | Comma-separated audiences — the iOS bundle id `com.cardtrader.app` |
| `TWO_FACTOR_ENCRYPTION_KEY` | yes in production | 32 random bytes, base64. Encrypts TOTP secrets (AES-256-GCM). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Changing it makes every existing 2FA secret unreadable** |
| `TWO_FACTOR_ISSUER` | no | Name shown in authenticator apps (default `Card Trader`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | yes in production | Any SMTP provider. Without `SMTP_HOST`, development prints emails to the API log |
| `EMAIL_FROM` | yes | e.g. `Card Trader <no-reply@yourdomain.com>` — must be a sender your provider allows |
| `SUPPORT_EMAIL` | no | Support address |
| `EMAIL_VERIFICATION_TTL_HOURS` | no | Link lifetime (default 24) |
| `PUBLIC_BASE_URL` | yes | Used to build the verification link — must be reachable from the user's phone/browser (your LAN IP in development, your HTTPS domain in production) |

Production refuses to start without `TWO_FACTOR_ENCRYPTION_KEY` and `SMTP_HOST`.

### Mobile (`apps/mobile/.env` / `.env.production`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google **Web** OAuth client id. Without it the Google button is hidden |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google **iOS** client id (iOS builds only) |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Address used by Help → Contact Support |

`EXPO_PUBLIC_*` values are baked into the app; they are identifiers, not secrets. Never put passwords or client secrets there.

## 2. Google sign-in setup

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or pick) a project → **APIs & Services → OAuth consent screen**: app name, support email, authorised domain; add the `email` and `profile` scopes; publish (or add test users).
2. **Credentials → Create credentials → OAuth client ID**:
   - **Web application** — no redirect URI needed for native sign-in. Copy its client id → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (mobile) **and** into `GOOGLE_CLIENT_IDS` (API).
   - **Android** — package `com.cardtrader.app` and the **SHA-1** of the signing key. Get it with `cd apps/mobile/android && .\gradlew.bat signingReport` (use the release key's SHA-1 for release APKs; Play-signed apps: the SHA-1 from Play Console → App integrity).
   - **iOS** (if you ship iOS) — bundle id `com.cardtrader.app` → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and add its *reversed client id* as `iosUrlScheme` to the `@react-native-google-signin/google-signin` plugin in `app.json`.
3. Rebuild the native app (`npx expo prebuild --clean`, then the APK). Google sign-in does not work in Expo Go.

The server verifies every ID token's signature against Google's published keys, issuer, audience and expiry before trusting it, and stores only the Google user id (`sub`) and email.

## 3. Sign in with Apple setup (iPhone)

Requires a paid Apple Developer account.
1. **Certificates, Identifiers & Profiles → Identifiers** → the App ID `com.cardtrader.app` → enable **Sign In with Apple**.
2. `app.json` already has `ios.usesAppleSignIn: true` and the `expo-apple-authentication` plugin; regenerate the iOS project and rebuild.
3. API: `APPLE_CLIENT_IDS=com.cardtrader.app`.

The app sends Apple a SHA-256 of a one-time nonce and the server checks the token carries it, so a token can't be replayed. Apple shares the user's name only on the very first sign-in; private-relay emails (`…@privaterelay.appleid.com`) are treated as verified. Android shows Google and email only (by decision).

## 4. Email provider (SMTP)

Any SMTP service works. Typical settings:

| Provider | Host | Port / secure | User / password |
|---|---|---|---|
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 / false | SMTP credentials from SES |
| SendGrid | `smtp.sendgrid.net` | 587 / false | `apikey` / your API key |
| Mailgun | `smtp.mailgun.org` | 587 / false | domain SMTP login |
| Brevo | `smtp-relay.brevo.com` | 587 / false | SMTP login / key |
| Gmail (testing only) | `smtp.gmail.com` | 465 / true | your address / an **app password** (2-step verification required) |

Verify your sending domain with the provider (SPF/DKIM) so mail doesn't land in spam, and set `EMAIL_FROM` to an address on that domain.

## 5. Bootstrapping the super admin

1. Put in `apps/api/.env`:
   ```
   SUPER_ADMIN_EMAIL=willcomeo022@gmail.com
   SUPER_ADMIN_INITIAL_PASSWORD=<a long random password, typed here only>
   ```
2. Restart the API. The log says `Super admin … created`. The password is hashed with argon2id immediately.
3. Sign in (mobile or the admin website). You must choose a new password first.
4. Delete `SUPER_ADMIN_INITIAL_PASSWORD` from `.env` (it is ignored once the account exists anyway).

If an account with that email already exists, the bootstrap **does not** promote it (someone else might have registered the address); it logs a warning. Promote deliberately from the server: `npm run admin:super -w @card-trader/api -- willcomeo022@gmail.com`.

Other role commands (server only — there is no API to create a super admin):
```
npm run admin:grant  -w @card-trader/api -- someone@example.com   # ADMIN
npm run admin:revoke -w @card-trader/api -- someone@example.com   # back to USER
npm run admin:list   -w @card-trader/api
```

## 6. Roles

| | USER accounts | ADMIN accounts | SUPER_ADMIN |
|---|---|---|---|
| **ADMIN** | view, edit, reset password, block/unblock | view only | invisible (not listed, not searchable, 404) |
| **SUPER_ADMIN** | everything + change role | everything + change role, create admins | own profile only |

Nobody can change their own role or status. Enforced on the server for every request (`RolesGuard` + `permissionsFor`); the role is read from the database each time, so changes apply immediately. Blocking and password resets sign the user out everywhere at once. Every admin change is in the audit log (who, what, before/after, reason, IP); the full log and IPs are visible to the super admin only.

## 7. Testing

Automated: `npm run test:e2e` (sign-in security, admin roles, notifications, …) and `npm test`.

### 2FA by hand
1. Settings → Security → Two-factor authentication → Enable.
2. Scan the QR with Google Authenticator / Microsoft Authenticator / Authy (or type the secret).
3. Enter the 6-digit code → save the 10 recovery codes shown once.
4. Sign out and in: after the password you're asked for a code. Try a wrong code (rejected), the right one (signed in), a recovery code (works once).
5. Five wrong codes end the attempt — sign in again.

### Email verification by hand
Register a new account. Without SMTP the API log shows the email; open the link in a browser → "Email verified" → back in the app the reminder disappears. "Resend" works once a minute, five times an hour.

### Notifications by hand
Trigger one for Tom, e.g. as Sam edit the Austin show's admission (see README), or as the super admin send an announcement (admin → Announcement). With the app open a banner slides in at the top and disappears after a few seconds; tap it to open. The bell shows the unread count; the list shows the latest 6 with **Show all** for the full history; **Mark all as read** clears the badge. With the app in the background you get a phone notification instead. (There's no push service yet: notifications are fetched every 30 s while the app runs.)

## 8. Manual steps checklist

- [ ] Set `SUPER_ADMIN_INITIAL_PASSWORD`, start the API, sign in, change the password, remove it from `.env`.
- [ ] Create the Google OAuth clients; set `GOOGLE_CLIENT_IDS` (API) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app).
- [ ] (iOS) Enable Sign in with Apple on the App ID; set `APPLE_CLIENT_IDS`.
- [ ] Configure SMTP and `EMAIL_FROM`; verify the sending domain.
- [ ] Set `PUBLIC_BASE_URL` to an address phones can reach (HTTPS in production).
- [ ] Generate a production `TWO_FACTOR_ENCRYPTION_KEY` and keep it backed up with your secrets.
- [ ] Rebuild the app (`npx expo prebuild --clean`, then the APK) — new native modules.
- [ ] Production: put the API behind HTTPS and set `TRUST_PROXY=1` so rate limits and audit IPs see real client addresses.
