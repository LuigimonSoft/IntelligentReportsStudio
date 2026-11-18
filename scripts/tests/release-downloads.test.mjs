import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {selectInstallers, prepareDownloads} from '../release-downloads.mjs';

const assets = ['Report Studio_0.1.0_aarch64.dmg', 'Report Studio_0.1.0_x64.dmg', 'Report Studio_0.1.0_x64-setup.exe', 'Report Studio_0.1.0_x64_en-US.msi', 'Report Studio_0.1.0_amd64.AppImage', 'Report Studio_0.1.0_amd64.deb', 'Report Studio-0.1.0-1.x86_64.rpm'];
test('maps every platform to a stable name, ignoring unrelated assets', () => {
  const result = selectInstallers([...assets, 'Report Studio_0.1.0_aarch64.app.tar.gz'], 'v0.1.0');
  assert.equal(result.length, 7);
  assert.deepEqual(result[0], {source: assets[0], alias: 'Report-Studio-macOS-Apple-Silicon.dmg'});
  assert.equal(new Set(result.map(item => item.alias)).size, 7);
});
test('rejects missing installers and wrong versions before copying', () => {
  assert.throws(() => selectInstallers(assets.slice(1), 'v0.1.0'), /Expected exactly one/);
  assert.throws(() => selectInstallers(assets, 'v0.2.0'), /Expected exactly one/);
  assert.throws(() => selectInstallers(assets, 'latest'), /Invalid release tag/);
});
test('copies each installer without changing its bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-downloads-'));
  try {
    const destination = path.join(root, 'aliases');
    for (const file of assets) await writeFile(path.join(root, file), file);
    const result = await prepareDownloads(root, destination, 'v0.1.0');
    for (const {source, alias} of result) assert.deepEqual(await readFile(path.join(destination, alias)), await readFile(path.join(root, source)));
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('matches actual GitHub asset names with dots for v0.1.1', () => {
  const actual = assets.map(name => name.replace('Report Studio', 'Report.Studio').replace('0.1.0', '0.1.1'));
  const result = selectInstallers(actual, 'v0.1.1');
  assert.equal(result.length, 7);
  assert.equal(result[0].source, 'Report.Studio_0.1.1_aarch64.dmg');
  assert.equal(result[6].source, 'Report.Studio-0.1.1-1.x86_64.rpm');
});
test('rejects ambiguous assets with both display and stored names', () => {
  const stored = assets.map(name => name.replace('Report Studio', 'Report.Studio'));
  assert.throws(() => selectInstallers([...assets, ...stored], 'v0.1.0'), /found 2/);
});
