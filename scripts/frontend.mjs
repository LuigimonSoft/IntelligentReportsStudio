// Cross-platform CSR build entry point used by both Tauri and local development.
import {spawn, execFileSync} from 'node:child_process';
import {mkdir, lstat, readlink, symlink, rename, mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {buildRuntime} from './runtime-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (!['build', 'serve', 'watch'].includes(args[0])) {
  console.error('Usage: node scripts/frontend.mjs <build|serve|watch> [--release]');
  process.exit(1);
}
const env = {...process.env};
// Trunk parses NO_COLOR as a boolean, while many terminals export 1.
if (env.NO_COLOR) env.NO_COLOR = 'true';
if (process.platform === 'darwin') {
  // Synced Documents folders can evict generated binaries and block Cargo reads.
  const key = execFileSync('cksum', {input: root.replace(/\/$/, ''), encoding: 'utf8'}).split(/\s+/)[0];
  const cache = path.resolve(env.REPORTSTUDIO_BUILD_CACHE || path.join(os.homedir(), 'Library/Caches/ReportStudio', key));
  env.CARGO_TARGET_DIR = path.join(cache, 'front');
  await mkdir(path.join(root, 'target'), {recursive:true});
  for (const [name, destination] of [['csr', path.join(cache, 'csr')], ['desktop', path.join(cache, 'desktop')]]) {
    await mkdir(destination, {recursive:true});
    const link = path.join(root, 'target', name);
    const existing = await lstat(link).catch(error => {if(error.code !== 'ENOENT')throw error;});
    if (existing?.isSymbolicLink() && await readlink(link) === destination) continue;
    if (existing) {
      // Keep the backup on the same volume: a relocated project may be on
      // an external disk, where rename() into the user cache fails with EXDEV.
      const backup = await mkdtemp(path.join(root, 'target', `previous-${name}-`));
      await rename(link, path.join(backup,'output'));
    }
    await symlink(destination, link, 'dir');
  }
  console.log(`Report Studio CSR build cache: ${cache}`);
}
if (['serve', 'watch'].includes(args[0])) {
  const {serveFrontend} = await import('./dev-server.mjs');
  await serveFrontend(root,env,args.slice(1),{serve:args[0] === 'serve',beforeBuild:()=>buildRuntime(root,env)});
} else {
await buildRuntime(root,env);
const child = spawn('trunk', args, {cwd:root, env, stdio:'inherit'});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {console.error(error.message);process.exitCode=1;});
child.on('exit', (code, signal) => {process.exitCode=code ?? (signal ? 1 : 0);});

}
