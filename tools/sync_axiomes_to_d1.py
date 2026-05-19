#!/usr/bin/env python3
"""
sync_axiomes_to_d1.py — Pousse docs/data/axiomes.json dans la D1 prod
(collection 'config', doc 'axiomes').

Usage :
    python tools/sync_axiomes_to_d1.py

Le bot lit ensuite cette entrée via D1 (cache 5 min côté bot).

Prérequis :
    - npx + wrangler authentifié (`wrangler whoami` doit lister jaharta-d1)
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "docs" / "data" / "axiomes.json"
SQL  = ROOT / ".sync-axiomes.sql"


def main() -> int:
    if not SRC.exists():
        print(f"[sync] ERREUR : {SRC} introuvable", file=sys.stderr)
        return 1

    with SRC.open("r", encoding="utf-8") as f:
        data = json.load(f)

    blob = json.dumps(data, ensure_ascii=False).replace("'", "''")
    sql  = (
        "INSERT INTO documents (collection, doc_id, data, updated_at) "
        "VALUES ('config', 'axiomes', '" + blob + "', strftime('%s','now')) "
        "ON CONFLICT(collection, doc_id) DO UPDATE SET "
        "data=excluded.data, updated_at=strftime('%s','now');"
    )

    SQL.write_text(sql, encoding="utf-8")
    print(f"[sync] {len(data)} entrées prêtes à pousser...")

    try:
        proc = subprocess.run(
            ["npx", "wrangler", "d1", "execute", "jaharta-d1",
             "--remote", "--file", str(SQL)],
            cwd=ROOT / "worker",
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=(os.name == "nt"),
        )
        if proc.returncode != 0:
            print("[sync] ÉCHEC wrangler :", file=sys.stderr)
            print(proc.stderr or proc.stdout, file=sys.stderr)
            return proc.returncode
        # Succès : on grep "changes" dans la sortie pour résumer
        for line in (proc.stdout or "").splitlines():
            if "changes" in line.lower() or "rows_written" in line.lower():
                print("[sync]", line.strip())
        print(f"[sync] OK — config/axiomes synchronisé en D1 ({len(data)} entrées)")
        return 0
    finally:
        try:
            SQL.unlink()
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    sys.exit(main())
