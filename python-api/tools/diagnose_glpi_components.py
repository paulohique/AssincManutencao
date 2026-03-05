from __future__ import annotations

import asyncio
import json
import sys
from typing import Any, Dict, List

# Allows: python python-api/tools/diagnose_glpi_components.py
sys.path.append("python-api")

from app.integrations.glpi_client import GlpiClient  # noqa: E402


def _pick(d: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in keys:
        if k in d:
            out[k] = d.get(k)
    return out


def _candidate_keys(item: Dict[str, Any]) -> List[str]:
    needles = ("name", "designation", "model", "manufacturer", "serial", "size")
    keys = []
    for k in item.keys():
        lk = k.lower()
        if any(n in lk for n in needles) or lk.endswith("_id") or lk.endswith("_ids"):
            keys.append(k)
    return sorted(keys)


async def main():
    glpi = GlpiClient()
    await glpi.init_session()

    computers = await glpi.get_computers(start=0, limit=1)
    if not computers:
        print("GLPI: nenhum computador retornado")
        return

    glpi_id = computers[0].get("id")
    print(f"Sample Computer GLPI id: {glpi_id}")

    all_components = await glpi.get_all_components(int(glpi_id))

    for item_type, items in all_components.items():
        print("\n===", item_type, "items=", len(items))
        if not items:
            continue

        item = items[0]
        keys = _candidate_keys(item)
        print("Candidate keys:", keys)

        # show typical fields (values can be int/dict/str)
        interesting = [
            "designation",
            "name",
            "serial",
            "size",
            "manufacturers_id",
            "devicemodels_id",
            "deviceprocessors_id",
            "devicememories_id",
            "deviceharddrives_id",
            "devicenetworkcards_id",
            "devicegraphiccards_id",
            "devicemotherboards_id",
            "devicepowersupplies_id",
        ]
        sample = _pick(item, interesting)
        print("Sample fields (first item):")
        print(json.dumps(sample, ensure_ascii=False, indent=2))

    await glpi.kill_session()


if __name__ == "__main__":
    asyncio.run(main())
