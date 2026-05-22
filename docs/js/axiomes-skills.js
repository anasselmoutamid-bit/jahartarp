/* ═══════════════════════════════════════════════════════════════════════
   axiomes-skills.js — Helper central pour les effets d'axiomes T1+T2
   ═══════════════════════════════════════════════════════════════════════

   À inclure dans toutes les pages qui doivent appliquer des effets
   d'axiomes (forge, brassage, darknexusnet, shops, hub-bénédictions,
   stats-caps, etc.).

   Le helper charge data/axiomes.json une fois et expose une API simple :

     window.AxiomeSkills.ready  → Promise<void> (attendre avant d'utiliser)

     window.AxiomeSkills.has(char, skillId)
       → bool : le perso a-t-il débloqué ce skill ?

     window.AxiomeSkills.canAccessSystem(char, systemName)
       → bool : le perso a-t-il un skill qui débloque ce système ?
       systemName ∈ {'forge', 'brassage', 'darknexusnet', 'benedictions'}

     window.AxiomeSkills.getStatBonusTotal(char, statName)
       → number : somme des stat_bonus permanents débloqués pour cette stat.
       Inclut SEULEMENT les bonus permanents (pas les conditionnels).

     window.AxiomeSkills.getShopDiscount(char)
       → number ∈ [-1, 0] : remise totale (Orateur -10% + Manipulateur -10%
       cumul → -20% max). Retourne 0 si aucun skill discount.

     window.AxiomeSkills.getGoldenEggsBonus(char)
       → number : bonus prix de vente Golden Eggs (Dompteur). 0 sinon.

     window.AxiomeSkills.isAuraUnlocked(char)
       → bool : le perso a Cultivator → stat aura active

     window.AxiomeSkills.getBenedictionRate(char)
       → number ∈ [0, 1] : taux de succès des bénédictions.
         0.75 base (Pacte de Prière), 0.85 (Bénédiction Renforcée),
         0.95 (Bénédiction Suprême T2). 0 si pas de skill bénédiction.

     window.AxiomeSkills.getCompanionsMaxSync(char)
       → number : max companions synchros simultanés.
         1 par défaut, 3 (Ami des Bêtes), Infinity (Chef de Meute),
         2 (Limit Breaker Linked Path).

     window.AxiomeSkills.getCompanionLevelCap(char)
       → number : cap level companions. 130 si Limit Breaker, sinon
         valeur par défaut (à définir côté system companions).

     window.AxiomeSkills.getBrassageScope(char)
       → string : 'full' (Potionniste) | 'healing_only' (Druide) | 'none'

     window.AxiomeSkills.getForgeScope(char)
       → object : { allowed: bool, max_stars: 0|1|3, runes: bool,
                    chef_oeuvre: bool, max_rarity: string }

     window.AxiomeSkills.getDarknexusnetMode(char)
       → string : 'hacker' | 'encodeur' | 'both' | 'none'

   ───────────────────────────────────────────────────────────────────────
   IMPORTANT : la lecture des skills passe par `char.axiome_tree_unlocked`
   qui est un objet { skillId: true } maintenu par axiomes-page.js et le
   backend D1.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var DATA = null;            // axiomes.json chargé
  var READY_RESOLVE = null;
  var READY_PROMISE = new Promise(function (r) { READY_RESOLVE = r; });

  /* Cache des résolutions per-char (pour ne pas reparcourir l'arbre 50 fois) */
  var CHAR_CACHE = new WeakMap();

  /* ─── Chargement initial du JSON ─── */
  fetch('data/axiomes.json', { cache: 'force-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      READY_RESOLVE();
    })
    .catch(function (e) {
      if (window._dbg && window._dbg.warn) window._dbg.warn('[axiomes-skills] load failed:', e);
      DATA = {};
      READY_RESOLVE(); /* on résout quand même pour ne pas bloquer le reste */
    });

  /* ─── Utilitaires internes ─── */
  function _getUnlockedSet(char) {
    if (!char) return new Set();
    var cached = CHAR_CACHE.get(char);
    if (cached && cached._sig === char._sig) return cached.set;
    var raw = char.axiome_tree_unlocked || {};
    var set = new Set();
    Object.keys(raw).forEach(function (k) { if (raw[k]) set.add(k); });
    CHAR_CACHE.set(char, { _sig: char._sig || JSON.stringify(raw).slice(0, 32), set: set });
    return set;
  }

  function _findSkill(skillId) {
    if (!DATA || !skillId) return null;
    var prefix = String(skillId).split('.')[0];
    var ax = DATA[prefix];
    if (!ax || !ax.tree || !ax.tree.nodes) return null;
    return ax.tree.nodes.find(function (n) { return n.id === skillId; }) || null;
  }

  function _eachUnlockedEffect(char, cb) {
    var set = _getUnlockedSet(char);
    if (!DATA) return;
    set.forEach(function (skillId) {
      var n = _findSkill(skillId);
      if (!n) return;
      var effects = n.effects || (n.effect ? [{ type: 'legacy', summary: n.effect }] : []);
      effects.forEach(function (e) { cb(e, n, skillId); });
    });
  }

  /* ═══════════════════════════════════════════════════════
     API publique
     ═══════════════════════════════════════════════════════ */

  var API = {

    ready: READY_PROMISE,

    /* ── Présence d'un skill ── */
    has: function (char, skillId) {
      return _getUnlockedSet(char).has(skillId);
    },

    /* ── Accès aux systèmes (forge, brassage, darknexusnet, benedictions) ── */
    canAccessSystem: function (char, systemName) {
      if (!systemName) return false;
      var found = false;
      _eachUnlockedEffect(char, function (e) {
        if (found) return;
        if (e.type === 'unlock_system' && e.system === systemName) found = true;
      });
      return found;
    },

    /* ── Bonus stat permanent (non-conditionnel) ── */
    getStatBonusTotal: function (char, statName) {
      var total = 0;
      _eachUnlockedEffect(char, function (e) {
        if (e.type !== 'stat_bonus') return;
        if (e.stat !== statName) return;
        if (e.condition) return; /* skip conditionnels */
        if (typeof e.value === 'number') total += e.value;
      });
      return total;
    },

    /* ── Bonus stat conditionnel (ex: +7% RES si bouclier équipé) ──
       On retourne la liste pour que l'appelant gère la condition. */
    getConditionalStatBonuses: function (char, statName) {
      var out = [];
      _eachUnlockedEffect(char, function (e) {
        if (e.type !== 'stat_bonus') return;
        if (e.stat !== statName) return;
        if (!e.condition) return;
        out.push({ value: e.value, condition: e.condition });
      });
      return out;
    },

    /* ── Shop discount cumulé (Orateur + Manipulateur) ── */
    getShopDiscount: function (char) {
      var total = 0;
      _eachUnlockedEffect(char, function (e) {
        if (e.type !== 'shop_discount') return;
        if (e.scope === 'all_shops' && typeof e.value === 'number') total += e.value;
      });
      /* Clamp à [-0.50, 0] pour éviter discount > 50% */
      return Math.max(-0.50, Math.min(0, total));
    },

    /* ── Golden Eggs sell bonus (Dompteur) ── */
    getGoldenEggsBonus: function (char) {
      var total = 0;
      _eachUnlockedEffect(char, function (e) {
        if (e.type !== 'shop_bonus') return;
        if (e.scope === 'golden_eggs_sell' && typeof e.value === 'number') total += e.value;
      });
      return total;
    },

    /* ── Stat AURA débloquée (Cultivator) ── */
    isAuraUnlocked: function (char) {
      return this.has(char, 'cultivator.root');
    },

    /* ── Taux de bénédiction (Favori du Nexus) ── */
    getBenedictionRate: function (char) {
      /* Précédence : Suprême T2 (95%) > Renforcée T1 (85%) > Pacte T1 (75%) */
      if (this.has(char, 'favori_nexus_ii.benediction-supreme')) return 0.95;
      if (this.has(char, 'favori_nexus.benediction-renforcee')) return 0.85;
      if (this.has(char, 'favori_nexus.pacte-de-priere')) return 0.75;
      return 0;
    },

    /* ── Max companions synchros simultanés ── */
    getCompanionsMaxSync: function (char) {
      /* Précédence : Chef de Meute Meute Grandissante > Ami des Bêtes Amitié Plurielle > Limit Breaker Linked Path > default 1 */
      if (this.has(char, 'chef_meute.meute-grandissante')) return Infinity;
      if (this.has(char, 'ami_betes.amitie-plurielle')) return 3;
      if (this.has(char, 'limit_breaker.linked-path')) return 2;
      return 1;
    },

    /* ── Cap level companions (Limit Breaker = 130) ── */
    getCompanionLevelCap: function (char) {
      if (this.has(char, 'limit_breaker.root')) return 130;
      return null; /* null = utilise le cap par défaut du système companions */
    },

    /* ── Endurance Partagée (Chef de Meute, dynamique) ──
       Retourne le bonus RES à appliquer selon le nombre de companions synchros actifs. */
    getEndurancePartageeBonus: function (char, activeSyncCompanions) {
      if (!this.has(char, 'chef_meute.endurance-partagee')) return 0;
      var n = parseInt(activeSyncCompanions || 0, 10) || 0;
      return 0.005 * n;
    },

    /* ── Scope brassage ──
       'full' = tout (Potionniste) | 'healing_only' = soins seulement (Druide) | 'none' */
    getBrassageScope: function (char) {
      if (this.has(char, 'potionniste.root')) return 'full';
      if (this.has(char, 'druide.pacte-de-soin')) return 'healing_only';
      return 'none';
    },

    /* ── Élixir Mythic (Potionniste) ── */
    canBrewMythic: function (char) {
      return this.has(char, 'potionniste.elixir');
    },

    /* ── Scope forge ── */
    getForgeScope: function (char) {
      /* Forgeron Dwarf OU Héritier de Baldun → accès complet */
      var allowed = this.has(char, 'forgeron.root') || this.has(char, 'heritier_baldun.root');
      if (!allowed) return { allowed: false };

      var max_stars = 0;
      if (this.has(char, 'forgeron.amelioration-3') || this.has(char, 'heritier_baldun.amelioration-3')) max_stars = 3;
      else if (this.has(char, 'forgeron.amelioration-1') || this.has(char, 'heritier_baldun.amelioration-1')) max_stars = 1;

      var runes = this.has(char, 'arcano_forgeron.runiste') || this.has(char, 'initie_baldun.runiste');
      var rune_unique = this.has(char, 'arcano_forgeron.rune-unique') || this.has(char, 'initie_baldun.rune-unique');
      var chef_oeuvre = this.has(char, 'forgeron.chef-d-oeuvre') || this.has(char, 'heritier_baldun.chef-d-oeuvre');

      return {
        allowed: true,
        max_rarity: 'Legendary', /* T1 root donne déjà Common → Legendary */
        max_stars: max_stars,
        runes: runes,
        rune_unique: rune_unique,
        chef_oeuvre: chef_oeuvre,
      };
    },

    /* ── Mode DarkNexusNet ── */
    getDarknexusnetMode: function (char) {
      var hacker = this.has(char, 'hacker.root');
      var encodeur = this.has(char, 'encodeur.root');
      if (hacker && encodeur) return 'both';
      if (hacker) return 'hacker';
      if (encodeur) return 'encodeur';
      return 'none';
    },

    /* ── Debug : liste tous les skills débloqués d'un perso ── */
    listUnlocked: function (char) {
      return Array.from(_getUnlockedSet(char)).sort();
    },

    /* ── Accès aux données brutes (lecture seule) ── */
    getAxiome: function (axiomeId) {
      return (DATA && DATA[axiomeId]) || null;
    },

    getSkill: function (skillId) {
      return _findSkill(skillId);
    },
  };

  window.AxiomeSkills = API;

})();
