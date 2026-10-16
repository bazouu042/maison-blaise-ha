"""Workflow « le chat » — pilote Home Assistant à distance via le tunnel Cloudflare.

Deux modes d'entrée :
- REST : un chemin d'API Home Assistant + méthode + corps JSON.
- WebSocket (ws_commands) : commandes API WebSocket de Home Assistant,
  nécessaires pour tout ce qui n'est pas exposé en REST (dashboards
  Lovelace, par exemple).
C'est l'assistant du chat qui traduit le langage naturel en appel API.
"""

import os
from typing import Any, Literal

from pydantic import BaseModel, Field

import mistralai.workflows as workflows

HA_BASE_URL = os.environ.get("HA_BASE_URL", "https://ha.bazouu-lab.fr")
HA_WS_HOST = os.environ.get("HA_WS_HOST", "192.168.1.187")
HA_WS_PORT = int(os.environ.get("HA_WS_PORT", "8123"))


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
    """Exécute des commandes API WebSocket Home Assistant (LAN direct, en local).

    Le client WebSocket est implémenté en bibliothèque standard (aucune
    dépendance en plus). Il est importé ici car le bac à sable du workflow
    interdit les imports réseau au niveau module.
    """
    import asyncio
    import os as _os

    from lechat_ha import ha_ws

    token = _os.environ["HA_BEARER_TOKEN"]
    results = await asyncio.to_thread(
        ha_ws.run_ws_commands, commands, host, port, token, 30.0
    )
    return {"ws_results": results}


@workflows.workflow.define(
    name="ha-command",
    workflow_display_name="Le chat — Home Assistant (Maison Blaise)",
    workflow_description=(
        "Pilote la Maison Blaise : exécute un appel API Home Assistant "
        "à travers le tunnel Cloudflare sécurisé (REST), ou des commandes "
        "API WebSocket (dashboards Lovelace)."
    ),
)
class HaCommandWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: HaCommandInput) -> dict[str, Any]:
        if input.ws_commands:
            host = input.ws_host or HA_WS_HOST
            port = input.ws_port or HA_WS_PORT
            return await call_ha_ws(input.ws_commands, host, port)
        if not input.path:
            return {"error": "Fournir soit path (REST) soit ws_commands (WebSocket)."}
        return await call_ha(input.path, input.method, input.body)
