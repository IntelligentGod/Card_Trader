import { createHash } from 'crypto';
import type { AuthResponse, MeResponse, RecoveryCodesResponse, TwoFactorChallengeResponse, TwoFactorSetupResponse } from '@card-trader/shared';
import { base32Decode, hotp, totpStep } from '../src/common/security/totp';
import { createTestIdentityProviders, type TestIdentityProviders } from './oidc-test-keys';
import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext, type TestUser } from './utils';

const PASSWORD = 'Tr4ding-Cards-Rock';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('Sign-in security (e2e)', () => {
  let ctx: TestContext;
  let idp: TestIdentityProviders;

  beforeAll(async () => {
    idp = await createTestIdentityProviders();
    ctx = await createTestApp({ oidcKeys: idp.keys });
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const me = (user: { token: string }) => ctx.http().get(`${API}/users/me`).set(auth(user)).then((r) => r.body as MeResponse);
  const login = (email: string, password = PASSWORD) => ctx.http().post(`${API}/auth/login`).send({ email, password });

  describe('sign-up', () => {
    it('creates a password account without any email verification step', async () => {
      const alice = await registerUser(ctx, 'Alice');
      expect(await me(alice)).toMatchObject({ emailVerified: false, hasPassword: true, authProviders: ['PASSWORD'], twoFactorEnabled: false });
      await ctx.http().post(`${API}/auth/resend-verification`).set(auth(alice)).expect(404);
      await ctx.http().get(`${API}/auth/verify-email`).query({ token: 'x'.repeat(43) }).expect(404);
    });
  });

  describe('Google sign-in', () => {
    const googleLogin = (idToken: string) => ctx.http().post(`${API}/auth/google`).send({ idToken });

    it('creates a verified account from a valid ID token, then signs the same user in again', async () => {
      const token = await idp.googleToken({ sub: 'google-1', email: 'Gina@Gmail.com', email_verified: true, name: 'Gina Cards' });
      const first = (await googleLogin(token).expect(200)).body as AuthResponse;
      expect(first.user).toMatchObject({ email: 'gina@gmail.com', displayName: 'Gina Cards', emailVerified: true, hasPassword: false, authProviders: ['GOOGLE'] });
      expect(first.user.username).toMatch(/^gina/);

      const second = (await googleLogin(await idp.googleToken({ sub: 'google-1', email: 'gina@gmail.com', email_verified: true })).expect(200)).body as AuthResponse;
      expect(second.user.publicId).toBe(first.user.publicId);
      // Nothing about the provider token is stored.
      const stored = await ctx.prisma.userAuthProvider.findFirstOrThrow({ where: { provider: 'GOOGLE' } });
      expect(stored).toMatchObject({ providerUserId: 'google-1', providerEmail: 'gina@gmail.com' });
    });

    it('links to an existing account only when that account’s email is proven', async () => {
      const carol = await registerUser(ctx, 'Carol');
      const token = await idp.googleToken({ sub: 'google-carol', email: carol.email, email_verified: true });
      expect((await googleLogin(token).expect(409)).body.code).toBe('ACCOUNT_EXISTS_UNVERIFIED');

      // Only Google/Apple sign-up or the super-admin bootstrap mark an email as proven now.
      await ctx.prisma.user.update({ where: { id: carol.userId }, data: { emailVerifiedAt: new Date() } });
      const linked = (await googleLogin(token).expect(200)).body as AuthResponse;
      expect(linked.user.publicId).toBe(carol.publicId);
      expect(linked.user.authProviders.sort()).toEqual(['GOOGLE', 'PASSWORD']);
    });

    it('rejects forged, expired, wrong-audience and wrong-issuer tokens', async () => {
      const claims = { sub: 'google-evil', email: 'evil@gmail.com', email_verified: true };
      for (const token of [
        await idp.googleToken(claims, { signWith: 'stranger' }),
        await idp.googleToken(claims, { audience: 'someone-elses-app.apps.googleusercontent.com' }),
        await idp.googleToken(claims, { issuer: 'https://evil.example.com' }),
        await idp.googleToken(claims, { expiresIn: '-1m' }),
        await idp.googleToken(claims, { signWith: 'apple' }),
        'not.a.jwt.at.all.but.long.enough',
      ]) {
        const res = await googleLogin(token).expect(401);
        expect(res.body.code).toBe('INVALID_PROVIDER_TOKEN');
      }
      expect(await ctx.prisma.user.findUnique({ where: { email: 'evil@gmail.com' } })).toBeNull();
    });

    it('refuses an unverified Google email', async () => {
      const token = await idp.googleToken({ sub: 'google-2', email: 'nope@gmail.com', email_verified: false });
      expect((await googleLogin(token).expect(422)).body.code).toBe('PROVIDER_EMAIL_UNVERIFIED');
    });
  });

  describe('Sign in with Apple', () => {
    const nonce = 'raw-nonce-0123456789abcdef';

    it('signs in when the token carries the SHA-256 of our nonce', async () => {
      const identityToken = await idp.appleToken({ sub: 'apple-1', email: 'x7@privaterelay.appleid.com', email_verified: 'true', nonce: sha256(nonce) });
      const res = (await ctx.http().post(`${API}/auth/apple`).send({ identityToken, nonce, fullName: { givenName: 'Ada', familyName: 'Apple' } }).expect(200))
        .body as AuthResponse;
      expect(res.user).toMatchObject({ displayName: 'Ada Apple', emailVerified: true, authProviders: ['APPLE'] });
    });

    it('rejects a replayed token (nonce mismatch) and a token for another app', async () => {
      const identityToken = await idp.appleToken({ sub: 'apple-1', email: 'x7@privaterelay.appleid.com', email_verified: 'true', nonce: sha256(nonce) });
      await ctx.http().post(`${API}/auth/apple`).send({ identityToken, nonce: 'another-nonce-0123456789' }).expect(401);
      const otherApp = await idp.appleToken({ sub: 'apple-1', nonce: sha256(nonce) }, { audience: 'com.someone.else' });
      await ctx.http().post(`${API}/auth/apple`).send({ identityToken: otherApp, nonce }).expect(401);
    });
  });

  describe('password lockout and change', () => {
    it('locks the account for 15 minutes after 5 wrong passwords', async () => {
      const dave = await registerUser(ctx, 'Dave');
      for (let i = 0; i < 5; i++) await login(dave.email, 'wrong-password-123').expect(401);
      const locked = await login(dave.email).expect(429);
      expect(locked.body.code).toBe('ACCOUNT_LOCKED');
      await ctx.prisma.user.update({ where: { id: dave.userId }, data: { loginLockedUntil: new Date(Date.now() - 1000) } });
      await login(dave.email).expect(200);
    });

    it('changing the password ends every other session', async () => {
      const erin = await registerUser(ctx, 'Erin');
      await ctx.http().post(`${API}/auth/change-password`).set(auth(erin)).send({ currentPassword: 'wrong-password-1', newPassword: 'Brand-New-Pass-42' }).expect(400);
      // Tokens issued in the same second as the change stay valid by design; step past it.
      await new Promise((r) => setTimeout(r, 1100));
      const changed = (await ctx.http().post(`${API}/auth/change-password`).set(auth(erin)).send({ currentPassword: PASSWORD, newPassword: 'Brand-New-Pass-42' }).expect(200))
        .body as AuthResponse;

      await ctx.http().get(`${API}/users/me`).set(auth(erin)).expect(401);
      await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: erin.refreshToken }).expect(401);
      await ctx.http().get(`${API}/users/me`).set({ Authorization: `Bearer ${changed.tokens.accessToken}` }).expect(200);
      await login(erin.email).expect(401);
      await login(erin.email, 'Brand-New-Pass-42').expect(200);
    });
  });

  describe('linking sign-in methods', () => {
    it('links Google to the signed-in account and won’t remove the last method', async () => {
      const frank = await registerUser(ctx, 'Frank');
      const idToken = await idp.googleToken({ sub: 'google-frank', email: 'frank.other@gmail.com', email_verified: true });
      const linked = (await ctx.http().post(`${API}/auth/providers/google`).set(auth(frank)).send({ idToken }).expect(200)).body as MeResponse;
      expect(linked.authProviders.sort()).toEqual(['GOOGLE', 'PASSWORD']);
      // Someone else can't take it.
      const grace = await registerUser(ctx, 'Grace');
      expect((await ctx.http().post(`${API}/auth/providers/google`).set(auth(grace)).send({ idToken }).expect(409)).body.code).toBe('PROVIDER_ALREADY_LINKED');

      const gina = await ctx.http().post(`${API}/auth/google`).send({ idToken: await idp.googleToken({ sub: 'google-1', email: 'gina@gmail.com', email_verified: true }) });
      const ginaUser = { token: (gina.body as AuthResponse).tokens.accessToken };
      expect((await ctx.http().delete(`${API}/auth/providers/GOOGLE`).set(auth(ginaUser)).expect(409)).body.code).toBe('LAST_SIGN_IN_METHOD');
      await ctx.http().delete(`${API}/auth/providers/GOOGLE`).set(auth(frank)).expect(200);
    });
  });

  describe('two-factor authentication', () => {
    let henry: TestUser;
    let secret: Buffer;
    let recoveryCodes: string[];
    const codeAt = (offsetSteps = 0) => hotp(secret, totpStep(Date.now()) + offsetSteps);
    /** Each step accepts one code; tests reset the replay marker between sign-ins. */
    const allowNextCode = () => ctx.prisma.user.update({ where: { id: henry.userId }, data: { twoFactorLastStep: null } });
    const startLogin = async () => (await login(henry.email).expect(200)).body as TwoFactorChallengeResponse;

    beforeAll(async () => {
      henry = await registerUser(ctx, 'Henry');
    });

    it('sets up with a QR secret, refuses a wrong code and enables with the right one', async () => {
      const setup = (await ctx.http().post(`${API}/auth/2fa/setup`).set(auth(henry)).expect(200)).body as TwoFactorSetupResponse;
      expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Card%20Trader%3A/);
      secret = base32Decode(setup.secret);
      const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: henry.userId } });
      expect(stored.twoFactorSecretEncrypted).not.toContain(setup.secret);

      const wrong = await ctx.http().post(`${API}/auth/2fa/enable`).set(auth(henry)).send({ code: codeAt(5) }).expect(401);
      expect(wrong.body.code).toBe('INVALID_2FA_CODE');
      const enabled = (await ctx.http().post(`${API}/auth/2fa/enable`).set(auth(henry)).send({ code: codeAt() }).expect(200)).body as RecoveryCodesResponse;
      recoveryCodes = enabled.recoveryCodes;
      expect(recoveryCodes).toHaveLength(10);
      expect((await me(henry)).twoFactorEnabled).toBe(true);
      // The secret is never shown again.
      expect((await ctx.http().post(`${API}/auth/2fa/setup`).set(auth(henry)).expect(409)).body.code).toBe('2FA_ALREADY_ENABLED');
    });

    it('requires the code before any session is issued', async () => {
      const challenge = await startLogin();
      expect(challenge).toMatchObject({ twoFactorRequired: true, expiresIn: 300 });
      expect(challenge).not.toHaveProperty('tokens');

      await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: codeAt(10) }).expect(401);
      await allowNextCode();
      const done = (await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: codeAt() }).expect(200)).body as AuthResponse;
      expect(done.tokens.accessToken).toBeTruthy();
      // A challenge works once.
      await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: codeAt() }).expect(401);
    });

    it('refuses a replayed code', async () => {
      const challenge = await startLogin();
      // The code from the previous test's step was already used.
      const replay = await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: codeAt() }).expect(401);
      expect(replay.body.code).toBe('INVALID_2FA_CODE');
    });

    it('burns the challenge after 5 wrong codes', async () => {
      const challenge = await startLogin();
      for (let i = 0; i < 5; i++) await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: '000000' }).expect(401);
      await allowNextCode();
      const burnt = await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: challenge.challengeToken, code: codeAt() }).expect(401);
      expect(burnt.body.code).toBe('2FA_CHALLENGE_EXPIRED');
    });

    it('accepts each recovery code exactly once', async () => {
      const first = await startLogin();
      await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: first.challengeToken, recoveryCode: recoveryCodes[0]!.toUpperCase() }).expect(200);
      const second = await startLogin();
      expect((await ctx.http().post(`${API}/auth/2fa/verify`).send({ challengeToken: second.challengeToken, recoveryCode: recoveryCodes[0] }).expect(401)).body.code).toBe(
        'INVALID_RECOVERY_CODE',
      );
    });

    it('also guards Google sign-in', async () => {
      await ctx.prisma.user.update({ where: { id: henry.userId }, data: { emailVerifiedAt: new Date() } });
      const res = (await ctx.http().post(`${API}/auth/google`).send({ idToken: await idp.googleToken({ sub: 'google-henry', email: henry.email, email_verified: true }) }).expect(200))
        .body as TwoFactorChallengeResponse;
      expect(res.twoFactorRequired).toBe(true);
    });

    it('disables only with a valid code, and sign-in no longer asks', async () => {
      await ctx.http().post(`${API}/auth/2fa/disable`).set(auth(henry)).send({ code: '123456' }).expect(401);
      await allowNextCode();
      await ctx.http().post(`${API}/auth/2fa/disable`).set(auth(henry)).send({ code: codeAt() }).expect(204);
      expect(await ctx.prisma.twoFactorRecoveryCode.count({ where: { userId: henry.userId } })).toBe(0);
      const res = (await login(henry.email).expect(200)).body as AuthResponse;
      expect(res.tokens.accessToken).toBeTruthy();
    });
  });
});
