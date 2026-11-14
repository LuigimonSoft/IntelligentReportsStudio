# Publishing a desktop release

The desktop release workflow runs when a tag such as `v0.1.0` is pushed. Before tagging, set the same version in `src-tauri/tauri.conf.json` and the `[package]` section of `src-tauri/Cargo.toml`, commit the changes, and make sure the desktop verification workflow passes.

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow verifies the tag and versions, creates a draft release, and builds installers for macOS Apple Silicon, macOS Intel, Windows x64, and Linux x64. Tauri attaches the generated bundles to the draft. The release is published only after all four builds succeed. If a build fails, the draft remains available for inspection; rerun the failed workflow after correcting the issue. A published release is not overwritten on a rerun.

macOS builds use ad-hoc signing and are not notarized. Windows installers are not signed. Operating systems may therefore display security warnings; configure platform signing and notarization before distributing trusted production releases. Linux packages target Ubuntu 24.04 and compatible x64 systems.
