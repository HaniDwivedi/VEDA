# VEDA pairing and signaling backend

The backend creates one-time desktop pairing QR codes, pairs a mobile device,
issues separate role-specific access/refresh tokens, and routes Socket.IO
events to the opposite device role in the same pairing. QR challenges and
active pairings are stored in Redis. Socket.IO's Redis adapter shares live
rooms across backend instances.

## Local setup

1. Copy `.env.example` to `.env` and set two different random signing secrets
   of at least 32 characters. Configure `REDIS_URL` for a reachable Redis
   instance.
2. Install dependencies with `npm install`.
3. Start the server with `npm start`; check `GET /healthz` for readiness.

`CLIENT_ORIGINS` is a comma-separated allowlist for the desktop and mobile
client origins; include the deployed desktop origin and keep `https://localhost`
for the Capacitor Android WebView. `PORT` defaults to `5000`. Set `TRUST_PROXY` only to the
exact trusted proxy hop count or address range used by the deployment;
never trust arbitrary forwarded headers. Pairing and token endpoints have
per-IP request limits, and HTTP security headers are enabled. `STUN_URL` is
optional. Configure both `TURN_URLS` and `TURN_SHARED_SECRET` to issue
short-lived TURN credentials; leave both empty to use STUN only.

## Pairing and routing

- `POST /api/pairing/qr` creates a 15-minute, single-use QR challenge and a
  separate short-lived desktop polling token.
- `POST /api/pairing/scan` consumes the QR once and returns the mobile device's
  own tokens and ID.
- `GET /api/pairing/status` lets the desktop retrieve its own primary browser
  tokens and a separate agent token pair once.
- `POST /api/tokens/refresh` rotates a device's refresh token.
- Refresh tokens are rotated atomically in Redis and isolated by client ID so
  the browser and local desktop agent cannot invalidate each other's token.
- Socket.IO access tokens contain `pairingId`, `deviceId`, `deviceRole`, and
  `clientId`.
  The backend hashes the pairing ID for room names and directs chat, WebRTC,
  and agent events to the opposite role only.

Browser clients keep primary access/refresh tokens in browser `localStorage`
under `gat` and `gft`; token refresh is shared with sockets and serialized
across tabs when the Web Locks API is available. The Android app keeps them in
Android secure storage. Separate desktop-agent credentials are delivered only
to the loopback agent bridge and stored in the OS credential store. Agent
commands require explicit approval in the desktop browser; the agent only
executes its supported allow-listed actions.

Desktop screen sharing requires a user click and browser permission. The
desktop VEDA tab is excluded from browser-tab choices, the outgoing stream is
never rendered as a local preview, and the mobile client only receives video;
together these prevent a recursive screen-within-screen feedback loop. The
phone's operating-system picker may still let a user select the full monitor,
but the mirrored feed is not re-captured and sent back.

## WebRTC

Socket.IO relays offers, answers, and ICE candidates only. WebRTC media is
peer-to-peer after the desktop user explicitly shares a display. `GET
/api/rtc-config` returns authenticated, non-cacheable ICE configuration.
