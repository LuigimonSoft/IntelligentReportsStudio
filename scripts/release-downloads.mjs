// Create stable download names for GitHub's /releases/latest/download/ URLs.
import {copyFile, mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const installers = [
  ['Report-Studio-macOS-Apple-Silicon.dmg', '_aarch64.dmg'],
  ['Report-Studio-macOS-Intel.dmg', '_x64.dmg'],
  ['Report-Studio-Windows-x64.exe', '_x64-setup.exe'],
  ['Report-Studio-Windows-x64.msi', '_x64_en-US.msi'],
  ['Report-Studio-Linux-x64.AppImage', '_amd64.AppImage'],
  ['Report-Studio-Linux-x64.deb', '_amd64.deb'],
  ['Report-Studio-Linux-x64.rpm', '-1.x86_64.rpm'],
];

export function selectInstallers(files, tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('Invalid release tag');
  const version = tag.slice(1);
  return installers.map(([alias, suffix]) => {
    const expected = `Report Studio${suffix.startsWith('-') ? '-' : '_'}${version}${suffix}`;
    const matches = files.filter(file => file === expected);
    if (matches.length !== 1) throw new Error(`Expected exactly one installer named ${expected}; found ${matches.length}.`);
    return {source: matches[0], alias};
  });
}

export async function prepareDownloads(source, destination, tag) {
  const selected = selectInstallers(await readdir(source), tag);
  await mkdir(destination, {recursive: true});
  for (const {source: name, alias} of selected) await copyFile(path.join(source, name), path.join(destination, alias));
  return selected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, destination, tag] = process.argv.slice(2);
  if (!source || !destination || !tag) throw new Error('Usage: node scripts/release-downloads.mjs <source> <destination> <tag>');
  await prepareDownloads(source, destination, tag);
}
