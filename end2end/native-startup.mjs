// Run from any directory: node end2end/native-startup.mjs
// This checks the real Tauri WebView, not a browser with mocked native APIs.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'end2end/test-results/native-startup.log');
const stableMs = Number(process.env.REPORTSTUDIO_STABILITY_MS || 20000);
const timeoutMs = Number(process.env.REPORTSTUDIO_STARTUP_TIMEOUT_MS || 600000);
const child = spawn('cargo', ['tauri', 'dev'], {
  cwd: root,
  env: { ...process.env, CARGO_TERM_COLOR: 'never', CARGO_TERM_PROGRESS_WHEN: 'never' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});

let log = '';
let launches = 0;
let launchesAtReady = 0;
let stableTimer;
let startupTimer;
let stopping = false;
try {
  await new Promise((resolve, reject) => {
    startupTimer = setTimeout(() => reject(new Error('Native frontend did not become ready.')), timeoutMs);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (!stopping) reject(new Error(`Tauri exited before verification: ${code ?? signal}`));
    });
    const read = (chunk) => {
      const text = chunk.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
      log += text;
      launches = (log.match(/Running DevCommand/g) || []).length;
      if ((log.match(/Report Studio WebView mounted and ready/g) || []).length > 1) reject(new Error('Native WebView reloaded after mounting.'));
      if (stableTimer && launches > launchesAtReady) reject(new Error('Native application restarted after mounting.'));
      if (/The application panicked|Code Signature Invalid/.test(log)) {
        reject(new Error('Native process or WebView failed; see native-startup.log.'));
      }
      if (!stableTimer && log.includes('Report Studio WebView mounted and ready')) {
        launchesAtReady = launches;
        console.log(`Native WebView mounted; checking stability for ${stableMs / 1000}s.`);
        stableTimer = setTimeout(resolve, stableMs);
      }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
  });
  console.log('PASS: cargo tauri dev opened a mounted native WebView without restarting.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopping = true;
  clearTimeout(startupTimer);
  clearTimeout(stableTimer);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, log);
  console.log(`Native startup log: ${output}`);
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
  } else {
    // Stop this test's process group, including Cargo's native child, so no
    // orphaned window or development server can mask the next startup check.
    try { process.kill(-child.pid, 'SIGINT'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
