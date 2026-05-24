#!/usr/bin/env python3
"""
build_banners.py — Construit docs/data/gacha_banners.json à partir
d'items.json (catalog) en appliquant les règles d'exclusion :

EXCLUS des pools :
  - rarity == "forgeflamme"
  - rarity == "signature"
  - rarity == "pandemonium"
  - items issus des recettes de brassage (potions/élixirs)

INCLUS :
  - tous les autres equipment items (common → mythic + artifact + unique
    + mastercraft + racial)
  - tous les matériaux (type=material) — y compris les matos des items
    exclus (Pandemonium / Signature ont leurs matos qui peuvent drop,
    même s'ils n'ont pas de forge — c'est intentionnel)
  - 1× "arcanae" en slot dédié 1% sur chaque bannière

ROTATION : 2 actives / 4 jours (était 7 jours auparavant).

Output : docs/data/gacha_banners.json
Usage  : python tools/build_banners.py
"""
from __future__ import annotations
import json
import random
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parent.parent
ITEMS_FILE   = ROOT / "docs" / "data" / "items.json"
BREW_FILE    = ROOT / "docs" / "data" / "brassage_recipes.json"
OUTPUT_FILE  = ROOT / "docs" / "data" / "gacha_banners.json"

# Rarities qui retirent COMPLÈTEMENT l'item du pool gacha
EXCLUDED_RARITIES = {"forgeflamme", "signature", "pandemonium"}

# Bannières (4 thématiques, rotation 2 actives / 4 jours)
BANNER_DESIGN = [
    {
        "id":          "nexus_flux",
        "name":        "Nexus Flux",
        "description": "Flux standard du Nexus — équipement varié, toutes raretés. Idéal pour débuter.",
        "weights": {
            # weight = poids relatif (normalisé à 100% côté UI)
            "common": 30, "uncommon": 25, "rare": 20,
            "epic": 12, "legendary": 8, "mythic": 4,
            "arcanae": 1,
        },
        "pool_kinds": ["equipment", "materials"],
        "featured_rarity": "legendary",
        "image_hint": "linear-gradient(135deg,#0a1628,#0d2847,#061a30)",
    },
    {
        "id":          "arcana_memorium",
        "name":        "Arcana Memorium",
        "description": "Mémoire arcanique — focus sur l'épique et le mythique, accessoires magiques rares.",
        "weights": {
            "common": 18, "uncommon": 22, "rare": 23,
            "epic": 18, "legendary": 12, "mythic": 6,
            "arcanae": 1,
        },
        "pool_kinds": ["equipment", "materials"],
        "featured_rarity": "mythic",
        "image_hint": "linear-gradient(135deg,#1a0a28,#2d0d47,#1a0630)",
    },
    {
        "id":          "golden_nexus",
        "name":        "Golden Nexus",
        "description": "Trésor du Nexus — pas de common, garantis épique+ très souvent. Pour les chasseurs.",
        "weights": {
            "uncommon": 22, "rare": 28, "epic": 24,
            "legendary": 13, "mythic": 8, "artifact": 4,
            "arcanae": 1,
        },
        "pool_kinds": ["equipment", "materials"],
        "featured_rarity": "artifact",
        "image_hint": "linear-gradient(135deg,#281a0a,#473d0d,#302306)",
    },
    {
        "id":          "forge_supply",
        "name":        "Réserve du Forgeron",
        "description": "Bannière artisan — matériaux abondants, équipement low/mid tier.",
        "weights": {
            "common": 38, "uncommon": 28, "rare": 19,
            "epic": 9, "legendary": 4, "mythic": 1,
            "arcanae": 1,
        },
        "pool_kinds": ["materials_heavy"],
        "featured_rarity": "epic",
        "image_hint": "linear-gradient(135deg,#28140a,#3d1a0d,#2a0a06)",
    },
]

# Cap d'items par bucket de rareté affiché (côté UI / liste loot)
ITEMS_PER_RARITY_CAP = 14


def load_items_db():
    raw = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    # Fusion items + equipment + food + consumable
    all_items = {}
    for section in ("items", "equipment", "food_items", "consumable_items"):
        block = raw.get(section, {}) or {}
        for k, v in block.items():
            if isinstance(v, dict):
                all_items[k] = v
    return all_items


def load_brewing_ids():
    """IDs de toutes les potions / élixirs / consumables brewing."""
    out = set()
    try:
        brew = json.loads(BREW_FILE.read_text(encoding="utf-8"))
    except Exception:
        return out
    for section in ("potions", "recipes"):
        d = brew.get(section, {}) or {}
        for k, v in d.items():
            if k.startswith("_"):
                continue
            if isinstance(v, dict):
                # Une recette a souvent un .result.item_id ou un .id
                rid = v.get("id") or v.get("item_id")
                if rid:
                    out.add(rid)
                else:
                    out.add(k)
    return out


def is_excluded(item_id: str, item: dict, brewing_ids: set) -> bool:
    if item_id in brewing_ids:
        return True
    rarity = str(item.get("rarity", "")).lower()
    if rarity in EXCLUDED_RARITIES:
        return True
    name = str(item.get("name", "")).lower()
    if "potion" in name or "élixir" in name or "elixir" in name:
        return True
    return False


def categorize(items_db: dict, brewing_ids: set):
    """Range les items dans des buckets {rarity -> [items]}, séparant
    équipement et matériaux."""
    by_rarity_equip = {}
    by_rarity_mat = {}
    arcanae_item = None
    for iid, info in items_db.items():
        if is_excluded(iid, info, brewing_ids):
            continue
        if iid == "arcanae" or "arcanae" in iid:
            arcanae_item = (iid, info)
            continue
        rarity = str(info.get("rarity", "common")).lower()
        is_material = (info.get("type") == "material")
        entry = {
            "type": "item",
            "id": iid,
            "name": info.get("name", iid.replace("_", " ").title()),
            "icon": info.get("icon", "📦"),
            "quantity": 1,
        }
        bucket = by_rarity_mat if is_material else by_rarity_equip
        bucket.setdefault(rarity, []).append(entry)
    return by_rarity_equip, by_rarity_mat, arcanae_item


def build_banner(design: dict, by_rarity_equip: dict, by_rarity_mat: dict,
                 arcanae_item: tuple) -> dict:
    """Construit la def D1-ready d'une bannière."""
    rng = random.Random(hash(design["id"]) & 0xffffffff)

    rarities = {}
    for rarity, weight in design["weights"].items():
        if rarity == "arcanae":
            continue
        equip_pool = by_rarity_equip.get(rarity, [])
        mat_pool   = by_rarity_mat.get(rarity, [])

        # Selon le thème, on dose matos vs équipement
        if design["pool_kinds"] == ["materials_heavy"]:
            ratio_mat = 0.55  # ~55% matos
        else:
            ratio_mat = 0.30  # ~30% matos pour les autres
        n_mat = int(min(len(mat_pool), ITEMS_PER_RARITY_CAP * ratio_mat))
        n_eq  = min(len(equip_pool), ITEMS_PER_RARITY_CAP - n_mat)

        sel_mat = rng.sample(mat_pool, n_mat) if n_mat > 0 else []
        sel_eq  = rng.sample(equip_pool, n_eq) if n_eq > 0 else []
        items = sel_mat + sel_eq
        if not items:
            continue

        rarities[rarity.capitalize()] = {
            "weight": weight,
            "items": items,
        }

    # Slot Arcanae dédié (1% globalement)
    if arcanae_item:
        rarities["Arcanae"] = {
            "weight": design["weights"].get("arcanae", 1),
            "items": [{
                "type": "item",
                "id": arcanae_item[0],
                "name": arcanae_item[1].get("name", "Arcanae"),
                "icon": arcanae_item[1].get("icon", "✦"),
                "quantity": 1,
            }],
        }

    # Featured : 3 items pris dans la rareté principale du thème
    feat_rarity = design.get("featured_rarity", "legendary").capitalize()
    feat_items = (rarities.get(feat_rarity, {}) or {}).get("items", [])
    featured = [it["id"] for it in feat_items[:3]]

    return {
        "id":              design["id"],
        "name":            design["name"],
        "description":     design["description"],
        "cost":            1,
        "active":          False,           # déterminé par rotation
        "featured":        featured,
        "featured_rarity": design["featured_rarity"],
        "rarities":        rarities,
        "image_hint":      design["image_hint"],
    }


def main() -> int:
    if not ITEMS_FILE.exists():
        print(f"[build] ERREUR : {ITEMS_FILE} introuvable", file=sys.stderr)
        return 1

    items_db = load_items_db()
    brewing_ids = load_brewing_ids()
    print(f"[build] {len(items_db)} items chargés (excludes brewing: {len(brewing_ids)})")

    by_rarity_equip, by_rarity_mat, arcanae = categorize(items_db, brewing_ids)
    eq_count = sum(len(v) for v in by_rarity_equip.values())
    mat_count = sum(len(v) for v in by_rarity_mat.values())
    print(f"[build]   pool équipement : {eq_count} items dans {len(by_rarity_equip)} raretés")
    print(f"[build]   pool matériaux  : {mat_count} items")
    print(f"[build]   arcanae trouvé  : {arcanae[0] if arcanae else 'NON'}")

    banners = [build_banner(d, by_rarity_equip, by_rarity_mat, arcanae) for d in BANNER_DESIGN]

    # Rotation : 2 actives / 4 jours
    ROTATION_DAYS = 4
    now = datetime.now(timezone.utc)
    next_rot = now + timedelta(days=ROTATION_DAYS)
    banner_order = [b["id"] for b in banners]
    active_ids = banner_order[:2]
    next_ids   = banner_order[2:4] if len(banner_order) >= 4 else banner_order[:2]

    # Marque les bannières actives
    for b in banners:
        b["active"] = b["id"] in active_ids
        b["status"] = "live" if b["id"] in active_ids else ("next" if b["id"] in next_ids else "idle")

    config = {
        "banners": banners,
        "rotation": {
            "rotation_days":    ROTATION_DAYS,
            "active_ids":       active_ids,
            "next_ids":         next_ids,
            "banner_order":     banner_order,
            "pointer":          0,
            "last_rotation":    now.isoformat(),
            "next_rotation_at": next_rot.isoformat(),
            "days_until_next":  ROTATION_DAYS,
            "manual_override":  False,
            "updated_at":       now.isoformat(),
        },
        "_meta": {
            "generated_at":  now.isoformat(),
            "generator":     "build_banners.py",
            "version":       1,
            "rule_summary":  ("Exclus : forgeflamme/signature/pandemonium/brewing. "
                              "Inclus : tous matériaux + équipement non-exclu. "
                              "Arcanae : 1% sur chaque bannière. Rotation 2/4j."),
        },
    }

    OUTPUT_FILE.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[build] OK -> {OUTPUT_FILE}")
    print(f"[build]   {len(banners)} bannières · rotation {ROTATION_DAYS}j")
    print(f"[build]   actives : {active_ids}")
    print(f"[build]   next    : {next_ids}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
