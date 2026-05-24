#!/usr/bin/env python3
"""
sync_banners_to_d1.py — Pousse docs/data/gacha_banners.json dans la D1
prod (collection 'gacha_config', doc 'banners').

Usage :
    python tools/build_banners.py        # (1) génère le JSON
    python tools/sync_banners_to_d1.py   # (2) push vers D1

Prérequis : npx + wrangler authentifié (`wrangler whoami`).
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "docs" / "data" / "gacha_banners.json"
SQL  = ROOT / ".sync-banners.sql"


def main() -> int:
    if not SRC.exists():
        print(f"[sync] ERREUR : {SRC} introuvable.", file=sys.stderr)
        print("[sync] Lance d'abord : python tools/build_banners.py", file=sys.stderr)
        return 1

    data = json.loads(SRC.read_text(encoding="utf-8"))
    n_banners = len(data.get("banners", []))
    blob = json.dumps(data, ensure_ascii=False).replace("'", "''")

    sql = (
        "INSERT INTO documents (collection, doc_id, data, updated_at) "
        "VALUES ('gacha_config', 'banners', '" + blob + "', strftime('%s','now')) "
        "ON CONFLICT(collection, doc_id) DO UPDATE SET "
        "data=excluded.data, updated_at=strftime('%s','now');"
    )
    SQL.write_text(sql, encoding="utf-8")
    print(f"[sync] Prêt à pousser {n_banners} bannières...")

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
        out = (proc.stdout or "") + (proc.stderr or "")
        print("[sync] OK — Wrangler stdout (extrait) :")
        for line in out.splitlines()[-12:]:
            print(f"   {line}")
        return 0
    finally:
        try:
            SQL.unlink()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
