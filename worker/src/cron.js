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
 * Entry point appelé par le scheduler.
 * Cron pattern dans wrangler.toml décide de la fréquence.
 */
export async function handleScheduled(event, env, ctx) {
  const startedAt = Date.now();
  const stats = await purgeOldMessages(env);
  const took = Date.now() - startedAt;
  console.log(
    `[cron] ${event?.cron || "?"} — purged ${stats.messages_purged} messages, ` +
    `expired ${stats.requests_expired} friend_requests (${took}ms)` +
    (stats.errors.length ? ` — errors: ${stats.errors.join("; ")}` : "")
  );
  return stats;
}
