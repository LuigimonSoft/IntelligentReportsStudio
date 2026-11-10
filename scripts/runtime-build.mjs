// Generate the browser engine before Trunk copies public/vendor.
import {access, copyFile, lstat, readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';

async function run(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {...options, stdio:'inherit', shell:process.platform === 'win32' && command === 'npm'});
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code ?? signal}).`)));
  });
}

async function dependenciesReady(directory) {
  try {
    const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    for (const group of ['dependencies', 'devDependencies']) {
      const expectedSpecs = lock.packages?.['']?.[group] ?? {};
      const actualSpecs = manifest[group] ?? {};
      const names = new Set([...Object.keys(expectedSpecs), ...Object.keys(actualSpecs)]);
      for (const name of names) {
        if (expectedSpecs[name] !== actualSpecs[name]) return false;
        const entry = lock.packages?.[`node_modules/${name}`];
        const expected = entry?.link ? lock.packages?.[entry.resolved]?.version : entry?.version;
        const installed = JSON.parse(await readFile(path.join(directory, 'node_modules', name, 'package.json'), 'utf8'));
        if (!expected || installed.version !== expected) return false;
      }
    }
    const executable = path.join(directory, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`,
      process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild');
    await access(executable);
    await access(path.join(directory, 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs'));
    return true;
  } catch { return false; }
}

export async function buildRuntime(root, env = process.env) {
  const directory = path.join(root, 'runtime');
  if (!await dependenciesReady(directory)) {
    const installed = await lstat(path.join(directory, 'node_modules')).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    // Never let npm ci remove or rewrite dependencies owned by a symlink target.
    if (installed?.isSymbolicLink()) throw new Error('The runtime/node_modules symlink is incomplete or outdated. Run npm ci in its source directory and retry.');
    console.log('Report Studio: installing locked runtime dependencies (npm ci).');
    try { await run('npm', ['ci', '--no-audit', '--no-fund'], {cwd:directory, env}); }
    catch (error) { throw new Error(`Unable to install runtime dependencies. Run npm ci in runtime and retry. ${error.message}`); }
  }
  if (!await dependenciesReady(directory)) throw new Error('Runtime dependencies are incomplete after npm ci.');
  try { await access(path.join(root, 'public', 'vendor', 'tailwind.css')); }
  catch { throw new Error('Required bundled resource is missing: public/vendor/tailwind.css'); }
  // Keep PDF.js and its worker on the same locked version.
  const workerSource = path.join(directory, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const workerOutput = path.join(root, 'public', 'vendor', 'pdf.worker.min.mjs');
  const worker = await readFile(workerSource);
  const currentWorker = await readFile(workerOutput).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!currentWorker || !worker.equals(currentWorker)) {
    await copyFile(workerSource, workerOutput);
    console.log('Report Studio: updated the PDF.js worker.');
  }
  console.log('Report Studio: building the report runtime.');
  await run(process.execPath, ['build.mjs'], {cwd:directory, env});
}
