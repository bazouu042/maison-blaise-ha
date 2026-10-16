"""Client WebSocket minimal pour l'API Home Assistant (bibliothèque standard uniquement).

Home Assistant n'expose PAS les dashboards Lovelace via l'API REST :
cette partie passe uniquement par l'API WebSocket (/api/websocket).
Ce module implémente juste ce qu'il faut : poignée de main HTTP Upgrade,
authentification par jeton, trames texte (masquées côté client).
"""

import base64
import json
import os
import socket
import struct


class _WsConn:
    def __init__(self, sock: socket.socket):
        self.sock = sock
        self.buf = b""

    def _read(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("Connexion WebSocket fermée")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def read_http_headers(self) -> str:
        marker = b"\r\n\r\n"
        while marker not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("Pas de réponse HTTP")
            self.buf += chunk
        head, self.buf = self.buf.split(marker, 1)
        return head.decode(errors="replace")

    def send_frame(self, payload: bytes, opcode: int = 0x1) -> None:
        header = bytearray([0x80 | opcode])  # FIN + opcode
        mask = os.urandom(4)
        ln = len(payload)
        if ln < 126:
            header.append(0x80 | ln)
        elif ln < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", ln)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", ln)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def recv_message(self) -> str:
        chunks: list[bytes] = []
        while True:
            b1, b2 = self._read(2)
            opcode = b1 & 0x0F
            masked = b2 & 0x80
            ln = b2 & 0x7F
            if ln == 126:
                (ln,) = struct.unpack(">H", self._read(2))
            elif ln == 127:
                (ln,) = struct.unpack(">Q", self._read(8))
            mask = self._read(4) if masked else b""
            payload = self._read(ln)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 0x9:  # ping -> pong
                self.send_frame(payload, opcode=0xA)
                continue
            if opcode == 0x8:  # close
                raise ConnectionError("WebSocket fermé par le serveur")
            chunks.append(payload)
            if b1 & 0x80:  # FIN
                return b"".join(chunks).decode(errors="replace")


def run_ws_commands(
    commands: list,
    host: str,
    port: int,
    token: str,
    timeout: float = 30.0,
) -> list:
    """Ouvre un WebSocket vers Home Assistant, s'authentifie, exécute les commandes.

    Chaque commande est un dict sans « id » (assigné automatiquement).
    Retourne la liste des réponses HA ({'type': 'result', 'success': ..., 'result': ...}).
    """
    sock = socket.create_connection((host, port), timeout=timeout)
    sock.settimeout(timeout)
    try:
        conn = _WsConn(sock)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            "GET /api/websocket HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        sock.sendall(req.encode())
        resp = conn.read_http_headers()
        if "101" not in resp.splitlines()[0]:
            raise RuntimeError(f"Poignée de main WebSocket refusée : {resp[:200]}")

        msg = json.loads(conn.recv_message())
        if msg.get("type") != "auth_required":
            raise RuntimeError(f"Réponse inattendue de HA : {msg}")

        conn.send_frame(json.dumps({"type": "auth", "access_token": token}).encode())
        msg = json.loads(conn.recv_message())
        if msg.get("type") != "auth_ok":
            raise RuntimeError(f"Authentification refusée : {msg}")

        results = []
        next_id = 1
        for cmd in commands:
            frame = dict(cmd)
            frame["id"] = next_id
            next_id += 1
            conn.send_frame(json.dumps(frame).encode())
            while True:
                msg = json.loads(conn.recv_message())
                if msg.get("id") == frame["id"]:
                    break
            results.append(msg)
        return results
    finally:
        try:
            sock.close()
        except Exception:
            pass
