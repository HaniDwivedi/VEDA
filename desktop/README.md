# VEDA Desktop

The desktop client is packaged as a Windows NSIS installer with Electron. Packaged
releases check the GitHub Releases page on launch and every six hours. Updates
download in the background; after a download, the app asks the user before
restarting to install it. Vite development mode does not check for updates.

## Build locally

From the repository root:

```powershell
npm install
npm run start:desktop
npm run build:desktop:installer
```

The installer is written to `desktop/release`. A locally built installer is not
published and cannot auto-update until a matching GitHub release is available.

## Publish a release

1. Increment the root `package.json` version. Each published version must be
   higher than the version already installed by users.
2. Set `GH_TOKEN` in the publishing environment to a GitHub token authorized to
   create releases in `HaniDwivedi/VEDA`. Keep the token out of source control
   and never place it in the packaged app.
3. From the repository root, run `npm run release:desktop`.
4. Verify the GitHub release contains the Windows installer and its generated
   update metadata (`latest.yml` and referenced package files).

Users must install the NSIS installer from a published release to receive
automatic updates. The GitHub release provider is configured for this
repository; do not distribute builds from an unpublished or draft release.
