// Apply the release tag only to the checked-out build, without changing Git history.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function versionFromTag(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag ?? '')) {
    throw new Error(`Expected a vMAJOR.MINOR.PATCH release tag; received ${tag}.`);
  }
  return tag.slice(1);
}

export async function setReleaseVersion(root, tag) {
  const version = versionFromTag(tag);
  const configPath = path.join(root, 'src-tauri/tauri.conf.json');
  const cargoPath = path.join(root, 'src-tauri/Cargo.toml');
  const lockPath = path.join(root, 'Cargo.lock');
  const [configText, cargoText, lockText] = await Promise.all([configPath, cargoPath, lockPath].map(p => readFile(p, 'utf8')));
  const config = JSON.parse(configText);
  if (typeof config.version !== 'string') throw new Error('Tauri version is missing.');
  const packagePattern = /(\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m;
  const lockPattern = /(\[\[package\]\]\s*\nname = "intelligent_reports_studio"\s*\nversion = ")[^"]+("\s*$)/gm;
  if (!packagePattern.test(cargoText)) throw new Error('Desktop Cargo package version is missing.');
  if ([...lockText.matchAll(lockPattern)].length !== 1) throw new Error('Expected one desktop package in Cargo.lock.');
  config.version = version;
  const updatedConfig = JSON.stringify(config, null, 2) + '\n';
  const updatedCargo = cargoText.replace(packagePattern, (_, before, after) => before + version + after);
  const updatedLock = lockText.replace(lockPattern, (_, before, after) => before + version + after);
  await Promise.all([[configPath, updatedConfig], [cargoPath, updatedCargo], [lockPath, updatedLock]].map(([file, data]) => writeFile(file, data)));
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const version = await setReleaseVersion(process.cwd(), process.argv[2]);
  console.log(`Build version: ${version}`);
}
