import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import type { AuthResponse } from '@card-trader/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { OIDC_KEY_SOURCES, type OidcKeySources } from '../src/modules/auth/oidc-verifier';
import { PrismaService } from '../src/prisma/prisma.service';

export const API = '/api/v1';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

/** `oidcKeys` replaces Google's/Apple's published signing keys with test keys. */
export async function createTestApp(options: { oidcKeys?: OidcKeySources } = {}): Promise<TestContext> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.oidcKeys) builder = builder.overrideProvider(OIDC_KEY_SOURCES).useValue(options.oidcKeys);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), http: () => request(app.getHttpServer()) };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  token: string;
  refreshToken: string;
  publicId: string;
  userId: string;
  email: string;
}

let userCounter = 0;

/** Registers through the API. Accounts are unlocked (as if bought) unless `paid: false`. */
export async function registerUser(ctx: TestContext, displayName = 'Collector', options: { paid?: boolean } = {}): Promise<TestUser> {
  userCounter++;
  const email = `user${userCounter}-${Date.now()}@example.com`;
  const res = await ctx
    .http()
    .post(`${API}/auth/register`)
    .send({ email, password: 'Tr4ding-Cards-Rock', username: `user${userCounter}_${Date.now() % 100000}`, displayName })
    .expect(201);
  const body = res.body as AuthResponse;
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  if (options.paid !== false) await ctx.prisma.user.update({ where: { id: user.id }, data: { paidAt: new Date(), paidVia: 'SEED' } });
  return {
    token: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    publicId: body.user.publicId,
    userId: user.id,
    email,
  };
}

export function auth(user: Pick<TestUser, 'token'>): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}

/** Creates a catalog card and a current estimate for the given tiers. */
export async function createCard(
  prisma: PrismaService,
  options: { name?: string; category?: 'POKEMON' | 'ONE_PIECE' | 'SPORTS'; values?: Record<string, number> } = {},
): Promise<string> {
  const category = options.category ?? 'POKEMON';
  const set = await prisma.cardSet.upsert({
    where: { category_code: { category, code: 'TEST' } },
    create: { category, code: 'TEST', name: 'Test Set', year: 2024 },
    update: {},
  });
  const card = await prisma.card.create({
    data: {
      setId: set.id,
      category,
      name: options.name ?? 'Pikachu',
      cardNumber: String(Math.floor(Math.random() * 1_000_000)),
      subject: options.name ?? 'Pikachu',
    },
  });
  for (const [priceTierKey, valueCents] of Object.entries(options.values ?? {})) {
    await prisma.cardMarketValue.create({
      data: {
        cardId: card.id,
        priceTierKey,
        valueCents,
        confidence: 'HIGH',
        sampleSize: 3,
        computedAt: new Date(),
        algorithm: 'test',
        nextRefreshAt: new Date(Date.now() + 86_400_000),
      },
    });
  }
  return card.id;
}

export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
