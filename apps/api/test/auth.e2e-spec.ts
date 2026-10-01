import { API, auth, createTestApp, registerUser, resetDatabase, type TestContext } from './utils';

describe('Auth & users (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });
  afterAll(async () => ctx.app.close());

  it('registers, never stores plain passwords, and never leaks secrets', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: '  Tom@Example.com ', password: 'Tr4ding-Cards-Rock', username: '@Tom_Cards', displayName: 'Tom' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'tom@example.com', username: 'tom_cards', displayName: 'Tom', vendor: null });
    expect(res.body.user.publicId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Tr4ding/);

    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'tom@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);

    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'tom@example.com', password: 'Another-Pass-123', username: 'tom_two', displayName: 'Tom 2' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('EMAIL_TAKEN'));

    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'someone@example.com', password: 'Another-Pass-123', username: 'TOM_CARDS', displayName: 'Other' })
      .expect(409)
      .expect((r) => expect(r.body.code).toBe('USERNAME_TAKEN'));
  });

  it('validates input and rejects unknown fields', async () => {
    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'not-an-email', password: 'short', username: 'no spaces!', displayName: 'x' })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('VALIDATION_FAILED'));

    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'a@b.co', password: 'Tr4ding-Cards-Rock', username: 'al_b', displayName: 'Al', isAdmin: true })
      .expect(400);

    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'weak@example.com', password: 'password123', username: 'weak_one', displayName: 'Weak' })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('WEAK_PASSWORD'));
  });

  it('logs in with the same error for wrong email or password', async () => {
    const wrongPassword = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: 'tom@example.com', password: 'wrong-password-1' })
      .expect(401);
    const wrongEmail = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'wrong-password-1' })
      .expect(401);
    expect(wrongPassword.body).toEqual(wrongEmail.body);

    await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: 'TOM@example.com', password: 'Tr4ding-Cards-Rock' })
      .expect(200);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const user = await registerUser(ctx);
    const first = await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: user.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    // Replaying the old token = theft signal → whole family revoked.
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('REFRESH_TOKEN_REUSED'));
    await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it('logout revokes the session', async () => {
    const user = await registerUser(ctx);
    await ctx.http().post(`${API}/auth/logout`).send({ refreshToken: user.refreshToken }).expect(204);
    await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: user.refreshToken }).expect(401);
  });

  it('requires a valid access token on protected routes', async () => {
    await ctx.http().get(`${API}/users/me`).expect(401);
    await ctx.http().get(`${API}/users/me`).set({ Authorization: 'Bearer nope' }).expect(401);
    const user = await registerUser(ctx, 'Alex');
    const me = await ctx.http().get(`${API}/users/me`).set(auth(user)).expect(200);
    expect(me.body.displayName).toBe('Alex');
  });

  it('updates the profile and exposes only public fields to others', async () => {
    const alex = await registerUser(ctx, 'Alex');
    const sam = await registerUser(ctx, 'Sam');
    await ctx.http().patch(`${API}/users/me`).set(auth(alex)).send({ bio: '  One Piece collector  ' }).expect(200);

    const pub = await ctx.http().get(`${API}/users/${alex.publicId}`).set(auth(sam)).expect(200);
    expect(pub.body).toMatchObject({ publicId: alex.publicId, displayName: 'Alex', bio: 'One Piece collector' });
    expect(pub.body.email).toBeUndefined();
    expect(JSON.stringify(pub.body)).not.toContain(alex.userId);

    await ctx
      .http()
      .patch(`${API}/users/me`)
      .set(auth(alex))
      .send({ avatarKey: `avatars/${sam.userId}/00000000-0000-4000-8000-000000000000.jpg` })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('INVALID_AVATAR_KEY'));
  });

  it('QR payload contains only the deep link with the public id', async () => {
    const user = await registerUser(ctx);
    const qr = await ctx.http().get(`${API}/users/me/qr`).set(auth(user)).expect(200);
    expect(qr.body).toEqual({ publicId: user.publicId, deepLink: `cardtrader://u/${user.publicId}` });
    await ctx.http().get(`${API}/users/doesNotExist99`).set(auth(user)).expect(404);
  });
});
