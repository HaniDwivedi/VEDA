# VEDA Desktop

The desktop client is packaged as a Windows NSIS installer with Electron. On
launch it opens the pairing screen and starts the bundled floating agent widget.
After the phone is paired, open the stream from the pairing screen; the widget
shows agent status and listens for voice commands while the phone is connected.
Packaged releases check the GitHub Releases page on launch and every six hours.
Updates download in the background; after a download, the app asks the user
before restarting to install it. Production builds use
`https://veda-kkbd.onrender.com` as their backend by default;
`VITE_VEDA_SERVER_URL` can override it at build time.
Vite development mode uses `http://localhost:5000` and does not check for updates.
On Windows, the installer closes VEDA Desktop and its bundled agent during the
install phase, after any installation-scope or elevation prompt, then verifies
that VEDA Desktop has exited before replacing its files.

## Build locally

From the repository root:

```powershell
npm ci
cd desktop/ai-agent
python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm --clean --onefile --windowed `
  --name VEDA-Agent `
  --collect-all customtkinter `
  --collect-all vosk `
  --collect-all keyring `
  --collect-all socketio `
  --collect-all engineio `
  --hidden-import pyttsx3.drivers.sapi5 `
  --add-data "model/vosk-model-small-en-in-0.4;model/vosk-model-small-en-in-0.4" `
  widget_ui.py
cd ../..
npm run start:desktop
npm run build:desktop:installer
```

The installer is written to `desktop/release`. A locally built installer is not
published and cannot auto-update until a matching GitHub release is available.

## Publish a release

1. Increment the root `package.json` version for each new desktop release. The
   latest release is `v1.0.5`; this source is prepared as `1.0.6` because the
   `v1.0.5` Python-only release had already started.
2. Push the version and code changes to `main`. The Windows release workflow
   bundles the Python agent widget inside the Electron NSIS installer and
   publishes the installer using GitHub's built-in token; no personal access
   token is needed.
3. Verify the GitHub release contains the NSIS installer, `latest.yml`, and
   referenced update files.

Users must install the NSIS installer from a published release to receive
automatic updates. The previous standalone `VEDA.exe` only opened the floating
agent widget; current releases bundle it inside the installer. The GitHub
release provider is configured for this repository.

## Browser frontend

The public landing page in `veda/frontend` is separate from the desktop app and
backend. Netlify builds it from that directory using its existing `netlify.toml`.
Share the Netlify site URL for the public website, the GitHub Releases URL for
the Windows installer, and use the Render URL only as the backend API endpoint.
