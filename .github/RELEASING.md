# Publishing a desktop release

The desktop release workflow runs when a tag such as `v0.1.0` is pushed. Before tagging, set the same version in `src-tauri/tauri.conf.json` and the `[package]` section of `src-tauri/Cargo.toml`, commit the changes, and make sure the desktop verification workflow passes.

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow verifies the tag and versions and builds installers for macOS Apple Silicon, macOS Intel, Windows x64, and Linux x64. A new release is created as a draft and published after all four builds succeed. If the release already exists, its current draft or published state is preserved and the installers are attached to it; an asset with the same name may be replaced. A published release can therefore receive assets as individual builds finish.

To build an existing tag after updating the workflow, open **Actions → Desktop release → Run workflow**, select the branch containing the updated workflow, and enter the existing tag (for example `v0.1.0`). The builds check out that tag, not the selected workflow branch. Re-running an older workflow run uses the workflow stored at the original commit and will not pick up this fix.

macOS builds use ad-hoc signing and are not notarized. Windows installers are not signed. Operating systems may therefore display security warnings; configure platform signing and notarization before distributing trusted production releases. Linux packages target Ubuntu 24.04 and compatible x64 systems.
