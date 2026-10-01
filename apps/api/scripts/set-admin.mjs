/**
 * Sets roles from the server. SUPER_ADMIN can only be granted here (never through
 * the API); in the app, the super admin manages ADMIN roles.
 *
 *   npm run admin:grant -w @card-trader/api -- someone@example.com    # ADMIN
 *   npm run admin:super -w @card-trader/api -- someone@example.com    # SUPER_ADMIN
 *   npm run admin:revoke -w @card-trader/api -- someone@example.com   # back to USER
 *   npm run admin:list -w @card-trader/api
 *
 * Reads DATABASE_URL from apps/api/.env (Prisma loads it automatically).
 */
import { PrismaClient } from '@prisma/client';

const [command, rawEmail] = process.argv.slice(2);
const prisma = new PrismaClient();

async function main() {
  if (command === 'list') {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { email: true, role: true, status: true, profile: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (admins.length === 0) console.log('No admins yet.');
    for (const a of admins) console.log(`${a.role.padEnd(11)} ${a.email}  (${a.profile?.displayName ?? '-'}, ${a.status})`);
    return;
  }

  if (!['grant', 'super', 'revoke'].includes(command) || !rawEmail) {
    console.error('Usage: set-admin.mjs grant|super|revoke <email>   or   set-admin.mjs list');
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    console.error(`No user with email ${email}. They need to sign up first.`);
    process.exitCode = 1;
    return;
  }
  const role = command === 'grant' ? 'ADMIN' : command === 'super' ? 'SUPER_ADMIN' : 'USER';
  if (user.role === role) {
    console.log(`${email} is already ${role}.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${email} is now ${role}. The change applies to their next request; no new sign-in needed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
