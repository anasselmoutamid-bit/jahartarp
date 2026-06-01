# Axiomes T1+T2 — Intégration tech (TODO)

## Helper central : `js/axiomes-skills.js`

Lib JS qui expose `window.AxiomeSkills.*` après que `data/axiomes.json` soit chargé. Lecture des skills débloqués via `char.axiome_tree_unlocked`.

API publique principale :
```js
AxiomeSkills.ready                            // Promise<void>
AxiomeSkills.has(char, 'orateur.marchand-familier')
AxiomeSkills.canAccessSystem(char, 'forge')   // 'forge'|'brassage'|'darknexusnet'|'benedictions'
AxiomeSkills.getStatBonusTotal(char, 'resistance')
AxiomeSkills.getShopDiscount(char)            // -0.20 max
AxiomeSkills.getGoldenEggsBonus(char)         // +0.20 max
AxiomeSkills.isAuraUnlocked(char)             // Cultivator
AxiomeSkills.getBenedictionRate(char)         // 0.75 / 0.85 / 0.95
AxiomeSkills.getCompanionsMaxSync(char)       // 1 / 2 / 3 / Infinity
AxiomeSkills.getCompanionLevelCap(char)       // 130 (Limit Breaker) ou null
AxiomeSkills.getBrassageScope(char)           // 'full' / 'healing_only' / 'none'
AxiomeSkills.canBrewMythic(char)              // Potionniste Élixir
AxiomeSkills.getForgeScope(char)              // { allowed, max_stars, runes, ... }
AxiomeSkills.getDarknexusnetMode(char)        // 'hacker' / 'encodeur' / 'both' / 'none'
```

## Pages où inclure le script

Toutes les pages qui ont besoin de lire les skills d'axiomes :
- `hub.html`, `hub-irp.html` (compagnons, bénédictions, inventaire affichage)
- `fiches.html`, `fiches-irp.html` (affichage stat aura)
- `forge.html` (accès, raretés, améliorations, runes)
- `brassage.html` (accès, filtre soin, rareté Mythic)
- `darknexusnet.html` (modes hacker/encodeur)
- `shops.html`, `universal-shop.html`, `sanctuaire.html` (discount achat, bonus vente)
- `axiomes.html` (déjà — c'est ici qu'on débloque)

Ordre d'include (après `data/axiomes.json` ne soit nécessaire de charger directement) :
```html
<script src="js/utils.js"></script>
<script src="js/constants.js"></script>
<script src="js/axiomes-skills.js"></script>     <!-- avant les page-specific -->
<script src="js/forge-page.js"></script>
```

---

## Patches par système

### 1. Stat AURA (Cultivator)

**Fichiers** : `js/stats-caps.js`, `js/fiches.js`, `js/fiches-irp.js`, hub display.

**Logique** : la stat aura DOIT être à 0 et masquée sauf si le perso a `cultivator.root` débloqué.

```js
// stats-caps.js — modifier le calcul / affichage
// Si !AxiomeSkills.isAuraUnlocked(char) → forcer aura = 0
// fiches.js : ne pas afficher la barre aura si pas débloqué
```

### 2. Shop discount/bonus

**Fichiers** : `js/shops-page.js`, `js/universal-shop.js`, `js/sanctuaire-page.js`.

**Logique** :
- Sur l'achat : `prixFinal = prixBase * (1 + AxiomeSkills.getShopDiscount(char))` (discount est négatif)
- Sur la vente de Golden Eggs : `prixVenteFinal = prixBase * (1 + AxiomeSkills.getGoldenEggsBonus(char))`

```js
// Exemple shops-page.js :
function computePrice(item, char) {
  let price = item.price;
  if (window.AxiomeSkills) {
    price *= (1 + AxiomeSkills.getShopDiscount(char));
  }
  return Math.floor(price);
}

// Exemple ventes golden_eggs :
function computeSellPrice(item, char) {
  let price = item.sell_price;
  if (item.type === 'golden_eggs' && window.AxiomeSkills) {
    price *= (1 + AxiomeSkills.getGoldenEggsBonus(char));
  }
  return Math.floor(price);
}
```

### 3. Forge (accès + raretés + runes)

**Fichier** : `js/forge-page.js`.

**Logique** :
```js
const scope = AxiomeSkills.getForgeScope(char);
if (!scope.allowed) { showAccessDenied('Forgeron ou Héritier de Baldun requis'); return; }
// Rareté max forgeable : Legendary par défaut (T1 root donne accès complet)
// Stars max : scope.max_stars (0, 1, 3)
// Modal Rune visible si scope.runes === true
// Bouton "Chef d'Œuvre" visible si scope.chef_oeuvre === true (validation staff)
// Bouton "Rune Unique" visible si scope.rune_unique === true
```

L'ancien code `_forgeronStatus(c)` peut être conservé pour rétrocompat mais doit utiliser AxiomeSkills si dispo.

### 4. Brassage (accès + filtre + Mythic)

**Fichier** : `js/brassage-page.js`.

**Logique** :
```js
const scope = AxiomeSkills.getBrassageScope(char);
if (scope === 'none') { showAccessDenied('Potionniste ou Druide requis'); return; }

// Filtrer recettes
const recipes = brassage_recipes.filter(r => {
  if (scope === 'full') return true;
  if (scope === 'healing_only') return r.category === 'healing';
  return false;
});

// Rareté Mythic visible si AxiomeSkills.canBrewMythic(char)
// Toutes les potions Mythic ont un nom commençant par "Elixir"
```

**Données** : `data/brassage_recipes.json` doit avoir un champ `category` (healing/buff/debuff/utility/etc.) et un champ `rarity` (avec valeur 'Mythic' pour les Elixirs).

### 5. DarkNexusNet (modes hacker/encodeur)

**Fichier** : `js/darknexusnet-page.js`.

**Logique** :
```js
const mode = AxiomeSkills.getDarknexusnetMode(char);
if (mode === 'none') { showAccessDenied('Hacker ou Encodeur requis'); return; }

// mode 'hacker' : section Marché Noir + Hack Bancaire visibles
// mode 'encodeur' : section Forge Anti-Hack visible
// mode 'both' : toutes visibles
```

L'ancien `_isHacker` / `_isEncodeur` peut être remplacé par `AxiomeSkills.getDarknexusnetMode(char) === 'hacker'` / etc.

### 6. Bénédictions (taux variable)

**Fichiers** : `js/hub-core.js` ou `js/hub-irp-core.js` (selon où est le menu Bénédictions).

**Logique** :
```js
function pray(char) {
  const rate = AxiomeSkills.getBenedictionRate(char);
  if (rate === 0) { showError('Pacte de Prière non débloqué'); return; }
  
  // Vérifier cooldown 3 jours
  const last = char.prayer_log?.last_at || 0;
  if (Date.now() - last < 3 * 86400 * 1000) { showError('Cooldown 3 jours'); return; }
  
  const success = Math.random() < rate;
  if (success) {
    // Écrire dans benedictions/
    // Mettre à jour char.prayer_log avec last_at = now
  } else {
    // Juste log dans prayer_log (avec last_at)
  }
}
```

### 7. Companions (synchros + level cap)

**Fichiers** : Hub onglet Compagnons (à identifier — probablement dans `hub-core.js` ou un nouveau fichier).

**Logique** :
```js
const maxSync = AxiomeSkills.getCompanionsMaxSync(char);
// Limiter le nombre de companions actifs simultanément à maxSync

const levelCap = AxiomeSkills.getCompanionLevelCap(char) || DEFAULT_COMPANION_CAP;
// Cap le level upgrade dans l'UI

// Endurance Partagée (Chef de Meute) — dynamique :
function recomputeResBonus(char) {
  const activeSync = char.companions_active_sync_count || 0;
  return AxiomeSkills.getEndurancePartageeBonus(char, activeSync);
}
```

### 8. Bot Discord (TODOs côté bot Python)

À coder côté bot dans les commandes :
- `/buy` (et autres achats) : appliquer le discount cumulé selon les skills lus depuis `characters.{id}.axiome_tree_unlocked`
- `/sell` Golden Eggs : appliquer le bonus
- `/power glyph` (TechnArcaniste) : nouvelle commande à créer
- Toutes les commandes qui utilisent stats : ajouter les `stat_bonus` cumulés de AxiomeSkills équivalent côté Python
- Bénédictions : si le bot doit en émettre, lire le taux (75/85/95)

Helper Python à créer (équivalent de `axiomes-skills.js`) qui charge le même `data/axiomes.json` et expose la même API.

---

## Ordre d'implémentation suggéré

1. ✅ Helper `axiomes-skills.js` créé.
2. ✅ **Stat AURA (Cultivator)** — gating dans `fiches.js`, `fiches-irp.js`, helper `Jaharta.isAuraUnlocked` ajouté.
3. ✅ **Shop discount** (`shops-page.js`, `universal-shop.js`) + ✅ **Golden Eggs sell bonus** (`shops-page.js` addToShop, détecte items golden_egg).
4. ✅ **Forge** — gating + raretés + runes branchés sur AxiomeSkills dans `forge-page.js`.
5. ✅ **Brassage** — gating (full / healing_only / none), filtre soin, gating Mythic dans `brassage-page.js`.
6. ✅ **DarkNexusNet** — modes hacker/encodeur/both/none dans `darknexusnet-page.js`.
7. ✅ **Bénédictions** — taux 75/85/95 + cooldown 3j, widget Pacte dans `hub-benedictions.js`.
8. ✅ **Companions** — Level cap (Limit Breaker 130), Max sync (1/2/3/∞), Endurance Partagée dynamique branchée dans `fiches.js` + `fiches-irp.js`.
9. ⏳ **Bot Discord** — Python side. La plupart des effets stat_bonus sont déjà appliqués via `active_buffs`. À auditer côté `Jaharta-bot/app.py` pour `/buy`, `/sell golden`, `/power glyph`.

Status global : **frontend axiomes T1+T2 → complet**.

Notes :
- Helper `axiomes-skills.js` est désormais inclus dans : `axiomes.html`, `forge.html`, `shops.html`, `universal-shop.html`, `hub.html`, `hub-irp.html`, `brassage.html`, `darknexusnet.html`, `sanctuaire.html`, `fiches.html`, `fiches-irp.html`.
- Tous les accès sont défensifs (`window.AxiomeSkills && …`) avec fallback sur ancien `axiome_current` pour rétrocompat.

---

## Audit 2026-06-01 — état réel

### ✅ Items débloqués par `unlock_item_type` (P0 #1) — DONE

**196 items générés** et pushés en D1 via `scripts/seed_axiome_items.py` (côté bot Python).

Couvre les 36 types listés dans `_axiome_unlocks.json` :
shield, heavy_armor, war_banner, heavy_bracers, dueling_blade, duelist_cape,
focus_charm, throwing_blade, arcane_focus, grimoire, arcane_ring, mana_medallion,
signet_ring, court_attire, court_jewelry, court_badge, beast_tool, beast_pelt_cloak,
beast_bond_ring, beast_pact_medallion, firearm, sidearm, ammo_belt, tactical_optic,
protection_focus, ram_armor, assassin_tool, military_kit, scout_garb, martial_glove,
martial_wraps, archmage_robe, techno_focus, monk_focus, socialite_badge, perfume.

Chaque item a un flag `axiome_unlock: true` + `axiome_item_type: "<type>"` pour traçabilité.

### ⊘ Sanctuaire (P0 #2) — NON-APPLICABLE

Investigation 2026-06-01 : le sanctuaire est un **système de don gratuit** (`prayers_per_day` quota, pas de coût en devise). Le `shop_discount` Orateur/Manipulateur et le `getGoldenEggsBonus` Dompteur (= bonus sur **vente**) n'ont pas de point d'application ici.

Le sanctuaire DONNE des golden eggs / navarites / items en récompense de prière — il n'y a aucun prix d'achat à réduire.

**Aucun patch nécessaire**. Cette ligne avait été ajoutée à la todo par excès de zèle.

### 🟠 Restant à faire (post-P0)

- **P1** : audit `/buy` (`cogs/shop_system.py`), `/sell` golden_eggs, et création `/power glyph` (TechnArcaniste)
- **P2** : audit pages IRP, cooldown 3j bénédictions, T2 spéciaux
- **P3** : extension des `_conditionPatterns`, golden tests
