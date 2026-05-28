// rules.js — Port de firestore.rules vers JS.
// Toute requête à une collection passe ici avant d'exécuter D1.
//
// session: { discord_id, is_admin, role } | null
// op: "read" | "list" | "create" | "update" | "delete"
// data: payload du write (pour validation de champs)
// existing: doc actuel (pour vérifier les diffs sur update)
//
// Retourne { ok: bool, status?: 401|403, message?: string }

const PUBLIC = () => ({ ok: true });
const DENY = (status, message) => ({ ok: false, status, message });

// ── Helpers ─────────────────────────────────────────────────────────────────

function keysAreSubsetOf(obj, allowed) {
  if (!obj || typeof obj !== "object") return true;
  return Object.keys(obj).every((k) => allowed.includes(k));
}

/**
 * Renvoie les TOP-LEVEL fields touchés par un payload de write.
 * Réduit les dotted paths à leur racine (ex: "stats.strength" -> "stats")
 * pour matcher la sémantique Firestore (affectedKeys).
 *
 * Note: pour les PATCH/update, on regarde simplement les clés du body —
 * les sentinels (Increment, arrayUnion) y figurent comme valeurs opaques,
 * et leur impact réel est sur la racine de la clé.
 */
function changedKeys(oldD, newD) {
  if (!newD || typeof newD !== "object") return [];
  const out = new Set();
  for (const k of Object.keys(newD)) {
    if (k === "_id" || k === "_updated_at") continue;
    out.add(String(k).split(".")[0]);
  }
  // Pour les SET (POST) avec merge=false, les champs ABSENTS du body sont
  // effacés -> on les considère comme affectés aussi.
  if (oldD && newD.__set_replace === true) {
    for (const k of Object.keys(oldD)) {
      if (k === "_id" || k === "_updated_at") continue;
      if (!(k in newD)) out.add(k);
    }
  }
  return [...out];
}

// ── Rules per collection ────────────────────────────────────────────────────
//
// Convention :
//  - Lecture par défaut = publique
//  - Écriture par défaut = admin
//  - Override par entrée dédiée si différent
//

const RULES = {
  // Admins : lecture restreinte (seulement soi-même), pas d'écriture client
  admins: {
    read: (s, ctx) => (s?.discord_id === ctx.docId ? PUBLIC() : DENY(403, "admins self-read only")),
    list: () => DENY(403, "admins not listable"),
    create: () => DENY(403, "admins read-only via API"),
    update: () => DENY(403, "admins read-only via API"),
    delete: () => DENY(403, "admins read-only via API"),
  },

  // VIP whitelist — admin only
  vip_whitelist: { read: adminOnly, list: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Fiches : public read, public create (avec validation), admin update/delete
  fiches: {
    read: PUBLIC,
    list: PUBLIC,
    create: (s, ctx) => {
      const d = ctx.data || {};
      if (d.status && d.status !== "en_attente") return DENY(400, "status must be 'en_attente'");
      const allowed = [
        "firstname","lastname","age","race","raceSpecific","rank","desc","discord",
        "links","linkUrl","stats","powers","photoUrl","photo","createdAt","status"
      ];
      if (!keysAreSubsetOf(d, allowed)) return DENY(400, "unauthorized fields in fiche");
      if ("_vip_id" in d) return DENY(400, "field _vip_id forbidden");
      return PUBLIC();
    },
    update: adminOnly,
    delete: adminOnly,
  },

  // PNJ + filtres
  pnj: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  pnj_filters: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Lore, bestiaire — lecture publique, écriture admin
  lore: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  bestiaire: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Logs — admin lecture, admin écriture (panel), pas d'update/delete (audit trail)
  logs: {
    read: adminOnly,
    list: adminOnly,
    create: (s, ctx) => {
      if (!s?.is_admin) return DENY(403, "admin only");
      const allowed = ["action","targetId","targetName","byEmail","byUid","byName","role","at"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized log fields");
      return PUBLIC();
    },
    update: () => DENY(403, "logs immutable"),
    delete: () => DENY(403, "logs immutable"),
  },

  // Gacha link codes — read+delete publics (échange du code), pas de create/update via API
  gacha_link_codes: {
    read: PUBLIC,
    list: () => DENY(403, "not listable"),
    create: () => DENY(403, "bot-only"),
    update: () => DENY(403, "bot-only"),
    delete: PUBLIC,
  },
  hub_link_codes: {
    read: PUBLIC,
    list: () => DENY(403, "not listable"),
    create: () => DENY(403, "bot-only"),
    update: () => DENY(403, "bot-only"),
    delete: PUBLIC,
  },

  // Characters — lecture publique, update avec champs whitelistés OU admin
  characters: {
    read: PUBLIC, list: PUBLIC,
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["stats","available_stat_points","unallocated_stat_points","updated_at",
        "skill_tree_unlocked","pc_spent","skill_tree_palier_slots","golden_eggs",
        "powers","aura_enabled","class","race_category",
        "axiome_current","axiome_pa","axiome_tree_unlocked",
        "hack_alerts","last_hack_attempt",
        "benedictions","prayer_log","principes_discovered"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      // Server-side gate : choix/changement d'axiome interdit avant niveau 50.
      // Le débit de l'Axium reste géré par le bot Discord (transaction atomique).
      if (changed.includes("axiome_current") && ctx.data.axiome_current) {
        const lvl = parseInt(ctx.existing?.level || 0, 10) || 0;
        if (lvl < 50) return DENY(403, `niveau 50 requis pour choisir un axiome (actuel: ${lvl})`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: adminOnly,
  },
  active_characters: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      if (!s?.discord_id) return DENY(401, "session requise");
      if (String(ctx.docId) !== String(s.discord_id)) return DENY(403, "can only set your own active character");
      const allowed = ["character_id","user_id"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      return PUBLIC();
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      if (!s?.discord_id) return DENY(401, "session requise");
      if (String(ctx.docId) !== String(s.discord_id)) return DENY(403, "can only set your own active character");
      const allowed = ["character_id","user_id"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) return DENY(400, "unauthorized fields");
      return PUBLIC();
    },
    delete: adminOnly,
  },

  // IRP characters — même logique
  irp_characters: {
    read: PUBLIC, list: PUBLIC,
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["stats","available_stat_points","unallocated_stat_points","updated_at"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: adminOnly,
  },
  irp_active_characters: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      if (!s?.discord_id) return DENY(401, "session requise");
      if (String(ctx.docId) !== String(s.discord_id)) return DENY(403, "can only set your own active character");
      const allowed = ["character_id","user_id"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      return PUBLIC();
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      if (!s?.discord_id) return DENY(401, "session requise");
      if (String(ctx.docId) !== String(s.discord_id)) return DENY(403, "can only set your own active character");
      const allowed = ["character_id","user_id"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) return DENY(400, "unauthorized fields");
      return PUBLIC();
    },
    delete: adminOnly,
  },
  irp_links: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  irp_pnj: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  irp_bestiaire: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  irp_players: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: () => DENY(403, "no delete") },
  irp_gacha_banners: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  irp_bonds: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: PUBLIC },
  irp_seals: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: PUBLIC },
  irp_seal_targets: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: PUBLIC },
  irp_courts: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: PUBLIC },
  irp_flesh_marks: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: PUBLIC },

  // IRP Whitelist — chaque joueur peut lire son propre statut, bot écrit
  irp_whitelist: {
    read: (s, ctx) => (s?.discord_id && s.discord_id === ctx.docId ? PUBLIC() : DENY(403, "self-read only")),
    list: () => DENY(403, "not listable"),
    create: () => DENY(403, "bot-only"),
    update: () => DENY(403, "bot-only"),
    delete: () => DENY(403, "bot-only"),
  },

  // Casino
  casino_config: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  casino_tables: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: adminOnly },
  casino_heartbeats: { read: PUBLIC, list: PUBLIC, create: PUBLIC, update: PUBLIC, delete: adminOnly },
  casino_logs: {
    read: adminOnly, list: adminOnly,
    create: (s, ctx) => {
      const allowed = ["user_id","username","game","mode","currency","amount","profit","result","char_id","extra","at"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized log fields");
      return PUBLIC();
    },
    update: () => DENY(403, "immutable"), delete: () => DENY(403, "immutable"),
  },

  // Players — update limité aux 2 champs côté client OU admin
  players: {
    read: PUBLIC, list: PUBLIC,
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["display_theme","navarites"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: () => DENY(403, "no delete"),
  },

  // Inventaires
  //  - equipment_presets : jusqu'à 7 loadouts par perso (gérés côté hub).
  inventories: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => s?.is_admin || keysAreSubsetOf(ctx.data, ["equipped_assets","items","item_upgrades","item_runes","singularity_items","equipment_presets"]) ? PUBLIC() : DENY(403, "fields restricted"),
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["equipped_assets","items","item_upgrades","item_runes","singularity_items","equipment_presets"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    delete: () => DENY(403, "no delete"),
  },

  // Économie
  economy: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => s?.is_admin || keysAreSubsetOf(ctx.data, ["personal","family","royal"]) ? PUBLIC() : DENY(403, "fields restricted"),
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["personal","family","royal"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    delete: () => DENY(403, "no delete"),
  },

  // Shops
  shops: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["items","open","name","tagline","sales_log","owner_user_id","message_id","channel_id"];
      return keysAreSubsetOf(ctx.data, allowed) ? PUBLIC() : DENY(403, "fields restricted");
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["items","open","name","tagline","sales_log","owner_user_id","message_id","channel_id"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    delete: adminOnly,
  },

  // Gacha
  gacha_admin_actions: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: () => DENY(403, "immutable"), delete: () => DENY(403, "immutable") },
  gacha_pulls: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      // `free` est autorisé seulement pour le owner (validé côté bot via VIP_IDS).
      const allowed = ["user_id","banner_id","count","status","created_at","free","specialz_leg_plus","vip_leg_plus"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      if (ctx.data.status !== "pending") return DENY(400, "status must be 'pending'");
      if (![1,5,10].includes(ctx.data.count)) return DENY(400, "count must be 1, 5, or 10");
      return PUBLIC();
    },
    update: () => DENY(403, "bot-only"),
    // Le site crée le doc et doit pouvoir le supprimer après completion (cleanup).
    // L'update reste bot-only pour éviter que le client n'écrase les résultats.
    delete: (s, ctx) => {
      // Seul le créateur (user_id === session.discord_id) ou un admin peut supprimer.
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      if (s?.discord_id && String(s.discord_id) === String(e.user_id || "")) return PUBLIC();
      return DENY(403, "can only delete your own pull request");
    },
  },
  irp_gacha_pulls: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      const allowed = ["user_id","banner_id","count","status","created_at","special_code"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      if (ctx.data.status !== "pending") return DENY(400, "status must be 'pending'");
      if (![1,5,10].includes(ctx.data.count)) return DENY(400, "count must be 1, 5, or 10");
      return PUBLIC();
    },
    update: () => DENY(403, "bot-only"),
    delete: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      if (s?.discord_id && String(s.discord_id) === String(e.user_id || "")) return PUBLIC();
      return DENY(403, "can only delete your own pull request");
    },
  },

  stat_allocation_requests: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      const allowed = ["user_id","char_id","allocations","status","created_at"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      if (ctx.data.status !== "pending") return DENY(400, "status must be 'pending'");
      return PUBLIC();
    },
    update: () => DENY(403, "bot-only"), delete: () => DENY(403, "bot-only"),
  },

  // Parties — update champs limités
  parties: {
    read: PUBLIC, list: PUBLIC,
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["pp","max_size","stat_gain","msg_threshold","purchased_powers","log","votes"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: adminOnly,
  },
  party_membership: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  party_invites: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Configs publiques
  gacha_config: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  config: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: () => DENY(403, "no delete") },
  irp_gacha_config: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  irp_gacha_pity: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  config_admin: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Données bot
  //  - companions_user : le hub permet aux joueurs de switch active_companion,
  //    toggle synchronized (champ d'un sous-objet de owned_companions) et
  //    nourrir le compagnon actif (modifie xp dans owned_companions). Toutes
  //    ces opérations passent par 2 top-level keys : active_companion et
  //    owned_companions. La validation sémantique (cap sync, possession food)
  //    est faite côté client + bot pour les sources de XP fiables.
  companions_user: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      return keysAreSubsetOf(ctx.data, ["owned_companions","active_companion"])
        ? PUBLIC() : DENY(403, "fields restricted");
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["owned_companions","active_companion"];
      const changed = changedKeys(ctx.existing, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    delete: adminOnly,
  },
  titles_user: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  gacha_pity: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  gacha_rotation: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  buffs: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  powers_unique_states: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  powers_limit_states: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Modération — public read (le panel admin gère)
  moderation_warnings: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  moderation_mutes: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Races
  races_data: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Achievements
  achievements_user: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // Habitations — création/résiliation/paiement par le bot uniquement.
  // Lecture publique (le site affiche le statut au joueur via le hub).
  habitations:        { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
  habitations_active: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // ──────────────────────────────────────────────────────────────────────────
  // MESSAGERIE par PERSONNAGE (Nexus)
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Modèle :
  //   friend_requests/{auto_id}
  //     { from_char_id, from_player_id, to_player_id, status, created_at }
  //     - 'pending' à la création
  //     - 'accepted' → on crée friendships/{pairId} ET on delete la request
  //     - 'rejected' → delete la request
  //
  //   friendships/{pairId}     pairId = sorted([charA, charB]).join('__')
  //     { char_a, char_b, player_a, player_b,
  //       name_<charId>, avatar_<charId>,
  //       last_message, last_at,
  //       unread_<charId>, created_at }
  //
  //   messages/{auto_id}
  //     { friendship_id, from_char_id, to_char_id,
  //       text|kind ('text'|'transfer_money'|'transfer_item'),
  //       at, read_at?, important: bool,
  //       amount?, note?, item_id?, item_name?, qty? }
  //
  // Sécurité : on autorise lecture/écriture pour tout client authentifié.
  // La validation sémantique (être membre du pair) est faite par les rules
  // au cas par cas.
  //
  // Auto-purge : un cron Worker passe quotidiennement et supprime les
  // messages où `important !== true` AND `read_at` est non null
  // ET `read_at < now - 7 jours`. Voir worker/src/cron.js.

  friend_requests: {
    read: PUBLIC,
    list: PUBLIC,
    create: (s, ctx) => {
      const d = ctx.data || {};
      // Whitelist : 5 champs requis pour la logique + 3 snapshots d'affichage
      // (from_char_name / from_char_avatar / from_player_name) envoyés par le
      // client pour pré-remplir l'UI côté receveur sans re-fetch des chars.
      const allowed = [
        "from_char_id","from_player_id","to_player_id","status","created_at",
        "from_char_name","from_char_avatar","from_player_name",
      ];
      if (!keysAreSubsetOf(d, allowed)) return DENY(400, "unauthorized friend_request fields");
      if (d.status && d.status !== "pending") return DENY(400, "status must be 'pending'");
      if (!d.from_player_id || !d.to_player_id) return DENY(400, "from_player_id/to_player_id required");
      if (String(d.from_player_id) === String(d.to_player_id)) return DENY(400, "cannot friend yourself (player)");
      // Anti-spoof: la session DOIT correspondre à from_player_id (sauf admin).
      // String() des deux côtés pour résister aux Discord snowflake (> Number.MAX_SAFE_INTEGER) :
      // si un client envoie l'id en Number (lossy), String() le normalise; pareil côté session.
      if (!s?.is_admin && String(s?.discord_id || "") !== String(d.from_player_id || "")) {
        return DENY(403, "from_player_id mismatch");
      }
      return PUBLIC();
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      // Le destinataire (to_player_id) peut update pour 'accepted' avec son to_char_id.
      const e = ctx.existing || {};
      const sid = String(s?.discord_id || "");
      if (!sid || sid !== String(e.to_player_id)) return DENY(403, "only recipient can update");
      const allowed = ["status","to_char_id","accepted_at"];
      const changed = changedKeys(e, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) return DENY(403, `forbidden fields: ${changed.join(",")}`);
      if (ctx.data.status && !["accepted","rejected"].includes(ctx.data.status)) return DENY(400, "bad status");
      return PUBLIC();
    },
    delete: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      const sid = String(s?.discord_id || "");
      // Soit le sender soit le receiver peut supprimer.
      if (sid === String(e.from_player_id) || sid === String(e.to_player_id)) return PUBLIC();
      return DENY(403, "not a party of this request");
    },
  },

  friendships: {
    read: PUBLIC,
    list: PUBLIC,
    create: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const d = ctx.data || {};
      const allowedKnown = ["char_a","char_b","player_a","player_b","last_message","last_at","created_at","accepted_at"];
      // Champs dynamiques: name_<id>, avatar_<id>, unread_<id> — autorisés.
      const dynamic = (k) => /^(name_|avatar_|unread_)/.test(k);
      const bad = Object.keys(d).filter(k => !allowedKnown.includes(k) && !dynamic(k));
      if (bad.length) return DENY(400, `unauthorized friendship fields: ${bad.join(",")}`);
      if (!d.player_a || !d.player_b) return DENY(400, "player_a/player_b required");
      // Anti-spoof: la session DOIT être l'un des deux players.
      const sid = String(s?.discord_id || "");
      if (sid !== String(d.player_a) && sid !== String(d.player_b)) {
        // DEBUG LOG : visible dans `wrangler tail`. Permet de comparer
        // exactement sid (JWT) vs payload pour diagnostiquer l'origine.
        console.log(`[RULES][friendships.create] DENY 403 — sid=${JSON.stringify(sid)} (len=${sid.length}) vs player_a=${JSON.stringify(d.player_a)} (len=${String(d.player_a||'').length}) player_b=${JSON.stringify(d.player_b)} (len=${String(d.player_b||'').length})`);
        return DENY(403, `must be one of the parties (sid=${sid} a=${d.player_a} b=${d.player_b})`);
      }
      return PUBLIC();
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      const sid = String(s?.discord_id || "");
      if (sid !== String(e.player_a) && sid !== String(e.player_b)) {
        console.log(`[RULES][friendships.update] DENY 403 — sid=${JSON.stringify(sid)} (len=${sid.length}) vs existing.player_a=${JSON.stringify(e.player_a)} (len=${String(e.player_a||'').length}) existing.player_b=${JSON.stringify(e.player_b)} (len=${String(e.player_b||'').length})`);
        return DENY(403, `must be one of the parties (sid=${sid} a=${e.player_a} b=${e.player_b})`);
      }
      // On autorise update sur last_message, last_at, unread_<charId>, name_<charId>, avatar_<charId>
      const allowed = (k) => ["last_message","last_at","accepted_at"].includes(k) ||
        /^(name_|avatar_|unread_)/.test(k);
      const changed = changedKeys(e, ctx.data);
      if (!changed.every(allowed)) return DENY(403, `forbidden field changes: ${changed.filter(k=>!allowed(k)).join(",")}`);
      return PUBLIC();
    },
    delete: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      const sid = String(s?.discord_id || "");
      if (sid === String(e.player_a) || sid === String(e.player_b)) return PUBLIC();
      return DENY(403, "not a party");
    },
  },

  messages: {
    read: PUBLIC,
    list: PUBLIC,
    create: (s, ctx) => {
      const d = ctx.data || {};
      const allowed = ["friendship_id","from_char_id","to_char_id","from_player_id","to_player_id",
        "text","kind","at","read_at","important","amount","note","item_id","item_name","qty"];
      if (!keysAreSubsetOf(d, allowed)) return DENY(400, "unauthorized message fields");
      if (!d.friendship_id) return DENY(400, "friendship_id required");
      const kind = d.kind || "text";
      if (!["text","transfer_money","transfer_item"].includes(kind)) return DENY(400, "bad kind");
      // Anti-spoof : la session DOIT être l'expéditeur.
      if (!s?.is_admin && s?.discord_id !== d.from_player_id) return DENY(403, "from_player_id mismatch");
      // Validation basique du contenu texte
      if (kind === "text" && (!d.text || typeof d.text !== "string")) return DENY(400, "text required");
      if (kind === "text" && d.text.length > 2000) return DENY(400, "text too long");
      return PUBLIC();
    },
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      // Les seules updates autorisées : read_at (par n'importe quel participant) et important (par le destinataire ou l'expéditeur)
      const allowed = ["read_at","important"];
      const changed = changedKeys(e, ctx.data);
      if (!changed.every((k) => allowed.includes(k))) return DENY(403, `forbidden: ${changed.join(",")}`);
      if (s?.discord_id !== e.from_player_id && s?.discord_id !== e.to_player_id) {
        return DENY(403, "not a party");
      }
      return PUBLIC();
    },
    delete: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const e = ctx.existing || {};
      // Un participant peut supprimer ses propres messages.
      if (s?.discord_id === e.from_player_id) return PUBLIC();
      return DENY(403, "only sender can delete");
    },
  },
};

function adminOnly(session) {
  return session?.is_admin ? PUBLIC() : DENY(403, "admin required");
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * checkAccess(env, session, collection, op, ctx)
 * ctx = { docId?, data?, existing?, merged? }
 */
export function checkAccess(session, collection, op, ctx = {}) {
  const rules = RULES[collection];
  if (!rules) {
    // Collection inconnue — par défaut, lecture publique, écriture admin
    // (sécurité: deny par défaut pour les writes)
    if (op === "read" || op === "list") return PUBLIC();
    return adminOnly(session);
  }
  const fn = rules[op];
  if (!fn) return DENY(405, `op ${op} not supported on ${collection}`);
  try {
    return fn(session, { ...ctx });
  } catch (e) {
    return DENY(500, `rule error: ${e.message}`);
  }
}

// ── Collections "écrivables par tout le monde" (auth optionnelle) ───────────
// Listées ici pour le doc — utilisé nulle part directement, juste pour info.
export const ANON_WRITABLE = [
  "casino_tables","casino_heartbeats","irp_players","irp_bonds","irp_seals",
  "irp_seal_targets","irp_courts","irp_flesh_marks","gacha_link_codes",
];
