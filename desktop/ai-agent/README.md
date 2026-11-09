# Windows desktop build

The GitHub Actions workflow builds `widget_ui.py` with PyInstaller on Python
3.11 and publishes `VEDA.exe` as a GitHub Release asset. The file is a
standalone application executable, not an installer.

For local builds, install `requirements.txt` and run the same PyInstaller
options from this directory. The Hindi and English Vosk models are checked
into `model/`; the build bundles the English model currently selected by
`main.py`.

Do not bundle API keys. `voice.py` reads the Groq API key from the
`nexus_ear` environment variable at runtime. The app can still start without
that variable, but cloud speech transcription will not be available.

Copy `.env.example` to `.env` beside `widget_ui.py` for local runs, or beside
the packaged executable for a release build. Set `nexus_ear` there to enable
the Groq transcription path. The local TinyLlama intent parser uses
`OLLAMA_URL` and `OLLAMA_MODEL` when set; it defaults to
`http://localhost:11434` and `tinyllama`.

The running widget also provides a loopback-only pairing bridge on
`127.0.0.1:8765`. After the desktop browser is paired, it sends a separate
desktop-agent token pair to that bridge; the tokens are stored in the Windows
credential store, not in a local plaintext file. Set `VEDA_SERVER_URL` to the
backend URL and `VEDA_DESKTOP_ORIGINS` to the exact browser origins that may
pair with this widget. Remote commands require approval in the desktop browser
and are routed only through the agent's supported, allow-listed actions.
