// cron.js — Tâches planifiées (Cloudflare Cron Triggers).
//
// Déclenché par le scheduler Cloudflare selon les crons définis
// dans wrangler.toml. Le handler `scheduled` doit être exporté
// depuis le module principal (voir index.js).
//
// Tâches actuelles :
//  • purge des messages non-importants lus depuis > 7 jours
//
// Audit-friendly : chaque tâche logue ses stats via console.log
// (visible dans `wrangler tail`).

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Purge des messages dans la table `documents` (collection 'messages')
 * qui sont :
 *  - non-importants (important !== true)
 *  - déjà lus (read_at non-null)
 *  - lus il y a plus de 7 jours
 *
 * Aussi : nettoie les `friend_requests` 'pending' de plus de 30 jours
 * (auto-expiration des demandes ignorées).
 */
export async function purgeOldMessages(env) {
  const cutoffMs = Date.now() - SEVEN_DAYS_MS;
  const stats = { messages_purged: 0, requests_expired: 0, errors: [] };

  // ── 1) Purge messages non-importants lus
  try {
    const res = await env.DB.prepare(
      `DELETE FROM documents
       WHERE collection = 'messages'
         AND COALESCE(json_extract(data, '$.important'), 0) NOT IN (1, 'true')
         AND json_extract(data, '$.read_at') IS NOT NULL
         AND CAST(json_extract(data, '$.read_at') AS INTEGER) < ?`
    ).bind(cutoffMs).run();
    stats.messages_purged = res.meta?.changes || 0;
  } catch (e) {
    stats.errors.push(`messages: ${e.message}`);
  }

  // ── 2) Expire les friend_requests 'pending' vieilles de > 30 jours
  try {
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const res = await env.DB.prepare(
      `DELETE FROM documents
       WHERE collection = 'friend_requests'
         AND json_extract(data, '$.status') = 'pending'
         AND CAST(json_extract(data, '$.created_at') AS INTEGER) < ?`
    ).bind(cutoff30).run();
    stats.requests_expired = res.meta?.changes || 0;
  } catch (e) {
    stats.errors.push(`friend_requests: ${e.message}`);
  }

  return stats;
}

/**
 * Rotation automatique des bannières gacha (normales).
 * Lit `gacha_config/banners`, si `rotation.next_rotation_at <= now`, on
 * avance le pointeur et on met à jour active_ids / next_ids / next_rotation_at.
 *
 * Idempotent : si la rotation est déjà à jour ou en mode manuel, no-op.
 * Le système IRP a sa propre rotation gérée séparément.
 */
export async function rotateBanners(env) {
  const stats = { rotated: false, from: null, to: null, errors: [] };
  try {
    const row = await env.DB.prepare(
      `SELECT data FROM documents WHERE collection='gacha_config' AND doc_id='banners'`
    ).first();
    if (!row || !row.data) return stats;

    const cfg = JSON.parse(row.data);
    const rot = cfg.rotation || {};
    if (rot.manual_override) {
      // Admin a forcé l'override → on ne touche pas
      return stats;
    }
    const order = rot.banner_order || (cfg.banners || []).map(b => b.id);
    if (!order.length) return stats;

    const nextAt = rot.next_rotation_at ? Date.parse(rot.next_rotation_at) : 0;
    const now = Date.now();
    if (nextAt && nextAt > now) {
      // Pas encore le moment — recalc days_until_next pour l'UI
      const daysLeft = Math.max(0, Math.ceil((nextAt - now) / 86400000));
      cfg.rotation = { ...rot, days_until_next: daysLeft };
      // (pas besoin de réécrire si déjà à jour)
      if (daysLeft !== rot.days_until_next) {
        await env.DB.prepare(
          `UPDATE documents SET data=?, updated_at=unixepoch()
           WHERE collection='gacha_config' AND doc_id='banners'`
        ).bind(JSON.stringify(cfg)).run();
      }
      return stats;
    }

    // ── Rotation effective ────────────────────────────────────────────────
    const step = Math.max(1, Number(rot.active_ids?.length || 2));
    const oldPointer = Number(rot.pointer || 0);
    const newPointer = (oldPointer + step) % order.length;
    const rotDays = Number(rot.rotation_days || 4);
    const nextRot = new Date(now + rotDays * 86400000).toISOString();
    const nowIso = new Date(now).toISOString();

    const activeIds = [];
    const nextIds = [];
    for (let i = 0; i < Math.min(step, order.length); i++) {
      activeIds.push(order[(newPointer + i) % order.length]);
      nextIds.push(order[(newPointer + step + i) % order.length]);
    }

    stats.from = rot.active_ids || [];
    stats.to = activeIds;
    stats.rotated = true;

    cfg.rotation = {
      ...rot,
      pointer:           newPointer,
      active_ids:        activeIds,
      next_ids:          nextIds,
      last_rotation:     nowIso,
      next_rotation_at:  nextRot,
      days_until_next:   rotDays,
      updated_at:        nowIso,
    };
    // Marque active/status dans chaque bannière (l'UI utilise ces 2 champs)
    for (const b of (cfg.banners || [])) {
      b.active = activeIds.includes(b.id);
      b.status = activeIds.includes(b.id) ? "live"
        : (nextIds.includes(b.id) ? "next" : "idle");
    }

    await env.DB.prepare(
      `UPDATE documents SET data=?, updated_at=unixepoch()
       WHERE collection='gacha_config' AND doc_id='banners'`
    ).bind(JSON.stringify(cfg)).run();
  } catch (e) {
    stats.errors.push(`rotateBanners: ${e.message}`);
  }
  return stats;
}


/**
 * Entry point appelé par le scheduler.
 * Cron pattern dans wrangler.toml décide de la fréquence.
 */
export async function handleScheduled(event, env, ctx) {
  const startedAt = Date.now();
  const purge = await purgeOldMessages(env);
  const rot   = await rotateBanners(env);
  const took = Date.now() - startedAt;
  const rotMsg = rot.rotated
    ? ` — rotated banners ${JSON.stringify(rot.from)}→${JSON.stringify(rot.to)}`
    : "";
  console.log(
    `[cron] ${event?.cron || "?"} — purged ${purge.messages_purged} messages, ` +
    `expired ${purge.requests_expired} friend_requests${rotMsg} (${took}ms)` +
    ([...purge.errors, ...rot.errors].length
      ? ` — errors: ${[...purge.errors, ...rot.errors].join("; ")}`
      : "")
  );
  return { purge, rot };
}
