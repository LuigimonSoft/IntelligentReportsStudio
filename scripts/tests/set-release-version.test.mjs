import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setReleaseVersion, versionFromTag} from '../set-release-version.mjs';

test('requires a stable semantic version tag', () => {
  assert.equal(versionFromTag('v0.1.1'), '0.1.1');
  for (const tag of ['0.1.1', 'v0.1', 'v01.1.1', 'v0.1.1-beta', 'v0.1.1/anything']) assert.throws(() => versionFromTag(tag));
});
test('updates Tauri, the desktop crate and the matching lockfile entry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-version-'));
  try {
    await mkdir(path.join(root, 'src-tauri'));
    await writeFile(path.join(root, 'src-tauri/tauri.conf.json'), '{"version":"0.1.0","productName":"Report Studio"}');
    await writeFile(path.join(root, 'src-tauri/Cargo.toml'), '[package]\nname = "intelligent_reports_studio"\nversion = "0.1.0"\n\n[dependencies]\nexample = "1"\n');
    await writeFile(path.join(root, 'Cargo.lock'), '[[package]]\nname = "app"\nversion = "0.1.0"\n\n[[package]]\nname = "intelligent_reports_studio"\nversion = "0.1.0"\n');
    await setReleaseVersion(root, 'v0.1.1');
    assert.equal(JSON.parse(await readFile(path.join(root, 'src-tauri/tauri.conf.json'))).version, '0.1.1');
    assert.match(await readFile(path.join(root, 'src-tauri/Cargo.toml'), 'utf8'), /version = "0\.1\.1"/);
    const lock = await readFile(path.join(root, 'Cargo.lock'), 'utf8');
    assert.match(lock, /name = "app"\nversion = "0\.1\.0"/);
    assert.match(lock, /name = "intelligent_reports_studio"\nversion = "0\.1\.1"/);
  } finally { await rm(root, {recursive: true, force: true}); }
});
