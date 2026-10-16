"""Workflow « le chat » — pilote Home Assistant à distance via le tunnel Cloudflare.

Entrée générique : un chemin d'API Home Assistant + méthode + corps JSON.
C'est l'assistant du chat qui traduit le langage naturel en appel API.
"""

import os
from typing import Any, Literal

from pydantic import BaseModel, Field

import mistralai.workflows as workflows

HA_BASE_URL = os.environ.get("HA_BASE_URL", "https://ha.bazouu-lab.fr")


class HaCommandInput(BaseModel):
    path: str = Field(
        description="Chemin API Home Assistant, ex: /api/states, /api/services/light/turn_on"
    )
    method: Literal["GET", "POST"] = "GET"
    body: dict[str, Any] | None = None


@workflows.activity()
async def call_ha(path: str, method: str, body: dict[str, Any] | None) -> dict[str, Any]:
    """Appelle l'API de Home Assistant avec les 3 badges (jeton HA + Cloudflare Access).

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


@workflows.workflow.define(
    name="ha-command",
    workflow_display_name="Le chat — Home Assistant (Maison Blaise)",
    workflow_description=(
        "Pilote la Maison Blaise : exécute un appel API Home Assistant "
        "à travers le tunnel Cloudflare sécurisé."
    ),
)
class HaCommandWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: HaCommandInput) -> dict[str, Any]:
        return await call_ha(input.path, input.method, input.body)
