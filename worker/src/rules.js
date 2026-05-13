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

function changedKeys(oldD, newD) {
  if (!oldD) return Object.keys(newD || {});
  const all = new Set([...Object.keys(oldD), ...Object.keys(newD || {})]);
  const out = [];
  for (const k of all) {
    if (JSON.stringify(oldD[k]) !== JSON.stringify((newD || {})[k])) out.push(k);
  }
  return out;
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
        "powers","aura_enabled","class","race_category"];
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: adminOnly,
  },
  active_characters: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },

  // IRP characters — même logique
  irp_characters: {
    read: PUBLIC, list: PUBLIC,
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["stats","available_stat_points","unallocated_stat_points","updated_at"];
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: adminOnly,
  },
  irp_active_characters: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
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
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
      if (!changed.every((k) => allowed.includes(k))) {
        return DENY(403, `forbidden field changes: ${changed.filter(k => !allowed.includes(k)).join(",")}`);
      }
      return PUBLIC();
    },
    create: adminOnly, delete: () => DENY(403, "no delete"),
  },

  // Inventaires
  inventories: {
    read: PUBLIC, list: PUBLIC,
    create: (s, ctx) => s?.is_admin || keysAreSubsetOf(ctx.data, ["equipped_assets","items"]) ? PUBLIC() : DENY(403, "fields restricted"),
    update: (s, ctx) => {
      if (s?.is_admin) return PUBLIC();
      const allowed = ["equipped_assets","items"];
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
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
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
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
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
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
      const allowed = ["user_id","banner_id","count","status","created_at"];
      if (!keysAreSubsetOf(ctx.data, allowed)) return DENY(400, "unauthorized fields");
      if (ctx.data.status !== "pending") return DENY(400, "status must be 'pending'");
      if (![1,5,10].includes(ctx.data.count)) return DENY(400, "count must be 1, 5, or 10");
      return PUBLIC();
    },
    update: () => DENY(403, "bot-only"), delete: () => DENY(403, "bot-only"),
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
    update: () => DENY(403, "bot-only"), delete: () => DENY(403, "bot-only"),
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
      const changed = changedKeys(ctx.existing, ctx.merged || ctx.data);
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
  companions_user: { read: PUBLIC, list: PUBLIC, create: adminOnly, update: adminOnly, delete: adminOnly },
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
