#!/usr/bin/env python3
"""Générateur des skill trees Dragon & Gyoubu.

Reproduit la structure des trees existants (human.json, moth.json) :
- 1 origin (tier 0)
- N voies, chacune avec :
    - cases stats par tier (densité : ~10 / 13 / 17 / 18 / 19 / 17 / 17 / 16 / 14 / 14 / 12 / 11 / 10 / 9)
    - cases egg/navarites sprinklées (cases supplémentaires)
    - cases jahartites pour la voie Immoral
    - 1 palier final (tier = last)
- Flags : hidden_unless_irp (immoral), hidden_until_base_full (evolution)

Le PRNG est seedé par voie pour reproductibilité.
"""

import json, random, os

OUT_DIR = os.path.dirname(__file__)

ALL_STATS = ['str','agi','spd','int','mana','res','cha']

# (stat, egg, nav) par tier — matche la courbe de human.json corps
PATTERN = [
    (10, 0, 0),   # t1
    (13, 0, 0),   # t2
    (16, 1, 0),   # t3
    (17, 0, 1),   # t4
    (18, 1, 0),   # t5
    (16, 0, 1),   # t6
    (16, 1, 0),   # t7
    (14, 1, 1),   # t8
    (13, 0, 1),   # t9
    (13, 1, 0),   # t10
    (11, 0, 1),   # t11
    (10, 1, 0),   # t12
    (9,  0, 1),   # t13
    (8,  1, 0),   # t14
]

EVO_PATTERN = [
    (6,  1, 0),   # t1
    (8,  1, 0),   # t2
    (10, 1, 0),   # t3
    (10, 0, 1),   # t4
    (10, 1, 0),   # t5
    (8,  0, 0),   # t6
]

# Sprinkle jahartites cases au tier 4/8/12 pour la voie Immoral
JAH_TIERS = {4: 1, 8: 1, 12: 1}


def stat_amount(tier, rng):
    base = 1 + (tier - 1) // 2
    return rng.choice([base, base, base + 1])

def stat_cost(tier):
    if tier <= 3: return 1
    if tier <= 6: return 2
    if tier <= 10: return 3
    return 4

def gen_effects(focus_stats, tier, rng):
    """{stat: amount}. ~25% multi-stat à partir de tier 2."""
    pool = focus_stats if focus_stats else ALL_STATS
    p1 = rng.choice(pool)
    amt1 = stat_amount(tier, rng)
    effects = {p1: amt1}
    # 25% multi-stat
    if tier >= 2 and rng.random() < 0.25:
        secondary = [s for s in (focus_stats or ALL_STATS) if s != p1]
        if not secondary:
            secondary = [s for s in ALL_STATS if s != p1]
        p2 = rng.choice(secondary)
        amt2 = max(1, stat_amount(tier, rng) - 1)
        effects[p2] = amt2
    return effects


def make_stat(prefix, voie, tier, idx, focus, requires, rng):
    return {
        "id": f"{prefix}-{voie}-t{tier}-{idx:02d}",
        "voie": voie, "tier": tier, "type": "stat",
        "effects": gen_effects(focus, tier, rng),
        "eggs": 0,
        "pos": {"x": 0, "y": 0},
        "requires": requires,
        "cost_pc": stat_cost(tier),
    }

def make_egg(prefix, voie, tier, idx, requires, rng):
    """Egg sprinkle : valeur ~3 + tier/2 (de +3 à +10 du tier 1 au 14)."""
    eggs = 2 + tier // 2 + rng.randint(0, 1)
    return {
        "id": f"{prefix}-{voie}-egg-t{tier}-{idx:02d}",
        "voie": voie, "tier": tier, "type": "egg",
        "effects": {},
        "eggs": eggs,
        "pos": {"x": 0, "y": 0},
        "requires": requires,
        "cost_pc": 1,
        "desc": f"+{eggs} Golden Eggs",
    }

def make_nav(prefix, voie, tier, idx, requires, rng):
    nav = 3 + tier + rng.randint(0, 2)
    return {
        "id": f"{prefix}-{voie}-nav-t{tier}-{idx:02d}",
        "voie": voie, "tier": tier, "type": "stat",
        "effects": {},
        "eggs": 0,
        "navarites": nav,
        "pos": {"x": 0, "y": 0},
        "requires": requires,
        "cost_pc": 1,
        "desc": f"+{nav} Navarites",
    }

def make_jah(prefix, voie, tier, idx, requires, rng):
    jah = 5 + tier * 2 + rng.randint(0, 3)
    return {
        "id": f"{prefix}-{voie}-jah-t{tier}-{idx:02d}",
        "voie": voie, "tier": tier, "type": "stat",
        "effects": {},
        "eggs": 0,
        "jahartites": jah,
        "pos": {"x": 0, "y": 0},
        "requires": requires,
        "cost_pc": 1,
        "desc": f"+{jah} Jahartites",
    }


def gen_voie(prefix, voie, total_tiers, focus, palier_data, has_immoral_jah=False):
    """Génère les cases d'une voie complète (cases tiers 1..total_tiers-1 + palier au tier total_tiers)."""
    rng = random.Random(hash(f"{prefix}-{voie}") & 0xffffffff)
    cases = []
    prev_tier_ids = [f"{prefix}-origin"]  # tier 0 = origin

    pattern = EVO_PATTERN if voie == 'evolution' else PATTERN
    # On utilise pattern[i] pour tier i+1 ; on prend total_tiers-1 entrées
    for tier_idx in range(total_tiers - 1):
        tier = tier_idx + 1
        if tier_idx >= len(pattern):
            n_stat, n_egg, n_nav = (8, 1, 0)  # fallback safe pour très grand tier
        else:
            n_stat, n_egg, n_nav = pattern[tier_idx]
        n_jah = JAH_TIERS.get(tier, 0) if has_immoral_jah else 0

        # Génère les requires : tier 1 → [origin], tier N → 1-2 parents random de tier N-1
        tier_cases = []
        # Stats
        for i in range(n_stat):
            if tier == 1:
                req = [prev_tier_ids[0]]
            else:
                # 1 parent principal + 30% chance d'avoir 2 parents
                n_par = 1 if rng.random() > 0.30 else 2
                n_par = min(n_par, len(prev_tier_ids))
                req = rng.sample(prev_tier_ids, n_par)
            tier_cases.append(make_stat(prefix, voie, tier, i + 1, focus, req, rng))
        # Eggs
        for i in range(n_egg):
            req = rng.sample(prev_tier_ids, min(1, len(prev_tier_ids)))
            tier_cases.append(make_egg(prefix, voie, tier, i + 1, req, rng))
        # Navarites
        for i in range(n_nav):
            req = rng.sample(prev_tier_ids, min(1, len(prev_tier_ids)))
            tier_cases.append(make_nav(prefix, voie, tier, i + 1, req, rng))
        # Jahartites (immoral only)
        for i in range(n_jah):
            req = rng.sample(prev_tier_ids, min(1, len(prev_tier_ids)))
            tier_cases.append(make_jah(prefix, voie, tier, i + 1, req, rng))

        cases.extend(tier_cases)
        # Les paliers requièrent ~4 cases du tier final-1
        prev_tier_ids = [c["id"] for c in tier_cases]

    # Palier final
    palier_tier = total_tiers
    # Sélectionne 4 cases du dernier tier comme requires du palier
    palier_reqs = sorted(prev_tier_ids)[:min(4, len(prev_tier_ids))]
    palier = {
        "id": f"{prefix}-{voie}-palier",
        "voie": voie,
        "tier": palier_tier,
        "type": "palier",
        "palier_name": palier_data["name"],
        "palier_desc": palier_data["desc"],
        "effects": {},
        "eggs": 0,
        "pos": {"x": 0, "y": 0},
        "requires": palier_reqs,
        "cost_pc": 8 if voie != 'evolution' else 10,
    }
    # Récompenses spécifiques au palier
    if "grants_power" in palier_data:
        palier["grants_power"] = palier_data["grants_power"]
        palier["grants_power_name"] = palier_data["grants_power_name"]
    if "eggs" in palier_data:
        palier["eggs"] = palier_data["eggs"]
    if "navarites" in palier_data:
        palier["navarites"] = palier_data["navarites"]
    if "jahartites" in palier_data:
        palier["jahartites"] = palier_data["jahartites"]
    if "requires_dm_fonda" in palier_data:
        palier["requires_dm_fonda"] = palier_data["requires_dm_fonda"]
    if "transforms_race_to" in palier_data:
        palier["transforms_race_to"] = palier_data["transforms_race_to"]
    cases.append(palier)
    return cases


def make_origin(prefix):
    return {
        "id": f"{prefix}-origin",
        "voie": "core",
        "tier": 0,
        "type": "origin",
        "effects": {},
        "eggs": 0,
        "pos": {"x": 0, "y": 0},
        "requires": [],
        "cost_pc": 0,
        "desc": "Point de départ — gratuit, débloqué automatiquement à la création.",
    }


def compute_totals(meta, cases):
    """Calcule les totals (cases, eggs, navarites, etc.) en fonction des cases générées."""
    visible_cases = [c for c in cases if meta['voies'].get(c['voie'], {}).get('hidden_unless_irp') is not True]
    irp_cases = cases  # tout, y compris l'immoral
    stat_total = {s: 0 for s in ALL_STATS}
    for c in cases:
        if meta['voies'].get(c['voie'], {}).get('hidden_unless_irp'):
            continue
        for s, v in (c.get('effects') or {}).items():
            if s in stat_total:
                stat_total[s] += v
    return {
        "cases": len(cases),
        "cases_visible_non_irp": len(visible_cases),
        "pc_to_full_clear_visible": sum(c.get('cost_pc', 0) for c in visible_cases),
        "pc_to_full_clear_irp":     sum(c.get('cost_pc', 0) for c in irp_cases),
        "golden_eggs_visible":      sum(c.get('eggs', 0) for c in visible_cases),
        "golden_eggs_irp":          sum(c.get('eggs', 0) for c in irp_cases),
        "navarites_visible":        sum(c.get('navarites', 0) for c in visible_cases),
        "navarites_irp":            sum(c.get('navarites', 0) for c in irp_cases),
        "jahartites_irp":           sum(c.get('jahartites', 0) for c in irp_cases),
        "paliers":                  sum(1 for c in cases if c.get('type') == 'palier'),
        "stat_points_per_stat":     stat_total,
    }


# ═══════════════════════════════════════════════════════════════════════
# DRAGON
# ═══════════════════════════════════════════════════════════════════════

DRAGON_VOIES_META = {
    "privilege": {
        "name": "Voie du Privilège", "focus": "Global",
        "palier_name": "EXCELLENCE", "palier_desc": "Récompense de fin de voie : 100 Navarites.",
        "color": "#cc2936", "order": 0,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "supreme": {
        "name": "Voie du Suprême", "focus": "Global",
        "palier_name": "MÉTAMORPHE", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Mythical Morph » (commande /mythmorph — multiplie les stats par 2 durant MANA_GLOBAL/20 messages RP).",
        "color": "#ff9500", "order": 1,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "arrogance": {
        "name": "Voie de l'Arrogance", "focus": "Global",
        "palier_name": "HUBRIS", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Supreme Privilege » (passif : toutes les stats ×1.3).",
        "color": "#ff006e", "order": 2,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "apex": {
        "name": "Voie de l'Apex", "focus": "Global",
        "palier_name": "INTOUCHABLE", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Supreme Creature » (passif : immunité aux pouvoirs Crowd Control).",
        "color": "#7b1fa2", "order": 3,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "puissance": {
        "name": "Voie de la Puissance", "focus": "Global",
        "palier_name": "BRASIER", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Dragon Breath » (souffle dévastateur — Plasma Cannon × 0.67).",
        "color": "#FF4757", "order": 4,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "elegance": {
        "name": "Voie de l'Élégance", "focus": "Global",
        "palier_name": "MAJESTÉ", "palier_desc": "Récompense de fin de voie : 50 Golden Eggs.",
        "color": "#80b3ff", "order": 5,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "immoral": {
        "name": "Voie de l'Immoral", "focus": "Global",
        "palier_name": "TYRANNIE", "palier_desc": "Récompense de fin de voie : 350 Jahartites.",
        "color": "#9d1f4d", "order": 6,
        "stat_weights": {s: 1 for s in ALL_STATS},
        "hidden_unless_irp": True,
    },
    "evolution": {
        "name": "Voie de l'Évolution", "focus": "Endgame — bouleversement de l'identité",
        "palier_name": "POUVOIR UNIQUE", "palier_desc": "Récompense ultime : Item Unique — MP le fondateur pour activation.",
        "color": "#ffd60a", "order": 7,
        "stat_weights": {s: 1 for s in ALL_STATS},
        "hidden_until_base_full": True,
    },
}

DRAGON_VOIE_PALIER_DATA = {
    "privilege": {"name": "EXCELLENCE", "desc": "Récompense de fin de voie : 100 Navarites.", "navarites": 100},
    "supreme":   {"name": "MÉTAMORPHE", "desc": "Pouvoir Voie « Mythical Morph » — /mythmorph multiplie les stats par 2 durant MANA_GLOBAL/20 messages RP.",
                  "grants_power": "dragon_mythical_morph", "grants_power_name": "Mythical Morph"},
    "arrogance": {"name": "HUBRIS", "desc": "Pouvoir Voie « Supreme Privilege » — passif : toutes les stats ×1.3.",
                  "grants_power": "dragon_supreme_privilege", "grants_power_name": "Supreme Privilege"},
    "apex":      {"name": "INTOUCHABLE", "desc": "Pouvoir Voie « Supreme Creature » — passif : immunité aux pouvoirs Crowd Control.",
                  "grants_power": "dragon_supreme_creature", "grants_power_name": "Supreme Creature"},
    "puissance": {"name": "BRASIER", "desc": "Pouvoir Voie « Dragon Breath » — souffle dévastateur (Plasma Cannon × 0.67).",
                  "grants_power": "dragon_breath", "grants_power_name": "Dragon Breath"},
    "elegance":  {"name": "MAJESTÉ", "desc": "Récompense de fin de voie : 50 Golden Eggs.", "eggs": 50},
    "immoral":   {"name": "TYRANNIE", "desc": "Récompense de fin de voie : 350 Jahartites.", "jahartites": 350},
    "evolution": {"name": "POUVOIR UNIQUE", "desc": "Récompense ultime : Item Unique — MP le fondateur pour activation.",
                  "requires_dm_fonda": "Item Unique (à définir avec le fondateur)"},
}

DRAGON_VOIES_TIERS = {
    "privilege": 13,
    "supreme":   13,
    "arrogance": 14,
    "apex":      14,
    "puissance": 14,
    "elegance":  14,
    "immoral":   14,
    "evolution": 7,
}

DRAGON_VOIES_FOCUS = {
    "privilege": None,  # Global
    "supreme":   None,
    "arrogance": None,
    "apex":      None,
    "puissance": None,
    "elegance":  None,
    "immoral":   None,
    "evolution": None,
}


def build_dragon():
    prefix = "dr"
    voies_meta = DRAGON_VOIES_META
    cases = [make_origin(prefix)]
    for voie_key in ['privilege','supreme','arrogance','apex','puissance','elegance','immoral','evolution']:
        tiers = DRAGON_VOIES_TIERS[voie_key]
        focus = DRAGON_VOIES_FOCUS[voie_key]
        palier_data = DRAGON_VOIE_PALIER_DATA[voie_key]
        has_jah = (voie_key == 'immoral')
        cases.extend(gen_voie(prefix, voie_key, tiers, focus, palier_data, has_immoral_jah=has_jah))

    meta = {
        "description": "Skill tree Dragon — 8 voies (6 visibles globales + Immoral IRP + Evolution endgame). Toutes les voies sont 'Global'. Paliers : 4 pouvoirs raciaux (Mythical Morph, Supreme Privilege, Supreme Creature, Dragon Breath), 1× 100 Nav, 1× 50 Eggs, 1× 350 Jah, 1× Item Unique.",
        "pc_per_xp_chars": 1000,
        "allocation": "site-only",
        "voies": voies_meta,
    }
    meta["totals"] = compute_totals(meta, cases)
    return {"race": "Dragon", "version": 1, "_meta": meta, "cases": cases}


# ═══════════════════════════════════════════════════════════════════════
# GYOUBU
# ═══════════════════════════════════════════════════════════════════════

GYOUBU_VOIES_META = {
    "malice": {
        "name": "Voie de la Malice", "focus": "INT + AGI",
        "palier_name": "SILENCE", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Silent Walker ».",
        "color": "#5e3c8e", "order": 0,
        "stat_weights": {"int": 2, "agi": 2, "spd": 1, "cha": 1},
    },
    "voleur": {
        "name": "Voie du Voleur", "focus": "AGI + SPD",
        "palier_name": "OMBRE", "palier_desc": "Récompense de fin de voie : pouvoir Voie « Charming ».",
        "color": "#4a9d63", "order": 1,
        "stat_weights": {"agi": 2, "spd": 2, "int": 1, "cha": 1},
    },
    "espiegle": {
        "name": "Voie de l'Espiègle", "focus": "CHA + INT",
        "palier_name": "FARCE", "palier_desc": "Récompense de fin de voie : 50 Golden Eggs.",
        "color": "#ff5fa3", "order": 2,
        "stat_weights": {"cha": 2, "int": 2, "agi": 1, "spd": 1},
    },
    "illicite": {
        "name": "Voie de l'Illicite", "focus": "Global",
        "palier_name": "TRANSGRESSION", "palier_desc": "Récompense de fin de voie : 100 Navarites.",
        "color": "#ff5e1f", "order": 3,
        "stat_weights": {s: 1 for s in ALL_STATS},
    },
    "evolution": {
        "name": "Voie de l'Évolution", "focus": "Endgame — transformation",
        "palier_name": "MUTATION", "palier_desc": "Récompense ultime : transformation en Dragon ou Salamander (au choix — MP le fondateur).",
        "color": "#ffd60a", "order": 4,
        "stat_weights": {s: 1 for s in ALL_STATS},
        "hidden_until_base_full": True,
    },
}

GYOUBU_VOIE_PALIER_DATA = {
    # NOTE : on réutilise les IDs existants `silent_walker` / `charming` du
    # bot (character_system.py / irp_character_system.py — ALL_RACIAL_POWERS).
    # Ainsi le Gyoubu qui débloque ce palier reçoit le même pouvoir qu'un
    # Neko/Moth/Lamia qui l'aurait pris au char-creation, et tous les checks
    # bot/site existants fonctionnent sans modification.
    "malice":    {"name": "SILENCE", "desc": "Pouvoir Voie « Silent Walker » — déplacements silencieux (pas insonores).",
                  "grants_power": "silent_walker", "grants_power_name": "Silent Walker"},
    "voleur":    {"name": "OMBRE", "desc": "Pouvoir Voie « Charming » — CHA/MAN alloc ×2, buffs CHA/MAN ×1.3.",
                  "grants_power": "charming", "grants_power_name": "Charming"},
    "espiegle":  {"name": "FARCE", "desc": "Récompense de fin de voie : 50 Golden Eggs.", "eggs": 50},
    "illicite":  {"name": "TRANSGRESSION", "desc": "Récompense de fin de voie : 100 Navarites.", "navarites": 100},
    "evolution": {"name": "MUTATION", "desc": "Transformation ultime en Dragon ou Salamander (au choix).",
                  "requires_dm_fonda": "Transformation en Dragon ou Salamander (au choix du joueur)"},
}

GYOUBU_VOIES_TIERS = {
    "malice":   11,
    "voleur":   11,
    "espiegle": 11,
    "illicite": 15,
    "evolution": 7,
}

GYOUBU_VOIES_FOCUS = {
    "malice":   ["int", "agi"],
    "voleur":   ["agi", "spd"],
    "espiegle": ["cha", "int"],
    "illicite": None,
    "evolution": None,
}


def build_gyoubu():
    prefix = "gy"
    voies_meta = GYOUBU_VOIES_META
    cases = [make_origin(prefix)]
    for voie_key in ['malice','voleur','espiegle','illicite','evolution']:
        tiers = GYOUBU_VOIES_TIERS[voie_key]
        focus = GYOUBU_VOIES_FOCUS[voie_key]
        palier_data = GYOUBU_VOIE_PALIER_DATA[voie_key]
        cases.extend(gen_voie(prefix, voie_key, tiers, focus, palier_data))

    meta = {
        "description": "Skill tree Gyoubu — 5 voies (4 visibles + Evolution endgame). Focus AGI/INT/CHA. Paliers : 2 pouvoirs raciaux (Silent Walker, Charming), 1× 50 Eggs, 1× 100 Nav, 1× transformation Dragon/Salamander.",
        "pc_per_xp_chars": 1000,
        "allocation": "site-only",
        "voies": voies_meta,
    }
    meta["totals"] = compute_totals(meta, cases)
    return {"race": "Gyoubu", "version": 1, "_meta": meta, "cases": cases}


# ═══════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════
def main():
    import sys
    try: sys.stdout.reconfigure(encoding='utf-8')
    except: pass
    dragon = build_dragon()
    gyoubu = build_gyoubu()
    p1 = os.path.join(OUT_DIR, 'dragon.json')
    p2 = os.path.join(OUT_DIR, 'gyoubu.json')
    with open(p1, 'w', encoding='utf-8') as f:
        json.dump(dragon, f, ensure_ascii=False, indent=2)
    with open(p2, 'w', encoding='utf-8') as f:
        json.dump(gyoubu, f, ensure_ascii=False, indent=2)
    print(f"OK  {p1} ({len(dragon['cases'])} cases)")
    print(f"OK  {p2} ({len(gyoubu['cases'])} cases)")
    print()
    print('=== DRAGON totals ===')
    for k,v in dragon['_meta']['totals'].items():
        print(f'  {k}: {v}')
    print('=== GYOUBU totals ===')
    for k,v in gyoubu['_meta']['totals'].items():
        print(f'  {k}: {v}')

if __name__ == '__main__':
    main()
