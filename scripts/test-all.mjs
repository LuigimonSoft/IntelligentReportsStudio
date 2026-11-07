// Build and test the actual sources in isolation from a running development app.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const end2end = path.join(root, 'end2end');
const runtime = path.join(root, 'runtime');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const cargo = isWindows ? 'cargo.exe' : 'cargo';
const env = { ...process.env, CARGO_TERM_COLOR: 'never' };
if (env.NO_COLOR) env.NO_COLOR = 'true';
const chromiumOnly = process.argv.includes('--chromium-only');
const run = (label, command, args, options = {}) => new Promise((resolve, reject) => {
  console.log(`\n=== ${label} ===`);
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', ...options, shell: isWindows && command.endsWith('.cmd') });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${label} failed (${signal ?? code}).`)));
});
const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});
const temp = await mkdtemp(path.join(os.tmpdir(), 'reportstudio-tests-'));
try {
  await run('Development watcher', process.execPath, ['--test', 'scripts/tests/source-snapshot.test.mjs']);
  await run('Report engine', npm, ['test'], { cwd: runtime });
  await run('Rust document model', cargo, ['test', '-p', 'app', '--lib']);
  await run('Tauri native commands', cargo, ['test', '-p', 'intelligent_reports_studio', '--lib']);
  await run('Build browser runtime', npm, ['run', 'build'], { cwd: runtime });
  await run('Build isolated frontend', process.execPath, ['scripts/frontend.mjs', 'build', '--dist', temp]);
  const testEnv = { ...env, CI: '1', REPORTSTUDIO_ASSET_DIR: temp, REPORTSTUDIO_PORT: String(await freePort()) };
  const runDir = path.join(end2end, 'test-runs', `${Date.now()}-${process.pid}`);
  testEnv.REPORTSTUDIO_TEST_OUTPUT = path.join(runDir, 'results');
  testEnv.REPORTSTUDIO_HTML_OUTPUT = path.join(runDir, 'report');
  delete testEnv.REPORTSTUDIO_URL;
  console.log(`Playwright artifacts: ${runDir}`);
  if (chromiumOnly) delete testEnv.REPORTSTUDIO_WEBKIT; else testEnv.REPORTSTUDIO_WEBKIT = '1';
  await run('Playwright browser interactions', process.execPath, [path.join(end2end, 'node_modules', '@playwright', 'test', 'cli.js'), 'test'], { cwd: end2end, env: testEnv });
  console.log('\nAll report engine, native and browser tests passed.');
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
