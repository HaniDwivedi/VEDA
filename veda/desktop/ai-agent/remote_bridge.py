"""Pair the local desktop agent with the web client and route approved commands."""
import base64
import hmac
import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from urllib.error import HTTPError
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import keyring
import socketio

from ai_engine import analyze_user_intent_and_screen

logger = logging.getLogger("RemoteAgentBridge")
KEYRING_SERVICE = "VEDA Desktop Agent"


class RemoteAgentBridge:
    def __init__(
        self,
        server_url: str,
        allowed_origins: set[str],
        on_connection_change: Callable[[bool], None] | None = None,
        on_voice_stream_change: Callable[[bool], None] | None = None,
    ) -> None:
        self.server_url = self._normalize_server_url(server_url)
        self.allowed_origins = allowed_origins
        self.on_connection_change = on_connection_change
        self.on_voice_stream_change = on_voice_stream_change
        self.bridge_token = os.getenv("VEDA_AGENT_BRIDGE_TOKEN", "")
        self.client = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
        self._stop = threading.Event()
        self._credentials_changed = threading.Event()
        self._authentication_rejected = threading.Event()
        self._pending_commands: dict[str, tuple[str, float]] = {}
        self._pending_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._http_server = ThreadingHTTPServer(("127.0.0.1", 8765), self._handler_type())
        self._http_server.daemon_threads = True
        self._socket_thread = threading.Thread(target=self._connection_loop, daemon=True)
        self._http_thread = threading.Thread(target=self._http_server.serve_forever, daemon=True)
        self.client.on("agent_command_received", self._receive_command)
        self.client.on("agent_command_approval", self._receive_approval)
        self.client.on("connect_error", self._handle_connect_error)
        self.client.on("connect", lambda: self._notify_connection_change(True))
        self.client.on("disconnect", lambda: self._notify_connection_change(False))
        self.client.on("voice_stream_state", self._receive_voice_stream_state)

    def _notify_connection_change(self, connected: bool) -> None:
        if self.on_connection_change:
            try:
                self.on_connection_change(connected)
            except Exception:
                logger.exception("Could not notify the widget about the secure connection state.")

    def _receive_voice_stream_state(self, payload: dict) -> None:
        active = payload.get("active") if isinstance(payload, dict) else None
        if not isinstance(active, bool):
            logger.warning("Ignoring malformed voice stream state.")
            return
        if self.on_voice_stream_change:
            try:
                self.on_voice_stream_change(active)
            except Exception:
                logger.exception("Could not notify the widget about the voice stream state.")

    def start(self) -> None:
        self._http_thread.start()
        self._socket_thread.start()
        logger.info("Local pairing bridge listening on 127.0.0.1:8765")

    def stop(self) -> None:
        self._stop.set()
        self._credentials_changed.set()
        if self.client.connected:
            self.client.disconnect()
        self._http_server.shutdown()
        self._http_server.server_close()
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _handler_type(self):
        bridge = self

        class PairingHandler(BaseHTTPRequestHandler):
            def do_OPTIONS(self) -> None:
                if not bridge._allow_origin(self):
                    self.send_error(403)
                    return
                self.send_response(204)
                self._cors_headers()
                self.end_headers()

            def do_POST(self) -> None:
                if self.path != "/pair" or not bridge._allow_origin(self):
                    self.send_error(403)
                    return
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if length <= 0 or length > 8192:
                        raise ValueError("Invalid pairing request size.")
                    payload = json.loads(self.rfile.read(length))
                    if not isinstance(payload, dict):
                        raise ValueError("Invalid pairing request.")
                    access_token = payload.get("accessToken")
                    refresh_token = payload.get("refreshToken")
                    server_url = payload.get("serverUrl")
                    if not isinstance(access_token, str) or not access_token or \
                            not isinstance(refresh_token, str) or not refresh_token or \
                            len(access_token) > 4096 or len(refresh_token) > 4096:
                        raise ValueError("Access and refresh tokens are required.")
                    if not isinstance(server_url, str):
                        raise ValueError("Backend server URL is required.")
                    bridge._store_tokens(access_token, refresh_token, server_url)
                except (ValueError, json.JSONDecodeError, keyring.errors.PasswordSetError) as error:
                    self.send_error(400, str(error))
                    return
                except Exception:
                    logger.exception("Could not save paired desktop credentials.")
                    self.send_error(500, "Could not securely store paired-device credentials.")
                    return

                body = b'{"paired":true}'
                self.send_response(200)
                self._cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _cors_headers(self) -> None:
                origin = self.headers.get("Origin")
                if origin:
                    self.send_header("Access-Control-Allow-Origin", origin)
                    self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Access-Control-Allow-Private-Network", "true")

            def log_message(self, _format: str, *_args) -> None:
                return

        return PairingHandler

    def _allow_origin(self, request: BaseHTTPRequestHandler) -> bool:
        host = request.headers.get("Host", "").lower()
        origin = request.headers.get("Origin", "")
        if host not in {"127.0.0.1:8765", "localhost:8765"}:
            return False
        if origin in self.allowed_origins:
            return True
        supplied_token = request.headers.get("X-VEDA-Agent-Token", "")
        return bool(
            not origin
            and self.bridge_token
            and hmac.compare_digest(supplied_token, self.bridge_token)
        )

    @staticmethod
    def _normalize_server_url(server_url: str) -> str:
        parsed = urlparse(server_url.strip())
        local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
        if (parsed.scheme != "https" and not local_http) or not parsed.hostname or \
                parsed.username or parsed.password or parsed.path not in {"", "/"} or \
                parsed.query or parsed.fragment:
            raise ValueError("Backend URL must be an HTTPS origin, except for localhost development.")
        return f"{parsed.scheme}://{parsed.netloc}"

    def _store_tokens(self, access_token: str, refresh_token: str, server_url: str) -> None:
        self.server_url = self._normalize_server_url(server_url)
        keyring.set_password(KEYRING_SERVICE, "server_url", self.server_url)
        keyring.set_password(KEYRING_SERVICE, "access_token", access_token)
        keyring.set_password(KEYRING_SERVICE, "refresh_token", refresh_token)
        self._credentials_changed.set()
        if self.client.connected:
            self.client.disconnect()

    @staticmethod
    def _token_expires_soon(token: str) -> bool:
        try:
            encoded_payload = token.split(".")[1]
            encoded_payload += "=" * (-len(encoded_payload) % 4)
            payload = json.loads(base64.urlsafe_b64decode(encoded_payload))
            return int(payload.get("exp", 0)) <= time.time() + 60
        except (IndexError, ValueError, TypeError, json.JSONDecodeError):
            return True

    def _refresh_tokens(self, refresh_token: str) -> tuple[str, str] | None:
        payload = json.dumps({"refreshToken": refresh_token}).encode("utf-8")
        request = Request(
            f"{self.server_url}/api/tokens/refresh",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:
                tokens = json.loads(response.read())
        except HTTPError as error:
            if error.code == 401:
                for credential in ("access_token", "refresh_token"):
                    try:
                        keyring.delete_password(KEYRING_SERVICE, credential)
                    except keyring.errors.PasswordDeleteError:
                        pass
                logger.warning("Desktop-agent credentials expired; pair the desktop again.")
                return None
            logger.exception("Desktop-agent token refresh failed.")
            return None
        except (URLError, TimeoutError, json.JSONDecodeError):
            logger.exception("Desktop-agent token refresh failed.")
            return None
        access_token = tokens.get("accessToken")
        next_refresh_token = tokens.get("refreshToken")
        if not access_token or not next_refresh_token:
            logger.error("Token refresh endpoint returned incomplete credentials.")
            return None
        keyring.set_password(KEYRING_SERVICE, "access_token", access_token)
        keyring.set_password(KEYRING_SERVICE, "refresh_token", next_refresh_token)
        return access_token, next_refresh_token

    def _connection_loop(self) -> None:
        while not self._stop.is_set():
            try:
                configured_url = keyring.get_password(KEYRING_SERVICE, "server_url")
                access_token = keyring.get_password(KEYRING_SERVICE, "access_token")
                refresh_token = keyring.get_password(KEYRING_SERVICE, "refresh_token")
            except Exception:
                logger.exception("Could not read desktop-agent credentials from the OS keyring.")
                self._credentials_changed.wait(3)
                self._credentials_changed.clear()
                continue
            if configured_url:
                self.server_url = self._normalize_server_url(configured_url)
            if not access_token or not refresh_token:
                self._credentials_changed.wait(3)
                self._credentials_changed.clear()
                continue

            if self._token_expires_soon(access_token):
                refreshed = self._refresh_tokens(refresh_token)
                if not refreshed:
                    self._credentials_changed.wait(3)
                    self._credentials_changed.clear()
                    continue
                access_token, _ = refreshed

            try:
                self.client.connect(
                    self.server_url,
                    auth={"token": access_token, "clientType": "desktop-agent"},
                    transports=["websocket"],
                    wait_timeout=10,
                )
                self.client.wait()
            except Exception:
                if self._stop.is_set():
                    break
                logger.exception("Desktop agent could not connect to VEDA.")
                if self._authentication_rejected.is_set() or self._token_expires_soon(access_token):
                    self._refresh_tokens(refresh_token)
                self._authentication_rejected.clear()
                self._credentials_changed.wait(3)
                self._credentials_changed.clear()

    def _handle_connect_error(self, error) -> None:
        message = error.get("message") if isinstance(error, dict) else str(error)
        if message == "Authentication error":
            self._authentication_rejected.set()

    def _receive_command(self, payload: dict) -> None:
        command_id = payload.get("commandId")
        command_text = payload.get("commandText")
        if not isinstance(command_id, str) or not isinstance(command_text, str):
            logger.warning("Ignoring malformed remote agent command.")
            return
        if not command_text.strip() or len(command_text) > 1000:
            logger.warning("Ignoring remote agent command outside the supported length.")
            return
        with self._pending_lock:
            now = time.monotonic()
            self._pending_commands = {
                key: value for key, value in self._pending_commands.items()
                if value[1] > now
            }
            self._pending_commands[command_id] = (command_text.strip(), now + 60)

    def _receive_approval(self, payload: dict) -> None:
        command_id = payload.get("commandId")
        approved = payload.get("approved")
        if not isinstance(command_id, str) or not isinstance(approved, bool):
            logger.warning("Ignoring malformed remote command approval.")
            return
        with self._pending_lock:
            pending = self._pending_commands.pop(command_id, None)
        if not pending or pending[1] <= time.monotonic():
            logger.warning("Ignoring approval for a missing or expired command.")
            return
        if not approved:
            self._send_response("Desktop user declined the command.")
            return
        self._executor.submit(self._execute_command, pending[0])

    def _execute_command(self, command_text: str) -> None:
        try:
            result = analyze_user_intent_and_screen(command_text)
            self._send_response(str(result)[:1000])
        except Exception:
            logger.exception("Approved desktop command failed.")
            self._send_response("The approved desktop action failed.")

    def _send_response(self, result_text: str) -> None:
        if self.client.connected:
            self.client.emit("agent_response_send", {"resultText": result_text})
