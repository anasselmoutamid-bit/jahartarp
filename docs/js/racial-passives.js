/* ═══════════════════════════════════════════════════════════════════════
   docs/js/racial-passives.js — Calcul dérivé des passifs raciaux.
   ═══════════════════════════════════════════════════════════════════════
   Port JS de utils/racial_passives.py (bot Python).
   Source de vérité partagée entre le bot et le site.

   Avant : le bot écrivait des buffs `racial_passive_*` dans Firestore/D1,
   et le site les lisait via la collection `buffs`. Problème : valeurs
   figées, se désynchronisent dès que stats/équipement/succès changent.

   Maintenant : on calcule à la volée à chaque affichage. Le bot
   appelle sa version Python, le site appelle ce module. Mêmes formules,
   mêmes résultats.

   Les call sites doivent :
   1. Filtrer les buffs dont `source` commence par `racial_passive_` ou
      `axiome_passive_` AVANT d'agréger les buffs stockés (pour ignorer
      les anciennes entrées D1 résiduelles).
   2. Construire un `buffScope` = somme des bonus d'équipement (direct +
      sets + pandemonium + signature + mythic + equalizer), compagnon
      sync, titres, et buffs actifs filtrés. Ce scope correspond à
      `_eq_buffs + _other_buffs` côté bot. NE PAS y inclure : succès,
      party, singularité, bénédictions.
   3. Appeler computeRacialPassiveBuffs(char, buffScope) APRÈS avoir
      tout aggrégé dans buffScope.
   4. Ajouter chaque effect du résultat à `bonuses` (ordre préservé, car
      dragon_supreme_privilege dépend des passifs précédents).
   ═══════════════════════════════════════════════════════════════════════ */
(function(window){
  'use strict';

  const RACIAL_PASSIVE_SOURCE_PREFIX = 'racial_passive_';
  const AXIOME_PASSIVE_SOURCE_PREFIX = 'axiome_passive_';
  const ALL_STAT_KEYS = ['strength','agility','speed','intelligence','mana','resistance','charisma'];

  /** Normalise un id de pouvoir : minuscules, espaces → underscores. */
  function _normPid(s){ return String(s||'').toLowerCase().replace(/ /g,'_'); }

  /** Extrait la liste des IDs de pouvoirs normalisés (powers + racial_power). */
  function getCharPowers(char){
    if (!char) return [];
    const out = [];
    const list = char.powers || [];
    for (const p of list){
      if (typeof p === 'string') { out.push(_normPid(p)); }
      else if (p && typeof p === 'object') {
        const pid = p.id || '';
        if (pid) out.push(_normPid(pid));
      }
    }
    const rp = char.racial_power;
    if (rp){
      const pid = (typeof rp === 'string') ? rp : (rp && rp.id) || '';
      if (pid) out.push(_normPid(pid));
    }
    return out;
  }

  function hasPassive(char, passiveId){
    return getCharPowers(char).indexOf(passiveId) !== -1;
  }

  /** Reconnaît les buffs persistants gérés par ce module (à filtrer côté lecture). */
  function isManagedPassiveSource(source){
    const s = String(source||'');
    return s.indexOf(RACIAL_PASSIVE_SOURCE_PREFIX) === 0
        || s.indexOf(AXIOME_PASSIVE_SOURCE_PREFIX) === 0;
  }

  function _gi(o, k){ const v = (o||{})[k]; return parseInt(v||0)||0; }

  /**
   * Calcule les contributions des passifs raciaux à appliquer en buffs flat.
   * Mirror de utils/racial_passives.py::compute_racial_passive_buffs.
   *
   * @param {object} char - Données perso (.powers / .racial_power / .stats).
   * @param {object} buffScope - {stat:delta}. Équivalent _eq_buffs+_other_buffs côté bot.
   *   Doit inclure : équipement direct + sets + pandemonium + signature + mythic +
   *   equalizer + buff_mults appliqués, compagnon sync, titres, buffs actifs (hors
   *   sources racial_passive_* / axiome_passive_*). Ne PAS inclure : succès, party,
   *   singularité, bénédictions.
   * @returns {Array<{source:string, name:string, effects:Object<string,number>}>}
   */
  function computeRacialPassiveBuffs(char, buffScope){
    const powers = getCharPowers(char);
    const stats = (char && char.stats) || {};
    const scope = buffScope || {};
    const buffs = [];

    const globalStat = (sk) => _gi(stats, sk) + _gi(scope, sk);
    // _withPrevious() : base + scope + passifs raciaux déjà ajoutés à `buffs`.
    function _withPrevious(sk){
      let v = globalStat(sk);
      for (const b of buffs) v += _gi(b.effects, sk);
      return v;
    }

    // ── Génie de l'Arcane : INT/MAN alloc ×2 → +base ──
    if (powers.indexOf('genie_arcane') !== -1){
      const intBase = _gi(stats, 'intelligence');
      const manBase = _gi(stats, 'mana');
      const effects = {};
      if (intBase > 0) effects.intelligence = intBase;
      if (manBase > 0) effects.mana = manBase;
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'genie_arcane',
                    name: "Génie de l'Arcane (Passif)", effects});
      }
    }

    // ── Charming : CHA/MAN alloc ×2 → +base. MAN sauté si genie_arcane (anti-double). ──
    if (powers.indexOf('charming') !== -1){
      const chaBase = _gi(stats, 'charisma');
      const manBase = _gi(stats, 'mana');
      const effects = {};
      if (chaBase > 0) effects.charisma = chaBase;
      if (manBase > 0 && powers.indexOf('genie_arcane') === -1) effects.mana = manBase;
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'charming',
                    name: 'Charming (Passif)', effects});
      }
    }

    // ── Force of Nature : RES ×1.1 (sur base seulement, parité bot) ──
    if (powers.indexOf('force_of_nature') !== -1){
      const resBase = _gi(stats, 'resistance');
      if (resBase > 0){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'force_of_nature',
                    name: 'Force of Nature (Passif)',
                    effects: {resistance: Math.trunc(resBase * 0.1)}});
      }
    }

    // ── Favori de l'Arcane : tous les buffs ×1.1 ──
    if (powers.indexOf('favori_arcane') !== -1){
      const effects = {};
      for (const sk of ALL_STAT_KEYS){
        const t = _gi(scope, sk);
        if (t > 0){
          const b = Math.trunc(t * 0.1);
          if (b > 0) effects[sk] = b;
        }
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'favori_arcane',
                    name: "Favori de l'Arcane (Passif)", effects});
      }
    }

    // ── Génie de l'Arcane — Buff Mult : buffs INT/MAN ×1.1 ──
    if (powers.indexOf('genie_arcane') !== -1){
      const effects = {};
      for (const sk of ['intelligence','mana']){
        const t = _gi(scope, sk);
        if (t > 0){
          const b = Math.trunc(t * 0.1);
          if (b > 0) effects[sk] = b;
        }
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'genie_arcane_buffmult',
                    name: "Génie de l'Arcane — Buff Mult (Passif)", effects});
      }
    }

    // ── Charming — Buff Mult : buffs CHA/MAN ×1.1 ──
    if (powers.indexOf('charming') !== -1){
      const effects = {};
      for (const sk of ['charisma','mana']){
        const t = _gi(scope, sk);
        if (t > 0){
          const b = Math.trunc(t * 0.1);
          if (b > 0) effects[sk] = b;
        }
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'charming_buffmult',
                    name: 'Charming — Buff Mult (Passif)', effects});
      }
    }

    // ── Hopper : buffs AGI/SPD ×1.1 ──
    if (powers.indexOf('hopper') !== -1){
      const effects = {};
      for (const sk of ['agility','speed']){
        const t = _gi(scope, sk);
        if (t > 0){
          const b = Math.trunc(t * 0.1);
          if (b > 0) effects[sk] = b;
        }
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'hopper',
                    name: 'Hopper (Passif)', effects});
      }
    }

    // ── Vampire — Supériorité Raciale : SPD/AGI/CHA ×1.10 ──
    if (powers.indexOf('vampire_superiority') !== -1){
      const effects = {};
      for (const sk of ['speed','agility','charisma']){
        const t = globalStat(sk);
        if (t > 0) effects[sk] = Math.trunc(t * 0.10);
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'vampire_superiority',
                    name: 'Supériorité Raciale (Passif)', effects});
      }
    }

    // ── Android — Quantum AI Assistance : INT ×1.35 ──
    if (powers.indexOf('android_quantum_ai') !== -1){
      const t = globalStat('intelligence');
      if (t > 0){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'android_quantum_ai',
                    name: 'Quantum AI Assistance (Passif)',
                    effects: {intelligence: Math.trunc(t * 0.35)}});
      }
    }

    // ── Succubus — Sensual Gyal : CHA/AGI/MAN ×1.20 ──
    if (powers.indexOf('succubus_sensual_gyal') !== -1){
      const effects = {};
      for (const sk of ['charisma','agility','mana']){
        const t = globalStat(sk);
        if (t > 0) effects[sk] = Math.trunc(t * 0.20);
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'succubus_sensual_gyal',
                    name: 'Sensual Gyal (Passif)', effects});
      }
    }

    // ── Moth — Insectoid Boost : SPD/AGI/MAN ×1.15 ──
    if (powers.indexOf('moth_insectoid_boost') !== -1){
      const effects = {};
      for (const sk of ['speed','agility','mana']){
        const t = globalStat(sk);
        if (t > 0) effects[sk] = Math.trunc(t * 0.15);
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'moth_insectoid_boost',
                    name: 'Insectoid Boost (Passif)', effects});
      }
    }

    // ── Dragon — Supreme Privilege : toutes stats ×1.30 sur (base + scope + passifs précédents) ──
    if (powers.indexOf('dragon_supreme_privilege') !== -1){
      const effects = {};
      for (const sk of ALL_STAT_KEYS){
        const t = _withPrevious(sk);
        if (t > 0) effects[sk] = Math.trunc(t * 0.30);
      }
      if (Object.keys(effects).length){
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'dragon_supreme_privilege',
                    name: 'Supreme Privilege (Passif)', effects});
      }
    }

    // ── INT caps : Hopper 500 / Force of Nature 350 (cap après tout le reste). ──
    if (powers.indexOf('force_of_nature') !== -1 || powers.indexOf('hopper') !== -1){
      let intBuffs = _gi(scope, 'intelligence');
      for (const b of buffs) intBuffs += _gi(b.effects, 'intelligence');
      const totalInt = _gi(stats, 'intelligence') + intBuffs;
      const cap = (powers.indexOf('force_of_nature') !== -1) ? 350 : 500;
      if (totalInt > cap){
        const name = (cap === 350) ? 'Force of Nature' : 'Hopper';
        buffs.push({source: RACIAL_PASSIVE_SOURCE_PREFIX+'int_cap',
                    name: name + ' — INT Cap (Passif)',
                    effects: {intelligence: -(totalInt - cap)}});
      }
    }

    return buffs;
  }

  /** Aplatit une liste de buffs en {stat: somme}. */
  function sumBuffEffects(buffs){
    const out = {};
    for (const b of (buffs||[])){
      const eff = (b && b.effects) || {};
      for (const k in eff){
        const v = parseInt(eff[k])||0;
        if (v) out[k] = (out[k]||0) + v;
      }
    }
    return out;
  }

  /** Items legendary+ (Artisan né). Parité avec is_item_legendary_plus côté bot. */
  function isItemLegendaryPlus(rarity){
    const r = String(rarity||'').toLowerCase();
    return ['legendary','unique','mythic','artifact','mastercraft','signature','pandemonium']
      .indexOf(r) !== -1;
  }

  /** Multiplicateur Artisan né — actuellement ×1.1 côté bot (cf. artisan_ne_buff_multiplier). */
  function artisanNeBuffMultiplier(char){
    return hasPassive(char, 'artisan_ne') ? 1.1 : 1.0;
  }

  window.RacialPassives = {
    RACIAL_PASSIVE_SOURCE_PREFIX,
    AXIOME_PASSIVE_SOURCE_PREFIX,
    ALL_STAT_KEYS,
    getCharPowers,
    hasPassive,
    isManagedPassiveSource,
    computeRacialPassiveBuffs,
    sumBuffEffects,
    isItemLegendaryPlus,
    artisanNeBuffMultiplier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
