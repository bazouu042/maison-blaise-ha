"""Point d'entrée du worker géré par Mistral Cloud."""

import asyncio

import mistralai.workflows as workflows

from lechat_ha.ha_command import HaCommandWorkflow


async def main() -> None:
    await workflows.run_worker([HaCommandWorkflow])


if __name__ == "__main__":
    asyncio.run(main())
