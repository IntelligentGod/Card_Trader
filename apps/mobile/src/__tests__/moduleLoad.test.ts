import { readdirSync } from 'fs';
import { join, relative } from 'path';

/**
 * Loads every source file the way the app does at start-up. Anything that runs a hook
 * (useTheme, useStyles, …) at module level instead of inside a component throws here;
 * in the release app the same mistake crashes on launch.
 */
const SRC = join(__dirname, '..');
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });

describe('every module loads without running hooks at import time', () => {
  const files = sourceFiles(SRC).map((file) => relative(SRC, file));

  it('finds the app’s source files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s', (file) => {
    jest.isolateModules(() => {
      expect(() => require(join(SRC, file))).not.toThrow();
    });
  });
});
