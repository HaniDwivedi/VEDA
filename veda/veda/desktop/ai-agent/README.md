# Windows desktop build

The GitHub Actions workflow builds `widget_ui.py` with PyInstaller on Python
3.11 and bundles the resulting `VEDA-Agent.exe` into the Electron desktop
installer. Users should launch the `VEDA-Desktop-Setup-*.exe` installer; the
installed app opens the pairing page and starts the floating agent widget.

For local builds, install `requirements.txt` and build `VEDA-Agent.exe` with
PyInstaller before running the root `npm run build:desktop:installer` command.
The Hindi and English Vosk models are checked into `model/`; the build bundles
the English model currently selected by `main.py`.

The Electron app pairs this local widget through a short-lived secret passed
over an authenticated loopback request. The secret is generated at app launch
and is never stored in the renderer or on disk.

Do not bundle API keys. `voice.py` reads the optional Groq API key from the
`nexus_ear` environment variable at runtime. When configured, Groq handles
speech transcription and intent parsing; without it, the app uses local Vosk
for transcription and Ollama for intent parsing. If a Groq request fails, the
corresponding local model is used as a fallback.
The desktop voice listener runs only while the paired phone is connected to
the desktop `/stream` page, and pauses when that stream disconnects.

Copy `.env.example` to `.env` beside `widget_ui.py` for local runs. Set
`nexus_ear` there to enable the Groq paths, and optionally set `GROQ_MODEL` to
override the chat model.
The local TinyLlama intent parser uses `OLLAMA_URL` and `OLLAMA_MODEL` when set; it defaults to
`http://localhost:11434` and `tinyllama`.

The running widget also provides a loopback-only pairing bridge on
`127.0.0.1:8765`. After the desktop browser is paired, it sends a separate
desktop-agent token pair to that bridge; the tokens are stored in the Windows
credential store, not in a local plaintext file. Set `VEDA_SERVER_URL` to the
backend URL and `VEDA_DESKTOP_ORIGINS` to the exact browser origins that may
pair with this widget. Remote commands require approval in the desktop browser
and are routed only through the agent's supported, allow-listed actions.
