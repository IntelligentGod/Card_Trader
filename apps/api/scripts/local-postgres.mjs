/**
 * Runs a real PostgreSQL server locally without Docker or an installer, using
 * the `embedded-postgres` binaries. Development only.
 *
 * Data lives OUTSIDE the repo (default %LOCALAPPDATA%/card-trader/pgdata or
 * ~/.card-trader/card-trader/pgdata) so cloud-sync folders never touch database files.
 *
 *   npm run db:start          # keep this terminal open
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const baseDir = process.env.LOCAL_PG_DIR ?? join(process.env.LOCALAPPDATA ?? join(homedir(), '.card-trader'), 'card-trader');
const databaseDir = join(baseDir, 'pgdata');
const DATABASES = ['cardtrader', 'cardtrader_test'];

/** True when something is already listening on the port. */
function portInUse(p) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: p });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

if (await portInUse(port)) {
  console.log(`PostgreSQL is already running on port ${port} — nothing to do.`);
  console.log(`Connection: postgresql://cardtrader:cardtrader@localhost:${port}/cardtrader`);
  console.log('To stop it, close the terminal that started it (or end the "postgres" processes in Task Manager).');
  process.exit(0);
}

// A crash or forced shutdown can leave a stale lock file that blocks startup.
const pidFile = join(databaseDir, 'postmaster.pid');
if (existsSync(pidFile)) {
  console.log('Removing stale postmaster.pid from a previous run.');
  rmSync(pidFile);
}

mkdirSync(baseDir, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'cardtrader',
  password: 'cardtrader',
  port,
  persistent: true,
  onLog: () => undefined,
});

try {
  if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
    console.log(`Initialising new cluster in ${databaseDir}`);
    await pg.initialise();
  }
  await pg.start();
} catch (error) {
  // embedded-postgres sometimes rejects with no error object; always say something useful.
  console.error(`Could not start PostgreSQL on port ${port}.`);
  if (error) console.error(error instanceof Error ? error.message : String(error));
  console.error(`Data directory: ${databaseDir}`);
  console.error('Try: close other terminals running db:start, or set LOCAL_PG_PORT to a free port.');
  process.exit(1);
}

for (const name of DATABASES) {
  try {
    await pg.createDatabase(name);
    console.log(`Created database ${name}`);
  } catch {
    // already exists
  }
}

console.log(`PostgreSQL running on postgresql://cardtrader:cardtrader@localhost:${port}/cardtrader`);
console.log('Press Ctrl+C to stop.');

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
setInterval(() => undefined, 1 << 30);
