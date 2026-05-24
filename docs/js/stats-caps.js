/*
 * stats-caps.js — Rank-based stat caps (single source of truth for the site).
 *
 * Mirror of the Python `stats_common.py` helpers. Keep in sync.
 *
 * Rules:
 *   - Each character rank caps every stat individually (aura is NEVER capped).
 *   - Ranks F..SSS have a hard cap.
 *   - Rank X is fully uncapped.
 *   - Ranks T, G, G+, Z are uncapped but grant a % bonus to the portion of
 *     a stat above a threshold. Non-cumulative: only the player's current
 *     rank rule applies.
 *
 * Usage:
 *     const rank = Jaharta.rankFromLevel(level);
 *     const effective = Jaharta.applyRankCap(rank, "strength", base + bonus);
 *     // for pre-render payload shrinking (option B):
 *     const { baseOut } = Jaharta.clampForDisplay(rank, base, bonusSum);
 */
(function () {
  const RANK_STAT_CAPS = {
    F: 150, E: 375, D: 600, C: 1125, B: 1425, A: 1800,
    S: 2025, SS: 3000, SSS: 4050,
    X: null, T: null, G: null, "G+": null, Z: null,
  };

  const RANK_OVERFLOW_BONUS = {
    T:  { threshold: 3750, pct: 0.01 },
    G:  { threshold: 4500, pct: 0.02 },
    "G+": { threshold: 6750, pct: 0.03 },
    Z:  { threshold: 9000, pct: 0.05 },
  };

  const UNCAPPED_STATS = new Set(["aura"]);

  function rankFromLevel(level) {
    const lvl = parseInt(level || 0, 10) || 0;
    if (lvl >= 450) return "Z";
    if (lvl >= 400) return "G+";
    if (lvl >= 350) return "G";
    if (lvl >= 300) return "T";
    if (lvl >= 260) return "X";
    if (lvl >= 220) return "SSS";
    if (lvl >= 180) return "SS";
    if (lvl >= 140) return "S";
    if (lvl >= 100) return "A";
    if (lvl >= 80)  return "B";
    if (lvl >= 60)  return "C";
    if (lvl >= 40)  return "D";
    if (lvl >= 20)  return "E";
    return "F";
  }

  function getRankCap(rank) {
    const v = RANK_STAT_CAPS[rank];
    return (v === undefined) ? null : v;
  }

  function getRankOverflow(rank) {
    return RANK_OVERFLOW_BONUS[rank] || null;
  }

  function applyRankCap(rank, statKey, value) {
    let v = parseInt(value || 0, 10);
    if (!isFinite(v)) v = 0;
    if (UNCAPPED_STATS.has(statKey)) return v;
    if (v <= 0) return v;
    const cap = getRankCap(rank);
    if (cap !== null && cap !== undefined) {
      return Math.min(v, cap);
    }
    const ovf = getRankOverflow(rank);
    if (ovf && v > ovf.threshold) {
      return Math.floor(ovf.threshold + (v - ovf.threshold) * (1 + ovf.pct));
    }
    return v;
  }

  // ── AURA gating (Cultivator) ─────────────────────────────────────────
  // L'aura est forcée à 0 tant que le perso n'a pas débloqué cultivator.root.
  // Si AxiomeSkills n'est pas chargé (ancien code), on laisse passer pour
  // ne pas péter les fichiers existants.
  function isAuraUnlocked(char) {
    if (!char) return false;
    if (window.AxiomeSkills && typeof window.AxiomeSkills.isAuraUnlocked === 'function') {
      return !!window.AxiomeSkills.isAuraUnlocked(char);
    }
    // Fallback : si pas de helper, on lit direct le tree
    var tree = char.axiome_tree_unlocked || {};
    return !!tree['cultivator.root'];
  }

  // Helper bulk : retourne un nouveau totalsMap où aura est 0 si pas débloquée.
  function gateAuraInMap(char, totalsMap) {
    var out = Object.assign({}, totalsMap || {});
    if (!isAuraUnlocked(char)) {
      if ('aura' in out) out.aura = 0;
    }
    return out;
  }

  function cappedStatTotal(rank, statKey, base, ...bonuses) {
    let total = parseInt(base || 0, 10) || 0;
    for (const b of bonuses) {
      total += parseInt(b || 0, 10) || 0;
    }
    return applyRankCap(rank, statKey, total);
  }

  // Apply cap across an object {stat: value} — useful for bulk displays.
  // `totalsMap` must already be base + all bonuses summed per stat.
  function capStatsMap(rank, totalsMap) {
    const out = {};
    for (const k of Object.keys(totalsMap || {})) {
      out[k] = applyRankCap(rank, k, totalsMap[k]);
    }
    return out;
  }

  // Global namespace (avoid collisions; sites use globals already).
  const ns = (window.Jaharta = window.Jaharta || {});
  ns.RANK_STAT_CAPS = RANK_STAT_CAPS;
  ns.RANK_OVERFLOW_BONUS = RANK_OVERFLOW_BONUS;
  ns.UNCAPPED_STATS = UNCAPPED_STATS;
  ns.rankFromLevel = rankFromLevel;
  ns.getRankCap = getRankCap;
  ns.getRankOverflow = getRankOverflow;
  ns.applyRankCap = applyRankCap;
  ns.cappedStatTotal = cappedStatTotal;
  ns.capStatsMap = capStatsMap;
  ns.isAuraUnlocked = isAuraUnlocked;
  ns.gateAuraInMap = gateAuraInMap;
})();
