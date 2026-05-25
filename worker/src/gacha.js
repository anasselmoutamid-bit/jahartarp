// gacha.js — Standalone gacha pull engine (Cloudflare Worker).
// Aucune dépendance au bot Discord. Lit banners_raw, exécute les pulls,
// met à jour players/{uid}.navarites et gacha_pity/{uid} dans D1.

import { getDoc, setDoc } from "./db.js";
import { json, err } from "./utils.js";

// ── Constantes ────────────────────────────────────────────────────────────────

const PULL_COST = 1; // 1 navarite par pull (×count)

const VIP_LEG_IDS = new Set([
  "372065190142803982", // Owner
  "213985774771765248", // Kaijuu
  "769193650915246131", // Partenaire
  "424937768704147458", // Admin
]);
const OWNER_ID = "372065190142803982";

const LEG_PLUS  = new Set(["Legendary","Mythic","Unique","Artifact","Mastercraft"]);
const EPIC_PLUS = new Set(["Epic","Legendary","Mythic","Unique","Artifact","Mastercraft"]);

// Navarites dépensés avant garantie pity
const PITY_EPIC_THRESHOLD = 100;
const PITY_LEG_THRESHOLD  = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function weightedPick(pool) {
  // pool: [{value, weight}]
  const total = pool.reduce((s, x) => s + x.weight, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const x of pool) { r -= x.weight; if (r <= 0) return x.value; }
  return pool[pool.length - 1].value;
}

function pickRarity(rarities, isBooster = false) {
  const pool = [];
  for (const [rarity, data] of Object.entries(rarities)) {
    let w = Number(data.weight) || 0;
    if (!w) continue;
    if (isBooster && LEG_PLUS.has(rarity)) w *= 2;
    pool.push({ value: rarity, weight: w });
  }
  return weightedPick(pool);
}

function pickItem(items, featuredIds = []) {
  if (!items || !items.length) return null;
  const pool = items.map(it => ({
    value: it,
    weight: featuredIds.includes(it.id) ? 2 : 1,
  }));
  return weightedPick(pool);
}

function pickFromTiers(rarities, tierSet) {
  const tiers = Object.keys(rarities).filter(r => tierSet.has(r) && (rarities[r].items||[]).length);
  if (!tiers.length) return null;
  const pool = tiers.map(r => ({ value: r, weight: Number(rarities[r].weight) || 1 }));
  return weightedPick(pool);
}

function formatItem(item, rarity, nameMap) {
  if (!item) return { name: "???", icon: "📦", rarity, qty: 1 };
  const t = item.type || "";
  if (t === "item") {
    const info = nameMap[item.id] || {};
    return {
      name: info.name || (item.id || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      icon: info.icon || "📦",
      rarity,
      qty: item.quantity || 1,
      id: item.id,
    };
  }
  if (t === "currency") {
    const [[k, v] = []] = Object.entries(item.amount || {});
    return { name: `${v || "?"} ${(k || "").replace(/_/g, " ")}`, icon: "💰", rarity, qty: 1 };
  }
  if (t === "golden_egg") {
    return { name: "Golden Egg", icon: "🥚", rarity, qty: item.quantity || 1 };
  }
  return { name: item.id || "???", icon: "📦", rarity, qty: 1 };
}

// ── Item name lookup (batch) ─────────────────────────────────────────────────

async function fetchItemNames(env, itemIds) {
  const nameMap = {};
  if (!itemIds.length) return nameMap;
  try {
    const placeholders = itemIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT doc_id, data FROM documents WHERE collection='items' AND doc_id IN (${placeholders})`
    ).bind(...itemIds).all();
    for (const row of rows.results || []) {
      try {
        const d = JSON.parse(row.data);
        nameMap[row.doc_id] = { name: d.name, icon: d.icon };
      } catch {}
    }
  } catch {}
  return nameMap;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleGachaPull(req, env, session) {
  const body = await req.json().catch(() => null);
  if (!body) return err(400, "JSON body required");

  const uid      = String(session.discord_id || "");
  const bannerId = String(body.banner_id || "");
  const count    = Number(body.count);
  const isFree   = !!body.free && uid === OWNER_ID;

  if (!bannerId)                   return err(400, "banner_id requis");
  if (![1,5,10].includes(count))   return err(400, "count doit être 1, 5 ou 10");
  if (!uid)                        return err(401, "session invalide");

  const cost = isFree ? 0 : PULL_COST * count;

  // ── Lire les données de bannière ─────────────────────────────────────────
  const bannersRaw = await getDoc(env, "gacha_config", "banners_raw");
  if (!bannersRaw) return err(503, "Données de bannière indisponibles");

  const banner = bannersRaw[bannerId];
  if (!banner || !banner.rarities) return err(404, `Bannière '${bannerId}' introuvable`);

  const rarities   = banner.rarities;
  const featuredIds = banner.featured || [];

  // ── Lire le joueur (navarites + booster) ────────────────────────────────
  const player   = (await getDoc(env, "players", uid)) || {};
  const navarites = Number(player.navarites ?? 0);

  if (!isFree && navarites < cost) {
    return err(402, `Navarites insuffisants : ${navarites}/${cost}`);
  }

  // Vérifier si le banner est actif (parmi active_ids dans banners doc)
  const bannersCfg = await getDoc(env, "gacha_config", "banners");
  const activeIds  = new Set((bannersCfg?.banners || [])
    .filter(b => b.status === "live")
    .map(b => b.id));
  if (!activeIds.has(bannerId)) {
    return err(403, "Cette bannière n'est pas active");
  }

  // ── Lire pity ────────────────────────────────────────────────────────────
  const pityDoc = (await getDoc(env, "gacha_pity", uid)) || {};
  let epicSpent = Number(pityDoc.navarites_spent_epic ?? 0);
  let legSpent  = Number(pityDoc.navarites_spent_leg  ?? 0);

  const isBooster = !!player.booster;
  const isVipLeg  = VIP_LEG_IDS.has(uid);
  const vipEpicGuaranteed = isVipLeg ? 3 : 1; // 10x: derniers N pulls = Epic+

  // ── Exécution des pulls ───────────────────────────────────────────────────
  const pulls = []; // [{rarity, item}]
  const navPerPull = cost / count;

  for (let i = 0; i < count; i++) {
    let rarity = null;

    // Pity : si seuils atteints, forcer la rareté
    if (legSpent >= PITY_LEG_THRESHOLD) {
      rarity = pickFromTiers(rarities, LEG_PLUS);
    } else if (epicSpent >= PITY_EPIC_THRESHOLD) {
      rarity = pickFromTiers(rarities, EPIC_PLUS);
    }

    if (!rarity) rarity = pickRarity(rarities, isBooster);
    if (!rarity) rarity = Object.keys(rarities)[0] || "Common";

    const items = (rarities[rarity]?.items) || [];
    let item = pickItem(items, featuredIds);

    // Fallback si rareté sélectionnée est vide
    if (!item) {
      for (const [r, data] of Object.entries(rarities)) {
        if ((data.items || []).length) { rarity = r; item = data.items[0]; break; }
      }
    }

    pulls.push({ rarity, item });

    // Mise à jour pity intermédiaire (reset sur hit, accumule sinon)
    if (LEG_PLUS.has(rarity))  { legSpent = 0;  epicSpent = 0; }
    else if (EPIC_PLUS.has(rarity)) { epicSpent = 0; legSpent += navPerPull; }
    else { epicSpent += navPerPull; legSpent += navPerPull; }
  }

  // ── Garantie Epic+ sur les derniers pulls du 10x ─────────────────────────
  if (count === 10) {
    for (let i = count - vipEpicGuaranteed; i < count; i++) {
      if (!EPIC_PLUS.has(pulls[i].rarity)) {
        const r = pickFromTiers(rarities, EPIC_PLUS);
        if (r) {
          const it = pickItem(rarities[r].items, featuredIds);
          if (it) pulls[i] = { rarity: r, item: it };
        }
      }
    }
  }

  // ── Garantie VIP : au moins 1 LEG+ dans tous les pulls ──────────────────
  if (isVipLeg) {
    const hasLeg = pulls.some(p => LEG_PLUS.has(p.rarity));
    if (!hasLeg) {
      const r = pickFromTiers(rarities, LEG_PLUS);
      if (r) {
        const it = pickItem(rarities[r].items, featuredIds);
        if (it) pulls[pulls.length - 1] = { rarity: r, item: it };
      }
    }
  }

  // ── Lookup des noms d'items ───────────────────────────────────────────────
  const itemIds = [...new Set(pulls
    .map(p => p.item?.id)
    .filter(Boolean)
  )];
  const nameMap = await fetchItemNames(env, itemIds);

  // ── Formater les résultats ────────────────────────────────────────────────
  const results = pulls.map(p => formatItem(p.item, p.rarity, nameMap));

  // ── Écrire navarites + pity ──────────────────────────────────────────────
  const newBalance = Math.max(0, navarites - cost);

  await Promise.all([
    setDoc(env, "players", uid, { navarites: newBalance }, { merge: true }),
    setDoc(env, "gacha_pity", uid, {
      navarites_spent_epic: epicSpent,
      navarites_spent_leg:  legSpent,
    }, { merge: true }),
  ]);

  return json({
    ok: true,
    results,
    navarites: newBalance,
    pity: { epic: Math.round(epicSpent), leg: Math.round(legSpent) },
  });
}

// ── Rotation (lecture seule, le Worker expose le state) ──────────────────────

export async function handleGachaRotation(req, env) {
  const banners = await getDoc(env, "gacha_config", "banners");
  const raw     = await getDoc(env, "gacha_config", "banners_raw");
  if (!banners) return err(503, "Rotation indisponible");

  // Enrichir avec les taux réels depuis banners_raw
  const enriched = (banners.banners || []).map(b => {
    const rawB = raw?.[b.id];
    if (!rawB?.rarities) return b;
    const totalW = Object.values(rawB.rarities).reduce((s, r) => s + (Number(r.weight) || 0), 0);
    const rarities = {};
    for (const [rarity, rdata] of Object.entries(rawB.rarities)) {
      const pct = totalW ? Math.round((rdata.weight / totalW) * 10000) / 100 : 0;
      const items = (rdata.items || []).map(it => {
        if (it.type === "item")
          return { name: (it.id||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()), icon:"📦", qty: it.quantity||1 };
        if (it.type === "currency") {
          const [[k,v]=[]] = Object.entries(it.amount||{});
          return { name:`${v||"?"} ${(k||"").replace(/_/g," ")}`, icon:"💰", qty:1 };
        }
        if (it.type === "golden_egg") return { name:"Golden Egg", icon:"🥚", qty: it.quantity||1 };
        return null;
      }).filter(Boolean);
      rarities[rarity] = { pct, items };
    }
    return { ...b, rarities };
  });

  return json({ ok: true, banners: enriched, rotation: banners.rotation || {} });
}
