"""
migrate-js.py — Migration en masse Firebase ESM -> d1-client.js.

Pour chaque fichier .js/.html/.css contenant des imports Firebase ESM modular,
on remplace:
  - import{...}from"https://www.gstatic.com/firebasejs/.../firebase-*.js"  (4 imports)
  - const cfg = { apiKey: ... };
  - const app = getApps()...; const db = getFirestore(app); const auth = getAuth(app); const storage = getStorage(app);

Par:
  - 1 import unique depuis ./d1-client.js?v=1
  - const db=getFirestore(); const auth=getAuth(); const storage=getStorage();

Idempotent: ne touche pas les fichiers déjà migrés.

Usage:
    python migrate-js.py          # dry-run (montre les changements)
    python migrate-js.py --apply  # applique réellement
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "docs"

# Pattern : 1 à 5 imports gstatic Firebase + une config + init
FIREBASE_BLOCK_RE = re.compile(
    r"""(
        (?:[\t ]*import\s*\{[^}]+\}\s*from\s*["']https://www\.gstatic\.com/firebasejs/[^"']+["']\s*;?\s*\n?)+
        [\t ]*const\s+\w+\s*=\s*\{
            (?:[^{}]|\{[^{}]*\})*?
            apiKey\s*:\s*["'][^"']+["']
            (?:[^{}]|\{[^{}]*\})*?
        \}\s*;?\s*\n?
        [\t ]*const\s+app\s*=\s*[^;]+;\s*\n?
        (?:[\t ]*(?:let|const)\s+(?:db|auth|storage|appCheck)[^;\n]+;?\s*\n?)*
        (?:[\t ]*enableIndexedDbPersistence\([^;]+\)\s*\.\s*catch\([^;]+\)\s*;?\s*\n?)?
    )""",
    re.VERBOSE | re.MULTILINE,
)

# Collecter tous les noms importés depuis Firebase (entre {})
IMPORTS_NAME_RE = re.compile(
    r"""import\s*\{([^}]+)\}\s*from\s*["']https://www\.gstatic\.com/firebasejs/[^"']+["']""",
    re.MULTILINE,
)


def is_html(path: Path) -> bool:
    return path.suffix.lower() == ".html"


def parse_imports(block: str) -> list[str]:
    """Extrait tous les noms (avec alias 'as') des imports Firebase d'un bloc."""
    names: list[str] = []
    for m in IMPORTS_NAME_RE.finditer(block):
        inner = m.group(1)
        # Split par virgule mais respecte les `as X`
        for item in inner.split(","):
            item = item.strip()
            if not item:
                continue
            names.append(item)
    # Dedup en gardant l'ordre
    seen = set()
    out = []
    for n in names:
        key = n.split(" as ")[-1].strip()
        if key not in seen:
            seen.add(key)
            out.append(n)
    return out


# Noms qu'on doit AJOUTER (toujours utiles pour le init côté d1-client)
EXTRA_NEEDED = ["getFirestore", "getAuth", "getStorage"]
# Noms à filtrer (présents dans Firebase modular mais qu'on n'expose pas
# (ou qu'on remplace différemment)
FILTER_OUT = {"initializeApp", "getApps", "initializeFirestore", "persistentLocalCache", "enableIndexedDbPersistence"}


def build_replacement(block: str, is_html_file: bool) -> str:
    names = parse_imports(block)
    # Garde uniquement les noms utiles
    kept = [n for n in names if n.split(" as ")[-1].strip() not in FILTER_OUT]
    for needed in EXTRA_NEEDED:
        if not any(n.split(" as ")[-1].strip() == needed for n in kept):
            kept.append(needed)

    rel = "./js/d1-client.js?v=1" if is_html_file else "./d1-client.js?v=1"
    new_import = f'import{{{",".join(kept)}}}from"{rel}";'

    # Détecter si le bloc init a db / auth / storage
    has_db = re.search(r"\b(?:let|const)\s+db\s*=", block)
    has_auth = re.search(r"\b(?:let|const)\s+auth\s*=", block)
    has_storage = re.search(r"\b(?:let|const)\s+storage\s*=", block)
    init_lines = []
    if has_db:
        init_lines.append("const db=getFirestore();")
    if has_auth:
        init_lines.append("const auth=getAuth();")
    if has_storage:
        init_lines.append("const storage=getStorage();")

    return (
        "/* Migration Firebase -> Cloudflare D1 (Worker https://jahartarp-api.jahartarp.workers.dev). */\n"
        + new_import
        + "\n"
        + "".join(init_lines)
        + ("\n" if init_lines else "")
    )


def migrate_file(path: Path, apply: bool) -> tuple[bool, int]:
    text = path.read_text(encoding="utf-8")
    if "gstatic.com/firebasejs" not in text:
        return False, 0
    # Don't migrate d1-client.js itself
    if path.name == "d1-client.js":
        return False, 0

    replaced = 0
    out = text
    for m in list(FIREBASE_BLOCK_RE.finditer(text)):
        block = m.group(1)
        repl = build_replacement(block, is_html(path))
        out = out.replace(block, repl, 1)
        replaced += 1

    if replaced == 0:
        # Pattern non trouvé — manuel
        return False, 0

    if apply:
        path.write_text(out, encoding="utf-8")

    print(f"{'WROTE ' if apply else 'WOULD '}{path.relative_to(ROOT.parent)} ({replaced} block{'s' if replaced > 1 else ''})")
    return True, replaced


def main():
    apply = "--apply" in sys.argv
    print(f"{'APPLY' if apply else 'DRY-RUN'} mode\n")

    targets = list(ROOT.rglob("*.html")) + list(ROOT.rglob("*.js"))
    total_files = 0
    total_blocks = 0
    skipped = []
    for p in sorted(targets):
        if "firebase" in p.name.lower():
            continue
        text = p.read_text(encoding="utf-8")
        if "gstatic.com/firebasejs" not in text:
            continue
        ok, n = migrate_file(p, apply)
        if ok:
            total_files += 1
            total_blocks += n
        else:
            skipped.append(p)

    print(f"\n{'Applied' if apply else 'Would apply'}: {total_files} files, {total_blocks} blocks")
    if skipped:
        print(f"\nSkipped (pattern not matched, do manually): {len(skipped)}")
        for p in skipped:
            print(f"  - {p.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
