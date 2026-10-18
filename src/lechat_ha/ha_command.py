"""Workflow « le chat » — pilote Home Assistant à distance via le tunnel Cloudflare.

Trois modes d'entrée :
- REST : un chemin d'API Home Assistant + méthode + corps JSON.
- WebSocket (ws_commands) : commandes API WebSocket de Home Assistant,
  nécessaires pour tout ce qui n'est pas exposé en REST (dashboards
  Lovelace, par exemple).
- SSH (ssh_command) : exécute une commande sur le PC JARVIS (Windows),
  en LAN direct depuis le ZimaOS. Utilisé pour la maintenance du dossier
  Jarvis (C:/Users/adminlocal/AppData/Local/TechEnClair/Jarvis).
C'est l'assistant du chat qui traduit le langage naturel en appel API.
"""

import os
from typing import Any, Literal

from pydantic import BaseModel, Field

import mistralai.workflows as workflows

HA_BASE_URL = os.environ.get("HA_BASE_URL", "https://ha.bazouu-lab.fr")
HA_WS_HOST = os.environ.get("HA_WS_HOST", "192.168.1.187")
HA_WS_PORT = int(os.environ.get("HA_WS_PORT", "8123"))
JARVIS_SSH_HOST = os.environ.get("JARVIS_SSH_HOST", "192.168.1.190")
JARVIS_SSH_USER = os.environ.get("JARVIS_SSH_USER", "adminlocal")
JARVIS_SSH_PASSWORD = os.environ.get("JARVIS_SSH_PASSWORD", "")


class HaCommandInput(BaseModel):
    path: str | None = Field(
        default=None,
        description="Chemin API REST Home Assistant, ex: /api/states, /api/services/light/turn_on",
    )
    method: Literal["GET", "POST"] = "GET"
    body: dict[str, Any] | None = None
    ws_commands: list[dict[str, Any]] | None = Field(
        default=None,
        description=(
            "Commandes API WebSocket Home Assistant, ex: "
            "[{'type': 'lovelace/config', 'url_path': 'lovelace'}] "
            "(nécessaire pour les dashboards Lovelace)"
        ),
    )
    ws_host: str | None = None
    ws_port: int | None = None
    ssh_command: str | None = Field(
        default=None,
        description=(
            "Commande à exécuter sur le PC JARVIS (Windows, via SSH en LAN). "
            "Ex: 'dir C:/Users/adminlocal/AppData/Local/TechEnClair/Jarvis'"
        ),
    )
    ssh_host: str | None = None
    ssh_user: str | None = None


@workflows.activity()
async def call_ha(path: str, method: str, body: dict[str, Any] | None) -> dict[str, Any]:
    """Appelle l'API REST de Home Assistant avec les 3 badges (jeton HA + Cloudflare Access).

    Note: httpx est importé ici (et pas en haut du fichier) car le bac à sable
    du workflow interdit les imports réseau au niveau module.
    """
    import httpx

    headers = {
        "Authorization": f"Bearer {os.environ['HA_BEARER_TOKEN']}",
        "CF-Access-Client-Id": os.environ["CF_ACCESS_CLIENT_ID"],
        "CF-Access-Client-Secret": os.environ["CF_ACCESS_CLIENT_SECRET"],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, HA_BASE_URL + path, headers=headers, json=body)
    try:
        data: Any = resp.json()
    except Exception:
        data = resp.text
    return {"status_code": resp.status_code, "response": data}


@workflows.activity()
async def call_ha_ws(
    commands: list,
    host: str,
    port: int,
) -> dict[str, Any]:
    """Exécute des commandes API WebSocket Home Assistant (LAN direct, en local)."""
    import asyncio

    from lechat_ha import ha_ws

    token = os.environ["HA_BEARER_TOKEN"]
    results = await asyncio.to_thread(
        ha_ws.run_ws_commands, commands, host, port, token, 30.0
    )
    return {"ws_results": results}


@workflows.activity()
async def run_ssh(command: str, host: str, user: str) -> dict[str, Any]:
    """Exécute une commande sur le PC JARVIS via SSH (LAN direct depuis le ZimaOS).

    Utilise paramiko (importé ici, bac à sable du workflow). Le mot de passe
    vient de la variable d'environnement JARVIS_SSH_PASSWORD du conteneur.
    """
    import asyncio

    import paramiko

    password = os.environ.get("JARVIS_SSH_PASSWORD", "")

    def _exec() -> dict[str, Any]:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=host,
                port=22,
                username=user,
                password=password,
                timeout=15,
                banner_timeout=15,
                auth_timeout=15,
                look_for_keys=False,
                allow_agent=False,
            )
            stdin, stdout, stderr = client.exec_command(command, timeout=25)
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            code = stdout.channel.recv_exit_status()
            return {"exit_code": code, "stdout": out, "stderr": err}
        except Exception as exc:
            return {"exit_code": -1, "error": f"SSH vers {host} échoué : {exc}"}
        finally:
            try:
                client.close()
            except Exception:
                pass

    return await asyncio.to_thread(_exec)


@workflows.workflow.define(
    name="ha-command",
    workflow_display_name="Le chat — Home Assistant (Maison Blaise)",
    workflow_description=(
        "Pilote la Maison Blaise : exécute un appel API Home Assistant "
        "à travers le tunnel Cloudflare sécurisé (REST), des commandes "
        "API WebSocket (dashboards Lovelace), ou une commande SSH "
        "sur le PC JARVIS (maintenance Jarvis)."
    ),
)
class HaCommandWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: HaCommandInput) -> dict[str, Any]:
        if input.ssh_command:
            host = input.ssh_host or JARVIS_SSH_HOST
            user = input.ssh_user or JARVIS_SSH_USER
            return await run_ssh(input.ssh_command, host, user)
        if input.ws_commands:
            host = input.ws_host or HA_WS_HOST
            port = input.ws_port or HA_WS_PORT
            return await call_ha_ws(input.ws_commands, host, port)
        if not input.path:
            return {"error": "Fournir path (REST), ws_commands (WebSocket) ou ssh_command (SSH JARVIS)."}
        return await call_ha(input.path, input.method, input.body)
