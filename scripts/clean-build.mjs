// Stage a clean source snapshot on the local filesystem before invoking Tauri.
// This avoids AppleDouble files on external volumes without changing the source.
import {cp, mkdir, mkdtemp, rm, symlink, stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? 'build';
if (!['build', 'dev', 'prepare'].includes(mode)) throw new Error('Use: node scripts/clean-build.mjs build|dev|prepare');
const parent = path.join(os.tmpdir(), 'reportstudio-build');
await mkdir(parent, {recursive: true});
const stage = await mkdtemp(path.join(parent, 'source-'));
await cp(root, stage, {recursive: true, filter: source => {
  const relative = path.relative(root, source);
  return !relative.split(path.sep).some(part => part.startsWith('._') || ['.git', 'target', 'node_modules'].includes(part));
}});
for (const directory of ['runtime', 'end2end']) {
  try {
    const dependencies = path.join(root, directory, 'node_modules');
    if ((await stat(dependencies)).isDirectory()) await symlink(dependencies, path.join(stage, directory, 'node_modules'), 'dir');
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Clean source snapshot: ${stage}`);
if (mode !== 'prepare') {
  const child = spawn('cargo', ['tauri', mode, ...process.argv.slice(3)], {cwd: stage, stdio: 'inherit', env: process.env});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0))); });
  if (mode === 'dev') await rm(stage, {recursive:true, force:true});
  process.exitCode = status;
}
