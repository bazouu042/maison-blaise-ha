"""Lancement du worker : python -m lechat_ha"""

import asyncio

import mistralai.workflows as workflows

from .ha_command import HaCommandWorkflow


def main() -> None:
    asyncio.run(workflows.run_worker([HaCommandWorkflow]))


if __name__ == "__main__":
    main()
